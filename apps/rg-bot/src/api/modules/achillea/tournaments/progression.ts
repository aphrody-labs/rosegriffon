/**
 * Propagation du résultat d'un lobby de tournoi dans l'arbre — legacy
 * `BracketService.checkAndPropagateLobbyResult` + `propagateToManager` +
 * `generateLobbies` + `checkAndSetTournamentFinished`.
 *
 * Quand une manche est validée (ou qu'un joueur est disqualifié), la série du
 * lobby est résolue selon le format (BO1/BO3/BO5, aller-retour cumulé) :
 *  - série décidée : le lobby passe `Finished` (ou `Forfeited`), les scores sont
 *    reportés sur les `lobby_user`, le vainqueur est écrit dans le match de
 *    brackets-manager — qui le glisse lui-même dans le match suivant (et place
 *    les byes) — puis les lobbys des matchs devenus jouables sont ouverts ;
 *  - égalité cumulée (aller-retour) : le lobby passe `Contested`, aucun départage
 *    automatique : un organisateur tranche ;
 *  - série incomplète : rien ne bouge.
 * Quand plus aucun lobby n'est ouvert et que l'arbre est terminé, le tournoi
 * passe `Finished` (le bonus de podium est alors versé).
 *
 * Tout tient dans UNE transaction, l'arbre compris (l'adaptateur brackets-manager
 * écrit sur la transaction) : jamais de vainqueur écrit sans ses lobbys suivants.
 * Idempotent : l'événement est verrouillé (propagations concurrentes d'un même
 * tournoi sérialisées) puis le lobby ; un lobby déjà terminé est rendu tel quel
 * et un match d'arbre déjà complété n'est jamais réécrit.
 *
 * Écart assumé avec le legacy : l'Elo ranked d'un match de tournoi
 * (`EloService.applyTournamentLobbyResult`) n'est pas encore porté côté API.
 */
import { MatchFormat, computeSeriesOutcome } from "@rosegriffon/achillea-core";
import { BracketsManager } from "brackets-manager";
import { Status } from "brackets-model";
import type { Kysely, Transaction } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { KyselyBracketAdapter, finalTournamentStandings, type ExecuteurArbre } from "./bracket";
import { applyPlacementPrizes } from "./placement";
import { lobbysAOuvrir, ouvrirLobbys, type LobbyArbre, type MatchArbre } from "./start";

/** États de lobby après lesquels plus rien ne bouge (legacy `$nin FINISHED/FORFEITED/CANCELED`). */
export const ETATS_LOBBY_TERMINES: readonly string[] = ["Finished", "Forfeited", "Canceled"];

export interface MancheSerie {
  valide: boolean;
  score1: number;
  score2: number;
}

export type IssueSerie =
  | { statut: "attente" }
  | { statut: "egalite" }
  | { statut: "double_forfait" }
  | { statut: "decide"; gagnant: 1 | 2; score1: number; score2: number; forfait: boolean };

/** Une manche est validée par l'organisateur, ou par les deux camps (legacy `LobbyMatch.isValidated`). */
export function mancheValidee(m: { team1validated: boolean; team2validated: boolean; admin_validated: boolean }): boolean {
  return m.admin_validated || (m.team1validated && m.team2validated);
}

/**
 * Issue d'une série. Un forfait tranche d'office (1-0 pour l'autre camp) sans
 * attendre les manches ; deux forfaits sont une impasse (legacy : `Conflict`).
 */
export function issueSerie(
  format: string | null | undefined,
  manches: readonly MancheSerie[],
  forfaits: { equipe1: boolean; equipe2: boolean },
): IssueSerie {
  if (forfaits.equipe1 && forfaits.equipe2) return { statut: "double_forfait" };
  if (forfaits.equipe1) return { statut: "decide", gagnant: 2, score1: 0, score2: 1, forfait: true };
  if (forfaits.equipe2) return { statut: "decide", gagnant: 1, score1: 1, score2: 0, forfait: true };
  const issue = computeSeriesOutcome(
    (format ?? MatchFormat.BO1) as MatchFormat,
    manches.map(m => ({ isValidated: m.valide, scoreTeam1: m.score1, scoreTeam2: m.score2 })),
  );
  if (issue.status !== "decided") return { statut: issue.status === "tie" ? "egalite" : "attente" };
  return { statut: "decide", gagnant: issue.winner === 1 ? 1 : 2, score1: issue.scoreT1, score2: issue.scoreT2, forfait: false };
}

/** Charge utile de `manager.update.match` (legacy `propagateToManager`). */
export function miseAJourMatch(issue: Extract<IssueSerie, { statut: "decide" }>) {
  if (issue.forfait) {
    return {
      opponent1: issue.gagnant === 2 ? { forfeit: true } : { score: issue.score1 },
      opponent2: issue.gagnant === 1 ? { forfeit: true } : { score: issue.score2 },
    };
  }
  return {
    opponent1: issue.gagnant === 1 ? { score: issue.score1, result: "win" as const } : { score: issue.score1 },
    opponent2: issue.gagnant === 2 ? { score: issue.score2, result: "win" as const } : { score: issue.score2 },
  };
}

export interface EtatArbre {
  /** `false` si le match était déjà complété (rejeu) : rien n'a été écrit. */
  ecrit: boolean;
  /** Matchs encore à jouer de l'étape du match, avec leurs deux camps. */
  matchs: MatchArbre[];
  /** Plus aucun match à jouer dans le tournoi. */
  arbreTermine: boolean;
}

/**
 * Écrit le résultat dans l'arbre puis relit l'étape. Un match déjà complété
 * n'est pas réécrit (brackets-manager refuserait, et un rejeu ne doit rien changer).
 */
export async function appliquerResultatArbre(
  manager: BracketsManager,
  tournoiId: number,
  matchId: number,
  issue: Extract<IssueSerie, { statut: "decide" }>,
): Promise<EtatArbre> {
  const match = await manager.storage.select("match", matchId);
  if (!match) throw new Error(`Match d'arbre ${matchId} introuvable`);
  const ecrit = match.status < Status.Completed;
  if (ecrit) await manager.update.match({ id: matchId, ...miseAJourMatch(issue) });
  const matchs = (await manager.storage.select("match", { stage_id: match.stage_id })) ?? [];
  const arbreTermine = (await manager.get.currentStage(tournoiId)) === null;
  return {
    ecrit,
    arbreTermine,
    matchs: matchs
      .filter(m => m.status < Status.Completed)
      .map(m => ({
        id: Number(m.id),
        opponent1: m.opponent1 ? { id: m.opponent1.id ?? null } : null,
        opponent2: m.opponent2 ? { id: m.opponent2.id ?? null } : null,
      })),
  };
}

export type IssuePropagation =
  | { etat: "introuvable" | "non_tournoi" | "deja_termine" | "attente" | "litige" | "double_forfait" }
  | {
      etat: "termine";
      gagnant: 1 | 2;
      score1: number;
      score2: number;
      forfait: boolean;
      /** Lobbys des matchs devenus jouables. */
      lobbysOuverts: number[];
      tournoiTermine: boolean;
      /** Vainqueur du tournoi (rang 1), seulement quand le tournoi vient de se terminer. */
      championId: string | null;
    };

export interface OptionsPropagation {
  maintenant?: Date;
  /** Écritures préalables, exécutées sous verrou (forfaits d'une disqualification). */
  preparer?: (trx: Transaction<Database>) => Promise<void>;
}

/** Propage le résultat d'un lobby dans une transaction déjà ouverte. */
export async function propagerDansTransaction(
  trx: Transaction<Database>,
  lobbyId: number,
  options: OptionsPropagation = {},
): Promise<PropagationBrute> {
  const maintenant = options.maintenant ?? new Date();
  const apercu = await trx.selectFrom("lobby").select(["event_id", "event_type"]).where("id", "=", lobbyId).executeTakeFirst();
  if (!apercu) return { etat: "introuvable" };
  if (apercu.event_type !== "TOURNAMENT") return { etat: "non_tournoi" };
  // Ordre de verrous fixe (événement puis lobby) : deux demi-finales validées
  // ensemble s'écrivent l'une après l'autre dans la même case de la finale.
  const tournoi = await trx
    .selectFrom("event")
    .select(["id", "internal_state", "match_format", "custom_format_child_count"])
    .where("id", "=", apercu.event_id)
    .forUpdate()
    .executeTakeFirst();
  const lobby = await trx.selectFrom("lobby").selectAll().where("id", "=", lobbyId).forUpdate().executeTakeFirst();
  if (!tournoi || !lobby) return { etat: "introuvable" };
  if (ETATS_LOBBY_TERMINES.includes(lobby.state)) return { etat: "deja_termine" };
  if (options.preparer) await options.preparer(trx);

  const [joueurs, manches] = await Promise.all([
    trx.selectFrom("lobby_user").select(["id", "team", "forfeit"]).where("lobby_id", "=", lobbyId).execute(),
    trx
      .selectFrom("lobby_match")
      .select(["game_number", "score_team1", "score_team2", "team1validated", "team2validated", "admin_validated"])
      .where("lobby_id", "=", lobbyId)
      .orderBy("game_number", "asc")
      .execute(),
  ]);
  const issue = issueSerie(
    lobby.match_format,
    manches.map(m => ({ valide: mancheValidee(m), score1: m.score_team1, score2: m.score_team2 })),
    { equipe1: joueurs.some(j => j.team === 1 && j.forfeit), equipe2: joueurs.some(j => j.team === 2 && j.forfeit) },
  );
  if (issue.statut === "double_forfait") return { etat: "double_forfait" };
  if (issue.statut === "attente") return { etat: "attente" };
  if (issue.statut === "egalite") {
    // Égalité cumulée : aucun départage automatique, un organisateur tranche.
    await trx.updateTable("lobby").set({ state: "Contested", updated_at: maintenant }).where("id", "=", lobbyId).execute();
    return { etat: "litige" };
  }

  // Scores et forfaits sur les joueurs (source des stats profil), puis le lobby.
  for (const joueur of joueurs) {
    await trx
      .updateTable("lobby_user")
      .set({
        score: joueur.team === 1 ? issue.score1 : issue.score2,
        forfeit: issue.forfait && joueur.team !== issue.gagnant,
        state: "Finished",
        updated_at: maintenant,
      })
      .where("id", "=", joueur.id)
      .execute();
  }
  await trx
    .updateTable("lobby")
    .set({ state: issue.forfait ? "Forfeited" : "Finished", updated_at: maintenant })
    .where("id", "=", lobbyId)
    .execute();

  let lobbysOuverts: number[] = [];
  let tournoiTermine = false;
  // Un lobby de phase (suisse, ...) n'a pas d'arbre : la tâche `achillea:tournois-phases` avance les phases.
  if (lobby.bracket_match_id !== null) {
    const manager = new BracketsManager(new KyselyBracketAdapter(trx as unknown as ExecuteurArbre));
    const etat = await appliquerResultatArbre(manager, tournoi.id, Number(lobby.bracket_match_id), issue);
    const [participants, existants] = await Promise.all([
      trx
        .selectFrom("tournament_participant")
        .select(["user_id", "bracket_participant_id"])
        .where("tournament_id", "=", tournoi.id)
        .where("bracket_participant_id", "is not", null)
        .execute(),
      trx.selectFrom("lobby").select("bracket_match_id").where("event_id", "=", tournoi.id).where("event_type", "=", "TOURNAMENT").execute(),
    ]);
    const parParticipant = new Map(participants.map(p => [Number(p.bracket_participant_id), p.user_id]));
    const couverts = new Set(existants.flatMap(l => (l.bracket_match_id === null ? [] : [Number(l.bracket_match_id)])));
    const suivants: LobbyArbre[] = lobbysAOuvrir(etat.matchs, parParticipant, couverts);
    lobbysOuverts = await ouvrirLobbys(
      trx,
      { id: tournoi.id, format: tournoi.match_format ?? "bo1", personnalise: tournoi.custom_format_child_count },
      suivants,
      maintenant,
    );
    if (etat.arbreTermine) {
      const ouverts = await trx
        .selectFrom("lobby")
        .select(eb => eb.fn.countAll<number>().as("n"))
        .where("event_id", "=", tournoi.id)
        .where("state", "not in", [...ETATS_LOBBY_TERMINES])
        .executeTakeFirst();
      if (Number(ouverts?.n ?? 0) === 0) {
        const bascule = await trx
          .updateTable("event")
          .set({ internal_state: "Finished", closed_at: maintenant, updated_at: maintenant })
          .where("id", "=", tournoi.id)
          .where("internal_state", "=", "Ongoing")
          .executeTakeFirst();
        tournoiTermine = Number(bascule.numUpdatedRows) > 0;
        if (tournoiTermine) {
          await trx
            .insertInto("tournament_event")
            .values({
              tournament_id: tournoi.id,
              type: "TOURNAMENT_CLOSED",
              actor_id: null,
              target_id: null,
              payload: { automatic: true, forced: false, openLobbies: 0, lobbyId },
              reason: null,
            })
            .execute();
        }
      }
    }
  }
  return {
    etat: "termine",
    gagnant: issue.gagnant,
    score1: issue.score1,
    score2: issue.score2,
    forfait: issue.forfait,
    lobbysOuverts,
    tournoiTermine,
  };
}

export type PropagationBrute = Omit<Extract<IssuePropagation, { etat: "termine" }>, "championId"> | Exclude<IssuePropagation, { etat: "termine" }>;

/**
 * Suites d'une propagation validée, hors transaction : champion et bonus de
 * podium d'un tournoi qui vient de se terminer (idempotent par
 * `TOURNAMENT_PLACEMENT_PRIZES_APPLIED`). Un échec ne défait pas le résultat.
 */
export async function finaliserPropagation(db: Kysely<Database>, tournoiId: number, issue: PropagationBrute): Promise<IssuePropagation> {
  if (issue.etat !== "termine") return issue;
  let championId: string | null = null;
  if (issue.tournoiTermine) {
    try {
      championId = (await finalTournamentStandings(db, tournoiId)).find(ligne => ligne.rank === 1)?.userId ?? null;
    } catch {
      // Format sans classement final (poules) : pas de champion unique.
    }
    await applyPlacementPrizes(db, tournoiId, null).catch(erreur =>
      console.warn(`[achillea] bonus de podium du tournoi ${tournoiId} reporté :`, (erreur as Error)?.message),
    );
  }
  return { ...issue, championId };
}

/** Forme publique (API, site, CLI) d'une propagation ; `TournamentModel.serie`. */
export function resumeSerie(issue: IssuePropagation) {
  if (issue.etat !== "termine") {
    return {
      etat: issue.etat,
      gagnant: null,
      score1: null,
      score2: null,
      forfait: false,
      lobbysOuverts: [] as number[],
      tournoiTermine: false,
      championId: null,
    };
  }
  return {
    etat: issue.etat,
    gagnant: issue.gagnant,
    score1: issue.score1,
    score2: issue.score2,
    forfait: issue.forfait,
    lobbysOuverts: issue.lobbysOuverts,
    tournoiTermine: issue.tournoiTermine,
    championId: "championId" in issue ? issue.championId : null,
  };
}

/** Propage le résultat d'un lobby (transaction propre), puis ses suites. */
export async function propagerResultatLobby(
  db: Kysely<Database>,
  lobbyId: number,
  options: OptionsPropagation = {},
): Promise<IssuePropagation> {
  const lobby = await db.selectFrom("lobby").select("event_id").where("id", "=", lobbyId).executeTakeFirst();
  const issue = await db.transaction().execute(trx => propagerDansTransaction(trx, lobbyId, options));
  return finaliserPropagation(db, Number(lobby?.event_id ?? 0), issue);
}

/**
 * Disqualification en cours de tournoi (legacy `forfeitOpenLobbiesOf`) : chaque
 * lobby ouvert du joueur passe en forfait, toutes ses manches non validées sont
 * tranchées d'un coup (sinon la série resterait `pending`), et l'arbre avance.
 * Un lobby en échec n'empêche pas les autres. Rend le nombre de lobbys traités.
 */
export async function forfaiterLobbysOuverts(db: Kysely<Database>, tournoiId: number, userId: string): Promise<number> {
  const lobbys = await db
    .selectFrom("lobby as l")
    .innerJoin("lobby_user as lu", "lu.lobby_id", "l.id")
    .select(["l.id", "lu.team"])
    .where("l.event_id", "=", tournoiId)
    .where("l.event_type", "=", "TOURNAMENT")
    .where("l.state", "not in", [...ETATS_LOBBY_TERMINES])
    .where("lu.user_id", "=", userId)
    .execute();
  let traites = 0;
  for (const { id, team } of lobbys) {
    try {
      const issue = await propagerResultatLobby(db, Number(id), {
        preparer: async trx => {
          await trx
            .updateTable("lobby_user")
            .set({ forfeit: true, updated_at: new Date() })
            .where("lobby_id", "=", Number(id))
            .where("user_id", "=", userId)
            .execute();
          await trx
            .updateTable("lobby_match")
            .set({
              score_team1: team === 1 ? 0 : 1,
              score_team2: team === 2 ? 0 : 1,
              admin_validated: true,
              updated_at: new Date(),
            })
            .where("lobby_id", "=", Number(id))
            .where("admin_validated", "=", false)
            .where(eb => eb.not(eb.and([eb("team1validated", "=", true), eb("team2validated", "=", true)])))
            .execute();
        },
      });
      if (issue.etat === "termine") traites++;
    } catch (erreur) {
      console.warn(`[achillea] forfait du lobby ${id} non traité :`, (erreur as Error)?.message);
    }
  }
  return traites;
}
