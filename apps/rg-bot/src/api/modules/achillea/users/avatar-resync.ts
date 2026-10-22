/**
 * `POST /users/resync-avatars` — réindexe avatar, pseudo et nom affiché de
 * tous les comptes depuis l'API REST Discord (jeton de l'application
 * Achilléa), pour que ranked, classement et membres de clan les lisent sans
 * appel Discord. Tâche de fond (~1-2 min) ; la route répond immédiatement.
 *
 * Écarts avec le legacy : une seule passe à la fois (`started: false` si une
 * passe tourne déjà), 429 Discord respectés (`retry_after`), et le résultat de
 * la dernière passe est consigné dans les journaux.
 */

import { Elysia, status, t } from "elysia";
import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { normalizeNames } from "@rosegriffon/achillea-core/names";
import { resolveDiscordAvatarUrl } from "@rosegriffon/achillea-core/identity";
import { jetonBotAchillea } from "../../../../lib/achillea-discord";
import { dbPlugin } from "../../../plugins/db";
import { journaliserAudit } from "../audit";
import { requireRole, ROLE_ADMINISTRATOR } from "../guards";

const API_DISCORD = "https://discord.com/api/v10";
const CHUNK = 10;
const PAUSE_MS = 1200;

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export interface ResyncResult {
  scanned: number;
  updated: number;
  failed: number;
}

/** `null` = compte inconnu de Discord (404) ; lève sur toute autre erreur. */
export async function fetchDiscordUser(token: string, userId: string, attempt = 0): Promise<DiscordUser | null> {
  const response = await fetch(`${API_DISCORD}/users/${userId}`, {
    headers: { Authorization: `Bot ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return null;
  if (response.status === 429 && attempt < 3) {
    const body = (await response.json().catch(() => ({}))) as { retry_after?: number };
    await Bun.sleep(Math.ceil((body.retry_after ?? 1) * 1000) + 250);
    return fetchDiscordUser(token, userId, attempt + 1);
  }
  if (!response.ok) throw new Error(`Discord ${response.status}`);
  return (await response.json()) as DiscordUser;
}

export async function resyncAvatars(
  db: Kysely<Database>,
  token: string,
  options: { pauseMs?: number } = {},
): Promise<ResyncResult> {
  const users = await db
    .selectFrom("user")
    .select(["id", "avatar", "username", "display_name", "normalized_display_name"])
    .execute();
  let updated = 0;
  let failed = 0;
  for (let i = 0; i < users.length; i += CHUNK) {
    const chunk = users.slice(i, i + CHUNK);
    const changes = await Promise.all(
      chunk.map(async user => {
        try {
          const discord = await fetchDiscordUser(token, user.id);
          if (!discord) {
            // Inconnu de Discord : on se contente de normaliser l'URL stockée.
            const normalized = resolveDiscordAvatarUrl(user.id, user.avatar);
            return normalized === user.avatar ? null : { id: user.id, avatar: normalized };
          }
          const avatar = resolveDiscordAvatarUrl(discord.id, discord.avatar);
          // username / display_name sont NOT NULL : jamais écrasés par une valeur vide.
          const username = discord.username || user.username || "";
          const displayName = discord.global_name || username || user.display_name;
          if (avatar === user.avatar && username === user.username && displayName === user.display_name) return null;
          return {
            id: user.id,
            avatar,
            username,
            display_name: displayName,
            normalized_display_name: normalizeNames(displayName),
          };
        } catch {
          failed++;
          return null;
        }
      }),
    );
    for (const change of changes) {
      if (!change) continue;
      const { id, ...values } = change;
      await db.updateTable("user").set(values).where("id", "=", id).execute();
      updated++;
    }
    if (i + CHUNK < users.length) await Bun.sleep(options.pauseMs ?? PAUSE_MS);
  }
  return { scanned: users.length, updated, failed };
}

let running: Promise<ResyncResult> | null = null;

/** Passe en cours, le cas échéant (tests et supervision). */
export function currentAvatarResync(): Promise<ResyncResult> | null {
  return running;
}

export const avatarResyncController = new Elysia({ prefix: "/users" }).use(dbPlugin).post(
  "/resync-avatars",
  async ({ db, headers }) => {
    const auth = await requireRole(db, headers, ROLE_ADMINISTRATOR);
    if (auth.error) return auth.error;
    const token = jetonBotAchillea();
    if (!token) return status(503, { message: "ACHILLEA_DISCORD_BOT_TOKEN absent" });
    if (running) return { started: false };
    await journaliserAudit(db, {
      acteur: auth.session.id,
      action: "user.resync_avatars",
      cibleType: "user",
      cibleId: null,
    });
    running = resyncAvatars(db, token)
      .then(result => {
        console.info("[resync-avatars]", result);
        return result;
      })
      .catch(err => {
        console.error("[resync-avatars]", err);
        return { scanned: 0, updated: 0, failed: 0 };
      })
      .finally(() => {
        running = null;
      });
    return { started: true };
  },
  {
    response: {
      200: t.Object({ started: t.Boolean() }),
      401: t.Object({ message: t.String() }),
      403: t.Object({ message: t.String() }),
      503: t.Object({ message: t.String() }),
    },
  },
);
