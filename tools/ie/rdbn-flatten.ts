// Flatten every RDBN typed table ("cfg.bin", non-T2B) of the user's IEVR install into one long SQLite table.
// Structure (lists, types, field order, field hashes, string table) comes from the decoder's raw RDBN JSON already
// stored in var/ie-inventory/ievr-cfg.sqlite (aphrody-nie-formats::cfgbin::parse); values are read from the raw file
// under var/ie-extract with a line-for-line port of cfgbin::read_values / read_field_value, in a pool of Bun Workers
// (one per CPU core). Same JSON value conventions as aphrody-nie-explore bridge::rdbn_value_to_json (Hash as
// "0xXXXXXXXX"), except Blob fields (AbilityData / EnhanceData / StatusRate / Unknown), kept as upper hex instead of
// null. If the Rust CLI exists (NIE_CLI, default target/release/nie.exe; NOT NIE_EXE, which names the game binary), every file is cross-checked against
// `nie mod get --limite 0` and mismatching cells are counted.
// Output (local only, never committed): var/ie-inventory/ievr-rdbn.sqlite
//   rdbn_file(path, lists, rows, cells, checked, mismatches, error)
//   rdbn_list(path, list_index, list_hash, list_name, type_hash, type_name, row_count)
//   rdbn_row(path, list_index, list_name, type_hash, type_name, row_index, field_index, field_hash, field_name,
//            field_type, value_json, value_num)   -- value_num: integer cells (Hash as u32, Bool as 0/1)
//
//   bun tools/ie/rdbn-flatten.ts [ievr-cfg.sqlite] [out.sqlite] [extract-dir]
// Env: NIE_GAME_DIR (default: Steam install), NIE_CLI, JOBS (default: cores).
import { Database } from "bun:sqlite";
import { existsSync, rmSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join, resolve } from "node:path";

type FieldType = string | { Unknown: number };
type Meta = {
  types: { name_hash: number; field_index: number; field_count: number }[];
  fields: {
    name_hash: number;
    field_type: FieldType;
    value_size: number;
    value_offset: number;
  }[];
  roots: {
    type_index: number;
    value_offset: number;
    value_size: number;
    value_count: number;
    name_hash: number;
  }[];
  strings: { entries: [number, string][] };
  value_abs: number;
  string_abs: number;
};
type Cell = [
  number,
  string | null,
  number,
  string | null,
  number,
  number,
  number,
  string,
  string,
  string,
  number | null,
];
type Result = {
  path: string;
  lists: [number, number, string | null, number, string | null, number][];
  cells: Cell[];
  checked: boolean;
  mismatches: number;
  firstMismatch?: string;
  error?: string;
};

const hex8 = (n: number) =>
  `0x${(n >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;

// Port of cfgbin::read_field_value (+ read_condition_value), JSON-shaped like bridge::rdbn_value_to_json.
function readField(
  data: Uint8Array,
  dv: DataView,
  off: number,
  size: number,
  type: FieldType,
  stringAbs: number,
): unknown {
  if (off < 0 || off + Math.max(size, 0) > data.length) return null; // RdbnValue::Invalid
  switch (type) {
    case "Bool":
      return data[off] !== 0;
    case "Byte":
      return data[off];
    case "Short":
    case "ActType":
      return dv.getInt16(off, true);
    case "Int":
    case "Flag":
      return dv.getInt32(off, true);
    case "Float":
      return dv.getFloat32(off, true);
    case "Hash":
      return hex8(dv.getUint32(off, true));
    case "Rates":
    case "Position":
      return [0, 4, 8, 12].map((k) => dv.getFloat32(off + k, true));
    case "ShortTuple":
      return [dv.getInt16(off, true), dv.getInt16(off + 2, true)];
    case "Condition": {
      if (off + 4 > data.length) return null;
      const v = dv.getUint32(off, true);
      const pos = stringAbs + v;
      if (pos < data.length && pos > 0) {
        let end = pos;
        while (end < data.length && data[end] !== 0) end++;
        return new TextDecoder().decode(data.subarray(pos, end));
      }
      return hex8(v);
    }
    default:
      return Buffer.from(data.subarray(off, off + size))
        .toString("hex")
        .toUpperCase(); // Blob
  }
}

function numeric(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && /^0x[0-9A-F]{8}$/.test(v))
    return parseInt(v, 16) >>> 0;
  return null;
}

async function flattenFile(
  path: string,
  meta: Meta,
  rawPath: string,
  nieExe: string | null,
  gameDir: string,
): Promise<Result> {
  const data = new Uint8Array(await Bun.file(rawPath).arrayBuffer());
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const names = new Map(meta.strings.entries);
  const res: Result = {
    path,
    lists: [],
    cells: [],
    checked: false,
    mismatches: 0,
  };
  const decoded: { name: string; values: Record<string, unknown>[] }[] = [];
  meta.roots.forEach((r, li) => {
    const listName = names.get(r.name_hash) ?? null;
    const ty = meta.types[r.type_index];
    if (!ty) {
      res.lists.push([li, r.name_hash, listName, 0, null, 0]);
      decoded.push({
        name: listName ?? `Unknown_${hex8(r.name_hash)}`,
        values: [],
      });
      return;
    }
    const typeName = names.get(ty.name_hash) ?? null;
    const count = Math.max(r.value_count, 0);
    res.lists.push([li, r.name_hash, listName, ty.name_hash, typeName, count]);
    const fields = meta.fields.slice(
      ty.field_index,
      ty.field_index + Math.max(ty.field_count, 0),
    );
    const values: Record<string, unknown>[] = [];
    for (let ri = 0; ri < count; ri++) {
      const base = meta.value_abs + r.value_offset + ri * r.value_size;
      const row: Record<string, unknown> = {};
      fields.forEach((f, fi) => {
        const fname = names.get(f.name_hash) ?? `Field_${hex8(f.name_hash)}`;
        const ftype =
          typeof f.field_type === "string"
            ? f.field_type
            : `Unknown${f.field_type.Unknown}`;
        const v = readField(
          data,
          dv,
          base + f.value_offset,
          f.value_size,
          f.field_type,
          meta.string_abs,
        );
        row[fname] = v;
        res.cells.push([
          li,
          listName,
          ty.name_hash,
          typeName,
          ri,
          fi,
          f.name_hash,
          fname,
          ftype,
          JSON.stringify(v),
          numeric(v),
        ]);
      });
      values.push(row);
    }
    decoded.push({ name: listName ?? `Unknown_${hex8(r.name_hash)}`, values });
  });
  if (nieExe) {
    // Cross-check against the Rust decoder (blobs are null there, floats are f32 widened to f64 on both sides).
    const proc = Bun.spawn([nieExe, "mod", "get", "--limite", "0", path], {
      env: { ...process.env, NIE_GAME_DIR: gameDir },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [text, code] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    if (code === 0) {
      const ref = JSON.parse(text) as {
        lists: { name: string; values: Record<string, unknown>[] }[];
      };
      res.checked = true;
      decoded.forEach((l, li) => {
        const rl = ref.lists[li];
        if (!rl || rl.name !== l.name || rl.values.length !== l.values.length) {
          res.mismatches++;
          res.firstMismatch ??= `list ${li} ${l.name}`;
          return;
        }
        l.values.forEach((row, ri) => {
          for (const [k, v] of Object.entries(row)) {
            const rv = rl.values[ri][k];
            if (rv === null && typeof v === "string" && !/^0x/.test(v))
              continue; // blob
            if (JSON.stringify(rv) !== JSON.stringify(v)) {
              res.mismatches++;
              res.firstMismatch ??= `${l.name}[${ri}].${k}: ${JSON.stringify(v)} vs ${JSON.stringify(rv)}`;
            }
          }
        });
      });
    }
  }
  return res;
}

if (!Bun.isMainThread) {
  // Worker: receives {cfgPath, extractDir, nieExe, gameDir} then paths one by one.
  let cfg: Database | null = null;
  let opts: {
    cfgPath: string;
    extractDir: string;
    nieExe: string | null;
    gameDir: string;
  };
  self.onmessage = async (ev: MessageEvent) => {
    const msg = ev.data;
    if (msg.init) {
      opts = msg.init;
      cfg = new Database(opts.cfgPath, { readonly: true });
      postMessage({ ready: true });
      return;
    }
    const path: string = msg.path;
    try {
      const row = cfg!
        .query("SELECT json FROM cfg WHERE path = ?")
        .get(path) as { json: string };
      const meta = (JSON.parse(row.json) as { data: Meta }).data;
      postMessage(
        await flattenFile(
          path,
          meta,
          join(opts.extractDir, path),
          opts.nieExe,
          opts.gameDir,
        ),
      );
    } catch (e) {
      postMessage({
        path,
        lists: [],
        cells: [],
        checked: false,
        mismatches: 0,
        error: String((e as Error).message ?? e),
      } satisfies Result);
    }
  };
} else {
  const root = join(import.meta.dir, "..", "..");
  const cfgPath = resolve(
    process.argv[2] ?? join(root, "var", "ie-inventory", "ievr-cfg.sqlite"),
  );
  const outPath = resolve(
    process.argv[3] ?? join(root, "var", "ie-inventory", "ievr-rdbn.sqlite"),
  );
  const extractDir = resolve(
    process.argv[4] ?? join(root, "var", "ie-extract"),
  );
  const nieCandidate =
    process.env.NIE_CLI ??
    join(
      root,
      "target",
      "release",
      process.platform === "win32" ? "nie.exe" : "nie",
    );
  const nieExe = existsSync(nieCandidate) ? nieCandidate : null;
  const gameDir =
    process.env.NIE_GAME_DIR ??
    "C:/Program Files (x86)/Steam/steamapps/common/INAZUMA ELEVEN Victory Road";
  const jobs = Number(process.env.JOBS) || availableParallelism();

  const src = new Database(cfgPath, { readonly: true });
  const paths = (
    src
      .query("SELECT path FROM cfg WHERE format = 'cfg.bin' ORDER BY path")
      .all() as { path: string }[]
  ).map((r) => r.path);
  src.close();

  for (const p of [outPath, `${outPath}-wal`, `${outPath}-shm`])
    if (existsSync(p)) rmSync(p);
  const out = new Database(outPath);
  out.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = OFF;
CREATE TABLE rdbn_file(path TEXT PRIMARY KEY, lists INTEGER, rows INTEGER, cells INTEGER, checked INTEGER, mismatches INTEGER, error TEXT);
CREATE TABLE rdbn_list(path TEXT, list_index INTEGER, list_hash INTEGER, list_name TEXT, type_hash INTEGER, type_name TEXT, row_count INTEGER);
CREATE TABLE rdbn_row(path TEXT, list_index INTEGER, list_name TEXT, type_hash INTEGER, type_name TEXT, row_index INTEGER,
  field_index INTEGER, field_hash INTEGER, field_name TEXT, field_type TEXT, value_json TEXT, value_num INTEGER);`);
  const insFile = out.prepare("INSERT INTO rdbn_file VALUES (?,?,?,?,?,?,?)");
  const insList = out.prepare("INSERT INTO rdbn_list VALUES (?,?,?,?,?,?,?)");
  const insRow = out.prepare(
    "INSERT INTO rdbn_row VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  const totals = {
    files: 0,
    lists: 0,
    rows: 0,
    cells: 0,
    checked: 0,
    mismatches: 0,
  };
  const failures: string[] = [];
  const mismatchNotes: string[] = [];
  const write = out.transaction((r: Result) => {
    if (r.error) {
      insFile.run(r.path, null, null, null, 0, 0, r.error);
      failures.push(`${r.path}: ${r.error}`);
      return;
    }
    for (const l of r.lists) insList.run(r.path, ...l);
    for (const c of r.cells) insRow.run(r.path, ...c);
    const rows = r.lists.reduce((n, l) => n + l[5], 0);
    insFile.run(
      r.path,
      r.lists.length,
      rows,
      r.cells.length,
      r.checked ? 1 : 0,
      r.mismatches,
      null,
    );
    totals.files++;
    totals.lists += r.lists.length;
    totals.rows += rows;
    totals.cells += r.cells.length;
    totals.checked += r.checked ? 1 : 0;
    totals.mismatches += r.mismatches;
    if (r.firstMismatch)
      mismatchNotes.push(`${r.path}: ${r.mismatches} (${r.firstMismatch})`);
  });

  const t0 = performance.now();
  let next = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(jobs, paths.length) },
      () =>
        new Promise<void>((done) => {
          const w = new Worker(import.meta.url);
          w.onmessage = (ev: MessageEvent) => {
            if (!ev.data.ready) write(ev.data as Result);
            if (next < paths.length) w.postMessage({ path: paths[next++] });
            else {
              w.terminate();
              done();
            }
          };
          w.postMessage({ init: { cfgPath, extractDir, nieExe, gameDir } });
        }),
    ),
  );
  out.exec(`CREATE INDEX rdbn_row_num ON rdbn_row(value_num);
CREATE INDEX rdbn_row_field ON rdbn_row(type_name, field_name);
CREATE INDEX rdbn_row_cell ON rdbn_row(path, list_index, row_index);`);
  out.close();
  console.log(
    JSON.stringify(
      {
        out: outPath,
        jobs,
        nie: nieExe,
        seconds: +((performance.now() - t0) / 1000).toFixed(1),
        input: paths.length,
        ...totals,
        failures: failures.length,
      },
      null,
      2,
    ),
  );
  for (const f of failures) console.log(`FAIL ${f}`);
  for (const m of mismatchNotes.slice(0, 20)) console.log(`MISMATCH ${m}`);
}
