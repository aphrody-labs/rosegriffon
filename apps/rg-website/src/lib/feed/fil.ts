// SPDX-License-Identifier: Apache-2.0
// Fil unifié : propriétaire unique de la logique du Feed. Interroge en parallèle les sources
// retenues par le filtre (réseau, groupe, compte), tolère la panne de l'une d'elles, fusionne et
// trie par date. L'interface ne fait que consommer `FilUnifie`.
//
// Temps réel : pas de websocket (aucun des trois réseaux n'en offre en lecture publique) ; le
// client relit toutes les 30 s, le serveur met chaque lecture en cache 45 s (profils 10 min,
// oEmbed 1 h) et fusionne les appels identiques simultanés, ce qui protège la session X.
import { comptesDuFiltre } from "./comptes";
import type { FiltreFil } from "./comptes";
import { avecDelai } from "./memo";
import { decoderCurseur, encoderCurseur, fusionner } from "./normalisation";
import type { CurseursParReseau } from "./normalisation";
import type { FilUnifie, PageSource, ProfilFeed, SourceFeed, StatutSource } from "./types";
import { cleProfil } from "./types";

const DELAI_SOURCE_MS = 35_000;
export const MAX_PAR_LECTURE = 80;

export async function composerFil(
  sources: readonly SourceFeed[],
  filtre: FiltreFil,
  curseur?: string,
): Promise<FilUnifie> {
  const comptes = comptesDuFiltre(filtre);
  const curseurs: CurseursParReseau | null = decoderCurseur(curseur);
  // Page suivante : seules les sources qui ont encore une suite sont relues.
  const actives = sources.filter(s => comptes.some(c => c.reseau === s.reseau) && (!curseurs || curseurs[s.reseau]));

  const resultats = await Promise.all(
    actives.map(async (source): Promise<{ source: SourceFeed; page: PageSource }> => {
      try {
        const page = await avecDelai(
          source.lire({ comptes: comptes.filter(c => c.reseau === source.reseau), curseur: curseurs?.[source.reseau] }),
          DELAI_SOURCE_MS,
          `source ${source.reseau}`,
        );
        return { source, page };
      } catch {
        // Une source qui échoue ne casse pas les autres.
        return {
          source,
          page: {
            posts: [],
            profils: [],
            statut: {
              reseau: source.reseau,
              etat: "indisponible",
              message: "Cette source ne répond pas pour le moment.",
            },
          },
        };
      }
    }),
  );

  const profils: Record<string, ProfilFeed> = {};
  for (const { page } of resultats) for (const p of page.profils) profils[cleProfil(p.reseau, p.pseudo)] = p;

  const suite: CurseursParReseau = {};
  for (const { source, page } of resultats) if (page.curseur) suite[source.reseau] = page.curseur;

  const statuts: StatutSource[] = resultats.map(r => r.page.statut);
  return {
    posts: fusionner(
      resultats.map(r => r.page.posts),
      MAX_PAR_LECTURE,
    ),
    profils,
    sources: statuts,
    curseur: encoderCurseur(suite),
    recuLe: new Date().toISOString(),
  };
}
