import { UserDTO } from "../../shared/services/user-service";
import { ClanMemberDistinction, ClanMemberRole } from "./ClanMember";
import { Suggestion, SuggestionRank, UserRole } from "./Suggestion";

export type User = {
	id: string;
	name: string;
	rank: Rank;
	logo: string;
};

export type Rank = {
	label: string;
	minElo: number;
	maxElo: number;
	gradient: string[];
};

/** Stats agrégées interclans / tournois (miroir de @achillea/types). */
export type CompetitionStats = {
	total: number;
	wins: number;
	losses: number;
	draws?: number;
	goalsScoredAvg: number;
	goalsReceivedAvg: number;
	personalTotal: number;
	personalWins: number;
	personalLosses: number;
	personalDraws: number;
};

export type EnrichedUserDTO = UserDTO & {
	clan?: {
		id: number;
		shortenedName: string;
		name: string;
		avatarUrl?: string;
		role: ClanMemberRole;
		distinctions: ClanMemberDistinction[];
	};
	interclans: CompetitionStats;
	tournaments: CompetitionStats;
	ranked: {
		solo: RankedModeStats;
		duo: RankedModeStats;
	};
	/** Éditable par le titulaire du profil (PUT /users/me/profile). */
	bio: string | null;
	twitchUrl: string | null;
};

export type RankedModeStats = {
	mode: MatchMode;
	total: number;
	wins: number;
	losses: number;
	draws: number;
	goalsScored: number;
	goalsReceived: number;
};

export enum MatchMode {
	ONE_VS_ONE = 2,
	TWO_VS_TWO = 4,
}

export function suggestionToUserDTO(suggestion: Suggestion): UserDTO {
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
	} as UserDTO;
}
