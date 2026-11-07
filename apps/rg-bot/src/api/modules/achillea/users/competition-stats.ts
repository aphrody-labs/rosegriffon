/**
 * Bilans « Tournois » et « Interclans » du profil public (`GET /users/:id`).
 *
 * Port des requêtes legacy `UserService.getTournamentStatsForUser` et
 * `getInterclanStatsForUser` : l'API unifiée renvoyait jusque-là des zéros
 * en dur, si bien que la page profil affichait « 0 tournoi » pour un joueur
 * classé au circuit.
 *
 * - Tournois : lobbies `TOURNAMENT` terminés (ou forfaits) du joueur ; le
 *   total compte les tournois distincts, le bilan perso les rencontres.
 * - Interclans : events `INTERCLAN` au résultat validé (état 7) où le joueur
 *   figure dans une composition ; le bilan perso vient de ses lobbies.
 *
 * `count(distinct …)` sur l'identifiant de lobby : une rencontre compte une
 * fois même si la jointure adverse renvoie plusieurs lignes.
 */

import { sql, type Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { ETAT } from "../interclans/regles";

export interface CompetitionStats {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  goalsScoredAvg: number;
  goalsReceivedAvg: number;
  personalTotal: number;
  personalWins: number;
  personalLosses: number;
  personalDraws: number;
}

export type CompetitionRow = Record<string, number | string | null | undefined>;

const num = (value: number | string | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Tournois : pas de notion de clan, « wins/losses » = bilan personnel. */
export function toTournamentStats(row: CompetitionRow | undefined): CompetitionStats {
  const personalWins = num(row?.personal_wins);
  const personalLosses = num(row?.personal_losses);
  const personalDraws = num(row?.personal_draws);
  return {
    total: num(row?.total),
    wins: personalWins,
    losses: personalLosses,
    draws: personalDraws,
    goalsScoredAvg: num(row?.goals_scored_avg),
    goalsReceivedAvg: num(row?.goals_received_avg),
    personalTotal: num(row?.personal_total),
    personalWins,
    personalLosses,
    personalDraws,
  };
}

export function toInterclanStats(row: CompetitionRow | undefined): CompetitionStats {
  return {
    total: num(row?.total),
    wins: num(row?.wins),
    losses: num(row?.losses),
    draws: num(row?.draws),
    goalsScoredAvg: num(row?.goals_scored_avg),
    goalsReceivedAvg: num(row?.goals_received_avg),
    personalTotal: num(row?.personal_total),
    personalWins: num(row?.personal_wins),
    personalLosses: num(row?.personal_losses),
    personalDraws: num(row?.personal_draws),
  };
}

export async function tournamentStats(db: Kysely<Database>, userId: string): Promise<CompetitionStats> {
  const result = await sql<CompetitionRow>`
		with matches as (
			select l.id as lobby_id, l.event_id, me.score as my_score, opp.score as opp_score,
				me.forfeit as my_forfeit, opp.forfeit as opp_forfeit
			from lobby l
			join lobby_user me on me.lobby_id = l.id and me.user_id = ${userId}
			join lobby_user opp on opp.lobby_id = l.id and opp.team <> me.team
			where l.event_type = 'TOURNAMENT' and l.state in ('Finished', 'Forfeited')
		), per_lobby as (
			select distinct on (lobby_id) lobby_id, event_id, my_score, opp_score, my_forfeit, opp_forfeit
			from matches order by lobby_id
		)
		select
			count(distinct event_id) as total,
			count(*) as personal_total,
			count(*) filter (where not my_forfeit and (opp_forfeit or my_score > opp_score)) as personal_wins,
			count(*) filter (where my_forfeit or (not opp_forfeit and my_score < opp_score)) as personal_losses,
			count(*) filter (where not my_forfeit and not opp_forfeit and my_score = opp_score) as personal_draws,
			coalesce(avg(my_score) filter (where not my_forfeit and not opp_forfeit), 0) as goals_scored_avg,
			coalesce(avg(opp_score) filter (where not my_forfeit and not opp_forfeit), 0) as goals_received_avg
		from per_lobby
	`.execute(db);
  return toTournamentStats(result.rows[0]);
}

export async function interclanStats(db: Kysely<Database>, userId: string): Promise<CompetitionStats> {
  const validated = ETAT.RESULTAT_VALIDE;
  const result = await sql<CompetitionRow>`
		with clan_results as (
			select
				count(distinct e.id) as total,
				count(distinct case when e.winner_clan_id::bigint = il.clan_id::bigint then e.id end) as wins,
				count(distinct case when e.winner_clan_id is not null
					and e.winner_clan_id::bigint <> il.clan_id::bigint then e.id end) as losses,
				count(distinct case when e.winner_clan_id is null then e.id end) as draws
			from interclan_lineup_member ilm
			join interclan_lineup il on il.id = ilm.lineup_id
			join event e on e.id = il.event_id
			where ilm.user_id = ${userId} and e.type = 'INTERCLAN' and e.state = ${validated}
		), per_lobby as (
			select distinct on (l.id) l.id as lobby_id, me.score as my_score, opp.score as opp_score
			from lobby l
			join lobby_user me on me.lobby_id = l.id and me.user_id = ${userId}
			join lobby_user opp on opp.lobby_id = l.id and opp.team <> me.team
			join event e on e.id = l.event_id
			where l.event_type = 'INTERCLAN' and e.state = ${validated}
			order by l.id
		), personal as (
			select
				count(*) as personal_total,
				count(*) filter (where my_score > opp_score) as personal_wins,
				count(*) filter (where my_score < opp_score) as personal_losses,
				count(*) filter (where my_score = opp_score) as personal_draws,
				coalesce(avg(my_score), 0) as goals_scored_avg,
				coalesce(avg(opp_score), 0) as goals_received_avg
			from per_lobby
		)
		select clan_results.*, personal.* from clan_results, personal
	`.execute(db);
  return toInterclanStats(result.rows[0]);
}
