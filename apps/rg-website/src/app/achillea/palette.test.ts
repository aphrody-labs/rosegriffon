/**
 * Garde des jetons de statut (docs/PLAN-SESSIONS.md §7).
 *
 * Dans `app/achillea/**` et `components/achillea/**`, un statut ou un état
 * (succès, alerte, erreur, information) s'écrit avec les jetons sémantiques de
 * `@rosegriffon/ui` : `success`, `warning`, `destructive`, `primary`,
 * `tertiary`, `muted`… et leurs `-foreground`. Une palette Tailwind brute
 * (`text-emerald-400`, `bg-rose-600`…) ignore le thème clair/sombre et la
 * marque : elle est refusée ici.
 *
 * Les couleurs qui sont des DONNÉES restent permises, et seulement aux
 * endroits listés ci-dessous. Les feuilles CSS (`achillea.css`) ne sont pas
 * parcourues : c'est là que les jetons et la rampe de marque sont définis.
 */
import { describe, expect, it } from "bun:test";

const RACINE = `${import.meta.dir}/../..`;
const DOSSIERS = ["app/achillea", "components/achillea"];

/** Familles de la palette Tailwind (assemblées pour que ce fichier ne se signale pas lui-même). */
const FAMILLES = [
  "emerald", "green", "lime", "teal", "rose", "red", "amber", "yellow", "orange",
  "sky", "blue", "cyan", "indigo", "purple", "violet", "fuchsia", "pink",
  "slate", "gray", "zinc", "neutral", "stone",
];
const PALETTE_BRUTE = new RegExp(String.raw`(?<![\w-])(?:[a-z-]+:)*[a-z]+(?:-[a-z]+)*-(?:${FAMILLES.join("|")})-\d{2,3}\b`, "g");
/** Valeur arbitraire hexadécimale dans une classe : `text-[#f87171]`, `from-[#6d00ce]/30`. */
const HEX_ARBITRAIRE = /(?<![\w-])(?:[a-z-]+:)*[a-z]+(?:-[a-z]+)*-\[#[0-9a-fA-F]{3,8}\]/g;

/**
 * Exceptions, fichier par fichier, avec leur raison.
 * - `couleurs-donnees.ts` : métaux du podium (or/argent/bronze, la couleur EST le
 *   rang) et couleurs de marque Twitch/YouTube, centralisés dans `MEDAILLE`/`MARQUE`.
 * - `clan-profile-client.tsx` : dégradé de remplacement de bannière aux couleurs
 *   de la marque Achilléa (#6d00ce, #DFFF57), pas un statut.
 * Les couleurs des rangs ELO (hex dans `RankedTiersGrid`, `guide/brand`,
 * `TierDistribution`, dégradés « Fer » de repli) sont des chaînes de données,
 * pas des classes : ce test ne les voit pas, et c'est voulu.
 */
const EXCEPTIONS: Record<string, RegExp[]> = {
  "components/achillea/couleurs-donnees.ts": [/.*/],
  "app/achillea/clans/[id]/clan-profile-client.tsx": [/^from-\[#6d00ce\]$/, /^to-\[#DFFF57\]$/],
};

async function fichiersSources(): Promise<string[]> {
  const sortie: string[] = [];
  for (const dossier of DOSSIERS) {
    for await (const relatif of new Bun.Glob("**/*.{ts,tsx}").scan(`${RACINE}/${dossier}`)) {
      const fichier = `${dossier}/${relatif.replaceAll("\\", "/")}`;
      if (!fichier.endsWith(".test.ts")) sortie.push(fichier);
    }
  }
  return sortie;
}

describe("jetons de statut dans Achilléa", () => {
  it("n'emploie aucune palette Tailwind brute hors des exceptions de données", async () => {
    const fichiers = await fichiersSources();
    expect(fichiers.length).toBeGreaterThan(50);
    const violations: string[] = [];
    for (const fichier of fichiers) {
      const permises = EXCEPTIONS[fichier] ?? [];
      const lignes = (await Bun.file(`${RACINE}/${fichier}`).text()).split("\n");
      lignes.forEach((ligne, index) => {
        for (const motif of [PALETTE_BRUTE, HEX_ARBITRAIRE]) {
          for (const [classe] of ligne.matchAll(motif)) {
            const nue = classe.replace(/^(?:[a-z-]+:)+/, "");
            if (!permises.some(permise => permise.test(nue))) violations.push(`${fichier}:${index + 1} ${classe}`);
          }
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it("reconnaît une palette brute et laisse passer les jetons", () => {
    const brutes = ["text-emerald-400", "hover:bg-rose-600/20", "border-amber-500/30", "ring-slate-300", "text-[#f87171]"];
    for (const classe of brutes) {
      const trouve = [...classe.matchAll(PALETTE_BRUTE), ...classe.matchAll(HEX_ARBITRAIRE)];
      expect({ classe, trouve: trouve.length }).toEqual({ classe, trouve: 1 });
    }
    for (const jeton of ["text-success", "bg-destructive/10", "hover:text-warning/80", "text-success-foreground", "bg-surface-container"]) {
      expect([...jeton.matchAll(PALETTE_BRUTE), ...jeton.matchAll(HEX_ARBITRAIRE)]).toEqual([]);
    }
  });
});
