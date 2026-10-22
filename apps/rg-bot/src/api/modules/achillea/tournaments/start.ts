/**
 * Démarrage d'un tournoi — legacy `TournamentsService.startTournament`.
 *
 * Le legacy distinguait deux chemins :
 *  - le tournoi a des phases (`tournament_phase` encore `Pending`) : la première
 *    est appariée par `SwissStageService.startSwiss`. Ici, c'est la tâche
 *    `achillea:tournois-phases` qui apparie et fait avancer les phases ;
 *  - le tournoi n'a AUCUNE phase : l'arbre brackets-manager construit pendant la
 *    préparation (`tournament_type` du tournoi) tient lieu de phase unique, et
 *    `BracketService.generateLobbies` ouvre un lobby par match dont les deux
 *    camps sont connus, avec une manche (`lobby_match`) par partie du format.
 *
 * Le legacy n'avait pas de démarrage « sans arbre » : `getCurrentStage` levait
 * `NotFound` et l'appel finissait en « Impossible de démarrer le tournoi. » —
 * mais APRÈS avoir déjà passé le tournoi en `Ongoing`. Ici le refus précède
 * toute écriture : un tournoi sans arbre possible reste en préparation.
 */
import type { Kysely, Transaction } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { currentStageMatches, rebuildTournamentBracket } from "./bracket";

/** Nombre de manches d'un lobby selon son format (legacy `BracketService.getChildCount`). */
export function nombreManches(format: string | null | undefined, personnalise?: number | null): number {
  switch (format) {
    case "bo3":
      return 3;
    case "bo5":
      return 5;
    case "double_leg":
      return 2;
    case "custom":
      return personnalise || 1;
    default:
      return 1;
  }
}

export interface MatchArbre {
  id: number;
  opponent1: { id: number | string | null } | null;
  opponent2: { id: number | string | null } | null;
}

export interface LobbyArbre {
  matchId: number;
  equipe1: string;
  equipe2: string;
}

/**
 * Lobbys à ouvrir (legacy `generateLobbies`) : un par match dont les deux camps
 * sont des participants connus. Un bye (adversaire absent) ou un tour futur
 * (adversaire encore indéterminé) n'en reçoit pas — un tel lobby resterait
 * `Fresh` à vie. Les matchs qui ont déjà leur lobby sont sautés (idempotent).
 */
export function lobbysAOuvrir(
  matchs: readonly MatchArbre[],
  joueurParParticipant: ReadonlyMap<number, string>,
  matchsCouverts: ReadonlySet<number>,
): LobbyArbre[] {
  const lobbys: LobbyArbre[] = [];
  for (const match of matchs) {
    if (matchsCouverts.has(match.id)) continue;
    const a = match.opponent1?.id;
    const b = match.opponent2?.id;
    if (a === null || a === undefined || b === null || b === undefined) continue;
    const equipe1 = joueurParParticipant.get(Number(a));
    const equipe2 = joueurParParticipant.get(Number(b));
    if (!equipe1 || !equipe2) continue;
    lobbys.push({ matchId: match.id, equipe1, equipe2 });
  }
  return lobbys;
}

/**
 * Insère les lobbys d'un tournoi (legacy `generateLobbies`) : le lobby, ses deux
 * joueurs (équipe 1 = `opponent1`) et une manche par partie du format. Appelé dans
 * la transaction de l'appelant : démarrage, ou propagation d'un résultat.
 */
export async function ouvrirLobbys(
  trx: Transaction<Database>,
  tournoi: { id: number; format: string; personnalise: number | null },
  lobbys: readonly LobbyArbre[],
  maintenant: Date,
): Promise<number[]> {
  const manches = nombreManches(tournoi.format, tournoi.personnalise);
  const ids: number[] = [];
  for (const l of lobbys) {
    const lobby = await trx
      .insertInto("lobby")
      .values({
        created_at: maintenant,
        updated_at: maintenant,
        event_type: "TOURNAMENT",
        event_id: tournoi.id,
        mode: 2,
        state: "Fresh",
        bracket_match_id: l.matchId,
        channel_id: null,
        host_user_id: null,
        is_repool: false,
        phase_id: null,
        swiss_round: null,
        match_format: tournoi.format,
        custom_format_child_count: tournoi.personnalise,
        ranked_elo_applied: false,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const joueur = (userId: string, team: number) => ({
      created_at: maintenant,
      updated_at: maintenant,
      user_id: userId,
      lobby_id: lobby.id,
      team,
      score: 0,
      forfeit: false,
      elo_variation: 0,
      validated_result: false,
      claimed_opponent_score: null,
      screenshot_url: null,
      state: "Pending",
    });
    await trx.insertInto("lobby_user").values([joueur(l.equipe1, 1), joueur(l.equipe2, 2)]).execute();
    await trx
      .insertInto("lobby_match")
      .values(
        Array.from({ length: manches }, (_, i) => ({
          created_at: maintenant,
          updated_at: maintenant,
          lobby_id: lobby.id,
          game_number: i + 1,
          score_team1: 0,
          score_team2: 0,
          team1validated: false,
          team2validated: false,
          admin_validated: false,
        })),
      )
      .execute();
    ids.push(Number(lobby.id));
  }
  return ids;
}

/** Refus de démarrage, avec le message montré au site, au bot et à la CLI. */
export const REFUS_DEMARRAGE = {
  pasEnPreparation:
    "La phase de préparation du tournoi n'est pas terminée, le tournoi a déjà démarré ou est terminé.",
  championnat:
    "Un championnat (league) n'a pas d'arbre : ajoutez-lui une phase avant de le démarrer.",
  sansArbre:
    "Impossible de démarrer le tournoi : aucun arbre n'a pu être généré (au moins deux participants actifs, dans la limite des places).",
  sansLobby: "Impossible de démarrer le tournoi : l'arbre ne contient aucun match jouable.",
} as const;

export type IssueDemarrage =
  | { ok: true; phases: number; lobbies: number }
  | { ok: false; status: 400 | 404; message: string };

/**
 * Démarre un tournoi en préparation : `Ongoing`, événement `TOURNAMENT_STARTED`
 * et, sans phase, les lobbys du premier tour de l'arbre. Tout ou rien : les
 * lobbys, l'état et l'événement sont écrits dans une même transaction.
 */
export async function demarrerTournoi(
  db: Kysely<Database>,
  tournoiId: number,
  acteurId: string | null,
  maintenant = new Date(),
): Promise<IssueDemarrage> {
  const tournoi = await db
    .selectFrom("event")
    .select(["id", "internal_state", "tournament_type", "match_format", "custom_format_child_count"])
    .where("id", "=", tournoiId)
    .where("type", "=", "TOURNAMENT")
    .executeTakeFirst();
  if (!tournoi) return { ok: false, status: 404, message: "Tournament not found" };
  if (tournoi.internal_state !== "Preparing") return { ok: false, status: 400, message: REFUS_DEMARRAGE.pasEnPreparation };

  const phases = await db
    .selectFrom("tournament_phase")
    .select("id")
    .where("tournament_id", "=", tournoiId)
    .where("status", "=", "Pending")
    .execute();

  // Sans phase : l'arbre du tournoi est la phase unique. S'il manque (préparation
  // ouverte à la main, arbre supprimé), il est construit maintenant.
  let lobbys: LobbyArbre[] = [];
  if (phases.length === 0) {
    if (tournoi.tournament_type === "league") return { ok: false, status: 400, message: REFUS_DEMARRAGE.championnat };
    let etape = await currentStageMatches(tournoiId);
    if (!etape && (await rebuildTournamentBracket(db, tournoiId).catch(() => false))) etape = await currentStageMatches(tournoiId);
    if (!etape) return { ok: false, status: 400, message: REFUS_DEMARRAGE.sansArbre };
    const [participants, existants] = await Promise.all([
      db
        .selectFrom("tournament_participant")
        .select(["user_id", "bracket_participant_id"])
        .where("tournament_id", "=", tournoiId)
        .where("bracket_participant_id", "is not", null)
        .execute(),
      db.selectFrom("lobby").select("bracket_match_id").where("event_id", "=", tournoiId).where("event_type", "=", "TOURNAMENT").execute(),
    ]);
    const joueurs = new Map(participants.map(p => [Number(p.bracket_participant_id), p.user_id]));
    const couverts = new Set(existants.flatMap(l => (l.bracket_match_id === null ? [] : [Number(l.bracket_match_id)])));
    lobbys = lobbysAOuvrir(etape.matches, joueurs, couverts);
    if (lobbys.length === 0 && couverts.size === 0) return { ok: false, status: 400, message: REFUS_DEMARRAGE.sansLobby };
  }

  const format = tournoi.match_format ?? "bo1";
  const demarre = await db.transaction().execute(async trx => {
    const bascule = await trx
      .updateTable("event")
      .set({ internal_state: "Ongoing", updated_at: maintenant })
      .where("id", "=", tournoiId)
      .where("internal_state", "=", "Preparing")
      .executeTakeFirst();
    // Démarrage concurrent (clic + tâche planifiée) : le premier l'emporte.
    if (Number(bascule.numUpdatedRows) === 0) return false;
    await ouvrirLobbys(trx, { id: tournoiId, format, personnalise: tournoi.custom_format_child_count }, lobbys, maintenant);
    const actifs = await trx
      .selectFrom("tournament_participant")
      .select(eb => eb.fn.countAll<number>().as("n"))
      .where("tournament_id", "=", tournoiId)
      .where("status", "=", "Active")
      .executeTakeFirst();
    await trx
      .insertInto("tournament_event")
      .values({
        tournament_id: tournoiId,
        type: "TOURNAMENT_STARTED",
        actor_id: acteurId,
        target_id: null,
        payload: {
          automatic: acteurId === null,
          participants: Number(actifs?.n ?? 0),
          phases: phases.length,
          lobbies: lobbys.length,
        },
        reason: null,
      })
      .execute();
    return true;
  });
  if (!demarre) return { ok: false, status: 400, message: REFUS_DEMARRAGE.pasEnPreparation };
  return { ok: true, phases: phases.length, lobbies: lobbys.length };
}
