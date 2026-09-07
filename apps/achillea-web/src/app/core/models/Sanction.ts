export enum SanctionType {
	Warn = "warn",
	Mute = "mute",
	Kick = "kick",
	Ban = "ban",
	Unmute = "unmute",
	Unban = "unban",
	Note = "note",
}

export enum SanctionIssuerType {
	User = "user",
	Bot = "bot",
	Staff = "staff",
	System = "system",
}

export interface Sanction {
	id: string;
	userId: string;
	guildId: string;
	type: SanctionType;
	reason: string | null;
	durationSec: number | null;
	issuedBy: string;
	issuedByType: SanctionIssuerType;
	expiresAt: string | null;
	revokedAt: string | null;
	revokedBy: string | null;
	revokeReason: string | null;
	evidence: Record<string, unknown>[] | null;
	createdAt: string;
}

export interface SanctionFilters {
	userId?: string;
	guildId?: string;
	type?: SanctionType;
	active?: boolean;
	page?: number;
	pageSize?: number;
}

export interface SanctionListResponse {
	data: Sanction[];
	total: number;
	meta: {
		page: number;
		pageSize: number;
		pageCount: number;
	};
}

export interface CreateSanctionPayload {
	userId: string;
	guildId: string;
	type: SanctionType;
	reason?: string | null;
	durationSec?: number | null;
	evidence?: Record<string, unknown>[] | null;
}

export function sanctionTypeSeverity(type: SanctionType): "danger" | "warn" | "info" | "secondary" {
	switch (type) {
		case SanctionType.Ban:
			return "danger";
		case SanctionType.Mute:
		case SanctionType.Kick:
			return "warn";
		case SanctionType.Warn:
			return "info";
		default:
			return "secondary";
	}
}

export function sanctionTypeLabel(type: SanctionType): string {
	switch (type) {
		case SanctionType.Warn:
			return "Avertissement";
		case SanctionType.Mute:
			return "Mute";
		case SanctionType.Kick:
			return "Expulsion";
		case SanctionType.Ban:
			return "Bannissement";
		case SanctionType.Unmute:
			return "Unmute";
		case SanctionType.Unban:
			return "Unban";
		case SanctionType.Note:
			return "Note";
		default:
			return type;
	}
}
