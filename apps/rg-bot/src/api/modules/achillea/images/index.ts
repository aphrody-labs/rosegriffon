/**
 * Images générées : carte joueur (`/users/:id/card.png`) et affiche de clan
 * (`/clans/:id/poster.png`), avec leur régénération archivée dans le Storage.
 *
 * Écarts assumés avec le legacy :
 * - la régénération n'est plus ouverte à toute session : carte = le joueur
 *   lui-même ou le staff ; affiche = un membre du clan ou le staff ;
 * - les rendus publics passent par un cache mémoire de 5 min (même durée que
 *   le `Cache-Control`), pour qu'une rafale de requêtes ne relance pas Skia.
 */

import { Elysia, status, t } from "elysia";
import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { dbPlugin } from "../../../plugins/db";
import { journaliserAudit } from "../audit";
import { requireSession, ROLE_MODERATOR } from "../guards";
import { publicImageStorage } from "../storage";
import { loadClanPosterData, renderClanPoster } from "./clan-poster";
import { loadPlayerCardData, renderPlayerCard } from "./player-card";
import { ImageNotFoundError } from "./render";

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 200;
const cache = new Map<string, { expires: number; png: Buffer }>();

async function cached(key: string, render: () => Promise<Buffer>): Promise<Buffer> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.png;
  const png = await render();
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { expires: Date.now() + TTL_MS, png });
  return png;
}

/** Vide le cache de rendu (tests, régénération). */
export function clearImageCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

function png(bytes: Buffer, filename: string): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=300",
      "content-disposition": `inline; filename="${filename}"`,
    },
  });
}

async function roleOf(db: Kysely<Database>, userId: string): Promise<number> {
  const row = await db.selectFrom("user").select("role").where("id", "=", userId).executeTakeFirst();
  return row?.role ?? 0;
}

const SNOWFLAKE = /^\d{5,24}$/;
const generationResult = t.Object({ success: t.Boolean(), path: t.Optional(t.String()), error: t.Optional(t.String()) });
const message = t.Object({ message: t.String() });

export const imagesController = new Elysia()
  .use(dbPlugin)
  .get(
    "/users/:id/card.png",
    async ({ db, params: { id } }) => {
      if (!SNOWFLAKE.test(id)) return status(404, { message: "Utilisateur introuvable" });
      try {
        const bytes = await cached(`card:${id}`, async () => renderPlayerCard(await loadPlayerCardData(db, id)));
        return png(bytes, `player-${id}-card.png`);
      } catch (err) {
        if (err instanceof ImageNotFoundError) return status(404, { message: err.message });
        throw err;
      }
    },
    { params: t.Object({ id: t.String({ maxLength: 32 }) }) },
  )
  .post(
    "/users/:id/card/regenerate",
    async ({ db, headers, params: { id } }) => {
      const auth = await requireSession(headers);
      if (auth.error) return auth.error;
      if (auth.session.id !== id && (await roleOf(db, auth.session.id)) < ROLE_MODERATOR)
        return status(403, { message: "Réservé au joueur ou au staff" });
      const storage = publicImageStorage();
      if (!storage) return status(503, { success: false, error: "Stockage d'images non configuré" });
      try {
        const bytes = await renderPlayerCard(await loadPlayerCardData(db, id));
        cache.set(`card:${id}`, { expires: Date.now() + TTL_MS, png: bytes });
        const stored = await storage.put(`cards/${id}.png`, new Uint8Array(bytes), "image/png");
        await journaliserAudit(db, {
          acteur: auth.session.id,
          action: "user.card.regenerate",
          cibleType: "user",
          cibleId: id,
          charge: { path: stored.path },
        });
        return { success: true, path: stored.url };
      } catch (err) {
        if (err instanceof ImageNotFoundError) return status(404, { message: err.message });
        return status(400, { success: false, error: err instanceof Error ? err.message : "Génération impossible" });
      }
    },
    {
      params: t.Object({ id: t.String({ maxLength: 32 }) }),
      response: { 200: generationResult, 400: generationResult, 401: message, 403: message, 404: message, 503: generationResult },
    },
  )
  .get(
    "/clans/:id/poster.png",
    async ({ db, params: { id } }) => {
      try {
        const bytes = await cached(`poster:${id}`, async () => renderClanPoster(await loadClanPosterData(db, id)));
        return png(bytes, `clan-${id}-poster.png`);
      } catch (err) {
        if (err instanceof ImageNotFoundError) return status(404, { message: err.message });
        throw err;
      }
    },
    { params: t.Object({ id: t.Numeric({ minimum: 1 }) }) },
  )
  .post(
    "/clans/:id/poster/regenerate",
    async ({ db, headers, params: { id } }) => {
      const auth = await requireSession(headers);
      if (auth.error) return auth.error;
      const member = await db
        .selectFrom("clan_member")
        .select("user_id")
        .where("clan_id", "=", id)
        .where("user_id", "=", auth.session.id)
        .executeTakeFirst();
      if (!member && (await roleOf(db, auth.session.id)) < ROLE_MODERATOR)
        return status(403, { message: "Réservé aux membres du clan ou au staff" });
      const storage = publicImageStorage();
      if (!storage) return status(503, { success: false, error: "Stockage d'images non configuré" });
      try {
        const bytes = await renderClanPoster(await loadClanPosterData(db, id));
        cache.set(`poster:${id}`, { expires: Date.now() + TTL_MS, png: bytes });
        // Archive horodatée, comme le legacy (`storage/clans/<id>-<ts>.png`).
        const stored = await storage.put(`posters/${id}-${Date.now()}.png`, new Uint8Array(bytes), "image/png");
        await journaliserAudit(db, {
          acteur: auth.session.id,
          action: "clan.poster.regenerate",
          cibleType: "clan",
          cibleId: String(id),
          charge: { path: stored.path },
        });
        return { success: true, path: stored.url };
      } catch (err) {
        if (err instanceof ImageNotFoundError) return status(404, { message: err.message });
        return status(400, { success: false, error: err instanceof Error ? err.message : "Génération impossible" });
      }
    },
    {
      params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
      response: { 200: generationResult, 400: generationResult, 401: message, 403: message, 404: message, 503: generationResult },
    },
  );
