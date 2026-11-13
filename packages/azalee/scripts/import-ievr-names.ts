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
 * Objets et passifs ne sont pas traités : le miroir n’a pas de clé commune
 * avec l’export (passive_N, objets absents).
 */
import { Database } from "bun:sqlite";
import { parseArgs } from "node:util";

import { classerEcart, normaliserId, sansFurigana } from "./ievr-names";

const { values: options } = parseArgs({
  options: {
    names: {
      type: "string",
      default: "C:/src/yolo-re/var/ie-export/azalee/names.jsonl",
    },
    mirror: { type: "string", default: "var/inagle-mirror.sqlite" },
    out: { type: "string", default: "var/ievr-names-report.json" },
  },
});

const LANGUES = ["fr", "en", "ja"] as const;
type Langue = (typeof LANGUES)[number];

interface Ref {
  table: string;
  /** Type de ligne (`row` dans les premières versions de l’export, `type` ensuite). */
  row?: string;
  type?: string;
  id: string;
  code?: string;
  /** Vrai quand `id` est un identifiant de club (belong_team_config), clé de inagle_teams. */
  club?: boolean;
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
  .map((l) => JSON.parse(l) as NomJeu);

const db = new Database(options.mirror, { readonly: true });
const personnages = new Map(
  db
    .query<
      {
        chara_id: string;
        name_fr: string | null;
        name_en: string | null;
        name_ja: string | null;
      },
      []
    >("select chara_id, name_fr, name_en, name_ja from inagle_characters")
    .all()
    .map((r) => [normaliserId(String(r.chara_id)), r]),
);
const equipes = new Map(
  db
    .query<
      {
        id: string;
        name_fr: string | null;
        name_en: string | null;
        name_ja: string | null;
      },
      []
    >("select id, name_fr, name_en, name_ja from inagle_teams")
    .all()
    .map((r) => [normaliserId(String(r.id)), r]),
);
const competences = new Map(
  db
    .query<
      {
        internal_code: string;
        name_fr: string | null;
        name_en: string | null;
        name_ja: string | null;
      },
      []
    >(
      "select internal_code, name_fr, name_en, name_ja from inagle_skills where internal_code is not null",
    )
    .all()
    .map((r) => [r.internal_code, r]),
);
db.close();

type LigneMiroir = {
  name_fr: string | null;
  name_en: string | null;
  name_ja: string | null;
};

/**
 * Ligne du miroir désignée par une ref de l’export :
 *   - personnage : chara_base → inagle_characters.chara_id ;
 *   - équipe : club (belong_team_config) → inagle_teams.id ; les lignes
 *     team_config sont des équipes de match, absentes du miroir ;
 *   - technique : skill_config (code skillIDStr) → inagle_skills.internal_code.
 */
function ligneDuMiroir(
  kind: NomJeu["kind"],
  ref: Ref,
): LigneMiroir | undefined {
  if (kind === "character" && ref.table === "chara_base")
    return personnages.get(normaliserId(ref.id));
  if (kind === "team" && ref.club) return equipes.get(normaliserId(ref.id));
  if (kind === "skill" && ref.table === "skill_config" && ref.code)
    return competences.get(ref.code);
  return undefined;
}

interface Correction {
  kind: "character" | "team" | "skill";
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
  if (nom.variant !== 0 || nom.kind === "item") continue;
  for (const ref of nom.refs ?? []) {
    const ligne = ligneDuMiroir(nom.kind, ref);
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
        corrections.push({
          kind: nom.kind,
          id: ref.code ?? ref.id,
          code: ref.code,
          langue,
          actuel,
          propose,
          ecart,
        });
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
console.log(
  `relies=${relies} orphelins=${orphelins} corrections=${corrections.length} -> ${options.out}`,
);
for (const [cle, parEcart] of Object.entries(stats))
  console.log(cle, JSON.stringify(parEcart));
