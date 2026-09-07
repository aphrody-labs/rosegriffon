import { MatchMode } from "./User";
import { MatchFormat } from "./Tournament";

export interface LobbyUserDataDTO {
	displayName: string;
	id: string;
	avatar: string;
}

export interface LobbyUserDTO {
	id: number;
	user: LobbyUserDataDTO;
	team: TeamSide;
	forfeit: boolean;
	state: LobbyUserState;
}

export interface LobbyMatchDTO {
	id: number;
	gameNumber: number;
	scoreTeam1: number;
	scoreTeam2: number;
	team1Validated: boolean;
	team2Validated: boolean;
	adminValidated: boolean;
}

export interface LobbyDTO {
	id: number;
	mode: MatchMode;
	state: LobbyState;
	bracketMatchId?: number | null;
	lobbyUsers: LobbyUserDTO[];
	lobbyMatches: LobbyMatchDTO[];
	hostUser: LobbyUserDTO | null;
	matchFormat: MatchFormat;
}

export enum TeamSide {
	TEAM_1 = 1,
	TEAM_2 = 2,
}

export enum LobbyUserState {
	PENDING = "Pending",
	READY = "Ready",
	AFK = "Afk",
	ONGOING = "Ongoing",
	FINISHED = "Finished",
	REPOOLED = "Repooled",
}

export enum LobbyState {
	FRESH = "Fresh",
	ONGOING = "Ongoing",
	PENDING_VALIDATION = "Pending validation",
	CONTESTED = "Contested",
	FINISHED = "Finished",
	CANCELED = "Canceled",
	FORFEITED = "Forfeited",
}

export type GameScoreDTO = {
	lobbyId: number;
	gameNumber: number;
	score1: number;
	score2: number;
};

export type GameValidatorDTO = {
	lobbyId: number;
	lobbyMatchId: number;
};
