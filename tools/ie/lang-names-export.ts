// Per-language name labels from the real game's text tables, for Azalée (local only).
// Source: decoded cfg.bin DB (var/ie-inventory/ievr-cfg.sqlite, built from the user's own install).
// Only NOUN_INFO rows (proper names: characters, skills, teams, items). TEXT_INFO rows (descriptions,
// help prose) and event/dialogue text are excluded on purpose.
// Output: var/ie-export/azalee/names.jsonl, one record per (kind, hash, variant):
//   {kind, hash, variant, names: {en, fr, ja, ...}, source: {table}}
//
//   bun tools/ie/lang-names-export.ts [ievr-cfg.sqlite] [out-dir] [ievr-rdbn.sqlite]
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const dbPath = resolve(
  process.argv[2] ??
    join(import.meta.dir, "..", "..", "var", "ie-inventory", "ievr-cfg.sqlite"),
);
const outDir = resolve(
  process.argv[3] ??
    join(import.meta.dir, "..", "..", "var", "ie-export", "azalee"),
);
mkdirSync(outDir, { recursive: true });

const TABLES: Record<string, string> = {
  character: "chara_text",
  skill: "skill_text",
  team: "team_text",
  item: "item_text",
};
const LANGS = ["ja", "en", "fr", "de", "es", "it", "pt", "zh_hans", "zh_hant"];

type Entry = {
  name: string;
  variables: Record<string, unknown>[];
  children: Entry[];
};
const db = new Database(dbPath, { readonly: true });
const hex = (n: number) =>
  `0x${(n >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;

const records = new Map<
  string,
  {
    kind: string;
    hash: string;
    variant: number;
    names: Record<string, string>;
    source: { table: string };
  }
>();
const counts: Record<string, Record<string, number>> = {};
for (const [kind, table] of Object.entries(TABLES)) {
  for (const lang of LANGS) {
    const row = db
      .query("SELECT json FROM cfg WHERE path = ? AND error IS NULL")
      .get(`data/common/text/${lang}/${table}.cfg.bin`) as {
      json: string;
    } | null;
    if (!row) continue;
    const entries = JSON.parse(row.json).data.entries as Entry[];
    let n = 0;
    for (const block of entries.filter((e) => e.name === "NOUN_INFO_BEGIN")) {
      for (const noun of block.children) {
        if (noun.name !== "NOUN_INFO") continue;
        const vals = noun.variables.map((v) => Object.values(v)[0]);
        const [hash, variant] = vals as [number, number];
        const label = vals
          .slice(2)
          .find((v) => typeof v === "string" && v.length > 0) as
          string | undefined;
        if (typeof hash !== "number" || !label) continue;
        const key = `${kind}:${hash}:${variant}`;
        const rec = records.get(key) ?? {
          kind,
          hash: hex(hash),
          variant,
          names: {},
          source: { table },
        };
        rec.names[lang] = label;
        records.set(key, rec);
        n++;
      }
    }
    (counts[kind] ??= {})[lang] = n;
  }
}
// Links name hash -> game entity, read from the gamedata tables (T2B). For each table, the column that
// holds name hashes is detected (the column whose values hit the most name hashes of that kind); the
// entity id is column 0 of the same row. One name can serve several entities (story / event variants).
// Hissatsu skills (skill_config) and club ids (belong_team_config) are RDBN typed tables: they are linked
// further down from the flattened RDBN DB (tools/ie/rdbn-flatten.ts). Passive skills and aura commands are T2B.
const REF_TABLES: { kind: string; like: string; row: string; code?: number }[] =
  [
    {
      kind: "character",
      like: "data/common/gamedata/character/chara_base_%",
      row: "CHARA_BASE_INFO",
    },
    { kind: "team", like: "data/common/gamedata/team/team_config_%", row: "" },
    { kind: "item", like: "data/common/gamedata/item/item_config_%", row: "" },
    {
      kind: "skill",
      like: "data/common/gamedata/skill/passive_skill_config_%",
      row: "PASSIVE_SKILL_INFO",
      code: 6,
    },
    {
      kind: "skill",
      like: "data/common/gamedata/skill/aura_skill_config_%",
      row: "AURA_CMD_INFO",
    },
  ];
type NameRecord = {
  kind: string;
  hash: string;
  refs?: Record<string, unknown>[];
};
const byKindHash = new Map<string, NameRecord[]>(); // `${kind}:${u32 hash}` -> records (all variants)
for (const rec of records.values()) {
  const k = `${rec.kind}:${parseInt(rec.hash, 16) >>> 0}`;
  byKindHash.set(k, [...(byKindHash.get(k) ?? []), rec]);
}
const refCounts: Record<string, number> = {};
const linkDb = new Database(dbPath, { readonly: true });
for (const { kind, ...spec } of REF_TABLES) {
  const tableRow = linkDb
    .query(
      "SELECT path, json FROM cfg WHERE path LIKE ? AND error IS NULL ORDER BY path DESC LIMIT 1",
    )
    .get(spec.like) as { path: string; json: string } | null;
  if (!tableRow) continue;
  const table = tableRow.path
    .split("/")
    .pop()!
    .replace(/_[\d.]+\.cfg\.bin$|\.cfg\.bin$/, "");
  const hashes = new Set(
    [...records.values()]
      .filter((r) => r.kind === kind)
      .map((r) => parseInt(r.hash, 16) >>> 0),
  );
  const rows: Entry[] = [];
  (function walk(xs: Entry[]) {
    for (const x of xs ?? []) {
      if (x.variables.length > 1 && (!spec.row || x.name === spec.row))
        rows.push(x);
      walk(x.children);
    }
  })(JSON.parse(tableRow.json).data.entries);
  // Detect the name column per row type.
  const hits = new Map<string, number>();
  for (const r of rows)
    r.variables.forEach((v, i) => {
      const x = Object.values(v)[0];
      if (i > 0 && typeof x === "number" && hashes.has(x >>> 0))
        hits.set(`${r.name}:${i}`, (hits.get(`${r.name}:${i}`) ?? 0) + 1);
    });
  const best = new Map<string, number>(); // row name -> column
  for (const [k, n] of [...hits].sort((a, b) => b[1] - a[1])) {
    const [rowName, col] = k.split(":");
    if (!best.has(rowName) && n >= 3) best.set(rowName, Number(col));
  }
  let linked = 0;
  for (const r of rows) {
    const col = best.get(r.name);
    if (col === undefined) continue;
    const vals = r.variables.map((v) => Object.values(v)[0]);
    const nameHash = vals[col];
    if (typeof nameHash !== "number" || typeof vals[0] !== "number") continue;
    for (const rec of byKindHash.get(`${kind}:${nameHash >>> 0}`) ?? []) {
      const code = vals[spec.code ?? 1];
      const ref: Record<string, unknown> = {
        table,
        row: r.name,
        id: hex(vals[0] as number),
        ...(typeof code === "string" ? { code } : {}),
      };
      // chara_base columns 16 / 17: the club ids the character belongs to (the ids inagle_teams uses,
      // e.g. Raimon 0xF01BB293), defined by belong_team_config BELONG_TEAM_INFO.belongTeamId (RDBN);
      // the team records carry the matching club refs (see RDBN_REFS).
      if (kind === "character") {
        const clubs = [vals[16], vals[17]]
          .filter((x): x is number => typeof x === "number" && x !== 0)
          .map(hex);
        if (clubs.length) ref.clubs = clubs;
      }
      ((rec as Record<string, unknown>).refs ??= []) as unknown[];
      ((rec as Record<string, unknown>).refs as unknown[]).push(ref);
      linked++;
    }
  }
  refCounts[kind] = (refCounts[kind] ?? 0) + linked;
  console.log(
    `${kind}: ${table} name column ${JSON.stringify(Object.fromEntries(best))}, ${linked} refs`,
  );
}
linkDb.close();
db.close();

// RDBN links, from var/ie-inventory/ievr-rdbn.sqlite (built by tools/ie/rdbn-flatten.ts). Each spec names the
// RDBN type, the field holding the NOUN_INFO name hash, the entity id field and an optional readable code field.
// Club refs: belongTeamId is the club id carried by chara_base columns 16 / 17 (refs[].clubs of characters).
const rdbnPath = resolve(
  process.argv[4] ?? join(dirname(dbPath), "ievr-rdbn.sqlite"),
);
const RDBN_REFS: {
  kind: string;
  like: string;
  type: string;
  name: string;
  id: string;
  code?: string;
  club?: boolean;
}[] = [
  {
    kind: "skill",
    like: "data/common/gamedata/skill/skill_config_%",
    type: "SKILL_INFO",
    name: "skillNameId",
    id: "skillID",
    code: "skillIDStr",
  },
  {
    kind: "team",
    like: "data/common/gamedata/character/belong_team_config_%",
    type: "BELONG_TEAM_INFO",
    name: "teamNameTextId",
    id: "belongTeamId",
    club: true,
  },
];
if (existsSync(rdbnPath)) {
  const rdb = new Database(rdbnPath, { readonly: true });
  for (const spec of RDBN_REFS) {
    const file = rdb
      .query(
        "SELECT path FROM rdbn_file WHERE path LIKE ? AND error IS NULL ORDER BY path DESC LIMIT 1",
      )
      .get(spec.like) as { path: string } | null;
    if (!file) continue;
    const table = file.path
      .split("/")
      .pop()!
      .replace(/_[\d.]+\.cfg\.bin$|\.cfg\.bin$/, "");
    const cells = rdb
      .query(
        "SELECT list_index, row_index, field_name, value_json FROM rdbn_row WHERE path = ? AND type_name = ? AND field_name IN (?, ?, ?)",
      )
      .all(file.path, spec.type, spec.name, spec.id, spec.code ?? spec.id) as {
      list_index: number;
      row_index: number;
      field_name: string;
      value_json: string;
    }[];
    const rows = new Map<string, Record<string, unknown>>();
    for (const c of cells) {
      const key = `${c.list_index}:${c.row_index}`;
      rows.set(key, {
        ...(rows.get(key) ?? {}),
        [c.field_name]: JSON.parse(c.value_json),
      });
    }
    let linked = 0;
    const named = new Set<string>();
    for (const row of rows.values()) {
      const nameHash = row[spec.name];
      const id = row[spec.id];
      if (
        typeof nameHash !== "string" ||
        typeof id !== "string" ||
        nameHash === "0x00000000"
      )
        continue;
      for (const rec of byKindHash.get(
        `${spec.kind}:${parseInt(nameHash, 16) >>> 0}`,
      ) ?? []) {
        const code = spec.code ? row[spec.code] : undefined;
        (rec.refs ??= []).push({
          table,
          type: spec.type,
          id,
          ...(typeof code === "string" ? { code } : {}),
          ...(spec.club ? { club: true } : {}),
        });
        named.add(rec.hash);
        linked++;
      }
    }
    refCounts[spec.kind] = (refCounts[spec.kind] ?? 0) + linked;
    console.log(
      `${spec.kind}: ${table} ${spec.type}.${spec.name} -> ${spec.id}, ${rows.size} rows, ${linked} refs, ${named.size} name hashes`,
    );
  }
  rdb.close();
} else
  console.log(
    `no RDBN DB at ${rdbnPath} (run tools/ie/rdbn-flatten.ts): skills and clubs not linked`,
  );
const linkedRecords: Record<string, number> = {};
for (const rec of records.values() as Iterable<NameRecord>)
  if (rec.refs?.length)
    linkedRecords[rec.kind] = (linkedRecords[rec.kind] ?? 0) + 1;

const writer = Bun.file(join(outDir, "names.jsonl")).writer();
for (const rec of records.values()) writer.write(`${JSON.stringify(rec)}\n`);
await writer.end();
await Bun.write(
  join(outDir, "names.manifest.json"),
  `${JSON.stringify({ schema: "azalee.ievr-names/1", generated_at: new Date().toISOString(), records: records.size, counts, refs: refCounts, linked_records: linkedRecords }, null, 2)}\n`,
);
console.log(`${records.size} name records`);
console.log(JSON.stringify(counts));
console.log(JSON.stringify({ refs: refCounts, linked_records: linkedRecords }));
