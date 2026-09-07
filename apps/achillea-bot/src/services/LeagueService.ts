/**
 * Service championnat / ligue (type Premier League).
 *
 * - Exposition de la saison Asytral S1 (données sheet → classement validé)
 * - Génération de calendrier + standings pour les tournois `StageType.league`
 */

import {
	ASTRAL_FORMAT,
	ASTRAL_S1_DETAILS,
	ASYTRAL_CHAMPION,
	ASYTRAL_LEAGUE_META,
	ASYTRAL_PLAYOFF_RESULTS,
	ASYTRAL_POINTS,
	ASYTRAL_REGULAR_RESULTS,
	ASYTRAL_TEAMS,
	computeLeagueTable,
	generateDoubleRoundRobin,
	generateSingleRoundRobin,
	type AstralSeasonDetails,
	type LeagueFixture,
	type LeagueMatchResult,
	type LeaguePointsConfig,
	type LeagueStanding,
} from "@achillea/core";
import { singleton } from "tsyringe";

export interface LeagueSeasonPayload {
	meta: typeof ASYTRAL_LEAGUE_META & { champion?: string };
	format: typeof ASTRAL_FORMAT;
	teams: ReadonlyArray<{ tag: string; name: string }>;
	pointsConfig: LeaguePointsConfig;
	standings: LeagueStanding[];
	results: readonly LeagueMatchResult[];
	playoffs: typeof ASYTRAL_PLAYOFF_RESULTS;
	/** Fixtures théoriques d'un RR simple (pour saisons futures). */
	schedule?: LeagueFixture[];
	/** Détail sheet : manches joueurs, leaderboard, rosters, H2H. */
	details: AstralSeasonDetails;
}

@singleton()
export class LeagueService {
	/** Saison de référence Astral League S1 (statique, hors DB). */
	getAsytralSeason(): LeagueSeasonPayload {
		return this.getAstralSeason();
	}

	getAstralSeason(): LeagueSeasonPayload {
		const teamIds = ASYTRAL_TEAMS.map((t) => t.tag);
		const standings = computeLeagueTable(teamIds, ASYTRAL_REGULAR_RESULTS, ASYTRAL_POINTS);
		return {
			meta: { ...ASYTRAL_LEAGUE_META, champion: ASYTRAL_CHAMPION },
			format: ASTRAL_FORMAT,
			teams: ASYTRAL_TEAMS,
			pointsConfig: { ...ASYTRAL_POINTS },
			standings,
			results: ASYTRAL_REGULAR_RESULTS,
			playoffs: ASYTRAL_PLAYOFF_RESULTS,
			schedule: generateSingleRoundRobin(teamIds),
			details: ASTRAL_S1_DETAILS,
		};
	}

	/** Calcule un classement à la volée (outil TO / preview). */
	previewStandings(
		teamIds: string[],
		results: LeagueMatchResult[],
		config: LeaguePointsConfig = ASYTRAL_POINTS
	): LeagueStanding[] {
		return computeLeagueTable(teamIds, results, config);
	}

	/** Calendrier pour un futur tournoi `StageType.league`. */
	buildSchedule(teamIds: string[], doubleRound = false): LeagueFixture[] {
		return doubleRound ? generateDoubleRoundRobin(teamIds) : generateSingleRoundRobin(teamIds);
	}
}
