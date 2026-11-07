import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import type { TournamentDTO } from "./model";
import { OrganizationService } from "../organizations/service";
import { tournamentBracketData } from "./bracket";

function publicTournamentStatus(state: string | null): string | null {
  if (state === "Preregistering" || state === "Preparing") return "Open";
  return state;
}

export interface ParticipantRank {
  elo: number;
  key: string;
  gradient: string[];
}

/**
 * Palier classé solo (mode 2) des inscrits, comme le `user_view` legacy : la
 * colonne « Classement ELO » des participants l'affichait. Sans ligne
 * `user_elo`, pas d'entrée : l'interface affiche « Non classé ».
 */
export async function participantSoloRanks(
  db: Kysely<Database>,
  userIds: readonly string[],
): Promise<Map<string, ParticipantRank>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  // Même saison que le classement public : la saison active, sinon les lignes
  // hors saison (`season_id` nul).
  const season = await db
    .selectFrom("season")
    .select("id")
    .where("state", "=", "Active")
    .orderBy("starts_at", "desc")
    .executeTakeFirst();
  const seasonElos = db.selectFrom("user_elo").select(["user_id", "elo"]).where("mode", "=", 2);
  const [elos, ranks] = await Promise.all([
    (season ? seasonElos.where("season_id", "=", season.id) : seasonElos.where("season_id", "is", null))
      .where("user_id", "in", ids)
      .execute(),
    db.selectFrom("rank").select(["key", "min_elo", "max_elo", "gradient"]).orderBy("min_elo", "asc").execute(),
  ]);
  return new Map(
    elos.map(row => {
      const elo = Number(row.elo ?? 0);
      const tier = ranks.find(rank => elo >= rank.min_elo && elo <= rank.max_elo);
      return [row.user_id, { elo, key: tier?.key ?? "Non classé", gradient: tier?.gradient ?? [] }] as const;
    }),
  );
}

export abstract class TournamentService {
  public static async findDetail(db: Kysely<Database>, id: number, includeReasons = false) {
    const row = await db
      .selectFrom("event")
      .selectAll()
      .where("id", "=", id)
      .where("type", "=", "TOURNAMENT")
      .executeTakeFirst();
    if (!row) return null;
    const organizationRow =
      row.organization_id === null ? null : await OrganizationService.findById(db, row.organization_id);
    const managers =
      row.organization_id === null
        ? []
        : await db
            .selectFrom("organization_manager as manager")
            .innerJoin("user", "user.id", "manager.user_id")
            .select(["user.id", "user.username", "user.display_name as displayName", "user.avatar"])
            .where("manager.organization_id", "=", row.organization_id)
            .execute();
    const organization = organizationRow
      ? {
          ...organizationRow,
          managers: organizationRow.managers.map((manager: Record<string, unknown>) => ({ user: manager })),
        }
      : null;
    const participants = await db
      .selectFrom("tournament_participant as participant")
      .innerJoin("user", "user.id", "participant.user_id")
      .select([
        "participant.id",
        "participant.tournament_id",
        "participant.user_id",
        "participant.bracket_participant_id",
        "participant.seed",
        "participant.has_checked_in",
        "participant.status",
        "participant.registered_at",
        "participant.status_reason",
        "user.username",
        "user.avatar",
        "user.display_name",
      ])
      .where("participant.tournament_id", "=", id)
      .orderBy("participant.seed", "asc")
      .orderBy("participant.registered_at", "asc")
      .execute();
    const soloRanks = await participantSoloRanks(
      db,
      participants.map(participant => participant.user_id),
    );
    const waitlisted = participants.filter(participant => participant.status === "Waitlisted");
    const tournament = {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      internalState: row.internal_state ?? "Pending",
      startsAt: row.starts_at?.toISOString() ?? row.created_at.toISOString(),
      grandFinalAt: row.grand_final_at?.toISOString() ?? row.created_at.toISOString(),
      series: null,
      organization,
      managers,
      participants: [],
      tournamentType: row.tournament_type ?? "single elimination",
      participantsNumber: row.participants_number,
      seedOrdering: row.seed_ordering,
      matchFormat: row.match_format,
      customFormatChildCount: row.custom_format_child_count,
      groupStageEnabled: Boolean(row.group_stage_enabled),
      groupStageType: row.group_stage_type,
      logo: row.logo ?? "",
      affiche: row.affiche,
      planning: row.planning ?? "",
      ruleset: row.ruleset ?? "",
      placementEloApplied: false,
      registrationOpensAt: row.registration_opens_at?.toISOString() ?? null,
      registrationClosesAt: row.registration_closes_at?.toISOString() ?? null,
      autoStart: row.auto_start,
      discordRoleEnabled: row.discord_role_enabled,
      scoreReportPolicy: row.score_report_policy ?? "players",
      discordRoleId: row.discord_role_id,
      cancelReason: row.cancel_reason,
      canceledAt: row.canceled_at?.toISOString() ?? null,
      closedAt: row.closed_at?.toISOString() ?? null,
    };
    const bracketData = await tournamentBracketData(id);
    return [
      tournament,
      participants.map((participant, index) => ({
        id: participant.id,
        tournament: tournament,
        user: {
          id: participant.user_id,
          username: participant.username ?? participant.user_id,
          avatar: participant.avatar ?? undefined,
          ...(soloRanks.has(participant.user_id) ? { soloRank: soloRanks.get(participant.user_id) } : {}),
        },
        bracketParticipantId: participant.bracket_participant_id,
        seed: participant.seed,
        hasCheckedIn: participant.has_checked_in,
        status: participant.status,
        registeredAt: participant.registered_at.toISOString(),
        waitlistPosition: participant.status === "Waitlisted" ? waitlisted.indexOf(participant) + 1 : null,
        statusReason: includeReasons ? participant.status_reason : null,
      })),
      bracketData,
    ] as const;
  }
  public static async findAll(
    db: Kysely<Database>,
    page = 1,
    pageSize = 25,
    organization?: number,
    states: string[] = [],
  ): Promise<{ data: TournamentDTO[]; meta: { page: number; limit: number; total: number; pageCount: number } }> {
    let base = db.selectFrom("event").selectAll().where("type", "=", "TOURNAMENT");
    let countBase = db
      .selectFrom("event")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("type", "=", "TOURNAMENT");
    if (organization !== undefined) {
      base = base.where("organization_id", "=", organization);
      countBase = countBase.where("organization_id", "=", organization);
    }
    if (states.length > 0) {
      const allowed = ["Pending", "Preregistering", "Preparing", "Ongoing", "Finished", "Canceled"] as const;
      const internalStates = [
        ...new Set(
          states
            .flatMap(state => (state === "Open" ? ["Preregistering", "Preparing"] : [state]))
            .filter((state): state is (typeof allowed)[number] => allowed.some(value => value === state)),
        ),
      ];
      base = base.where("internal_state", "in", internalStates);
      countBase = countBase.where("internal_state", "in", internalStates);
    }
    const [rows, countRow] = await Promise.all([
      base
        .orderBy("id", "desc")
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute(),
      countBase.executeTakeFirst(),
    ]);

    const data: TournamentDTO[] = rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      type: r.type,
      status: publicTournamentStatus(r.internal_state),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    }));

    const total = Number(countRow?.count ?? data.length);
    return { data, meta: { page, limit: pageSize, total, pageCount: Math.ceil(total / pageSize) } };
  }

  public static async findById(db: Kysely<Database>, id: number): Promise<TournamentDTO | null> {
    const r = await db.selectFrom("event").selectAll().where("id", "=", id).executeTakeFirst();

    if (!r) return null;

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      type: r.type,
      status: publicTournamentStatus(r.internal_state),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  }
}
