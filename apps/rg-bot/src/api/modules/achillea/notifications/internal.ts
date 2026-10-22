/**
 * Relais INTERNES de `/notifications` (sous-process ranked → API), protégés
 * par l'en-tête `x-internal-secret` = `RANKED_INTERNAL_SECRET`.
 *
 * - `emit-match-found` / `emit-to-users` : livraison temps réel aux joueurs
 *   connectés (lobby Colyseus du même processus `rg-core`, qui a remplacé le
 *   Socket.IO du bot legacy), ET persistance dans la boîte de réception :
 *   lue d'office si le joueur l'a reçue en direct, non lue sinon — un joueur
 *   hors ligne retrouve ce qu'il a manqué.
 * - `ranked-proof` : publie la preuve de litige dans le salon des Tournament
 *   Organizers via l'application Discord Achilléa.
 *
 * Écart avec le legacy : sans secret configuré, le legacy acceptait les appels
 * loopback ; derrière le relais `/api`, toute requête publique arrive en
 * loopback, l'API refuse donc tout appel tant que le secret n'est pas posé.
 */

import { Elysia, status, t } from "elysia";
import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { NotificationCategory, NotificationType } from "@rosegriffon/achillea-core/enums";
import { publierSalonAchillea, type MessageAchillea } from "../../../../lib/achillea-discord";
import { dbPlugin } from "../../../plugins/db";
import { isInternalCall } from "../guards";

/** Livre un évènement aux joueurs connectés ; rend les identifiants atteints. */
export type RealtimeDelivery = (userIds: readonly string[], event: string, payload: unknown) => Promise<Set<string>>;

const lobbyDelivery: RealtimeDelivery = async (userIds, event, payload) => {
  // Import paresseux : le module Colyseus n'est chargé que si un relais arrive.
  const { LobbyRoom } = await import("../../../ranked/rooms/LobbyRoom");
  const reached = new Set<string>();
  for (const userId of new Set(userIds)) if (LobbyRoom.livrerEvenement([userId], event, payload) > 0) reached.add(userId);
  return reached;
};

let delivery: RealtimeDelivery = lobbyDelivery;

/** Remplace la livraison temps réel (tests) ; `null` rétablit le lobby Colyseus. */
export function setRealtimeDelivery(next: RealtimeDelivery | null): void {
  delivery = next ?? lobbyDelivery;
}

const TITLES: Record<string, [string, string]> = {
  match_found: ["Match trouvé", "Un adversaire a été trouvé pour ta partie classée."],
  rematch_offer: ["Proposition de revanche", "Ton adversaire te propose une revanche."],
  ranked_dispute_resolved: ["Litige tranché", "Les administrateurs ont rendu leur décision sur ton litige ranked."],
};

/** Livre puis consigne ; une panne temps réel n'empêche jamais la persistance. */
export async function relayToUsers(
  db: Kysely<Database>,
  userIds: readonly string[],
  event: string,
  payload: unknown,
): Promise<{ delivered: number; stored: number }> {
  const unique = [...new Set(userIds)];
  let reached = new Set<string>();
  try {
    reached = await delivery(unique, event, payload);
  } catch (err) {
    console.error(`[notifications] livraison temps réel « ${event} » en échec`, err);
  }
  const existing = await db.selectFrom("user").select("id").where("id", "in", unique).execute();
  if (existing.length === 0) return { delivered: reached.size, stored: 0 };
  const [title, message] = TITLES[event] ?? [event, `Évènement « ${event} »`];
  const now = new Date();
  await db.transaction().execute(async trx => {
    const notification = await trx
      .insertInto("notification")
      .values({
        title,
        message,
        type: event === "match_found" ? NotificationType.RANKED_MATCH_FOUND : NotificationType.REALTIME_EVENT,
        category: NotificationCategory.USER,
        payload: { event, data: payload ?? {} } as Record<string, unknown>,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await trx
      .insertInto("user_notification")
      .values(
        existing.map(({ id }) => ({
          notification_id: notification.id,
          user_id: id,
          is_read: reached.has(id),
          read_at: reached.has(id) ? now : null,
        })),
      )
      .execute();
  });
  return { delivered: reached.size, stored: existing.length };
}

/** Salon des Tournament Organizers (`ACHILLEA_TO_CHANNEL_ID`, salon de prod du legacy par défaut). */
export function tournamentOrganizersChannel(): string {
  return process.env.ACHILLEA_TO_CHANNEL_ID?.trim() || "1436378680153608203";
}

/** Message de la preuve de litige, repris du `RankedDisputeNotifier` legacy. */
export function rankedProofMessage(lobbyId: number, userId: string, url: string): MessageAchillea {
  const absolute = /^https:\/\//i.test(url);
  const embed: Record<string, unknown> = {
    title: "🧾 Nouvelle preuve de litige Ranked",
    description: `Lobby **#${lobbyId}** — preuve déposée par <@${userId}>`,
    color: 0x6d00ce,
    footer: { text: "À arbitrer via le dashboard admin." },
    timestamp: new Date().toISOString(),
  };
  if (!absolute) return { embeds: [{ ...embed, fields: [{ name: "Preuve", value: url.slice(0, 1024) }] }] };
  return {
    embeds: [{ ...embed, image: { url } }],
    components: [
      { type: 1, components: [{ type: 2, style: 5, label: "🔗 Ouvrir la preuve", url }] },
    ],
  };
}

const success = t.Object({ success: t.Boolean(), error: t.Optional(t.String()) });
const forbidden = () => status(403, { success: false, error: "forbidden" });
const userIds = t.Array(t.String({ pattern: "^\\d{5,24}$" }), { minItems: 1, maxItems: 100 });

export const notificationsInternalController = new Elysia({ prefix: "/notifications" })
  .use(dbPlugin)
  .post(
    "/emit-match-found",
    async ({ db, headers, body }) => {
      if (!isInternalCall(headers)) return forbidden();
      await relayToUsers(db, body.userIds, "match_found", body.payload ?? {});
      return { success: true };
    },
    {
      body: t.Object({ userIds, payload: t.Optional(t.Unknown()) }),
      response: { 200: success, 403: success },
    },
  )
  .post(
    "/emit-to-users",
    async ({ db, headers, body }) => {
      if (!isInternalCall(headers)) return forbidden();
      await relayToUsers(db, body.userIds, body.event, body.payload ?? {});
      return { success: true };
    },
    {
      body: t.Object({
        userIds,
        event: t.String({ pattern: "^[a-z][a-z0-9_:-]{0,63}$" }),
        payload: t.Optional(t.Unknown()),
      }),
      response: { 200: success, 403: success },
    },
  )
  .post(
    "/ranked-proof",
    async ({ headers, body }) => {
      if (!isInternalCall(headers)) return forbidden();
      const result = await publierSalonAchillea(
        tournamentOrganizersChannel(),
        rankedProofMessage(body.lobbyId, body.userId, body.url),
      );
      if (!result.ok) {
        console.error("[notifications] ranked-proof : envoi salon TO en échec", result);
        return status(502, { success: false, error: result.motif || "discord" });
      }
      return { success: true };
    },
    {
      body: t.Object({
        lobbyId: t.Integer({ minimum: 1 }),
        userId: t.String({ pattern: "^\\d{5,24}$" }),
        url: t.String({ minLength: 1, maxLength: 2048 }),
      }),
      response: { 200: success, 403: success, 502: success },
    },
  );
