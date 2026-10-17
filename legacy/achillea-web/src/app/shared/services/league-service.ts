import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

export interface LeagueStandingRow {
	teamId: string;
	rank: number;
	played: number;
	wins: number;
	draws: number;
	losses: number;
	winsOt: number;
	lossesOt: number;
	points: number;
	mapDiff: number;
	mapsFor: number;
	mapsAgainst: number;
}

export interface LeagueMatchResult {
	homeId: string;
	awayId: string;
	homeScore: number;
	awayScore: number;
	matchday: number;
	overtime?: boolean;
	winnerId?: string | null;
}

export interface AstralFormat {
	game: string;
	startsAt: string;
	clans: number;
	playersPerTeam: number;
	playersPerMatch: number;
	regularSeries: string;
	mustPlayAllBo3Games: boolean;
	overtimeMatch: boolean;
	advantageJudgment: boolean;
	points: {
		winRegulation: number;
		lossRegulation: number;
		winOvertime: number;
		lossOvertime: number;
	};
	tiebreakers: readonly string[];
	playoffs: {
		teams: number;
		format: string;
		series: string;
		firstPickOpponent: boolean;
		extraGamesOnDraw: boolean;
	};
	durationWeeks: number;
	regularWeeks: number;
	playoffWeeks: number;
}

/** Manche 1v1 dans une rencontre d'équipe (sheet). */
export interface AstralGameLine {
	slotLabel: string | null;
	homePlayer: string;
	awayPlayer: string;
	homeGoals: number;
	awayGoals: number;
	forfeitHome: boolean;
	forfeitAway: boolean;
}

export interface AstralDetailedMatch {
	time: string;
	home: string;
	away: string;
	homeScore: number;
	awayScore: number;
	date: string;
	matchday: number;
	games: AstralGameLine[];
	phase: string;
	overtime?: boolean;
	winnerId?: string;
	label?: string;
	roundIndex?: number;
}

export interface AstralMatchday {
	matchday: number;
	date: string;
	matches: AstralDetailedMatch[];
}

export interface AstralPlayerStats {
	name: string;
	teams: string[];
	primaryTeam: string;
	games: number;
	wins: number;
	losses: number;
	draws: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDiff: number;
	winrate: number;
	forfeitsGiven: number;
	forfeitsReceived: number;
	regularGames: number;
	playoffGames: number;
}

export interface AstralH2HEntry {
	scoreFor: number;
	scoreAgainst: number;
	matchday: number;
	date: string;
	home: boolean;
}

export interface AstralSeasonDetails {
	regularMatchdays: AstralMatchday[];
	playoffMatches: AstralDetailedMatch[];
	players: AstralPlayerStats[];
	rosters: Record<string, string[]>;
	h2h: Record<string, Record<string, AstralH2HEntry>>;
}

export interface LeagueSeasonPayload {
	meta: {
		id: string;
		name: string;
		season: string;
		format: string;
		description: string;
		champion?: string;
		teamCount: number;
		matchdays: number;
		sourceSheetUrl?: string;
		sourceRulesUrl?: string;
		aliases?: readonly string[];
	};
	format: AstralFormat;
	teams: Array<{ tag: string; name: string }>;
	pointsConfig: {
		win: number;
		draw: number;
		loss: number;
		winOvertime: number;
		lossOvertime: number;
	};
	standings: LeagueStandingRow[];
	results: LeagueMatchResult[];
	playoffs: Array<{
		round: string;
		label: string;
		homeId: string;
		awayId: string;
		homeScore: number;
		awayScore: number;
	}>;
	/** Détail sheet (manches, joueurs, H2H) — toujours présent pour Astral S1. */
	details?: AstralSeasonDetails;
}

@Injectable({ providedIn: "root" })
export class LeagueApiService {
	private http = inject(HttpClient);
	private readonly API = "/api/leagues";

	list() {
		return this.http.get<{ items: Array<Record<string, unknown>> }>(this.API);
	}

	/** Astral League S1 (alias asytral conservé). */
	astral(): Observable<LeagueSeasonPayload> {
		return this.http.get<LeagueSeasonPayload>(`${this.API}/astral`);
	}

	/** @deprecated utiliser astral() */
	asytral(): Observable<LeagueSeasonPayload> {
		return this.astral();
	}
}
