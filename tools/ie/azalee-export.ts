// Export factual IEVR tables from the read-only inagle mirror to JSONL for Azalée.
// Facts only: IDs, names, element/position, numeric stats, costs and relations. Excluded on
// purpose: description_* (game prose), image/video/poster/thumbnail URLs, sheet_data and data
// blobs, and every asset. One record per line:
//   {kind, id, name_fr, name_en?, fields:{...}, source:{mirror, table, sha256}}
//
//   bun tools/ie/azalee-export.ts [mirror.sqlite] [out-dir]
// Env: NIE_WIKI_DB (mirror path) used when no argument is given.
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const mirror = resolve(process.argv[2] ?? process.env.NIE_WIKI_DB ?? "C:/src/apps/rosegriffon/var/inagle-mirror.sqlite");
const outDir = resolve(process.argv[3] ?? join(import.meta.dir, "..", "..", "var", "ie-export", "azalee"));
mkdirSync(outDir, { recursive: true });

const sha256 = new Bun.CryptoHasher("sha256").update(await Bun.file(mirror).bytes()).digest("hex");
const db = new Database(mirror, { readonly: true });

type Spec = {
  kind: string;
  table: string;
  id: string;
  fields: string[];
  json?: string[]; // text columns holding JSON relations, parsed into arrays/objects
};

const SPECS: Spec[] = [
  {
    kind: "character",
    table: "inagle_characters",
    id: "internal_code",
    fields: [
      "chara_id", "name_ja", "nickname", "slug", "base_slug", "element", "element_id", "position", "position_id",
      "gender", "age_group", "school_year", "rarity", "rarity_code", "rarity_label", "series", "team_id",
      "uniform_number", "hero_type", "is_primary", "is_controllable", "control_type", "model_id", "zukan_order",
      "constellation", "constellation_index",
      "stat_frappe", "stat_controle", "stat_technique", "stat_pression", "stat_physique", "stat_agilite",
      "stat_intelligence", "stat_total",
      "stat_lv1_frappe", "stat_lv1_controle", "stat_lv1_technique", "stat_lv1_pression", "stat_lv1_physique",
      "stat_lv1_agilite", "stat_lv1_intelligence",
    ],
    json: ["skills", "teams", "game_appearances"],
  },
  {
    kind: "team",
    table: "inagle_teams",
    id: "id",
    fields: ["internal_code", "name_ja", "country_code", "series", "region"],
    json: ["members"],
  },
  {
    kind: "skill",
    table: "inagle_skills",
    id: "internal_code",
    fields: [
      "name_ja", "category", "category_id", "element", "element_id", "power_min", "power_max", "tp_cost",
      "tension_cost", "recast_time", "partner_count", "foul_rate", "is_hyper", "is_eldorado", "evolution_type",
      "growth_type", "hash_id",
    ],
    json: ["tags"],
  },
  {
    kind: "passive",
    table: "inagle_passives",
    id: "id",
    fields: ["name_ja", "type", "category", "boost_type", "stat_boost", "effect_value"],
  },
  {
    kind: "tactic",
    table: "inagle_tactics",
    id: "internal_code",
    fields: ["name_ja", "element", "element_id", "power", "duration", "cooldown", "recast_time", "partner_count"],
    json: ["partner_ids"],
  },
  {
    kind: "formation",
    table: "inagle_formations",
    id: "id",
    fields: ["name_ja", "type", "power_offense", "power_defense"],
  },
];

const parseJson = (v: unknown) => {
  if (typeof v !== "string") return v ?? null;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

const summary: Record<string, number> = {};
for (const spec of SPECS) {
  const cols = new Set((db.query(`PRAGMA table_info(${spec.table})`).all() as { name: string }[]).map((c) => c.name));
  const wanted = [spec.id, "name_fr", "name_en", ...spec.fields, ...(spec.json ?? [])].filter((c) => cols.has(c));
  const missing = [spec.id, ...spec.fields].filter((c) => !cols.has(c));
  if (!cols.has(spec.id)) throw new Error(`${spec.table}: id column ${spec.id} missing`);
  if (missing.length) console.warn(`${spec.table}: columns absent, skipped: ${missing.join(", ")}`);

  const rows = db.query(`SELECT ${[...new Set(wanted)].map((c) => `"${c}"`).join(",")} FROM ${spec.table} ORDER BY "${spec.id}"`).all() as Record<string, unknown>[];
  const writer = Bun.file(join(outDir, `${spec.kind}s.jsonl`)).writer();
  let n = 0;
  for (const row of rows) {
    if (row[spec.id] === null || row[spec.id] === undefined) continue;
    const fields: Record<string, unknown> = {};
    for (const f of spec.fields) if (cols.has(f) && row[f] !== null && row[f] !== undefined) fields[f] = row[f];
    for (const f of spec.json ?? []) if (cols.has(f) && row[f] !== null) fields[f] = parseJson(row[f]);
    const record: Record<string, unknown> = {
      kind: spec.kind,
      id: String(row[spec.id]),
      name_fr: row.name_fr ?? null,
      ...(row.name_en ? { name_en: row.name_en } : {}),
      fields,
      source: { mirror: basename(mirror), table: spec.table, sha256 },
    };
    writer.write(`${JSON.stringify(record)}\n`);
    n++;
  }
  await writer.end();
  summary[spec.kind] = n;
}
db.close();

await Bun.write(
  join(outDir, "manifest.json"),
  `${JSON.stringify({ schema: "azalee.ievr-facts/1", generated_at: new Date().toISOString(), mirror: basename(mirror), mirror_sha256: sha256, counts: summary }, null, 2)}\n`,
);
console.log(JSON.stringify(summary));
