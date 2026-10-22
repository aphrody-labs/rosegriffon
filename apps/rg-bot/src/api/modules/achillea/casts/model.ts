import { t } from "elysia";
import type { ColumnType, Generated } from "kysely";
import {
  CastAvailabilityStatus,
  CastEventKind,
  CastEventStatus,
  CastSlotRole,
} from "@rosegriffon/achillea-core/enums";

/**
 * Tables de la cellule cast (schéma `achillea`, migrations legacy
 * Migration20260425230000/240000). Elles ne figurent pas encore dans
 * `@rosegriffon/db/schema` : on les déclare ici et on les greffe au client
 * Kysely partagé via `db.withTables<CastTables>()`.
 */
export type CastTables = {
  cast_event: {
    id: Generated<string>;
    name: string;
    kind: string;
    scheduled_at: Date;
    duration: Generated<number>;
    tournament_id: string | null;
    status: Generated<string>;
    description: string | null;
    twitch_url: string | null;
    created_by: string;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  cast_slot: {
    id: Generated<string>;
    event_id: string;
    role: string;
    required: Generated<boolean>;
    defrayment_amount: ColumnType<string | number | null, string | null, string | null>;
    defrayment_currency: string | null;
    defrayment_reason: string | null;
    notes: string | null;
  };
  cast_availability: {
    id: Generated<string>;
    user_id: string;
    event_id: string;
    status: Generated<string>;
    preferred_roles: ColumnType<unknown, unknown, unknown>;
    notes: string | null;
    declared_at: Generated<Date>;
  };
  cast_attribution: {
    id: Generated<string>;
    slot_id: string;
    user_id: string | null;
    assigned_at: Generated<Date>;
    assigned_by: string;
    confirmed_at: Date | null;
    notified_j2: Generated<boolean>;
    notified_h2: Generated<boolean>;
  };
};

const kind = t.Enum(CastEventKind);
const eventStatus = t.Enum(CastEventStatus);
const slotRole = t.Enum(CastSlotRole);
const availabilityStatus = t.Enum(CastAvailabilityStatus);

const event = t.Object({
  id: t.String(),
  name: t.String(),
  kind,
  scheduledAt: t.String(),
  duration: t.Number(),
  tournamentId: t.Nullable(t.String()),
  status: eventStatus,
  description: t.Nullable(t.String()),
  twitchUrl: t.Nullable(t.String()),
  createdBy: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

const attribution = t.Object({
  id: t.String(),
  slotId: t.String(),
  userId: t.Nullable(t.String()),
  assignedAt: t.String(),
  assignedBy: t.String(),
  confirmedAt: t.Nullable(t.String()),
});

const availability = t.Object({
  id: t.String(),
  userId: t.String(),
  status: availabilityStatus,
  preferredRoles: t.Nullable(t.Array(slotRole)),
  notes: t.Nullable(t.String()),
  declaredAt: t.String(),
});

const slot = t.Object({
  id: t.String(),
  role: slotRole,
  required: t.Boolean(),
  defraymentAmount: t.Nullable(t.String()),
  defraymentCurrency: t.Nullable(t.String()),
  defraymentReason: t.Nullable(t.String()),
  notes: t.Nullable(t.String()),
});

const checklistItem = t.Object({
  slot,
  attribution: t.Nullable(attribution),
  casterId: t.Nullable(t.String()),
  confirmed: t.Boolean(),
});

const id = t.String({ minLength: 1, maxLength: 64 });
const userId = t.String({ minLength: 1, maxLength: 32 });

export const CastModel = {
  event,
  slot,
  attribution,
  availability,
  detail: t.Object({
    event,
    slots: t.Array(slot),
    attributions: t.Array(attribution),
    checklist: t.Array(checklistItem),
  }),
  list: t.Object({
    data: t.Array(event),
    total: t.Number(),
    meta: t.Object({ page: t.Number(), pageSize: t.Number(), pageCount: t.Number() }),
  }),
  idParams: t.Object({ id }),
  listQuery: t.Object({
    status: t.Optional(eventStatus),
    from: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
    to: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
    page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 25 })),
  }),
  createBody: t.Object({
    name: t.String({ minLength: 1, maxLength: 255 }),
    kind,
    scheduledAt: t.String({ minLength: 1, maxLength: 64 }),
    duration: t.Optional(t.Integer({ minimum: 1, maximum: 24 * 60 })),
    tournamentId: t.Optional(t.Nullable(t.String({ maxLength: 64 }))),
    twitchUrl: t.Optional(t.Nullable(t.String({ maxLength: 512 }))),
    description: t.Optional(t.Nullable(t.String({ maxLength: 4000 }))),
    slots: t.Array(t.Object({ role: slotRole, required: t.Optional(t.Boolean()) }), { minItems: 1, maxItems: 32 }),
  }),
  surveyBody: t.Object({ casterPool: t.Array(userId, { minItems: 1, maxItems: 200 }) }),
  availabilityBody: t.Object({
    status: availabilityStatus,
    preferredRoles: t.Optional(t.Nullable(t.Array(slotRole, { maxItems: 6 }))),
    notes: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
  }),
  autoAssignBody: t.Optional(
    t.Object({ maxSlotsPerCaster: t.Optional(t.Integer({ minimum: 1, maximum: 50 })) }),
  ),
  swapBody: t.Object({ newCasterId: userId }),
  surveyResult: t.Object({ success: t.Boolean(), eventId: t.String(), poolSize: t.Number() }),
  autoAssignResult: t.Object({ created: t.Number(), attributions: t.Array(attribution) }),
  reminderReport: t.Object({
    kind: t.Union([t.Literal("j2"), t.Literal("h2")]),
    events: t.Number(),
    sent: t.Number(),
    failed: t.Number(),
  }),
  caster: t.Object({
    id: t.String(),
    displayName: t.String(),
    avatar: t.Nullable(t.String()),
    bio: t.Nullable(t.String()),
    twitchUrl: t.Nullable(t.String()),
    recentCasts: t.Number(),
  }),
};
