export interface Suggestion {
	id: string;
	type: "clan" | "user";
	label: string;
	sim: number;
	clanShortName?: string;
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
}

export type SuggestionRank = {
	elo: number;
	key: string;
};

// Enum : source unique @achillea/types (partagé avec le bot).
import { UserRole } from "@achillea/types";

export { UserRole };
