/**
 * Gardes partagées des routes Achilléa portées depuis le bot legacy.
 *
 * - `requireSession` : session Achilléa obligatoire (401 sinon).
 * - `requireRole` : session + rôle minimal lu en base (`user.role` : 0 joueur,
 *   1 modérateur, 2 administrateur…) — 403 si insuffisant.
 * - `isInternalCall` : appels serveur à serveur (sous-process ranked) signés
 *   par le secret partagé `RANKED_INTERNAL_SECRET`.
 */

import { status } from "elysia";
import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { safeEqual } from "@rosegriffon/achillea-core/licenses";
import { resolveAchilleaSession } from "../auth/session";

export type SessionHeaders = { authorization?: string; cookie?: string };

/** Rôles Achilléa (colonne `user.role`). */
export const ROLE_MODERATOR = 1;
export const ROLE_ADMINISTRATOR = 2;

export const authRequired = { message: "Authentication required" as const };

export async function requireSession(headers: SessionHeaders) {
  const session = await resolveAchilleaSession(headers);
  if (!session) return { error: status(401, authRequired), session: null } as const;
  return { error: null, session } as const;
}

export async function requireRole(db: Kysely<Database>, headers: SessionHeaders, minimumRole: number) {
  const session = await resolveAchilleaSession(headers);
  if (!session) return { error: status(401, authRequired), session: null } as const;
  const actor = await db.selectFrom("user").select("role").where("id", "=", session.id).executeTakeFirst();
  if (!actor || actor.role < minimumRole)
    return { error: status(403, { message: "Staff role required" as const }), session: null } as const;
  return { error: null, session, role: actor.role } as const;
}

/**
 * Appel interne autorisé : en-tête `x-internal-secret` égal à
 * `RANKED_INTERNAL_SECRET`. Sans secret configuré, tout appel est refusé —
 * derrière le relais `/api`, l'adresse loopback n'est pas une preuve d'origine.
 */
export function isInternalCall(headers: Record<string, string | undefined>): boolean {
  const expected = process.env.RANKED_INTERNAL_SECRET ?? "";
  const received = headers["x-internal-secret"] ?? "";
  return expected.length > 0 && safeEqual(expected, received);
}
