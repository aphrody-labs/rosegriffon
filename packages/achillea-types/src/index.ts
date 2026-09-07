/**
 * @achillea/types — Contrats d'API partagés (DTO + enums).
 *
 * SOURCE UNIQUE des shapes ET des enums échangés entre le bot (API) et le web.
 * Types + enums (runtime) consommés directement par Bun et par Angular
 * (via path tsconfig / résolution workspace) — aucun build séparé requis.
 */

// ── Enums partagés (source unique) ───────────────────────────────────────────
export * from "./enums/clanState";
export * from "./enums/clanMemberRole";
export * from "./enums/userRole";
export * from "./enums/eventEnums";

import type { ClanState } from "./enums/clanState";
import type { ClanMemberDistinction, ClanMemberRole } from "./enums/clanMemberRole";
import type { MatchMode } from "./enums/eventEnums";
import type { UserRole } from "./enums/userRole";

// ── User ────────────────────────────────────────────────────────────────────

export interface RankDTO {
	elo: number;
	key: string;
	gradient: string[];
}

export interface UserDTO {
	id: string;
	type: string;
	username: string;
	sim: number;
	avatar?: string;
	clanId?: number;
	soloRank: RankDTO;
	duoRank: RankDTO;
	lastInteract?: Date;
	role?: UserRole;
	currentLevel?: number;
	totalXp?: number;
	hasTwitch?: boolean;
	hasChallonge?: boolean;
	hasYoutube?: boolean;
}

export interface RankedModeStats {
	mode: MatchMode;
	total: number;
	wins: number;
	losses: number;
	draws: number;
	goalsScored: number;
	goalsReceived: number;
}

/** Stats agrégées d'un mode de compétition (interclans / tournois). */
export interface CompetitionStats {
	/** Nombre d'événements distincts (tournois / interclans) auxquels le joueur a participé. */
	total: number;
	/** Victoires d'équipe / de clan (contrib). */
	wins: number;
	/** Défaites d'équipe / de clan (contrib). */
	losses: number;
	/** Nuls d'équipe (si applicable). */
	draws: number;
	goalsScoredAvg: number;
	goalsReceivedAvg: number;
	/** Matchs individuels joués. */
	personalTotal: number;
	personalWins: number;
	personalLosses: number;
	personalDraws: number;
}

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
	/** Stats de matchs de tournoi (brackets / swiss). */
	tournaments: CompetitionStats;
	ranked: {
		solo: RankedModeStats;
		duo: RankedModeStats;
	};
	/** Éditable par le titulaire du profil (PUT /users/me/profile). */
	bio: string | null;
	twitchUrl: string | null;
};

// ── Clan ──────────────────────────────────────────────────────────────────

export interface ClanDTO {
	id: number;
	founders: string;
	name: string;
	shortenedName: string;
	normalizedShortName: string;
	clanAvatarUrl: string;
	clanBiography: string;
	fame: number;
	xUrl?: string | null;
	instagramUrl?: string | null;
	tiktokUrl?: string | null;
	isRecruiting: boolean;
	isInactive: boolean;
	isHidden: boolean;
	isDisbanded: boolean;
	autoAcceptMembers: boolean;
	state: ClanState;
	createdAt: Date;
	languages: string[];
	origin: string;
	experience: { currentLevel: number; totalXp: number };
	membersCount: number;
	president: UserDTO;
}

export interface ClanMemberDTO {
	clanRole: ClanMemberRole;
	distinctions: string[];
	clanFameContributed: number;
	createdAt: Date;
	updatedAt: Date;
	user: UserDTO;
}

export interface ClanApplicationDTO {
	id: number;
	user: UserDTO;
	clan: ClanDTO;
	distinctions: ClanMemberDistinction[];
	createdAt: Date;
	updatedAt: Date;
}

export interface ClanInviteDTO {
	id: number;
	user: UserDTO;
	clan: ClanDTO;
	inviter: ClanMemberDTO;
	threadId?: string;
	distinctions: ClanMemberDistinction[];
	createdAt: Date;
	updatedAt: Date;
	lastNotifiedAt: Date;
}

// ── Ranked / scores (self-contained) ─────────────────────────────────────────

export interface GameScoreDTO {
	lobbyId: number;
	gameNumber: number;
	score1: number;
	score2: number;
}

export interface GameValidatorDTO {
	lobbyId: number;
	lobbyMatchId: number;
}
