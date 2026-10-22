/**
 * Gardes d'accès partagées par les contrôleurs staff d'Achilléa.
 *
 * `staff` est l'ancienne fonction locale de `admin.ts`, déplacée telle quelle
 * (mêmes statuts, mêmes messages) pour que les modules `admin-db`, `health`,
 * `stats` et `database` appliquent exactement la même règle. Le chargeur de
 * rôle est injectable : les tests vérifient le 403 sans base de données.
 */
import { status } from "elysia";
import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { verifyAdminBearerToken } from "@rosegriffon/achillea-core/auth";
import { resolveAchilleaSession } from "../auth/session";

/** Rôles staff d'Achilléa, tels que stockés dans `user.role`. */
export const ROLE_STAFF = {
  Moderateur: 1,
  Administrateur: 2,
  SuperAdministrateur: 3,
} as const;

export type EnTetesAuth = { authorization?: string; cookie?: string };

export type ActeurStaff = { id: string; role: number };

/** Lit l'identifiant et le rôle d'un compte ; `undefined` s'il n'existe pas. */
export type ChargeurRole = (db: Kysely<Database>, id: string) => Promise<ActeurStaff | undefined>;

export const chargerRoleEnBase: ChargeurRole = (db, id) =>
  db.selectFrom("user").select(["id", "role"]).where("id", "=", id).executeTakeFirst();

export async function staff(
  db: Kysely<Database>,
  headers: EnTetesAuth,
  minimumRole: number = ROLE_STAFF.Administrateur,
  chargerRole: ChargeurRole = chargerRoleEnBase,
) {
  const session = await resolveAchilleaSession(headers);
  if (!session) return { error: status(401, { message: "Authentication required" as const }) };
  const actor = await chargerRole(db, session.id);
  if (!actor || actor.role < minimumRole) return { error: status(403, { message: "Staff role required" as const }) };
  return { session, actor };
}

function jetonPorteur(header: string | undefined): string | null {
  const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
  return match?.[1] ?? null;
}

/**
 * Sondes d'exploitation (`/health/*`, `/stats/*`, `/database/*`).
 *
 * Le legacy ne les ouvrait qu'au jeton de développement (`API_ADMIN_TOKEN`).
 * Le back-office Next appelle avec le cookie de session : on accepte donc
 * aussi une session SuperAdministrateur, et rien en dessous.
 */
export async function superAdminOuJetonDev(
  db: Kysely<Database>,
  headers: EnTetesAuth,
  chargerRole: ChargeurRole = chargerRoleEnBase,
) {
  const jeton = jetonPorteur(headers.authorization);
  if (jeton && verifyAdminBearerToken(jeton, process.env.API_ADMIN_TOKEN)) {
    return { actor: null as ActeurStaff | null };
  }
  const auth = await staff(db, headers, ROLE_STAFF.SuperAdministrateur, chargerRole);
  if (auth.error) return { error: auth.error };
  return { actor: auth.actor as ActeurStaff | null };
}
