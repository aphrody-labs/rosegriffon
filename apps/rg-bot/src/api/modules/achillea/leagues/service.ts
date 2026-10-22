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
  generateSingleRoundRobin,
} from "@rosegriffon/achillea-core";

export abstract class LeagueService {
  /**
   * Saison désignée par son identifiant ou l'un de ses alias (casse ignorée),
   * `null` si aucune ne correspond. Seule Astral S1 existe à ce jour.
   */
  static findSeason(id: string) {
    const wanted = id.trim().toLowerCase();
    const known = [ASYTRAL_LEAGUE_META.id, ...ASYTRAL_LEAGUE_META.aliases].map(alias => alias.toLowerCase());
    return known.includes(wanted) ? LeagueService.getAstralSeason() : null;
  }

  static getAstralSeason() {
    const teamIds = ASYTRAL_TEAMS.map(team => team.tag);
    return {
      meta: { ...ASYTRAL_LEAGUE_META, champion: ASYTRAL_CHAMPION, aliases: [...ASYTRAL_LEAGUE_META.aliases] },
      format: ASTRAL_FORMAT,
      teams: ASYTRAL_TEAMS.map(team => ({ ...team })),
      pointsConfig: { ...ASYTRAL_POINTS },
      standings: [...computeLeagueTable(teamIds, ASYTRAL_REGULAR_RESULTS, ASYTRAL_POINTS)],
      results: [...ASYTRAL_REGULAR_RESULTS],
      playoffs: [...ASYTRAL_PLAYOFF_RESULTS],
      schedule: [...generateSingleRoundRobin(teamIds)],
      details: ASTRAL_S1_DETAILS,
    };
  }
}
