/**
 * Importeur à blanc des noms propres du jeu (9 langues) vers les fiches Azalée.
 *
 * Entrées :
 *   - names.jsonl produit par yolo-re (`bun tools/ie/lang-names-export.ts`) :
 *     un enregistrement par nom propre, avec `refs` vers la ligne du jeu
 *     (chara_base → chara_id, team_config → id d'équipe).
 *   - le miroir SQLite inagle (`export-inagle-sqlite.ts`), ouvert en lecture.
 *
 * Sortie : un rapport JSON des corrections proposées, par entité et par
 * langue. RIEN n'est écrit en base : l'application en prod est une étape
 * séparée, soumise à validation.
 *
 * Usage :
 *   bun packages/azalee/scripts/import-ievr-names.ts \
 *     [--names C:/src/yolo-re/var/ie-export/azalee/names.jsonl] \
 *     [--mirror var/inagle-mirror.sqlite] [--out var/ievr-names-report.json]
 *
 * Les équipes ne sont pas encore reliées : les identifiants de inagle_teams
 * n’apparaissent ni comme hash ni comme ligne team_config dans l’export.
 * Les compétences ne sont pas traitées : yolo-re ne sait pas encore relier
 * leur hash de nom à une ligne (`refs` absent), et un rapprochement par nom
 * serait faux.
 */
import { Database } from "bun:sqlite";
import { parseArgs } from "node:util";

import { classerEcart, normaliserId, sansFurigana } from "./ievr-names";

const { values: options } = parseArgs({
  options: {
    names: { type: "string", default: "C:/src/yolo-re/var/ie-export/azalee/names.jsonl" },
    mirror: { type: "string", default: "var/inagle-mirror.sqlite" },
    out: { type: "string", default: "var/ievr-names-report.json" },
  },
});

const LANGUES = ["fr", "en", "ja"] as const;
type Langue = (typeof LANGUES)[number];

interface Ref {
  table: string;
  row: string;
  id: string;
  code?: string;
}
interface NomJeu {
  kind: "character" | "skill" | "team" | "item";
  hash: string;
  variant: number;
  names: Partial<Record<string, string>>;
  refs?: Ref[];
}

const lignes = (await Bun.file(options.names).text())
  .split("\n")
  .filter(Boolean)
  .map(l => JSON.parse(l) as NomJeu);

const db = new Database(options.mirror, { readonly: true });
const personnages = new Map(
  db
    .query<{ chara_id: string; name_fr: string | null; name_en: string | null; name_ja: string | null }, []>(
      "select chara_id, name_fr, name_en, name_ja from inagle_characters",
    )
    .all()
    .map(r => [normaliserId(String(r.chara_id)), r]),
);
const equipes = new Map(
  db
    .query<{ id: string; name_fr: string | null; name_en: string | null; name_ja: string | null }, []>(
      "select id, name_fr, name_en, name_ja from inagle_teams",
    )
    .all()
    .map(r => [normaliserId(String(r.id)), r]),
);
db.close();

interface Correction {
  kind: "character" | "team";
  id: string;
  code?: string;
  langue: Langue;
  actuel: string | null;
  propose: string;
  ecart: ReturnType<typeof classerEcart>;
}

const corrections: Correction[] = [];
const stats: Record<string, Record<string, number>> = {};
let relies = 0;
let orphelins = 0;

for (const nom of lignes) {
  if (nom.variant !== 0 || (nom.kind !== "character" && nom.kind !== "team")) continue;
  for (const ref of nom.refs ?? []) {
    // Les équipes du miroir sont indexées par le hash du nom, les personnages
    // par l’id de ligne (chara_id).
    const ligne =
      nom.kind === "character"
        ? personnages.get(normaliserId(ref.id))
        : (equipes.get(normaliserId(nom.hash)) ?? equipes.get(normaliserId(ref.id)));
    if (!ligne) {
      orphelins++;
      continue;
    }
    relies++;
    for (const langue of LANGUES) {
      const jeu = nom.names[langue];
      // `<MNT:…>` et autres balises : textes de substitution du jeu, pas des noms.
      if (!jeu || jeu.startsWith("<")) continue;
      const propose = langue === "ja" ? sansFurigana(jeu) : jeu;
      const actuel = ligne[`name_${langue}`];
      const ecart = classerEcart(actuel, propose);
      const cle = `${nom.kind}.${langue}`;
      stats[cle] ??= {};
      stats[cle][ecart] = (stats[cle][ecart] ?? 0) + 1;
      if (ecart !== "identique")
        corrections.push({ kind: nom.kind, id: ref.id, code: ref.code, langue, actuel, propose, ecart });
    }
  }
}

const rapport = {
  genere: new Date().toISOString(),
  sources: { names: options.names, mirror: options.mirror },
  relies,
  orphelins,
  stats,
  corrections,
};
await Bun.write(options.out, `${JSON.stringify(rapport, null, 2)}\n`);
console.log(`relies=${relies} orphelins=${orphelins} corrections=${corrections.length} -> ${options.out}`);
for (const [cle, parEcart] of Object.entries(stats)) console.log(cle, JSON.stringify(parEcart));
