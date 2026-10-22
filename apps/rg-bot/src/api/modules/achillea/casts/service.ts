/**
 * Cellule cast — portage de `CastService` (legacy achillea-bot) sur Kysely.
 *
 * Cycle de vie : création → sondage de disponibilités → auto-attribution →
 * échange (swap) → confirmation par le caster. Le score des candidats et les
 * transitions de statut viennent de `@rosegriffon/achillea-core/casts`.
 */

import { sql, type Kysely, type Selectable } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import {
  CastAvailabilityStatus,
  CastEventStatus,
  type CastEventKind,
  type CastSlotRole,
} from "@rosegriffon/achillea-core/enums";
import { canTransitionCastStatus, compareCastCandidates } from "@rosegriffon/achillea-core/casts";
import { resolveDiscordAvatarUrl } from "@rosegriffon/achillea-core/identity";
import { journaliserAudit } from "../audit";
import type { CastModel, CastTables } from "./model";

export type CastDb = Kysely<Database & CastTables>;
export type CastEvent = typeof CastModel.event.static;
export type CastSlot = typeof CastModel.slot.static;
export type CastAvailability = typeof CastModel.availability.static;
export type CastAttribution = typeof CastModel.attribution.static;
export type CasterPublic = typeof CastModel.caster.static;
export type ChecklistItem = typeof CastModel.detail.static.checklist[number];

/** Greffe les tables cast au client partagé (aucune connexion supplémentaire). */
export function castDb(db: Kysely<Database>): CastDb {
  return db.withTables<CastTables>();
}

/** Journal d'audit signé, dans la transaction de la mutation. */
function audit(
  trx: CastDb,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  payload: Record<string, unknown>,
) {
  return journaliserAudit(trx as unknown as Kysely<Database>, {
    acteur: actorId,
    action,
    cibleType: targetType,
    cibleId: targetId,
    charge: payload,
  });
}

/** Plafond anti-saturation par défaut (attributions sur 7 jours glissants). */
export const DEFAULT_MAX_SLOTS_PER_CASTER = 3;
/** Fenêtre anti-saturation, en jours. */
export const RECENT_CAST_WINDOW_DAYS = 7;
/** Bonus par binôme déjà formé sur un évènement passé. */
export const SCORE_BINOME_BONUS = 8;
/** Fenêtre « casts récents » de la vitrine publique, en jours. */
export const SHOWCASE_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

type EventRow = Selectable<CastTables["cast_event"]>;
type SlotRow = Selectable<CastTables["cast_slot"]>;
type AvailabilityRow = Selectable<CastTables["cast_availability"]>;
type AttributionRow = Selectable<CastTables["cast_attribution"]>;

const iso = (value: Date | string) => (value instanceof Date ? value : new Date(value)).toISOString();

function parseRoles(value: unknown): CastSlotRole[] | null {
  if (value == null) return null;
  const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  return Array.isArray(parsed) ? (parsed.filter(role => typeof role === "string") as CastSlotRole[]) : null;
}

export function toEvent(row: EventRow): CastEvent {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as CastEventKind,
    scheduledAt: iso(row.scheduled_at),
    duration: Number(row.duration),
    tournamentId: row.tournament_id,
    status: row.status as CastEventStatus,
    description: row.description,
    twitchUrl: row.twitch_url,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toSlot(row: SlotRow): CastSlot {
  return {
    id: row.id,
    role: row.role as CastSlotRole,
    required: row.required,
    defraymentAmount: row.defrayment_amount == null ? null : String(row.defrayment_amount),
    defraymentCurrency: row.defrayment_currency,
    defraymentReason: row.defrayment_reason,
    notes: row.notes,
  };
}

export function toAvailability(row: AvailabilityRow): CastAvailability {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status as CastAvailabilityStatus,
    preferredRoles: parseRoles(row.preferred_roles),
    notes: row.notes,
    declaredAt: iso(row.declared_at),
  };
}

export function toAttribution(row: AttributionRow): CastAttribution {
  return {
    id: row.id,
    slotId: row.slot_id,
    userId: row.user_id,
    assignedAt: iso(row.assigned_at),
    assignedBy: row.assigned_by,
    confirmedAt: row.confirmed_at ? iso(row.confirmed_at) : null,
  };
}

/** Checklist : chaque poste avec son attribution courante et sa confirmation. */
export function buildChecklist(slots: CastSlot[], attributions: CastAttribution[]): ChecklistItem[] {
  const bySlot = new Map(attributions.map(attribution => [attribution.slotId, attribution]));
  return slots.map(slot => {
    const attribution = bySlot.get(slot.id) ?? null;
    return {
      slot,
      attribution,
      casterId: attribution?.userId ?? null,
      confirmed: attribution?.confirmedAt != null,
    };
  });
}

export interface CreateEventInput {
  name: string;
  kind: CastEventKind;
  scheduledAt: Date;
  duration?: number;
  tournamentId: string | null;
  twitchUrl: string | null;
  description: string | null;
  createdBy: string;
  slots: Array<{ role: CastSlotRole; required?: boolean }>;
}

export interface AutoAssignCandidate {
  userId: string;
  status: CastAvailabilityStatus;
  preferredRoles: CastSlotRole[] | null;
}

/**
 * Attribution gloutonne, pure (testable sans base) : pour chaque poste libre,
 * le meilleur candidat selon `compareCastCandidates`, sans dépasser le plafond
 * anti-saturation ni attribuer deux postes au même caster dans la passe.
 */
export function planAutoAssign(
  slots: ReadonlyArray<{ id: string; role: CastSlotRole }>,
  candidates: readonly AutoAssignCandidate[],
  recentCounts: ReadonlyMap<string, number>,
  binomeBonus: ReadonlyMap<string, number>,
  maxSlotsPerCaster: number,
): Array<{ slotId: string; userId: string }> {
  const recent = new Map(recentCounts);
  const used = new Set<string>();
  const plan: Array<{ slotId: string; userId: string }> = [];
  for (const slot of slots) {
    const eligible = candidates.filter(
      candidate => (recent.get(candidate.userId) ?? 0) < maxSlotsPerCaster && !used.has(candidate.userId),
    );
    const input = (candidate: AutoAssignCandidate) => ({
      userId: candidate.userId,
      status: candidate.status,
      preferredRoles: candidate.preferredRoles,
      recentAssignments: recent.get(candidate.userId) ?? 0,
      binomeBonus: binomeBonus.get(candidate.userId) ?? 0,
    });
    const winner = eligible.toSorted((a, b) => compareCastCandidates(input(a), input(b), slot.role))[0];
    if (!winner) continue;
    plan.push({ slotId: slot.id, userId: winner.userId });
    used.add(winner.userId);
    recent.set(winner.userId, (recent.get(winner.userId) ?? 0) + 1);
  }
  return plan;
}

export abstract class CastService {
  static async listEvents(
    db: CastDb,
    query: { status?: CastEventStatus; from?: Date; to?: Date; page: number; pageSize: number },
  ) {
    let base = db.selectFrom("cast_event");
    if (query.status) base = base.where("status", "=", query.status);
    if (query.from) base = base.where("scheduled_at", ">=", query.from);
    if (query.to) base = base.where("scheduled_at", "<=", query.to);
    const [rows, count] = await Promise.all([
      base
        .selectAll()
        .orderBy("scheduled_at", "asc")
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .execute(),
      base.select(({ fn }) => fn.countAll<string>().as("total")).executeTakeFirst(),
    ]);
    const total = Number(count?.total ?? 0);
    return {
      data: rows.map(toEvent),
      total,
      meta: { page: query.page, pageSize: query.pageSize, pageCount: Math.ceil(total / query.pageSize) },
    };
  }

  static async findEvent(db: CastDb, id: string) {
    const row = await db.selectFrom("cast_event").selectAll().where("id", "=", id).executeTakeFirst();
    return row ? toEvent(row) : null;
  }

  static async getEventDetail(db: CastDb, id: string) {
    const event = await CastService.findEvent(db, id);
    if (!event) return null;
    const [slotRows, attributionRows] = await Promise.all([
      db.selectFrom("cast_slot").selectAll().where("event_id", "=", id).orderBy("id").execute(),
      db
        .selectFrom("cast_attribution")
        .innerJoin("cast_slot", "cast_slot.id", "cast_attribution.slot_id")
        .selectAll("cast_attribution")
        .where("cast_slot.event_id", "=", id)
        .execute(),
    ]);
    const slots = slotRows.map(toSlot);
    const attributions = attributionRows.map(toAttribution);
    return { event, slots, attributions, checklist: buildChecklist(slots, attributions) };
  }

  static async createEvent(db: CastDb, input: CreateEventInput) {
    return db.transaction().execute(async trx => {
      const row = await trx
        .insertInto("cast_event")
        .values({
          name: input.name,
          kind: input.kind,
          scheduled_at: input.scheduledAt,
          duration: input.duration ?? 60,
          tournament_id: input.tournamentId,
          twitch_url: input.twitchUrl,
          description: input.description,
          created_by: input.createdBy,
          status: CastEventStatus.Planned,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto("cast_slot")
        .values(input.slots.map(slot => ({ event_id: row.id, role: slot.role, required: slot.required ?? true })))
        .execute();
      await audit(trx, input.createdBy, "cast.event.create", "cast_event", row.id, {
        name: input.name,
        kind: input.kind,
        scheduledAt: input.scheduledAt.toISOString(),
        slots: input.slots.length,
      });
      return toEvent(row);
    });
  }

  /**
   * Ouvre le sondage : une disponibilité neutre (`unavailable`) par membre du
   * pool, idempotent sur (user_id, event_id), puis `planned` → `open_signup`.
   */
  static async openSurvey(db: CastDb, event: CastEvent, casterPool: readonly string[], actorId: string) {
    const pool = [...new Set(casterPool)];
    await db.transaction().execute(async trx => {
      await trx
        .insertInto("cast_availability")
        .values(
          pool.map(userId => ({ user_id: userId, event_id: event.id, status: CastAvailabilityStatus.Unavailable })),
        )
        .onConflict(oc => oc.columns(["user_id", "event_id"]).doNothing())
        .execute();
      if (event.status === CastEventStatus.Planned) {
        await trx
          .updateTable("cast_event")
          .set({ status: CastEventStatus.OpenSignup, updated_at: new Date() })
          .where("id", "=", event.id)
          .where("status", "=", CastEventStatus.Planned)
          .execute();
      }
      await audit(trx, actorId, "cast.survey.open", "cast_event", event.id, { casterPool: pool });
    });
    return { success: true as const, eventId: event.id, poolSize: casterPool.length };
  }

  /** Upsert de la disponibilité du caster connecté ; `declared_at` est rafraîchi. */
  static async recordAvailability(
    db: CastDb,
    input: {
      userId: string;
      eventId: string;
      status: CastAvailabilityStatus;
      preferredRoles?: CastSlotRole[] | null;
      notes?: string | null;
    },
  ) {
    const roles = input.preferredRoles == null ? null : sql`${JSON.stringify(input.preferredRoles)}::jsonb`;
    const now = new Date();
    const update: Record<string, unknown> = { status: input.status, declared_at: now };
    if (input.preferredRoles !== undefined) update.preferred_roles = roles;
    if (input.notes !== undefined) update.notes = input.notes;
    const row = await db
      .insertInto("cast_availability")
      .values({
        user_id: input.userId,
        event_id: input.eventId,
        status: input.status,
        preferred_roles: roles,
        notes: input.notes ?? null,
        declared_at: now,
      })
      .onConflict(oc => oc.columns(["user_id", "event_id"]).doUpdateSet(update))
      .returningAll()
      .executeTakeFirstOrThrow();
    return toAvailability(row);
  }

  static async autoAssign(
    db: CastDb,
    event: CastEvent,
    actorId: string,
    maxSlotsPerCaster = DEFAULT_MAX_SLOTS_PER_CASTER,
  ) {
    const [slots, existing, availabilities] = await Promise.all([
      db.selectFrom("cast_slot").selectAll().where("event_id", "=", event.id).orderBy("id").execute(),
      db
        .selectFrom("cast_attribution")
        .innerJoin("cast_slot", "cast_slot.id", "cast_attribution.slot_id")
        .selectAll("cast_attribution")
        .where("cast_slot.event_id", "=", event.id)
        .execute(),
      db
        .selectFrom("cast_availability")
        .selectAll()
        .where("event_id", "=", event.id)
        .where("status", "in", [CastAvailabilityStatus.Available, CastAvailabilityStatus.Maybe])
        .execute(),
    ]);
    const assignedSlotIds = new Set(existing.filter(a => a.user_id !== null).map(a => a.slot_id));
    const freeSlots = slots.filter(slot => !assignedSlotIds.has(slot.id));
    if (freeSlots.length === 0 || availabilities.length === 0) return [];

    const candidateIds = [...new Set(availabilities.map(a => a.user_id))];
    const windowStart = new Date(Date.now() - RECENT_CAST_WINDOW_DAYS * DAY_MS);
    const recentRows = await db
      .selectFrom("cast_attribution")
      .select(["user_id", ({ fn }) => fn.countAll<string>().as("count")])
      .where("user_id", "in", candidateIds)
      .where("assigned_at", ">=", windowStart)
      .groupBy("user_id")
      .execute();
    const recentCounts = new Map(recentRows.map(row => [row.user_id as string, Number(row.count)]));

    // Bonus binôme : le candidat a déjà été co-attribué, sur un AUTRE évènement,
    // avec un caster déjà placé sur celui-ci (+SCORE_BINOME_BONUS par binôme).
    const alreadyAssigned = existing.flatMap(a => (a.user_id ? [a.user_id] : []));
    const binomeBonus = new Map<string, number>();
    if (alreadyAssigned.length > 0) {
      const pairs = await sql<{ candidate: string; partner: string }>`
        SELECT DISTINCT a2.user_id AS candidate, a1.user_id AS partner
        FROM cast_attribution a1
        JOIN cast_slot s1 ON s1.id = a1.slot_id
        JOIN cast_slot s2 ON s2.event_id = s1.event_id
        JOIN cast_attribution a2 ON a2.slot_id = s2.id
        WHERE a1.user_id IN (${sql.join(alreadyAssigned)})
          AND a2.user_id IN (${sql.join(candidateIds)})
          AND s1.event_id <> ${event.id}
      `.execute(db);
      for (const pair of pairs.rows) {
        binomeBonus.set(pair.candidate, (binomeBonus.get(pair.candidate) ?? 0) + SCORE_BINOME_BONUS);
      }
    }

    const plan = planAutoAssign(
      freeSlots.map(slot => ({ id: slot.id, role: slot.role as CastSlotRole })),
      availabilities.map(a => ({
        userId: a.user_id,
        status: a.status as CastAvailabilityStatus,
        preferredRoles: parseRoles(a.preferred_roles),
      })),
      recentCounts,
      binomeBonus,
      maxSlotsPerCaster,
    );
    if (plan.length === 0) return [];

    return db.transaction().execute(async trx => {
      const now = new Date();
      const created: CastAttribution[] = [];
      for (const { slotId, userId } of plan) {
        // Une attribution vide peut déjà exister pour le poste (contrainte unique sur slot_id).
        const row = await trx
          .insertInto("cast_attribution")
          .values({ slot_id: slotId, user_id: userId, assigned_by: "system", assigned_at: now, confirmed_at: null })
          .onConflict(oc =>
            oc
              .column("slot_id")
              .doUpdateSet({ user_id: userId, assigned_by: "system", assigned_at: now, confirmed_at: null })
              .where("cast_attribution.user_id", "is", null),
          )
          .returningAll()
          .executeTakeFirst();
        if (row) created.push(toAttribution(row));
      }

      const covered = new Set([...assignedSlotIds, ...created.map(a => a.slotId)]);
      const allRequiredCovered = slots.filter(slot => slot.required).every(slot => covered.has(slot.id));
      if (allRequiredCovered && canTransitionCastStatus(event.status, CastEventStatus.Attributed)) {
        await trx
          .updateTable("cast_event")
          .set({ status: CastEventStatus.Attributed, updated_at: now })
          .where("id", "=", event.id)
          .execute();
      }
      if (created.length > 0)
        await audit(trx, actorId, "cast.attribution.auto_assign", "cast_event", event.id, {
          maxSlotsPerCaster,
          attributions: created.map(a => ({ id: a.id, slotId: a.slotId, userId: a.userId })),
        });
      return created;
    });
  }

  static async findEventOfSlot(db: CastDb, slotId: string) {
    const row = await db
      .selectFrom("cast_event")
      .innerJoin("cast_slot", "cast_slot.event_id", "cast_event.id")
      .selectAll("cast_event")
      .where("cast_slot.id", "=", slotId)
      .executeTakeFirst();
    return row ? toEvent(row) : null;
  }

  static async findAttribution(db: CastDb, id: string) {
    const row = await db.selectFrom("cast_attribution").selectAll().where("id", "=", id).executeTakeFirst();
    return row ? toAttribution(row) : null;
  }

  /** Remplace le caster : la confirmation est remise à zéro. */
  static async swap(db: CastDb, attributionId: string, newCasterId: string, swappedBy: string) {
    return db.transaction().execute(async trx => {
      const previous = await trx
        .selectFrom("cast_attribution")
        .select("user_id")
        .where("id", "=", attributionId)
        .forUpdate()
        .executeTakeFirst();
      if (!previous) return null;
      const row = await trx
        .updateTable("cast_attribution")
        .set({ user_id: newCasterId, confirmed_at: null, assigned_by: swappedBy, assigned_at: new Date() })
        .where("id", "=", attributionId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await audit(trx, swappedBy, "cast.attribution.swap", "cast_attribution", row.id, {
        slotId: row.slot_id,
        from: previous.user_id,
        to: newCasterId,
      });
      return toAttribution(row);
    });
  }

  static async confirm(db: CastDb, attributionId: string, casterId: string) {
    const row = await db
      .updateTable("cast_attribution")
      .set({ confirmed_at: new Date() })
      .where("id", "=", attributionId)
      .where("user_id", "=", casterId)
      .returningAll()
      .executeTakeFirst();
    return row ? toAttribution(row) : null;
  }

  /** Vitrine publique : casters ayant une disponibilité ou une attribution. */
  static async listCasters(db: CastDb): Promise<CasterPublic[]> {
    const since = new Date(Date.now() - SHOWCASE_WINDOW_DAYS * DAY_MS);
    const [available, attributed] = await Promise.all([
      db.selectFrom("cast_availability").select("user_id").distinct().execute(),
      db.selectFrom("cast_attribution").select("user_id").distinct().where("user_id", "is not", null).execute(),
    ]);
    const userIds = [...new Set([...available, ...attributed].flatMap(row => (row.user_id ? [row.user_id] : [])))];
    if (userIds.length === 0) return [];
    const [users, recent] = await Promise.all([
      db
        .selectFrom("user")
        .select(["id", "display_name", "username", "avatar", "bio", "twitch_url"])
        .where("id", "in", userIds)
        .execute(),
      db
        .selectFrom("cast_attribution")
        .select(["user_id", ({ fn }) => fn.countAll<string>().as("count")])
        .where("user_id", "in", userIds)
        .where("assigned_at", ">=", since)
        .groupBy("user_id")
        .execute(),
    ]);
    const byId = new Map(users.map(user => [user.id, user]));
    const recentById = new Map(recent.map(row => [row.user_id as string, Number(row.count)]));
    return userIds
      .map(userId => {
        const user = byId.get(userId);
        return {
          id: userId,
          displayName: user?.display_name || user?.username || userId,
          avatar: user ? resolveDiscordAvatarUrl(userId, user.avatar) : null,
          bio: user?.bio ?? null,
          twitchUrl: user?.twitch_url ?? null,
          recentCasts: recentById.get(userId) ?? 0,
        };
      })
      .toSorted((a, b) => b.recentCasts - a.recentCasts || a.id.localeCompare(b.id));
  }
}
