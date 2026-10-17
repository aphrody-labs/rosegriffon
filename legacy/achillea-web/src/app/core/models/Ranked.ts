// Modèles pour la feature Ranked.
// Côté serveur : entities Mikro-ORM achillea-bot (UserElo, Rank, Lobby, LobbyMatch, LobbyUser).
// Côté Colyseus : reflète le state schema MatchRoom (cf docs/ranking.md §5).

// Doit matcher l'enum côté bot (`apps/achillea-bot/src/utils/enums/eventEnums.ts`).
// MatchMode.ONE_VS_ONE = 2 (count joueurs), TWO_VS_TWO = 4.
export const MatchMode = {
	ONE_VS_ONE: 2,
	TWO_VS_TWO: 4,
} as const;
export type MatchMode = (typeof MatchMode)[keyof typeof MatchMode];

export type MatchRoomStatus = "waiting" | "playing" | "scoring" | "disputed" | "finished";

export interface RankTier {
	key: string;
	minElo: number;
	maxElo: number;
	emojiId: string;
	emojiKey: string;
	gradient: string[];
}

export interface RankedProfile {
	userId: string;
	mode: MatchMode;
	elo: number;
	peakRating: number;
	gamesPlayed: number;
	wins: number;
	losses: number;
	tier: RankTier | null;
	seasonId: string | null;
	globalRank?: number | null;
	totalPlayers?: number;
	percentile?: number | null;
}

export interface RankedTrend {
	sparkline: number[];
	deltaPeriod: number;
	gamesInPeriod: number;
	winRatePeriod: number;
	days: number;
}

export interface RankedPlayerView {
	userId: string;
	displayName: string;
	avatar: string;
	elo: number;
	// Côté terrain : 1 = domicile (1er joueur), 2 = extérieur (2e joueur). 0 = non assigné.
	team: number;
	// Saisie du score (double validation), du point de vue du joueur (−1 = non saisi).
	myScore: number;
	oppScore: number;
	startedMatch: boolean; // a cliqué « Début de match »
	submitted: boolean; // a validé sa saisie de score
	proofUploaded: boolean; // a uploadé sa capture de preuve
	confirmedFinish: boolean; // a cliqué « Fin de match »
}

export interface RankedChatMessage {
	userId: string;
	text: string;
	at: number;
}

// Joueur présent dans la lobby (salon de présence ranked), pour le défi direct.
export interface RankedLobbyPlayer {
	userId: string;
	displayName: string;
	avatar: string;
	elo: number;
	mode: number;
}

// Invitation reçue (on est défié par un autre joueur).
export interface RankedPendingInvite {
	fromUserId: string;
	fromDisplayName: string;
	fromAvatar: string;
	fromElo: number;
	mode: MatchMode;
	ranked: boolean; // classé (ELO) ou non classé (amical)
}

// Invitation envoyée (on a défié un joueur, en attente de sa réponse).
export interface RankedSentInvite {
	targetUserId: string;
	targetDisplayName: string;
	mode: MatchMode;
	ranked: boolean;
}

// Défi par lien partageable créé par le joueur courant (en attente d'acceptation).
export interface RankedChallengeLink {
	code: string;
	url: string;
	mode: MatchMode;
	ranked: boolean;
	toUserId: string | null;
	expiresAt: number;
}

// Aperçu d'un défi reçu via un lien (page /ranked/defi/:code).
export interface RankedChallengePreview {
	code: string;
	fromUserId: string;
	fromDisplayName: string;
	fromAvatar: string;
	fromElo: number;
	mode: MatchMode;
	ranked: boolean;
	isOwn: boolean;
	expiresAt: number;
}

// Proposition de revanche reçue en temps réel (Socket.IO `rematch_offer`).
export interface RankedRematchOffer {
	code: string;
	fromUserId: string;
	fromDisplayName: string;
	fromAvatar: string;
	fromElo: number;
	mode: MatchMode;
	ranked: boolean;
	url: string;
}

export interface RankedMatchSummary {
	lobbyId: number;
	roomCode: string;
	mode: MatchMode;
	ranked?: boolean; // false = partie amicale (aucun ELO appliqué)
	opponent: { userId: string; displayName: string; avatar: string };
	result: "win" | "loss" | "draw" | "forfeit";
	myScore: number;
	opponentScore: number;
	eloBefore: number;
	eloAfter: number;
	eloDelta: number;
	newTier: RankTier | null;
	endedAt: string;
}

export interface RankedDisputeRequest {
	lobbyId: number;
	screenshotUrl: string;
}

export interface RankedDisputePlayer {
	userId: string;
	displayName: string;
	submittedScore: number; // score que CE joueur réclame pour lui-même
	claimedOpponentScore?: number | null; // score qu'il attribue à l'adversaire
	screenshotUrl?: string | null; // capture de preuve uploadée
}

export interface RankedAdminDispute {
	lobbyId: number;
	mode: MatchMode;
	player1: RankedDisputePlayer;
	player2: RankedDisputePlayer;
	createdAt: string;
}

export interface RankedAdminValidateRequest {
	scoreTeam1: number;
	scoreTeam2: number;
	forfeitUserId?: string;
}

// Un joueur d'un match EN COURS (vue admin « Matchs en cours »).
export interface RankedActivePlayer {
	userId: string;
	displayName: string;
	score: number;
	claimedOpponentScore: number | null;
	submitted: boolean; // a saisi son score
	hasProof: boolean; // a uploadé une capture de preuve
}

// Un match ranked EN COURS (lobby 'Ongoing'), avec son état live persisté.
export interface RankedActiveMatch {
	lobbyId: number;
	mode: MatchMode;
	createdAt: string;
	player1: RankedActivePlayer; // domicile (team 1)
	player2: RankedActivePlayer; // extérieur (team 2)
}

// Compteurs synthétiques du ranked (vue admin overview).
export interface RankedOverview {
	activeMatches: number;
	contestedMatches: number;
	finishedToday: number;
	matchesToday: number;
	totalPlayers: number;
}

// Un événement de télémétrie ranked (journal du flow des matchs, vue staff).
export interface RankedMatchEvent {
	id: number;
	createdAt: string;
	lobbyId: number | null;
	roomCode: string | null;
	mode: number | null;
	userId: string | null;
	displayName: string | null;
	type: string;
	detail: Record<string, unknown>;
}

export interface RankedTierInfo {
	key: string;
	minElo: number;
	maxElo: number;
	gradient: string[];
	emojiId: string | null;
	emojiKey: string | null;
	playerCount: number;
}

export interface LeaderboardEntry {
	rank: number;
	userId: string;
	displayName: string;
	avatar: string;
	elo: number;
	peakRating: number;
	gamesPlayed: number;
}

export interface LeaderboardPage {
	entries: LeaderboardEntry[];
	total: number;
	mode: MatchMode;
}

export interface RankedHistoryEntry {
	lobbyId: number;
	mode: MatchMode;
	state: string;
	endedAt: string;
	myScore: number;
	opponentScore: number;
	eloDelta: number;
	result: "win" | "loss" | "forfeit";
	opponent: { userId: string; displayName: string; avatar: string };
}

// ---- Administration des saisons (dashboard admin) ----

export type SeasonState = "Upcoming" | "Active" | "Closed";

export interface RankedSeasonConfig {
	kFactor: number;
	baseRating: number;
	decayRate: number;
}

export interface RankedAdminSeason {
	id: string;
	name: string;
	state: SeasonState;
	startsAt: string;
	endsAt: string;
	config: RankedSeasonConfig;
	playerCount: number;
}

export interface RankedSeasonInput {
	name: string;
	startsAt: string;
	endsAt: string;
	config: RankedSeasonConfig;
}
