import type { SuggestionRank, UserRole } from "../models/Suggestion";

export type AuthStatus = "unknown" | "loading" | "authenticated" | "anonymous" | "error";

export type AuthUser = {
	id: string;
	username: string;
	clanId?: number;
	sim: number;
	avatar?: string;
	soloRank: SuggestionRank;
	duoRank: SuggestionRank;
	lastInteract?: Date;
	role?: UserRole;
	currentLevel?: number;
	totalXp?: number;
	hasTwitch?: boolean;
	hasChallonge?: boolean;
	hasYoutube?: boolean;
};
