import type { LeagueMatchRow } from "@rosegriffon/achillea-types";

/** Un match de championnat (résultat d'équipe). */
export interface LeagueMatchResult extends LeagueMatchRow {
  playedAt?: string | Date | null;
}
