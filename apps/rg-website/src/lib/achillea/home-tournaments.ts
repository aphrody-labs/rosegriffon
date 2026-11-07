import type { AchilleaClient } from "@rosegriffon/achillea-client";
import { TournamentState, type TournamentListItem } from "@rosegriffon/achillea-types";

/** Nombre de tournois récents montrés sur l'accueil quand aucun n'est actif. */
export const RECENT_TOURNAMENTS = 3;

/**
 * Derniers tournois terminés (`GET /tournaments?states=Finished`, tri par id
 * décroissant côté API). L'accueil les affiche quand aucun tournoi n'est en
 * cours ou ouvert : sinon il annonçait « Aucun tournoi publié » alors que
 * l'API en renvoie (9 au 5 novembre 2026, tous terminés).
 */
export async function loadRecentTournaments(
  client: Pick<AchilleaClient, "tournaments">,
  limit = RECENT_TOURNAMENTS,
): Promise<TournamentListItem[]> {
  try {
    const response = await client.tournaments.list({
      page: 1,
      pageSize: limit,
      states: [TournamentState.FINISHED],
    });
    if (!response.ok) return [];
    return response.value.data.slice(0, limit);
  } catch {
    return [];
  }
}
