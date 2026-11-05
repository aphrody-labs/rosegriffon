/**
 * Exporte les tables factuelles `inagle_*` (Postgres, lecture seule) vers un
 * miroir SQLite local, celui que lisent `nie wiki` et l'export Azalée de yolo-re.
 *
 * Usage :
 *   INAGLE_DATABASE_URL=... bun packages/azalee/scripts/export-inagle-sqlite.ts [sortie.sqlite]
 *
 * Seulement des SELECT. Les grosses tables d'index et de texte intégral
 * (index CPK, textes du jeu, graphe RAG, scripts Lua, sous-titres) sont
 * exclues : elles pèsent ~240 Mo de sortie réseau, sur un quota Neon de
 * 5 Go par mois, et ne servent pas aux fiches.
 */
import { Database } from "bun:sqlite";
import { SQL } from "bun";

const EXCLUES = new Set([
  "inagle_cpk_index",
  "inagle_game_text",
  "inagle_cross_catalog",
  "inagle_rag_edges",
  "inagle_lua_scripts",
  "inagle_event_subtitles",
]);

const url = process.env.INAGLE_DATABASE_URL;
if (!url) throw new Error("INAGLE_DATABASE_URL manquant");
const sortie = Bun.argv[2] ?? "var/inagle-mirror.sqlite";

const pg = new SQL(url);
await pg`set session characteristics as transaction read only`;

const tables = (
  await pg<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' and table_name like 'inagle\_%'
    order by table_name`
)
  .map(t => t.table_name)
  .filter(t => !EXCLUES.has(t));

await Bun.write(sortie, "");
const db = new Database(sortie, { create: true, strict: true });
db.exec("pragma journal_mode = off; pragma synchronous = off;");

/** Valeur Postgres → valeur SQLite : objets et tableaux en JSON, dates en ISO. */
const versSqlite = (v: unknown): string | number | bigint | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "boolean") return Number(v);
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "string") return v;
  return JSON.stringify(v);
};

const ident = (n: string) => `"${n.replaceAll('"', '""')}"`;
let total = 0;
for (const table of tables) {
  const colonnes = (
    await pg<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = ${table} order by ordinal_position`
  ).map(c => c.column_name);
  db.exec(`create table ${ident(table)} (${colonnes.map(ident).join(", ")})`);
  const inserer = db.prepare(
    `insert into ${ident(table)} values (${colonnes.map(() => "?").join(", ")})`,
  );
  const lignes = await pg.unsafe(`select * from public.${ident(table)}`);
  db.transaction(() => {
    for (const ligne of lignes) inserer.run(...colonnes.map(c => versSqlite(ligne[c])));
  })();
  total += lignes.length;
  console.log(`${table}\t${lignes.length}`);
}
db.close();
await pg.close();
console.log(`${tables.length} tables, ${total} lignes -> ${sortie}`);
