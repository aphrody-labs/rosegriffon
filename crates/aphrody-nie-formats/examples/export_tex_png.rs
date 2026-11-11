//! Exports `.g4tx` textures of the VFS as PNG, byte-identical to what `nie-model-serve` returns
//! for `GET /tex/<rel>.png` (same call: `g4tx_decode::decode_best_to_png(data, basename)`), or for
//! the named form `GET /tex/<rel>.g4tx/<name>.png` (`decode_named_to_png`).
//!
//! ```text
//! NIE_GAME_DIR=… cargo run --release -p aphrody-nie-formats --features textures \
//!   --example export_tex_png -- <out-dir> (--prefix dx11/menu/ | --list paths.txt) [--threads 8]
//! ```
//! `--list`: one path per line, as served (`dx11/…/x.png`, `/tex/dx11/…/x.png`,
//! `https://cdn…/dx11/…/x.png` or `dx11/…/x.g4tx/name.png`). Output: `<out>/<rel>.png` and
//! `<out>/manifest.jsonl` (`{"path","bytes","sha256"}` per file, `{"path","error"}` when the
//! texture is missing or does not decode). Existing files are kept (resumable).

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use aphrody_nie_formats::g4tx_decode;
use aphrody_nie_formats::vfs;
use sha2::{Digest, Sha256};

/// One requested image: the served relative path (`dx11/…/x.png` or `dx11/…/x.g4tx/name.png`).
fn normalize(line: &str) -> Option<String> {
    let s = line.trim();
    if s.is_empty() || s.starts_with('#') {
        return None;
    }
    let s = s.split(['?', '#']).next().unwrap_or(s);
    let s = s.find("/dx11/").map_or(s, |i| &s[i + 1..]);
    let s = s.strip_prefix("tex/").unwrap_or(s).trim_start_matches('/');
    let s = s.strip_prefix("data/").unwrap_or(s);
    (s.starts_with("dx11/") && s.ends_with(".png") && !s.contains("..")).then(|| s.to_string())
}

fn decode(vfs: &vfs::Vfs, rel: &str) -> Result<Vec<u8>, String> {
    let (container, name) = match rel.split_once(".g4tx/") {
        Some((c, n)) => (format!("data/{c}.g4tx"), Some(n.trim_end_matches(".png"))),
        None => (format!("data/{}.g4tx", rel.trim_end_matches(".png")), None),
    };
    let data = vfs.read(&container).map_err(|e| format!("read {container}: {e}"))?;
    match name {
        Some(n) => g4tx_decode::decode_named_to_png(&data, n),
        None => g4tx_decode::decode_best_to_png(&data, g4tx_decode::basename_of(&container)),
    }
    .ok_or_else(|| "not decoded".to_string())
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let flag = |n: &str| args.iter().position(|a| a == n).and_then(|i| args.get(i + 1)).cloned();
    let out = PathBuf::from(args.first().expect("usage: export_tex_png <out-dir> (--prefix P | --list F) [--threads N]"));
    let threads: usize = flag("--threads").and_then(|t| t.parse().ok()).unwrap_or(8);

    let probe = vfs::open_game().expect("open game VFS (NIE_GAME_DIR)");
    let mut wanted: Vec<String> = if let Some(list) = flag("--list") {
        std::fs::read_to_string(&list).expect("read --list").lines().filter_map(normalize).collect()
    } else {
        let prefix = flag("--prefix").unwrap_or_else(|| "dx11/".into());
        let prefix = format!("data/{}", prefix.trim_start_matches('/').trim_start_matches("data/"));
        probe
            .iter()
            .map(|(p, _)| p)
            .filter(|p| p.starts_with(&prefix) && p.ends_with(".g4tx"))
            .map(|p| format!("{}.png", p.trim_start_matches("data/").trim_end_matches(".g4tx")))
            .collect()
    };
    drop(probe);
    wanted.sort();
    wanted.dedup();
    eprintln!("{} textures to export into {}", wanted.len(), out.display());

    std::fs::create_dir_all(&out).expect("create out dir");
    let manifest = Arc::new(Mutex::new(
        std::fs::OpenOptions::new().create(true).append(true).open(out.join("manifest.jsonl")).expect("manifest"),
    ));
    let wanted = Arc::new(wanted);
    let next = Arc::new(AtomicUsize::new(0));
    let (ok, failed) = (Arc::new(AtomicUsize::new(0)), Arc::new(AtomicUsize::new(0)));
    let workers: Vec<_> = (0..threads)
        .map(|_| {
            let (wanted, next, manifest, out) = (wanted.clone(), next.clone(), manifest.clone(), out.clone());
            let (ok, failed) = (ok.clone(), failed.clone());
            std::thread::spawn(move || {
                let vfs = vfs::open_game().expect("open game VFS");
                loop {
                    let i = next.fetch_add(1, Ordering::Relaxed);
                    let Some(rel) = wanted.get(i) else { break };
                    let dest = out.join(Path::new(rel));
                    if dest.exists() {
                        ok.fetch_add(1, Ordering::Relaxed);
                        continue;
                    }
                    let line = match decode(&vfs, rel) {
                        Ok(png) => {
                            if let Some(dir) = dest.parent() {
                                let _ = std::fs::create_dir_all(dir);
                            }
                            let tmp = dest.with_extension("png.tmp");
                            std::fs::write(&tmp, &png).and_then(|()| std::fs::rename(&tmp, &dest)).expect("write png");
                            ok.fetch_add(1, Ordering::Relaxed);
                            let sha = hex(&Sha256::digest(&png));
                            serde_json::json!({ "path": rel, "bytes": png.len(), "sha256": sha })
                        }
                        Err(e) => {
                            failed.fetch_add(1, Ordering::Relaxed);
                            serde_json::json!({ "path": rel, "error": e })
                        }
                    };
                    let mut m = manifest.lock().unwrap();
                    let _ = writeln!(m, "{line}");
                    let done = ok.load(Ordering::Relaxed) + failed.load(Ordering::Relaxed);
                    if done % 1000 == 0 {
                        eprintln!("{done}/{}", wanted.len());
                    }
                }
            })
        })
        .collect();
    for w in workers {
        w.join().expect("worker");
    }
    eprintln!("done: {} ok, {} failed", ok.load(Ordering::Relaxed), failed.load(Ordering::Relaxed));
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
