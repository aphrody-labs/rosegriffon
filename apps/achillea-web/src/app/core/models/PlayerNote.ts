/**
 * Notes du staff sur les joueurs — « espace dédié » où les organisateurs consignent ce
 * qu'ils ont à dire d'un joueur pendant un tournoi, lisible du staff.
 *
 * Jamais exposé au joueur concerné : l'API réserve ces routes au staff et aux
 * organisateurs du tournoi cité.
 */
export enum PlayerNoteCategory {
	BEHAVIOR = "behavior",
	CHEATING = "cheating",
	NO_SHOW = "no_show",
	SCORE_DISPUTE = "score_dispute",
	POSITIVE = "positive",
	OTHER = "other",
}

export enum PlayerNoteSeverity {
	INFO = "info",
	WARNING = "warning",
	SERIOUS = "serious",
}

export interface PlayerNotePerson {
	id: string;
	username: string;
	displayName: string;
	avatar: string;
}

export interface PlayerNote {
	id: string;
	target: PlayerNotePerson | null;
	author: PlayerNotePerson | null;
	tournament: { id: number; name: string } | null;
	category: PlayerNoteCategory;
	severity: PlayerNoteSeverity;
	content: string;
	resolved: boolean;
	resolvedAt: string | null;
	resolvedBy: PlayerNotePerson | null;
	createdAt: string;
	updatedAt: string;
	/** Registre Drive où le signalement a été consigné (null si Drive non configuré). */
	docsUrl: string | null;
}

export interface PlayerNoteListResponse {
	data: PlayerNote[];
	total: number;
	meta: { page: number; pageSize: number; pageCount: number; isStaff: boolean };
}

export interface CreatePlayerNotePayload {
	targetId: string;
	tournamentId?: number | null;
	category?: PlayerNoteCategory;
	severity?: PlayerNoteSeverity;
	content: string;
}

export const PLAYER_NOTE_CATEGORY_LABELS: Record<PlayerNoteCategory, string> = {
	[PlayerNoteCategory.BEHAVIOR]: "Comportement",
	[PlayerNoteCategory.CHEATING]: "Triche suspectée",
	[PlayerNoteCategory.NO_SHOW]: "Absence / no-show",
	[PlayerNoteCategory.SCORE_DISPUTE]: "Litige de score",
	[PlayerNoteCategory.POSITIVE]: "Positif",
	[PlayerNoteCategory.OTHER]: "Autre",
};

export const PLAYER_NOTE_SEVERITY_LABELS: Record<PlayerNoteSeverity, string> = {
	[PlayerNoteSeverity.INFO]: "Info",
	[PlayerNoteSeverity.WARNING]: "Attention",
	[PlayerNoteSeverity.SERIOUS]: "Grave",
};

export function playerNoteSeverityColor(severity: PlayerNoteSeverity): "info" | "warn" | "danger" {
	switch (severity) {
		case PlayerNoteSeverity.WARNING:
			return "warn";
		case PlayerNoteSeverity.SERIOUS:
			return "danger";
		default:
			return "info";
	}
}
