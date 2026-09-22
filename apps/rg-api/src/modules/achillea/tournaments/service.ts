import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import type { TournamentDTO } from "./model";
import { OrganizationService } from "../organizations/service";

export abstract class TournamentService {
	public static async findDetail(db: Kysely<Database>, id: number, includeReasons = false) {
		const row = await db.selectFrom("event").selectAll().where("id", "=", id).where("type", "=", "TOURNAMENT").executeTakeFirst();
		if (!row) return null;
		const organizationRow = row.organization_id === null ? null : await OrganizationService.findById(db, row.organization_id);
		const managers = row.organization_id === null ? [] : await db.selectFrom("organization_manager as manager").innerJoin("user", "user.id", "manager.user_id").select(["user.id", "user.username", "user.display_name as displayName", "user.avatar"]).where("manager.organization_id", "=", row.organization_id).execute();
		const organization = organizationRow ? { ...organizationRow, managers: organizationRow.managers.map((manager: Record<string, unknown>) => ({ user: manager })) } : null;
		const participants = await db.selectFrom("tournament_participant as participant").innerJoin("user", "user.id", "participant.user_id").select([
			"participant.id", "participant.tournament_id", "participant.user_id", "participant.bracket_participant_id", "participant.seed", "participant.has_checked_in", "participant.status", "participant.registered_at", "participant.status_reason",
			"user.username", "user.avatar", "user.display_name",
		]).where("participant.tournament_id", "=", id).orderBy("participant.seed", "asc").orderBy("participant.registered_at", "asc").execute();
		const waitlisted = participants.filter((participant) => participant.status === "Waitlisted");
		const tournament = {
			id: row.id, name: row.name, description: row.description, type: row.type, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
			internalState: row.internal_state ?? "Pending", startsAt: row.starts_at?.toISOString() ?? row.created_at.toISOString(), grandFinalAt: row.grand_final_at?.toISOString() ?? row.created_at.toISOString(),
			series: null, organization, managers, participants: [], tournamentType: row.tournament_type ?? "single elimination", participantsNumber: row.participants_number,
			seedOrdering: row.seed_ordering, matchFormat: row.match_format, customFormatChildCount: row.custom_format_child_count, groupStageEnabled: Boolean(row.group_stage_enabled), groupStageType: row.group_stage_type,
			logo: row.logo ?? "", affiche: row.affiche, planning: row.planning ?? "", ruleset: row.ruleset ?? "", placementEloApplied: false, registrationOpensAt: row.registration_opens_at?.toISOString() ?? null,
			registrationClosesAt: row.registration_closes_at?.toISOString() ?? null, autoStart: row.auto_start, discordRoleEnabled: row.discord_role_enabled, scoreReportPolicy: row.score_report_policy ?? "players",
			discordRoleId: row.discord_role_id, cancelReason: row.cancel_reason, canceledAt: row.canceled_at?.toISOString() ?? null, closedAt: row.closed_at?.toISOString() ?? null,
		};
		return [tournament, participants.map((participant, index) => ({
			id: participant.id, tournament: tournament, user: { id: participant.user_id, username: participant.username ?? participant.user_id, avatar: participant.avatar ?? undefined }, bracketParticipantId: participant.bracket_participant_id,
			seed: participant.seed, hasCheckedIn: participant.has_checked_in, status: participant.status, registeredAt: participant.registered_at.toISOString(), waitlistPosition: participant.status === "Waitlisted" ? waitlisted.indexOf(participant) + 1 : null,
			statusReason: includeReasons ? participant.status_reason : null,
		})), { stage: [], group: [], round: [], match: [] }] as const;
	}
	public static async findAll(db: Kysely<Database>, page = 1, pageSize = 50): Promise<{ data: TournamentDTO[]; count: number }> {
		const base = db
			.selectFrom("event")
			.selectAll()
			.where("type", "=", "TOURNAMENT");
		const [rows, countRow] = await Promise.all([
			base.orderBy("id", "desc").limit(pageSize).offset((page - 1) * pageSize).execute(),
			db.selectFrom("event").select(({ fn }) => fn.countAll<number>().as("count")).where("type", "=", "TOURNAMENT").executeTakeFirst(),
		]);

		const data: TournamentDTO[] = rows.map((r) => ({
			id: r.id,
			name: r.name,
			description: r.description,
			type: r.type,
			status: r.status,
			createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
			updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
		}));

		return { data, count: Number(countRow?.count ?? data.length) };
	}

	public static async findById(db: Kysely<Database>, id: number): Promise<TournamentDTO | null> {
		const r = await db
			.selectFrom("event")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		if (!r) return null;

		return {
			id: r.id,
			name: r.name,
			description: r.description,
			type: r.type,
			status: r.status,
			createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
			updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
		};
	}
}
