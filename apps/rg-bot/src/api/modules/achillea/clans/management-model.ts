import { t } from "elysia";
import { ClanModel } from "./model";

/** Pays (`Country` de `@rosegriffon/achillea-types`) : seul `code` est persisté. */
const country = t.Object({ code: t.String({ minLength: 1 }) }, { additionalProperties: true });

/** Échec métier : forme `{ success: false, error }` du legacy. */
const failure = t.Object({ success: t.Literal(false), error: t.String(), code: t.Optional(t.String()) });

/** Invitation / candidature renvoyée telle que lue par `GET /clans/invites|applications` : seul `id` compte. */
const byId = t.Object({ id: t.Numeric() }, { additionalProperties: true });

export const ClanManagementModel = {
  failure,
  success: t.Object({ success: t.Literal(true) }),
  createBody: t.Object(
    {
      founders: t.Array(t.Object({ id: t.String({ minLength: 1 }) }, { additionalProperties: true }), {
        maxItems: 10,
      }),
      logo: t.String({ minLength: 1 }),
      name: t.String(),
      normalizedName: t.Optional(t.String()),
      shortName: t.String(),
      normalizedShortName: t.Optional(t.String()),
      description: t.String(),
      twitter: t.Optional(t.String()),
      instagram: t.Optional(t.String()),
      tiktok: t.Optional(t.String()),
      origin: t.Optional(country),
      languages: t.Optional(t.Array(country, { maxItems: 20 })),
    },
    { additionalProperties: true },
  ),
  createResponse: t.Object({ success: t.Literal(true), clanId: t.Number() }),
  applicationCreateBody: t.Object({
    clanId: t.Numeric(),
    distinctions: t.Array(t.String(), { maxItems: 4 }),
  }),
  applicationCreateResponse: t.Object({ success: t.Literal(true), autojoin: t.Boolean() }),
  inviteCreateBody: t.Object({
    userId: t.String({ minLength: 1 }),
    distinctions: t.Array(t.String(), { maxItems: 4 }),
  }),
  byId,
  kickBody: t.Object({ reason: t.Optional(t.String({ maxLength: 500 })) }),
  updateMemberBody: t.Object(
    {
      clanRole: t.Number(),
      distinctions: t.Array(t.String(), { maxItems: 4 }),
      user: t.Object({ id: t.String({ minLength: 1 }) }, { additionalProperties: true }),
    },
    { additionalProperties: true },
  ),
  membersResponse: t.Object({ success: t.Literal(true), members: ClanModel.members }),
} as const;
