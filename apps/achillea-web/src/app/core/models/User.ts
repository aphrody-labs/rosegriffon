export { MatchMode } from "@rosegriffon/achillea-types";
export type {
	CompetitionStats,
	EnrichedUserDTO,
	Rank,
	RankDTO,
	RankedModeStats,
	SessionRankDTO,
	SessionUserDTO,
	UpdateUserProfilePayload,
	User,
	UserClanSummary,
	UserRef,
} from "@rosegriffon/achillea-types";

import type { SessionUserDTO, Suggestion } from "@rosegriffon/achillea-types";

/** Projette une suggestion de recherche en utilisateur de session. */
export function suggestionToUserDTO(suggestion: Suggestion): SessionUserDTO {
	return {
		id: suggestion.id,
		username: suggestion.label,
		sim: suggestion.sim,
		avatar: suggestion.avatar,
		soloRank: suggestion.soloRank,
		duoRank: suggestion.duoRank,
		role: suggestion.role,
		currentLevel: suggestion.currentLevel,
		totalXp: suggestion.totalXp,
		hasTwitch: suggestion.hasTwitch,
		hasChallonge: suggestion.hasChallonge,
		hasYoutube: suggestion.hasYoutube,
	};
}
