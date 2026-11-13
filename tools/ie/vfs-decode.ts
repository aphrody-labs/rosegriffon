// Classify and decode every non-cfg.bin file of the Inazuma Eleven Victory Road VFS into a
// local SQLite index (var/ie-inventory/ievr-vfs.sqlite). Game data stays local: each CPK is
// extracted into var/ie-work/vfs-tmp/<pack>, inspected with `bunre formats inspect` by a
// pool of worker processes, then the temp tree is deleted. Resumable per pack.
//
//   bun tools/ie/vfs-decode.ts [--light] [--heavy] [--limit N] [--pool N] [--budget-gb N] [--map-only]
//
//   --light      only packs without g4tx/awb (textures and audio banks)
//   --heavy      only packs with g4tx/awb
//   --limit N    stop after N packs (this run)
//   --map-only   only rebuild var/ie-inventory/vfs-map.json from the index
//   --redo a,b   re-run packs with failed files of these extensions (after a decoder fix)
//
// Inputs: var/ie-inventory/ievr-inventory.sqlite (entry table), optional ievr-cfg.sqlite
// (read-only, folded into the map). Env: IEVR_GAME_DIR, BUNRE (default
// $CARGO_TARGET_DIR/release/bunre.exe, copied to var/ie-work/bin before the run).
import { Database } from "bun:sqlite";
import { Glob } from "bun";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statfsSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";

const REPO = join(import.meta.dir, "..", "..");
const INV = join(REPO, "var", "ie-inventory");
const WORK = join(REPO, "var", "ie-work");
const TMP = join(WORK, "vfs-tmp");
const GAME =
  process.env.IEVR_GAME_DIR ??
  "C:/Program Files (x86)/Steam/steamapps/common/INAZUMA ELEVEN Victory Road";
const PACKS = join(GAME, "data", "packs");

const argv = process.argv.slice(2);
const flag = (f: string) => argv.includes(f);
const opt = (f: string, d: number) => {
  const i = argv.indexOf(f);
  return i >= 0 ? Number(argv[i + 1]) : d;
};
const POOL = opt("--pool", availableParallelism());
const BUDGET = opt("--budget-gb", 8) * 1e9;
const LIMIT = opt("--limit", Infinity);
const MAX_EXTRACT = opt("--extractors", 4);
const SUMMARY_MAX = 16 * 1024;
const INSPECT_TIMEOUT_MS = 120_000;

// Formats with no standalone decoder: recorded, never extracted.
const SKIP: Record<string, string> = {
  g4mg: "skip: raw vertex buffer, decoded only with its sibling .g4md",
  usm: "skip: formats::decode has no USM arm (video, 20 GB)",
};
const HEAVY = new Set(["g4tx", "awb"]);

// ---------- classification ----------
const baseExt = (ext: string, path: string) => {
  if (/^r\d+$/.test(ext)) {
    const m = path.replace(/\.r\d+$/, "").match(/\.([a-z0-9]+(?:\.bin)?)$/i);
    return m ? m[1].toLowerCase() : ext;
  }
  return ext;
};
export function classify(
  path: string,
  ext: string,
  format?: string | null,
): string {
  const e = baseExt(ext, path);
  const dir = path.split("/")[2] ?? "";
  if (e === "g4tx" || e === "g4tg") return "texture";
  if (["acb", "awb", "acf"].includes(e)) return "audio";
  if (e === "usm") return "video";
  if (
    ["vfxo", "pfxo", "gfxo", "cfxo", "fxbin"].includes(e) ||
    format === "dxbc"
  )
    return "shader";
  if (e === "p3lip" || e === "lip") return "animation";
  if (["g4cm", "g4ma", "g4la", "g4vs"].includes(e)) return "animation";
  if (e === "col" || e === "g4nv") return "collision";
  if (
    e === "mevbin" ||
    path.endsWith(".lua.bin") ||
    format === "lua-bytecode" ||
    dir === "script"
  )
    return "script";
  if (e === "log" || e === "cfg") return "other";
  if (dir === "text" || dir === "font") return "text";
  if (e === "cfg.bin" || /\.cfg[_.].*bin$/.test(path)) return "data";
  if (dir === "effect") return "effect";
  if (dir === "map") return "map";
  if (dir === "menu") return "ui_layout";
  if (e === "g4pk") return "animation";
  if (["g4md", "g4mg", "g4mt", "g4sk", "g4pkm", "clobin"].includes(e))
    return "model";
  if (e === "objbin") return dir === "chr" ? "model" : "data";
  if (["ptlb", "linb"].includes(e)) return "effect";
  return "other";
}

// ---------- summary truncation ----------
function shrink(v: any, depth: number): any {
  if (v === null || typeof v !== "object")
    return typeof v === "string" && v.length > 200
      ? v.slice(0, 200) + "..."
      : v;
  if (Array.isArray(v)) {
    if (v.length === 0) return v;
    if (typeof v[0] !== "object" || v[0] === null)
      return v.length <= 16 ? v : { $len: v.length, $head: v.slice(0, 8) };
    if (depth <= 0) return { $len: v.length };
    const names = v
      .map((x) => x?.name ?? x?.id ?? x?.cue_id)
      .filter((x) => x !== undefined)
      .slice(0, 64);
    if (v.length <= 4) return v.map((x) => shrink(x, depth - 1));
    return {
      $len: v.length,
      ...(names.length ? { $names: names } : {}),
      $first: shrink(v[0], depth - 1),
    };
  }
  if (depth <= 0) return { $keys: Object.keys(v).slice(0, 32) };
  const o: any = {};
  for (const [k, x] of Object.entries(v)) o[k] = shrink(x, depth - 1);
  return o;
}
export function summarize(raw: string): string {
  if (raw.length <= SUMMARY_MAX) return raw;
  const v = JSON.parse(raw);
  for (const d of [6, 4, 3, 2, 1]) {
    const s = JSON.stringify({ $truncated: raw.length, ...shrink(v, d) });
    if (s.length <= SUMMARY_MAX) return s;
  }
  return JSON.stringify({
    $truncated: raw.length,
    $keys: Object.keys(v ?? {}).slice(0, 64),
  });
}

// ---------- index ----------
const inv = new Database(join(INV, "ievr-inventory.sqlite"), {
  readonly: true,
});
const db = new Database(join(INV, "ievr-vfs.sqlite"));
db.run("PRAGMA journal_mode=WAL");
db.run("PRAGMA busy_timeout=30000"); // readers querying the index mid-run must not fail a pack
db.run(`CREATE TABLE IF NOT EXISTS file(
  path TEXT PRIMARY KEY, pack TEXT, ext TEXT, size INT, class TEXT, format TEXT,
  ok INT, status TEXT, summary_json TEXT, error TEXT, ms INT)`);
db.run("CREATE INDEX IF NOT EXISTS file_pack ON file(pack)");
db.run("CREATE INDEX IF NOT EXISTS file_class ON file(class)");
db.run(`CREATE TABLE IF NOT EXISTS pack_done(pack TEXT PRIMARY KEY, files INT, ok INT, fail INT, skip INT,
  bytes INT, extract_ms INT, total_ms INT, finished_at TEXT)`);

function buildMap() {
  const rows = db
    .query("SELECT path, ext, size, class, status, error FROM file")
    .all() as any[];
  // cfg.bin coverage comes from the cfg pass (read-only); classification by path.
  const cfgPath = join(INV, "ievr-cfg.sqlite");
  const cfgStatus = new Map<string, string | null>();
  if (existsSync(cfgPath)) {
    const c = new Database(cfgPath, { readonly: true });
    for (const r of c.query("SELECT path, error FROM cfg").all() as any[])
      cfgStatus.set(r.path, r.error);
    c.close();
  }
  for (const r of inv
    .query(
      "SELECT path, ext, extract_size size FROM entry WHERE ext = 'cfg.bin'",
    )
    .all() as any[]) {
    const has = cfgStatus.has(r.path);
    const err = cfgStatus.get(r.path);
    rows.push({
      path: r.path,
      ext: r.ext,
      size: r.size,
      class: classify(r.path, r.ext),
      status: !has ? "pending" : err ? "fail" : "ok",
      error: !has ? null : err ? `cfg: ${err.slice(0, 120)}` : null,
    });
  }
  const indexed = new Set(rows.map((r) => r.path));
  for (const r of inv
    .query("SELECT path, ext, extract_size size FROM entry")
    .all() as any[])
    if (!indexed.has(r.path))
      rows.push({
        ...r,
        class: classify(r.path, r.ext),
        status: "pending",
        error: null,
      });

  type Agg = {
    files: number;
    bytes: number;
    ok: number;
    fail: number;
    skip: number;
    pending: number;
    coverage_pct: number;
    errors: Record<string, number>;
    formats?: Record<string, number>;
  };
  const mk = (): Agg => ({
    files: 0,
    bytes: 0,
    ok: 0,
    fail: 0,
    skip: 0,
    pending: 0,
    coverage_pct: 0,
    errors: {},
  });
  const add = (a: Agg, r: any) => {
    a.files++;
    a.bytes += r.size ?? 0;
    a[r.status as "ok"]++;
    if (r.status === "fail" || r.status === "skip") {
      const k = String(r.error ?? "?")
        .split("\n")[0]
        .slice(0, 120);
      a.errors[k] = (a.errors[k] ?? 0) + 1;
    }
  };
  const folders: Record<string, { total: Agg; classes: Record<string, Agg> }> =
    {};
  const classes: Record<string, Agg> = {};
  const exts: Record<string, Agg> = {};
  const total = mk();
  for (const r of rows) {
    const top = r.path.split("/").slice(0, 3).join("/");
    const f = (folders[top] ??= { total: mk(), classes: {} });
    for (const a of [
      total,
      f.total,
      (f.classes[r.class] ??= mk()),
      (classes[r.class] ??= mk()),
      (exts[r.ext] ??= mk()),
    ])
      add(a, r);
  }
  const fin = (a: Agg) => {
    a.coverage_pct = a.files ? +((100 * a.ok) / a.files).toFixed(2) : 0;
  };
  [total, ...Object.values(classes), ...Object.values(exts)].forEach(fin);
  for (const f of Object.values(folders)) {
    fin(f.total);
    Object.values(f.classes).forEach(fin);
  }
  const map = {
    generated_at: new Date().toISOString(),
    note: "coverage_pct = decoded ok / all files; cfg.bin status from ievr-cfg.sqlite; skip = no standalone decoder",
    packs_done: (db.query("SELECT COUNT(*) n FROM pack_done").get() as any).n,
    packs_total: (
      inv.query("SELECT COUNT(DISTINCT pack) n FROM entry").get() as any
    ).n,
    total,
    by_class: classes,
    by_ext: exts,
    by_folder: folders,
    by_format: db
      .query(
        "SELECT format, COUNT(*) n FROM file WHERE ok = 1 GROUP BY format ORDER BY n DESC",
      )
      .all(),
  };
  Bun.write(join(INV, "vfs-map.json"), JSON.stringify(map, null, 2));
  return map;
}

if (flag("--map-only")) {
  const m = buildMap();
  console.log(
    JSON.stringify({ total: m.total, packs_done: m.packs_done }, null, 2),
  );
  process.exit(0);
}

// Private copy of bunre: a concurrent `cargo build` must not pull the binary from under the pool.
const BUNRE_SRC =
  process.env.BUNRE ??
  join(
    process.env.CARGO_TARGET_DIR ?? join(REPO, "target"),
    "release",
    "bunre.exe",
  );
const BUNRE = join(WORK, "bin", "bunre.exe");
mkdirSync(join(WORK, "bin"), { recursive: true });
if (existsSync(BUNRE_SRC)) copyFileSync(BUNRE_SRC, BUNRE);
if (!existsSync(BUNRE)) throw new Error(`bunre not found: ${BUNRE_SRC}`);

// ---------- concurrency primitives ----------
class Sem {
  private q: (() => void)[] = [];
  constructor(private n: number) {}
  async take() {
    if (this.n > 0) {
      this.n--;
      return;
    }
    await new Promise<void>((r) => this.q.push(r));
  }
  give() {
    const r = this.q.shift();
    if (r) r();
    else this.n++;
  }
}
const inspectSem = new Sem(POOL);
const extractSem = new Sem(MAX_EXTRACT);
let budgetUsed = 0;
const budgetWait: (() => void)[] = [];
async function reserve(bytes: number) {
  const b = Math.min(bytes, BUDGET);
  while (budgetUsed > 0 && budgetUsed + b > BUDGET)
    await new Promise<void>((r) => budgetWait.push(r));
  budgetUsed += b;
  return b;
}
function release(b: number) {
  budgetUsed -= b;
  budgetWait.splice(0).forEach((r) => r());
}

async function run(cmd: string[], timeout = 0) {
  const p = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    windowsHide: true,
  });
  const t = timeout ? setTimeout(() => p.kill(), timeout) : null;
  const [out, err] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
  ]);
  await p.exited;
  if (t) clearTimeout(t);
  return {
    code: p.exitCode ?? -1,
    out,
    err: err.trim() || (p.signalCode ? `killed ${p.signalCode}` : ""),
  };
}

// ---------- per pack ----------
const ins = db.prepare(
  "INSERT OR REPLACE INTO file VALUES (?,?,?,?,?,?,?,?,?,?,?)",
);
const insPack = db.prepare(
  "INSERT OR REPLACE INTO pack_done VALUES (?,?,?,?,?,?,?,?,?)",
);
type Ent = { path: string; ext: string; size: number };

async function doPack(pack: string, ents: Ent[]) {
  const t0 = performance.now();
  const work = ents.filter((e) => !SKIP[e.ext]);
  const bytes = work.reduce((s, e) => s + e.size, 0);
  const rows: any[][] = ents
    .filter((e) => SKIP[e.ext])
    .map((e) => [
      e.path,
      pack,
      e.ext,
      e.size,
      classify(e.path, e.ext),
      e.ext,
      0,
      "skip",
      null,
      SKIP[e.ext],
      0,
    ]);
  let extractMs = 0;
  if (work.length) {
    const suffixes = [
      ...new Set(work.map((e) => "." + (/^r\d+$/.test(e.ext) ? e.ext : e.ext))),
    ].join(",");
    const dir = join(TMP, pack.replace(/\.cpk$/, ""));
    rmSync(dir, { recursive: true, force: true });
    const held = await reserve(bytes);
    try {
      await extractSem.take();
      const te = performance.now();
      let ex;
      try {
        ex = await run([
          BUNRE,
          "formats",
          "cpk-extract-all",
          join(PACKS, pack),
          dir,
          "--suffix",
          suffixes,
        ]);
      } finally {
        extractSem.give();
      }
      extractMs = Math.round(performance.now() - te);
      const exErr =
        ex.code !== 0 ? `extract: ${ex.err || "exit " + ex.code}` : null;
      await Promise.all(
        work.map(async (e) => {
          const file = join(dir, e.path);
          const cls = classify(e.path, e.ext);
          if (!existsSync(file)) {
            rows.push([
              e.path,
              pack,
              e.ext,
              e.size,
              cls,
              null,
              0,
              "fail",
              null,
              exErr ?? "extract: member not written",
              0,
            ]);
            return;
          }
          await inspectSem.take();
          const ti = performance.now();
          let r;
          try {
            r = await run(
              [BUNRE, "formats", "inspect", file],
              INSPECT_TIMEOUT_MS,
            );
          } finally {
            inspectSem.give();
          }
          const ms = Math.round(performance.now() - ti);
          if (r.code !== 0) {
            rows.push([
              e.path,
              pack,
              e.ext,
              e.size,
              cls,
              null,
              0,
              "fail",
              null,
              r.err.replace(/^bunre formats: /, "") || `exit ${r.code}`,
              ms,
            ]);
            return;
          }
          try {
            const nl = r.out.indexOf(',"data":');
            const format = JSON.parse(r.out.slice(0, nl) + "}")
              .format as string;
            const data = r.out.slice(nl + 8, r.out.lastIndexOf("}"));
            rows.push([
              e.path,
              pack,
              e.ext,
              e.size,
              classify(e.path, e.ext, format),
              format,
              1,
              "ok",
              summarize(data),
              null,
              ms,
            ]);
          } catch (err) {
            rows.push([
              e.path,
              pack,
              e.ext,
              e.size,
              cls,
              null,
              0,
              "fail",
              null,
              `json: ${(err as Error).message}`,
              ms,
            ]);
          }
        }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
      release(held);
    }
  }
  const c = { ok: 0, fail: 0, skip: 0 } as Record<string, number>;
  for (const r of rows) c[r[7]]++;
  db.transaction(() => {
    db.run("DELETE FROM file WHERE pack = ?", [pack]);
    for (const r of rows) ins.run(...r);
    insPack.run(
      pack,
      rows.length,
      c.ok,
      c.fail,
      c.skip,
      bytes,
      extractMs,
      Math.round(performance.now() - t0),
      new Date().toISOString(),
    );
  })();
  return { bytes, ...c, n: rows.length };
}

// ---------- schedule ----------
const all = inv
  .query(
    "SELECT pack, path, ext, extract_size size FROM entry WHERE ext != 'cfg.bin' ORDER BY pack",
  )
  .all() as any[];
const byPack = new Map<string, Ent[]>();
for (const r of all)
  (byPack.get(r.pack) ?? byPack.set(r.pack, []).get(r.pack)!).push(r);
const redoAt = argv.indexOf("--redo");
if (redoAt >= 0) {
  // After a decoder fix: forget packs holding failures of these extensions so they run again.
  const exts = String(argv[redoAt + 1] ?? "")
    .split(",")
    .filter(Boolean);
  const q = `DELETE FROM pack_done WHERE pack IN (SELECT DISTINCT pack FROM file WHERE status = 'fail' AND ext IN (${exts.map(() => "?").join(",")}))`;
  if (exts.length)
    console.log(`redo ${exts.join(",")}: ${db.run(q, exts).changes} packs`);
}
const done = new Set(
  (db.query("SELECT pack FROM pack_done").all() as any[]).map((r) => r.pack),
);
let queue = [...byPack]
  .filter(([p]) => !done.has(p))
  .map(([pack, ents]) => ({
    pack,
    ents,
    heavy: ents.some((e) => HEAVY.has(e.ext)),
    bytes: ents.reduce((s, e) => s + (SKIP[e.ext] ? 0 : e.size), 0),
  }));
if (flag("--light")) queue = queue.filter((q) => !q.heavy);
if (flag("--heavy")) queue = queue.filter((q) => q.heavy);
// light first, then heavy by descending size so the big ones do not form the tail
queue.sort(
  (a, b) =>
    Number(a.heavy) - Number(b.heavy) ||
    (a.heavy ? b.bytes - a.bytes : a.bytes - b.bytes),
);
queue = queue.slice(0, LIMIT);

mkdirSync(TMP, { recursive: true });
const totalBytes = queue.reduce((s, q) => s + q.bytes, 0);
const totalFiles = queue.reduce((s, q) => s + q.ents.length, 0);
console.log(
  `packs ${queue.length} (done ${done.size}), files ${totalFiles}, extract ${(totalBytes / 1e9).toFixed(1)} GB, pool ${POOL}, extractors ${MAX_EXTRACT}, budget ${(BUDGET / 1e9).toFixed(0)} GB`,
);
const T0 = performance.now();
let doneBytes = 0,
  doneFiles = 0,
  donePacks = 0;
const agg = { ok: 0, fail: 0, skip: 0 };
let qi = 0;
async function lane() {
  while (qi < queue.length) {
    const q = queue[qi++];
    const free = statfsSync(WORK).bavail * statfsSync(WORK).bsize;
    if (free < Math.min(q.bytes, BUDGET) + 3e9) {
      console.error(
        `low disk (${(free / 1e9).toFixed(1)} GB free), stopping before ${q.pack}`,
      );
      qi = queue.length;
      return;
    }
    try {
      const r = await doPack(q.pack, q.ents);
      doneBytes += r.bytes;
      doneFiles += r.n;
      donePacks++;
      agg.ok += r.ok;
      agg.fail += r.fail;
      agg.skip += r.skip;
    } catch (err) {
      console.error(`pack ${q.pack}: ${(err as Error).message}`);
    }
    const s = (performance.now() - T0) / 1000;
    const rate = doneBytes / s;
    if (donePacks % 10 === 0 || donePacks === queue.length)
      console.log(
        `[${donePacks}/${queue.length}] files ${doneFiles} ok ${agg.ok} fail ${agg.fail} skip ${agg.skip} | ${(doneBytes / 1e9).toFixed(2)} GB ${(rate / 1e6).toFixed(0)} MB/s ${(doneFiles / s).toFixed(0)} f/s | ETA ${rate ? ((totalBytes - doneBytes) / rate / 60).toFixed(0) : "?"} min`,
      );
  }
}
await Promise.all(Array.from({ length: MAX_EXTRACT + 2 }, lane));
const m = buildMap();
console.log(
  `done in ${((performance.now() - T0) / 1000).toFixed(0)} s; index coverage ${m.total.coverage_pct}% (${m.total.ok}/${m.total.files}), packs ${m.packs_done}/${m.packs_total}`,
);
