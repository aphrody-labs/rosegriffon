/**
 * Prépare la correction des noms de personnages de la base prod (`rg-inagle-pg`)
 * à partir des textes du jeu exportés par yolo-re (`names.jsonl`).
 *
 * Entrées :
 *   - `--prod` : export JSONL en lecture seule de `inagle_characters`
 *     (id, chara_id, name_fr, name_en, name_ja) ;
 *   - `--names` : names.jsonl de yolo-re (schéma azalee.ievr-names/1).
 *
 * Sortie : un script SQL transactionnel (`--out`) qui met à jour name_fr,
 * name_en et name_ja par chara_id, et un résumé sur la sortie standard.
 * Rien n'est exécuté ici.
 *
 * Seule la variante 0 (nom complet) est retenue : les variantes 11 et 12 sont
 * des formes courtes (« Jim »), source probable des noms doublés.
 */
import { parseArgs } from "node:util";

import { classerEcart, normaliserId, sansFurigana } from "./ievr-names";

const { values: options } = parseArgs({
  options: {
    prod: { type: "string", default: "var/prod-inagle-characters.jsonl" },
    names: { type: "string", default: "C:/src/yolo-re/var/ie-export/azalee/names.jsonl" },
    out: { type: "string", default: "var/ievr-names-prod.sql" },
  },
});

const LANGUES = ["fr", "en", "ja"] as const;
type Langue = (typeof LANGUES)[number];
type Noms = Record<Langue, string>;

interface LigneProd {
  id: string;
  chara_id: string;
  name_fr: string | null;
  name_en: string | null;
  name_ja: string | null;
}

const lireJsonl = async <T>(chemin: string) =>
  (await Bun.file(chemin).text())
    .split("\n")
    .filter(Boolean)
    .map(l => JSON.parse(l) as T);

const prod = await lireJsonl<LigneProd>(options.prod);
const exportJeu = await lireJsonl<{
  kind: string;
  variant: number;
  names: Partial<Record<string, string>>;
  refs?: { table: string; id: string }[];
}>(options.names);

/** chara_base id → noms du jeu ; un id couvert par deux noms différents est écarté. */
const parId = new Map<string, Noms | null>();
for (const r of exportJeu) {
  if (r.kind !== "character" || r.variant !== 0) continue;
  const fr = r.names.fr;
  const en = r.names.en;
  const ja = r.names.ja;
  if (!fr || !en || !ja || [fr, en, ja].some(n => n.startsWith("<"))) continue;
  // Les furigana apparaissent aussi hors du japonais (personnages de test au
  // nom japonais) ; certains noms du jeu finissent par une espace.
  const propre = (n: string) => sansFurigana(n).trim();
  const noms: Noms = { fr: propre(fr), en: propre(en), ja: propre(ja) };
  if (!noms.fr || !noms.en || !noms.ja) continue;
  for (const ref of r.refs ?? []) {
    if (ref.table !== "chara_base") continue;
    const cle = normaliserId(ref.id);
    const deja = parId.get(cle);
    if (deja === undefined) parId.set(cle, noms);
    else if (deja && (deja.fr !== noms.fr || deja.en !== noms.en || deja.ja !== noms.ja)) parId.set(cle, null);
  }
}

const sql = (s: string) => `'${s.replaceAll("'", "''")}'`;
const valeurs = new Map<string, Noms>();
const stats: Record<string, Record<string, number>> = {};
let sansCorrespondance = 0;
let ambigus = 0;

for (const ligne of prod) {
  const cle = normaliserId(ligne.chara_id);
  const noms = parId.get(cle);
  if (noms === undefined) {
    sansCorrespondance++;
    continue;
  }
  if (noms === null) {
    ambigus++;
    continue;
  }
  let change = false;
  for (const langue of LANGUES) {
    const ecart = classerEcart(ligne[`name_${langue}`], noms[langue]);
    stats[langue] ??= {};
    stats[langue][ecart] = (stats[langue][ecart] ?? 0) + 1;
    if (ecart !== "identique") change = true;
  }
  if (change) valeurs.set(ligne.chara_id, noms);
}

const lignesSql = [...valeurs].map(
  ([charaId, n]) => `  (${sql(charaId)}, ${sql(n.fr)}, ${sql(n.en)}, ${sql(n.ja)})`,
);
const script = `-- Généré par packages/azalee/scripts/plan-ievr-names-prod.ts le ${new Date().toISOString()}
-- Source : ${options.names}
begin;
create temp table noms_jeu (chara_id text primary key, fr text not null, en text not null, ja text not null) on commit drop;
insert into noms_jeu (chara_id, fr, en, ja) values
${lignesSql.join(",\n")};
update inagle_characters c
   set name_fr = n.fr, name_en = n.en, name_ja = n.ja
  from noms_jeu n
 where c.chara_id = n.chara_id
   and (c.name_fr is distinct from n.fr or c.name_en is distinct from n.en or c.name_ja is distinct from n.ja);
commit;
`;
await Bun.write(options.out, script);

console.log(
  `lignes prod=${prod.length} sans_correspondance=${sansCorrespondance} ambigus=${ambigus} chara_id_a_corriger=${valeurs.size} -> ${options.out}`,
);
for (const [langue, parEcart] of Object.entries(stats)) console.log(langue, JSON.stringify(parEcart));
