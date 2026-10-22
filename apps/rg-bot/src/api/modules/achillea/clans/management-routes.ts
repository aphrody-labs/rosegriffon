/**
 * Mutations de clan servies au site Achilléa (`/api/clans/*` → `/v1/achillea/clans/*`).
 * Toutes exigent la session Achilléa ; les règles vivent dans `./management`.
 */

import { Elysia, status } from "elysia";
import { dbPlugin } from "../../../plugins/db";
import { resolveAchilleaSession } from "../../auth/session";
import { ClanManagementModel as M } from "./management-model";
import { ClanManagementService, clanMembers, isClanMemberRole, parseDistinctions, type Failure } from "./management";

const unauthenticated = { success: false as const, error: "Non authentifié." };
const invalidDistinctions = { success: false as const, error: "Les distinctions fournies sont invalides." };

function failure(result: Failure) {
  return status(result.status, {
    success: false as const,
    error: result.error,
    ...(result.code ? { code: result.code } : {}),
  });
}

const errors = {
  400: M.failure,
  401: M.failure,
  403: M.failure,
  404: M.failure,
  409: M.failure,
  502: M.failure,
  503: M.failure,
};

export const clanManagementController = new Elysia({ prefix: "/clans" })
  .use(dbPlugin)
  .post(
    "/create",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, unauthenticated);
      const result = await ClanManagementService.create(db, session.id, body);
      if (!result.ok) return failure(result);
      return { success: true as const, clanId: result.clanId };
    },
    { body: M.createBody, response: { 200: M.createResponse, ...errors } },
  )
  .post(
    "/applications/create",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, unauthenticated);
      const distinctions = parseDistinctions(body.distinctions);
      if (!distinctions) return status(400, invalidDistinctions);
      const result = await ClanManagementService.apply(db, session.id, body.clanId, distinctions);
      if (!result.ok) return failure(result);
      return { success: true as const, autojoin: result.autojoin };
    },
    { body: M.applicationCreateBody, response: { 200: M.applicationCreateResponse, ...errors } },
  )
  .post(
    "/applications/accept",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, unauthenticated);
      const result = await ClanManagementService.acceptApplication(db, session.id, body.id);
      if (!result.ok) return failure(result);
      return { success: true as const };
    },
    { body: M.byId, response: { 200: M.success, ...errors } },
  )
  .post(
    "/applications/reject",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, unauthenticated);
      const result = await ClanManagementService.rejectApplication(db, session.id, body.id);
      if (!result.ok) return failure(result);
      return { success: true as const };
    },
    { body: M.byId, response: { 200: M.success, ...errors } },
  )
  .post(
    "/invites/create",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, unauthenticated);
      const distinctions = parseDistinctions(body.distinctions);
      if (!distinctions) return status(400, invalidDistinctions);
      const result = await ClanManagementService.invite(db, session.id, body.userId.trim(), distinctions);
      if (!result.ok) return failure(result);
      return { success: true as const };
    },
    { body: M.inviteCreateBody, response: { 200: M.success, ...errors } },
  )
  .post(
    "/invites/revoke",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, unauthenticated);
      const result = await ClanManagementService.revokeInvite(db, session.id, body.id);
      if (!result.ok) return failure(result);
      return { success: true as const };
    },
    { body: M.byId, response: { 200: M.success, ...errors } },
  )
  .post(
    "/invites/notify",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, unauthenticated);
      const result = await ClanManagementService.notifyInvite(db, session.id, body.id);
      if (!result.ok) return failure(result);
      return { success: true as const };
    },
    { body: M.byId, response: { 200: M.success, ...errors } },
  )
  .post(
    "/kick/:id",
    async ({ db, headers, params, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, unauthenticated);
      const result = await ClanManagementService.kick(db, session.id, params.id, body.reason);
      if (!result.ok) return failure(result);
      return { success: true as const, members: await clanMembers(db, result.clanId) };
    },
    { body: M.kickBody, response: { 200: M.membersResponse, ...errors } },
  )
  .post(
    "/updateMember",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, unauthenticated);
      if (!isClanMemberRole(body.clanRole)) return status(400, { success: false as const, error: "Rôle invalide." });
      const distinctions = parseDistinctions(body.distinctions);
      if (!distinctions) return status(400, { success: false as const, error: "Distinction invalide." });
      const result = await ClanManagementService.updateMember(
        db,
        session.id,
        body.user.id,
        body.clanRole,
        distinctions,
      );
      if (!result.ok) return failure(result);
      return { success: true as const, members: await clanMembers(db, result.clanId) };
    },
    { body: M.updateMemberBody, response: { 200: M.membersResponse, ...errors } },
  );
