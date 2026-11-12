// SPDX-License-Identifier: Apache-2.0
/**
 * Steam install index driver. Runs the Rust `steam-index` binary (bun-steam parsers) and stores
 * the result in SQLite with bun:sqlite. File hashing is resumable: rows whose size and mtime are
 * unchanged keep their blake3, so an interrupted run continues where it stopped.
 *
 *   bun tools/steam-index/index.ts [--steam <root>] [--db <path>] [--hash] [--vault]   (--hash: remote only, see remote-hash.sh)
 *
 * `--vault` writes STEAM_ACCOUNT_NAME and STEAM_ID (identifiers, most recent loginusers.vdf
 * account) to the env-kit vault. Values are never printed.
 */
import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const STEAM = opt("--steam", "C:/Program Files (x86)/Steam");
const DB_PATH = opt(
  "--db",
  join(homedir(), ".local", "share", "nie", "steam-index.sqlite"),
);
const BIN = opt(
  "--bin",
  join(
    import.meta.dir,
    "target",
    "release",
    process.platform === "win32" ? "steam-index.exe" : "steam-index",
  ),
);

async function run(cmd: string[]): Promise<string> {
  const p = Bun.spawn(cmd, { stdout: "pipe", stderr: "inherit" });
  const out = await new Response(p.stdout).text();
  if ((await p.exited) !== 0) throw new Error(`${cmd[0]} ${cmd[1]} failed`);
  return out;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS libraries (idx TEXT, path TEXT PRIMARY KEY, label TEXT, total_size INTEGER, app_count INTEGER);
CREATE TABLE IF NOT EXISTS apps (appid INTEGER PRIMARY KEY, name TEXT, installdir TEXT, library TEXT, install_path TEXT,
  exists_on_disk INTEGER, size_on_disk INTEGER, buildid INTEGER, state_flags INTEGER, last_updated INTEGER, acf_path TEXT);
CREATE TABLE IF NOT EXISTS app_depots (appid INTEGER, depot INTEGER, manifest TEXT, size INTEGER, PRIMARY KEY (appid, depot));
CREATE TABLE IF NOT EXISTS depotcache (path TEXT PRIMARY KEY, depot INTEGER, gid TEXT, size INTEGER);
CREATE TABLE IF NOT EXISTS pics_apps (appid INTEGER PRIMARY KEY, name TEXT, type TEXT, change_number INTEGER, last_updated INTEGER);
CREATE TABLE IF NOT EXISTS pics_packages (packageid INTEGER PRIMARY KEY, change_number INTEGER, appids TEXT, depotids TEXT);
CREATE TABLE IF NOT EXISTS workshop (appid INTEGER, item TEXT, size INTEGER, timeupdated INTEGER, manifest TEXT, path TEXT,
  exists_on_disk INTEGER, library TEXT, PRIMARY KEY (appid, item));
CREATE TABLE IF NOT EXISTS compat_tools (name TEXT, path TEXT PRIMARY KEY, source TEXT);
CREATE TABLE IF NOT EXISTS controller_configs (path TEXT PRIMARY KEY, size INTEGER);
CREATE TABLE IF NOT EXISTS userdata (account_id TEXT, config_file TEXT, PRIMARY KEY (account_id, config_file));
CREATE TABLE IF NOT EXISTS credential_artifacts (path TEXT PRIMARY KEY, size INTEGER, blake3 TEXT, error TEXT);
CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, appid INTEGER, size INTEGER, mtime_ms INTEGER,
  blake3 TEXT, error TEXT, hashed_at INTEGER);
CREATE INDEX IF NOT EXISTS files_appid ON files (appid);
CREATE INDEX IF NOT EXISTS files_pending ON files (blake3) WHERE blake3 IS NULL;
`;

// biome-ignore lint/suspicious/noExplicitAny: JSON emitted by the Rust half.
type J = any;

function storeMetadata(db: Database, d: J) {
  const ins = (sql: string) => db.prepare(sql);
  db.transaction(() => {
    for (const t of [
      "libraries",
      "apps",
      "app_depots",
      "depotcache",
      "pics_apps",
      "pics_packages",
      "workshop",
      "compat_tools",
      "controller_configs",
      "userdata",
      "credential_artifacts",
    ])
      db.run(`DELETE FROM ${t}`);
    const lib = ins("INSERT OR REPLACE INTO libraries VALUES (?,?,?,?,?)");
    for (const l of d.libraries)
      lib.run(l.index, l.path, l.label, l.total_size ?? null, l.app_count);
    const app = ins("INSERT OR REPLACE INTO apps VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    const dep = ins("INSERT OR REPLACE INTO app_depots VALUES (?,?,?,?)");
    for (const a of d.apps) {
      app.run(
        a.appid,
        a.name,
        a.installdir,
        a.library,
        a.install_path,
        a.exists ? 1 : 0,
        a.size_on_disk,
        a.buildid,
        a.state_flags,
        a.last_updated,
        a.acf_path,
      );
      for (const x of a.depots)
        dep.run(a.appid, Number(x.depot), x.manifest ?? null, x.size ?? null);
    }
    const dc = ins("INSERT OR REPLACE INTO depotcache VALUES (?,?,?,?)");
    for (const x of d.depotcache) dc.run(x.path, Number(x.depot), x.gid, x.size);
    const pa = ins("INSERT OR REPLACE INTO pics_apps VALUES (?,?,?,?,?)");
    for (const x of d.appinfo?.apps ?? [])
      pa.run(x.appid, x.name ?? null, x.type ?? null, x.change, x.last_updated);
    const pp = ins("INSERT OR REPLACE INTO pics_packages VALUES (?,?,?,?)");
    for (const x of d.packageinfo?.packages ?? [])
      pp.run(
        x.packageid,
        x.change,
        JSON.stringify(x.appids),
        JSON.stringify(x.depotids),
      );
    const ws = ins("INSERT OR REPLACE INTO workshop VALUES (?,?,?,?,?,?,?,?)");
    for (const x of d.workshop)
      ws.run(
        Number(x.appid),
        x.item,
        x.size ?? null,
        x.timeupdated ?? null,
        x.manifest ?? null,
        x.path,
        x.exists ? 1 : 0,
        x.library,
      );
    const ct = ins("INSERT OR REPLACE INTO compat_tools VALUES (?,?,?)");
    for (const x of d.compat_tools) ct.run(x.name, x.path, x.source);
    const cc = ins("INSERT OR REPLACE INTO controller_configs VALUES (?,?)");
    for (const x of d.controller_configs) cc.run(x.path, x.size);
    const ud = ins("INSERT OR REPLACE INTO userdata VALUES (?,?)");
    for (const u of d.userdata)
      for (const f of u.config_files) ud.run(u.account_id, f);
    const cr = ins("INSERT OR REPLACE INTO credential_artifacts VALUES (?,?,?,?)");
    for (const x of d.credential_artifacts)
      cr.run(x.path, x.size ?? null, x.blake3 ?? null, x.error ?? null);
    const m = ins("INSERT OR REPLACE INTO meta VALUES (?,?)");
    m.run("steam_root", d.steam_root);
    m.run("scanned_at", new Date().toISOString());
    m.run("appinfo_version", String(d.appinfo?.version ?? ""));
    m.run("packageinfo_version", String(d.packageinfo?.version ?? ""));
  })();
}

/** Registers every file of every installed game; resets the hash when size or mtime changed. */
function inventory(db: Database, apps: J[]) {
  const get = db.prepare("SELECT size, mtime_ms FROM files WHERE path = ?");
  const up = db.prepare(
    `INSERT INTO files (path, appid, size, mtime_ms) VALUES (?,?,?,?)
     ON CONFLICT(path) DO UPDATE SET appid=excluded.appid, size=excluded.size, mtime_ms=excluded.mtime_ms,
       blake3=NULL, error=NULL, hashed_at=NULL`,
  );
  let seen = 0;
  for (const a of apps) {
    if (!a.exists) continue;
    const entries = readdirSync(a.install_path, {
      recursive: true,
      withFileTypes: true,
    });
    db.transaction(() => {
      for (const e of entries) {
        if (!e.isFile()) continue;
        const p = join(e.parentPath, e.name);
        let st: ReturnType<typeof statSync>;
        try {
          st = statSync(p);
        } catch {
          continue;
        }
        seen++;
        const mt = Math.trunc(st.mtimeMs);
        const row = get.get(p) as { size: number; mtime_ms: number } | null;
        if (!row || row.size !== st.size || row.mtime_ms !== mt)
          up.run(p, a.appid, st.size, mt);
      }
    })();
  }
  return seen;
}

async function hashPending(db: Database) {
  const pending = db
    .query("SELECT path FROM files WHERE blake3 IS NULL AND error IS NULL ORDER BY path")
    .all() as { path: string }[];
  console.log(`hash: ${pending.length} pending`);
  if (!pending.length) return;
  const proc = Bun.spawn([BIN, "hash"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
  });
  const set = db.prepare(
    "UPDATE files SET blake3 = ?, error = ?, hashed_at = ? WHERE path = ?",
  );
  const feeder = (async () => {
    for (const r of pending) proc.stdin.write(`${r.path}\n`);
    await proc.stdin.end();
  })();
  let batch: J[] = [];
  let done = 0;
  const flush = () => {
    const now = Date.now();
    db.transaction(() => {
      for (const r of batch) set.run(r.blake3 ?? null, r.error ?? null, now, r.path);
    })();
    done += batch.length;
    batch = [];
  };
  let buf = "";
  let last = Date.now();
  const dec = new TextDecoder();
  for await (const chunk of proc.stdout) {
    buf += dec.decode(chunk, { stream: true });
    let i = buf.indexOf("\n");
    while (i >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (line) batch.push(JSON.parse(line));
      i = buf.indexOf("\n");
    }
    if (batch.length >= 500 || Date.now() - last > 2000) {
      flush();
      last = Date.now();
      console.log(`hash: ${done}/${pending.length}`);
    }
  }
  flush();
  await feeder;
  await proc.exited;
  console.log(`hash: ${done}/${pending.length} done`);
}

async function vault() {
  const { upsertEnvFileKey, DEFAULT_MONOREPO_ENV_PATH } = await import(
    "C:/src/packages/env-kit/src/index.ts"
  );
  const acct = JSON.parse(await run([BIN, "account", STEAM]));
  if (!acct?.account_name || !acct?.steam_id) {
    console.log("vault: no account found in loginusers.vdf");
    return;
  }
  const envPath = DEFAULT_MONOREPO_ENV_PATH;
  upsertEnvFileKey(envPath, "STEAM_ACCOUNT_NAME", acct.account_name);
  upsertEnvFileKey(envPath, "STEAM_ID", acct.steam_id);
  console.log("vault: set STEAM_ACCOUNT_NAME, STEAM_ID");
}

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH, { create: true });
db.exec(SCHEMA);
const scan = JSON.parse(await run([BIN, "scan", STEAM]));
storeMetadata(db, scan);
console.log(
  `scan: ${scan.libraries.length} libraries, ${scan.apps.length} apps, ${scan.appinfo?.apps.length ?? 0} pics apps, ${scan.packageinfo?.packages.length ?? 0} packages`,
);
if (args.includes("--vault")) await vault();
console.log(`inventory: ${inventory(db, scan.apps)} files (paths + sizes)`);
// blake3 is heavy: opt-in only, meant for the remote host (see remote-hash.sh).
if (args.includes("--hash")) await hashPending(db);
db.close();
