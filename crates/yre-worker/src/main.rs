//! Rust lane of the yolo-re job queue.
//!
//! Protocol (shared with the Bun and Python lanes, see `tools/data/jobs.ts`):
//! jobs are Redis Stream entries on `yre:jobs:<lane>` (fields `id`, `kind`, `payload`), read
//! through consumer group `workers`; each finished job is acknowledged and its result appended to
//! `yre:results` (fields `id`, `lane`, `kind`, `worker`, `status`, `result`, `ms`). Entries left
//! pending by a dead worker are reclaimed with `XAUTOCLAIM` after `RECLAIM_MS`.
//!
//! Job kinds:
//! - `disasm.calls`: payload `{"exe": path, "ranges": [[start_va, end_va], ...]}`. Decodes each
//!   range with iced-x86 and returns `{"edges": [[fn_va, site_va, target_va, kind], ...]}` where
//!   kind is `call` / `jmp` (direct near branches leaving the range) or `data` (RIP-relative
//!   memory operands and `lea` targets).
//!
//!   yre-worker [--redis URL] [--lane rust] [--name NAME]   (URL also from YRE_REDIS_URL)

use std::collections::HashMap;
use std::time::Instant;

use anyhow::{Context, Result, bail};
use goblin::pe::PE;
use iced_x86::{Decoder, DecoderOptions, FlowControl, Instruction, OpKind};
use redis::streams::{StreamReadOptions, StreamReadReply};
use redis::{Commands, Connection, Value};
use serde_json::{Value as Json, json};

const GROUP: &str = "workers";
const RESULTS: &str = "yre:results";
const RECLAIM_MS: u64 = 300_000;

struct Image {
    base: u64,
    bytes: Vec<u8>,
    /// (va, vsize, raw offset, raw size) per section.
    sections: Vec<(u64, u64, usize, usize)>,
}

impl Image {
    fn load(path: &str) -> Result<Self> {
        let bytes = std::fs::read(path).with_context(|| format!("read {path}"))?;
        let pe = PE::parse(&bytes).context("parse PE")?;
        let base = pe.image_base;
        let sections = pe
            .sections
            .iter()
            .map(|s| {
                (
                    base + u64::from(s.virtual_address),
                    u64::from(s.virtual_size),
                    s.pointer_to_raw_data as usize,
                    s.size_of_raw_data as usize,
                )
            })
            .collect();
        Ok(Self {
            base,
            bytes,
            sections,
        })
    }

    fn slice(&self, start: u64, end: u64) -> Option<&[u8]> {
        let &(va, _, raw, raw_len) = self
            .sections
            .iter()
            .find(|&&(va, vsize, _, _)| start >= va && start < va + vsize)?;
        let off = raw + (start - va) as usize;
        let len = ((end - start) as usize).min(raw + raw_len - off.min(raw + raw_len));
        self.bytes.get(off..off + len)
    }
}

fn disasm_calls(images: &mut HashMap<String, Image>, payload: &Json) -> Result<Json> {
    let exe = payload["exe"].as_str().context("payload.exe")?;
    if !images.contains_key(exe) {
        images.insert(exe.to_owned(), Image::load(exe)?);
    }
    let image = &images[exe];
    let ranges = payload["ranges"].as_array().context("payload.ranges")?;
    let mut edges = Vec::new();
    let mut instructions = 0u64;
    let mut instr = Instruction::default();
    for r in ranges {
        let (Some(start), Some(end)) = (r[0].as_u64(), r[1].as_u64()) else {
            bail!("range must be [start_va, end_va]");
        };
        let Some(code) = image.slice(start, end) else {
            continue;
        };
        let mut decoder = Decoder::with_ip(64, code, start, DecoderOptions::NONE);
        while decoder.can_decode() {
            decoder.decode_out(&mut instr);
            if instr.is_invalid() {
                continue;
            }
            instructions += 1;
            let site = instr.ip();
            match instr.flow_control() {
                FlowControl::Call
                | FlowControl::UnconditionalBranch
                | FlowControl::ConditionalBranch
                    if instr.op0_kind() == OpKind::NearBranch64 =>
                {
                    let target = instr.near_branch_target();
                    let is_call = instr.flow_control() == FlowControl::Call;
                    if is_call || target < start || target >= end {
                        edges.push(json!([
                            start,
                            site,
                            target,
                            if is_call { "call" } else { "jmp" }
                        ]));
                    }
                }
                _ => {}
            }
            if instr.is_ip_rel_memory_operand() {
                let target = instr.ip_rel_memory_address();
                if target >= image.base {
                    edges.push(json!([start, site, target, "data"]));
                }
            }
        }
    }
    Ok(json!({ "edges": edges, "instructions": instructions, "ranges": ranges.len() }))
}

fn field(map: &HashMap<String, Value>, k: &str) -> Option<String> {
    match map.get(k)? {
        Value::BulkString(b) => Some(String::from_utf8_lossy(b).into_owned()),
        Value::SimpleString(s) => Some(s.clone()),
        _ => None,
    }
}

fn handle(
    con: &mut Connection,
    images: &mut HashMap<String, Image>,
    lane: &str,
    worker: &str,
    key: &str,
    entry_id: &str,
    map: &HashMap<String, Value>,
) -> Result<()> {
    let t0 = Instant::now();
    let id = field(map, "id").unwrap_or_default();
    let kind = field(map, "kind").unwrap_or_default();
    let payload: Json =
        serde_json::from_str(&field(map, "payload").unwrap_or_else(|| "null".into()))
            .unwrap_or(Json::Null);
    let outcome = match kind.as_str() {
        "disasm.calls" => disasm_calls(images, &payload),
        other => Err(anyhow::anyhow!("unknown job kind {other:?} on lane {lane}")),
    };
    let (status, result) = match outcome {
        Ok(v) => ("ok", v),
        Err(e) => ("error", json!({ "error": format!("{e:#}") })),
    };
    let ms = t0.elapsed().as_millis() as u64;
    let _: String = con.xadd(
        RESULTS,
        "*",
        &[
            ("id", id.as_str()),
            ("lane", lane),
            ("kind", kind.as_str()),
            ("worker", worker),
            ("status", status),
            ("result", &result.to_string()),
            ("ms", &ms.to_string()),
        ],
    )?;
    let _: i64 = con.xack(key, GROUP, &[entry_id])?;
    let _: i64 = con.xdel(key, &[entry_id])?;
    eprintln!("{worker}: {kind} {id} {status} {ms} ms");
    Ok(())
}

fn main() -> Result<()> {
    let mut args = std::env::args().skip(1);
    let mut url = std::env::var("YRE_REDIS_URL").ok();
    let mut lane = "rust".to_owned();
    let mut name = format!("rust-{}", std::process::id());
    while let Some(a) = args.next() {
        match a.as_str() {
            "--redis" => url = args.next(),
            "--lane" => lane = args.next().context("--lane")?,
            "--name" => name = args.next().context("--name")?,
            _ => bail!("usage: yre-worker [--redis URL] [--lane rust] [--name NAME]"),
        }
    }
    let url = url.context("YRE_REDIS_URL or --redis is required")?;
    let mut con = redis::Client::open(url)?.get_connection()?;
    let key = format!("yre:jobs:{lane}");
    let created: redis::RedisResult<String> = redis::cmd("XGROUP")
        .arg("CREATE")
        .arg(&key)
        .arg(GROUP)
        .arg("$")
        .arg("MKSTREAM")
        .query(&mut con);
    if let Err(e) = created
        && e.code() != Some("BUSYGROUP")
    {
        return Err(e.into());
    }
    eprintln!("{name}: listening on {key}");
    let mut images = HashMap::new();
    loop {
        // Reclaim entries a dead worker left pending, then read new ones.
        let claimed: Value = redis::cmd("XAUTOCLAIM")
            .arg(&key)
            .arg(GROUP)
            .arg(&name)
            .arg(RECLAIM_MS)
            .arg("0-0")
            .arg("COUNT")
            .arg(1)
            .query(&mut con)?;
        let mut work: Vec<(String, HashMap<String, Value>)> = Vec::new();
        if let Value::Array(parts) = &claimed
            && let Some(Value::Array(entries)) = parts.get(1)
        {
            for e in entries {
                if let Value::Array(kv) = e
                    && let (Some(Value::BulkString(id)), Some(Value::Array(fields))) =
                        (kv.first(), kv.get(1))
                {
                    let mut m = HashMap::new();
                    for pair in fields.chunks(2) {
                        if let (Value::BulkString(k), Some(v)) = (&pair[0], pair.get(1)) {
                            m.insert(String::from_utf8_lossy(k).into_owned(), v.clone());
                        }
                    }
                    work.push((String::from_utf8_lossy(id).into_owned(), m));
                }
            }
        }
        if work.is_empty() {
            let opts = StreamReadOptions::default()
                .group(GROUP, &name)
                .count(1)
                .block(5000);
            let reply: Option<StreamReadReply> = con.xread_options(&[&key], &[">"], &opts)?;
            for s in reply.map(|r| r.keys).unwrap_or_default() {
                for e in s.ids {
                    work.push((e.id, e.map));
                }
            }
        }
        for (entry_id, map) in work {
            handle(&mut con, &mut images, &lane, &name, &key, &entry_id, &map)?;
        }
    }
}
