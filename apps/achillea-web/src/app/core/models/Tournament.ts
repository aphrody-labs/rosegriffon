import { ScoreReportPolicy } from "@achillea/types";

import { OrganizationDTO } from "./Organization";
import { UserDTO } from "../../shared/services/user-service";
import { SeedOrdering, StageType as BracketsStageType } from "brackets-model";
import { EventEntity } from "./Event";
import { TournamentSeries } from "./TournamentSeries";

/** StageType brackets-model + championnat Achillea (`league`). */
export type StageType = BracketsStageType | "league";

/** Qui saisit les scores — source unique @achillea/types (partagé avec le bot). */
export { ScoreReportPolicy };

export const SCORE_REPORT_POLICY_OPTIONS: ReadonlyArray<{
	value: ScoreReportPolicy;
	label: string;
	hint: string;
}> = [
	{
		value: ScoreReportPolicy.PLAYERS,
		label: "Les joueurs saisissent leur score",
		hint: "Chaque joueur remplit le score de son match, puis les deux camps le valident. Un organisateur peut toujours corriger et trancher.",
	},
	{
		value: ScoreReportPolicy.STAFF_ONLY,
		label: "Staff uniquement",
		hint: "Les joueurs consultent leur match sans pouvoir y toucher : seuls les organisateurs saisissent et valident les scores.",
	},
];

export interface NewTournamentDTO {
	name: string;
	description: string;
	series?: TournamentSeries | null;
	organization: OrganizationDTO | number;
	managers: UserDTO[];

	startsAt: Date; // Angular enverra ça en ISO String automatiquement
	grandFinalAt: Date;

	tournamentType: StageType;
	participantsNumber: number;
	seedOrdering: SeedOrdering;
	matchFormat: MatchFormat;
	customFormatChildCount?: number | null;
	groupStageEnabled: boolean;
	groupStageType?: StageType | null;

	affiche: string;
	logo: string;
	ruleset: string;
	planning: string;

	/** Planning automatisé — facultatif : sans dates, le tournoi se conduit à la main. */
	registrationOpensAt?: Date | string | null;
	registrationClosesAt?: Date | string | null;
	autoStart?: boolean;
	/** Case à cocher : rôle Discord distribué aux inscrits. */
	discordRoleEnabled?: boolean;
	/** Qui saisit les scores des matchs (défaut : les joueurs). */
	scoreReportPolicy?: ScoreReportPolicy;

	/** Dérogation aux règles de publication — SuperAdmin uniquement, côté API. */
	bypassRules?: boolean;
}

export enum MatchFormat {
	BO1 = "bo1",
	BO3 = "bo3",
	BO5 = "bo5",
	DOUBLE_LEG = "double_leg",
	CUSTOM = "custom",
}

/**
 * Tournament
 */
export interface Tournament extends EventEntity {
	internalState: TournamentState;
	startsAt: Date;
	grandFinalAt: Date;

	series?: TournamentSeries | null;
	organization: OrganizationDTO;
	managers: UserDTO[];
	participants: ParticipantDTO[];

	tournamentType: StageType;
	participantsNumber: number;
	seedOrdering: SeedOrdering;
	matchFormat: MatchFormat;
	customFormatChildCount?: number | null;
	groupStageEnabled: boolean;
	groupStageType?: StageType | null;

	logo: string;
	affiche: string;
	planning: string;
	ruleset: string;

	/**
	 * True une fois le bonus AP podium (top 4) versé.
	 * Absent / false tant que non appliqué (tournois en cours ou formats hors scope).
	 */
	placementEloApplied?: boolean;

	/** Planning automatisé (voir `docs/plan-tournois.md`). */
	registrationOpensAt?: string | null;
	registrationClosesAt?: string | null;
	autoStart?: boolean;
	discordRoleEnabled?: boolean;

	/** Qui saisit les scores des matchs (absent sur un tournoi d'avant l'option = joueurs). */
	scoreReportPolicy?: ScoreReportPolicy;

	/** Rôle Discord attribué aux inscrits, créé à l'ouverture des inscriptions. */
	discordRoleId?: string | null;

	/** Renseignés quand le tournoi a été annulé (l'entité reste en base). */
	cancelReason?: string | null;
	canceledAt?: string | null;
	/** Horodatage d'une clôture manuelle (null si passage automatique en Terminé). */
	closedAt?: string | null;
}

export const ALL_STAGE_TYPES: StageType[] = [
	"round_robin",
	"single_elimination",
	"double_elimination",
	"league",
];

const STAGE_TYPE_LABELS: Record<string, string> = {
	round_robin: "Tournoi à la ronde",
	single_elimination: "Élimination simple",
	double_elimination: "Double élimination",
	league: "Championnat (ligue)",
};

export const tournamentTypeOptions = ALL_STAGE_TYPES.map((value) => ({
	label: STAGE_TYPE_LABELS[value] ?? value,
	value: value,
}));

export enum TournamentState {
	PENDING = "Pending", // Pending approval
	PREREGISTERING = "Preregistering",
	PREPARING = "Preparing",
	ONGOING = "Ongoing",
	FINISHED = "Finished",
	CANCELED = "Canceled",
}

/** Statut d'un inscrit — source unique côté bot : `ParticipantStatus` (@achillea/types). */
export enum ParticipantStatus {
	ACTIVE = "Active",
	WAITLISTED = "Waitlisted",
	DISQUALIFIED = "Disqualified",
}

export type ParticipantDTO = {
	id: number;
	tournament: Tournament;
	user: UserDTO;
	bracketParticipantId?: number | null;
	seed?: number | null;
	hasCheckedIn: boolean;
	/** Absent sur les réponses d'API antérieures au statut : traiter comme `ACTIVE`. */
	status?: ParticipantStatus;
	registeredAt?: string;
	/** Rang dans la liste d'attente (1 = prochain promu). */
	waitlistPosition?: number | null;
	/** Motif de DQ — renseigné uniquement pour les organisateurs. */
	statusReason?: string | null;
};

/** Types d'évènements du journal d'un tournoi (table `tournament_event`). */
export type TournamentEventType =
	| "created"
	| "updated"
	| "registrations_opened"
	| "registrations_closed"
	| "participant_registered"
	| "participant_waitlisted"
	| "participant_promoted"
	| "participant_unregistered"
	| "participant_removed"
	| "participant_disqualified"
	| "participant_reinstated"
	| "seeding_changed"
	| "bracket_generated"
	| "tournament_started"
	| "score_reported"
	| "score_validated"
	| "phase_advanced"
	| "organizer_added"
	| "organizer_removed"
	| "tournament_closed"
	| "tournament_canceled"
	| "tournament_restored";

export interface TournamentEventActor {
	id: string;
	username: string;
	displayName: string;
	avatar: string;
}

export interface TournamentEventDTO {
	id: string;
	type: TournamentEventType;
	createdAt: string;
	actor: TournamentEventActor | null;
	target: TournamentEventActor | null;
	payload: Record<string, unknown> | null;
	/** Motif (DQ, annulation) — null pour les non-organisateurs. */
	reason: string | null;
}

/**
 * Classement circuit — cumul de points de circuit sur tous les tournois
 * élimination terminés. Voir `TournamentsService.getCircuitRanking` (bot) /
 * `@achillea/core/tournaments` pour le calcul des points.
 */
export interface CircuitLeaderboardEntry {
	userId: string;
	displayName: string;
	username: string;
	avatar: string;
	clan: CircuitClanTag | null;
	tournamentsPlayed: number;
	points: number;
	tournaments: number;
	wins: number;
	podiums: number;
	top4: number;
	top8: number;
	bestRank: number;
	bestRankLabel: string;
	/** Palier circuit — mêmes clés que le ranked (Fer → Légendaire). */
	tier: string;
}

export interface CircuitClanTag {
	id: number;
	name: string;
	shortName: string;
	avatar: string;
}

/** Classement des clans — somme des points circuit de leurs membres actuels. */
export interface CircuitClanEntry {
	id: number;
	name: string;
	shortName: string;
	avatar: string;
	points: number;
	players: number;
	tournamentsPlayed: number;
	wins: number;
	podiums: number;
	tier: string;
}

export interface CircuitPodiumEntry {
	rank: number;
	rankLabel: string;
	userId: string;
	displayName: string;
	avatar: string;
}

export interface CircuitTournamentSummary {
	id: number;
	name: string;
	size: number;
	grandFinalAt: string;
	podium: CircuitPodiumEntry[];
}

export interface CircuitRanking {
	leaderboard: CircuitLeaderboardEntry[];
	tournaments: CircuitTournamentSummary[];
	clanRanking: CircuitClanEntry[];
}

export interface TournamentTop10Entry {
	rank: number;
	rankLabel: string;
	userId: string;
	displayName: string;
	avatar: string;
	clan: CircuitClanTag | null;
	/** Points de circuit gagnés pour CE tournoi — pas le cumul all-time (voir la page classement). */
	points: number;
	tier: string;
	goalsScored: number;
	goalsConceded: number;
	goalAverage: number;
}

export interface TournamentMatchup {
	winnerDisplayName: string;
	winnerAvatar: string;
	loserDisplayName: string;
	loserAvatar: string;
	scoreWinner: number;
	scoreLoser: number;
}

export interface TournamentMatchStats {
	matches: number;
	totalGoals: number;
	avgGoals: number;
	topScore: number;
	minMargin: number;
	maxMargin: number;
	biggestBlowout: TournamentMatchup | null;
	closestMatch: TournamentMatchup | null;
}

export interface TournamentSummary {
	top10: TournamentTop10Entry[];
	stats: TournamentMatchStats | null;
}

/** Joueur enrichi des stats matchs (buts, séries) pour le hub stats circuit. */
export interface StatsHubPlayerEntry extends CircuitLeaderboardEntry {
	matchesPlayed: number;
	matchWins: number;
	matchLosses: number;
	goalsScored: number;
	goalsConceded: number;
	goalDiff: number;
	/** Buts marqués / encaissés — départage à points égaux (fr.wikipedia.org/wiki/Goal_average). */
	goalAverage: number;
	bestStreak: number;
}

export interface StatsHubClanEntry extends CircuitClanEntry {
	goalsScored: number;
	goalsConceded: number;
	goalAverage: number;
}

export interface StatsHubRecord {
	value: number;
	tournamentId: number;
	tournamentName: string;
	detail: string;
}

export interface StatsHubTournamentHistoryEntry {
	id: number;
	name: string;
	grandFinalAt: string;
	size: number;
	matches: number;
	goals: number;
	champion: string | null;
	runnerUp: string | null;
}

export interface StatsHub {
	overview: {
		totalTournaments: number;
		totalMatches: number;
		totalGoals: number;
		avgGoalsPerMatch: number;
		totalPlayers: number;
		totalClans: number;
	};
	records: {
		topScorer: StatsHubPlayerEntry | null;
		mostTitles: StatsHubPlayerEntry | null;
		mostTournaments: StatsHubPlayerEntry | null;
		bestStreakPlayer: StatsHubPlayerEntry | null;
		biggestTournament: { id: number; name: string; size: number } | null;
		highestScoringMatch: StatsHubRecord | null;
		closestFinal: StatsHubRecord | null;
		biggestBlowoutFinal: StatsHubRecord | null;
	};
	players: StatsHubPlayerEntry[];
	clans: StatsHubClanEntry[];
	tournamentHistory: StatsHubTournamentHistoryEntry[];
	tournaments: CircuitTournamentSummary[];
}

export interface PlayerTournamentHistoryEntry {
	tournamentId: number;
	tournamentName: string;
	grandFinalAt: string;
	size: number;
	rank: number | null;
	rankLabel: string;
	points: number;
	tier: string;
	goalsScored: number;
	goalsConceded: number;
}

/** Profil circuit d'un joueur — page profil public `/users/:id`. */
export interface PlayerCircuitProfile {
	tournamentsPlayed: number;
	points: number;
	tier: string;
	wins: number;
	podiums: number;
	top4: number;
	top8: number;
	bestRankLabel: string;
	goalsScored: number;
	goalsConceded: number;
	goalAverage: number;
	bestStreak: number;
	history: PlayerTournamentHistoryEntry[];
}

export function stageTypeToString(stageType: StageType) {
	switch (stageType) {
		case "single_elimination":
			return "Élimination Simple";
		case "double_elimination":
			return "Double Élimination";
		case "round_robin":
			return "Tournoi à la Ronde";
		case "league":
			return "Championnat (ligue)";
		default:
			return String(stageType);
	}
}
