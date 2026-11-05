/**
 * Prépare la correction de `inagle_characters.gender` en prod à partir du jeu.
 *
 * Entrées :
 *   - `--prod` : export JSONL en lecture seule de `inagle_characters` ;
 *   - `--genres` : chara_gender.jsonl de yolo-re (CHARA_BASE_INFO var[11] :
 *     1 = masculin, 2 = féminin, autre = null).
 *
 * L'ancien `cli-push.ts` d'inagle (yolo-re, corrigé en a44e5f6) écrivait
 * `gender === 1 ? "F" : "M"`, ce qui inversait tout. Sortie : un script SQL
 * transactionnel (`--out`), rien n'est exécuté ici.
 */
import { parseArgs } from "node:util";

import { normaliserId } from "./ievr-names";

const { values: options } = parseArgs({
  options: {
    prod: { type: "string", default: "var/prod-inagle-characters.jsonl" },
    genres: { type: "string", default: "C:/src/yolo-re/var/ie-export/azalee/chara_gender.jsonl" },
    out: { type: "string", default: "var/ievr-gender-prod.sql" },
  },
});

const lire = async <T>(chemin: string) =>
  (await Bun.file(chemin).text())
    .split("\n")
    .filter(Boolean)
    .map(l => JSON.parse(l) as T);

const jeu = await lire<{ chara_id: string; gender: "M" | "F" | null }>(options.genres);
const prod = await lire<{ chara_id: string }>(options.prod);
const parId = new Map(jeu.map(r => [normaliserId(r.chara_id), r.gender]));

const valeurs: string[] = [];
const stats: Record<string, number> = {};
let manquants = 0;
for (const id of new Set(prod.map(p => p.chara_id))) {
  const genre = parId.get(normaliserId(id));
  if (genre === undefined) {
    manquants++;
    continue;
  }
  stats[String(genre)] = (stats[String(genre)] ?? 0) + 1;
  valeurs.push(`  ('${id.replaceAll("'", "''")}', ${genre ? `'${genre}'` : "null"})`);
}

await Bun.write(
  options.out,
  `begin;
create temp table genre_jeu (chara_id text primary key, gender text) on commit drop;
insert into genre_jeu values
${valeurs.join(",\n")};
update inagle_characters c set gender = g.gender from genre_jeu g
 where c.chara_id = g.chara_id and c.gender is distinct from g.gender;
commit;
`,
);
console.log(`chara_id=${valeurs.length + manquants} manquants=${manquants} ${JSON.stringify(stats)} -> ${options.out}`);
