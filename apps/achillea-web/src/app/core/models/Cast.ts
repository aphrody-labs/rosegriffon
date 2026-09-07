// =============================================================================
// Modèles Cast — T-2.3
// Miroirs des DTOs bot (castDTO.ts).
// =============================================================================

export enum CastEventKind {
	Match = "match",
	Tournament = "tournament",
	Stream = "stream",
	Other = "other",
}

export enum CastEventStatus {
	Planned = "planned",
	OpenSignup = "open_signup",
	Attributed = "attributed",
	Live = "live",
	Done = "done",
	Cancelled = "cancelled",
}

export enum CastSlotRole {
	CasterMain = "caster_main",
	CasterSecondary = "caster_secondary",
	Observer = "observer",
	Producer = "producer",
	Host = "host",
	Technical = "technical",
}

export enum CastAvailabilityStatus {
	Available = "available",
	Maybe = "maybe",
	Unavailable = "unavailable",
}

export interface CastEvent {
	id: string;
	name: string;
	kind: CastEventKind;
	scheduledAt: string;
	duration: number;
	tournamentId: string | null;
	status: CastEventStatus;
	description: string | null;
	twitchUrl: string | null;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

export interface CastSlot {
	id: string;
	role: CastSlotRole;
	required: boolean;
	defraymentAmount: string | null;
	defraymentCurrency: string | null;
	defraymentReason: string | null;
	notes: string | null;
}

export interface CastAvailability {
	id: string;
	userId: string;
	status: CastAvailabilityStatus;
	preferredRoles: CastSlotRole[] | null;
	notes: string | null;
	declaredAt: string;
}

export interface CastAttribution {
	id: string;
	slotId: string;
	userId: string | null;
	assignedAt: string;
	assignedBy: string;
	confirmedAt: string | null;
}

export interface CasterPublic {
	id: string;
	displayName: string;
	avatar: string | null;
	bio: string | null;
	twitchUrl: string | null;
	recentCasts: number;
}

export interface ChecklistItem {
	slot: CastSlot;
	attribution: CastAttribution | null;
	casterId: string | null;
	confirmed: boolean;
}

export interface CastEventDetail {
	event: CastEvent;
	slots: CastSlot[];
	attributions: CastAttribution[];
	checklist: ChecklistItem[];
}

export interface CastEventListResponse {
	data: CastEvent[];
	total: number;
	meta: {
		page: number;
		pageSize: number;
		pageCount: number;
	};
}

export interface CastEventFilters {
	status?: CastEventStatus;
	from?: string;
	to?: string;
	page?: number;
	pageSize?: number;
}

export interface CreateCastEventPayload {
	name: string;
	kind: CastEventKind;
	scheduledAt: string;
	duration?: number;
	tournamentId?: string | null;
	twitchUrl?: string | null;
	description?: string | null;
	slots: Array<{ role: CastSlotRole; required?: boolean }>;
}

// ---------------------------------------------------------------------------
// Helpers affichage
// ---------------------------------------------------------------------------

export function castEventStatusLabel(status: CastEventStatus): string {
	switch (status) {
		case CastEventStatus.Planned:
			return "Planifié";
		case CastEventStatus.OpenSignup:
			return "Sondage ouvert";
		case CastEventStatus.Attributed:
			return "Attribué";
		case CastEventStatus.Live:
			return "En direct";
		case CastEventStatus.Done:
			return "Terminé";
		case CastEventStatus.Cancelled:
			return "Annulé";
		default:
			return status;
	}
}

export function castEventStatusSeverity(
	status: CastEventStatus
): "success" | "warn" | "info" | "danger" | "secondary" | "contrast" {
	switch (status) {
		case CastEventStatus.Live:
			return "danger";
		case CastEventStatus.OpenSignup:
			return "info";
		case CastEventStatus.Attributed:
			return "warn";
		case CastEventStatus.Done:
			return "success";
		case CastEventStatus.Cancelled:
			return "secondary";
		default:
			return "secondary";
	}
}

export function castSlotRoleLabel(role: CastSlotRole): string {
	switch (role) {
		case CastSlotRole.CasterMain:
			return "Caster principal";
		case CastSlotRole.CasterSecondary:
			return "Caster secondaire";
		case CastSlotRole.Observer:
			return "Observateur";
		case CastSlotRole.Producer:
			return "Producteur";
		case CastSlotRole.Host:
			return "Présentateur";
		case CastSlotRole.Technical:
			return "Technique";
		default:
			return role;
	}
}

export function castAvailabilityStatusLabel(status: CastAvailabilityStatus): string {
	switch (status) {
		case CastAvailabilityStatus.Available:
			return "Disponible";
		case CastAvailabilityStatus.Maybe:
			return "Peut-être";
		case CastAvailabilityStatus.Unavailable:
			return "Indisponible";
		default:
			return status;
	}
}

export function castAvailabilityStatusSeverity(
	status: CastAvailabilityStatus
): "success" | "warn" | "danger" | "secondary" {
	switch (status) {
		case CastAvailabilityStatus.Available:
			return "success";
		case CastAvailabilityStatus.Maybe:
			return "warn";
		case CastAvailabilityStatus.Unavailable:
			return "danger";
		default:
			return "secondary";
	}
}
