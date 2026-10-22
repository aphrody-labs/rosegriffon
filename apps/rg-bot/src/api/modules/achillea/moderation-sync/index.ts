/**
 * `POST /moderation/sync` — webhook de modération cross-serveurs (bots
 * partenaires), portage de `ModerationSyncController`.
 *
 * Sécurité :
 * - signature HMAC-SHA256 hexadécimale de `${timestamp}.${corps brut}` avec
 *   `ACHILLEA_CROSS_SYNC_RECEIVE_SECRET`, en-têtes `x-achillea-signature` et
 *   `x-achillea-timestamp` (millisecondes) ; dérive > 5 min refusée ;
 * - anti-boucle : la sanction reçue porte `evidence[0].from = source_bot_id`,
 *   que la propagation sortante reconnaît et ne renvoie pas.
 *
 * Améliorations : la signature est vérifiée sur le corps BRUT reçu (repli sur
 * la forme re-sérialisée qu'utilisait le legacy), et un rejeu d'une même création (même
 * `original_id`, même serveur source) renvoie la sanction déjà créée au lieu
 * d'en dupliquer une.
 */

import { Elysia, status, t } from "elysia";
import { sql, type Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { SanctionIssuerType, SanctionType } from "@rosegriffon/achillea-core/enums";
import { verifyHmacSha256 } from "@rosegriffon/achillea-core/licenses";
import { dbPlugin } from "../../../plugins/db";
import { journaliserAudit } from "../audit";

export const MAX_DRIFT_MS = 5 * 60 * 1000;

export interface IncomingSanction {
  id?: string;
  userId?: string;
  type?: string;
  reason?: string | null;
  durationSec?: number | null;
  expiresAt?: string | null;
  issuedBy?: string;
  evidence?: Record<string, unknown>[] | null;
}

export interface CrossSyncBody {
  version?: string;
  source_guild_id?: string;
  source_bot_id?: string;
  sanction?: IncomingSanction;
  action?: string;
}

export async function verifyCrossSyncSignature(
  timestamp: string,
  rawBody: string,
  signature: string,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_DRIFT_MS) return false;
  if (await verifyHmacSha256(`${timestamp}.${rawBody}`, signature.toLowerCase(), secret)) return true;
  // Le relais `/api` de rg-core re-sérialise le JSON : on accepte aussi la forme
  // canonique `JSON.stringify(JSON.parse(corps))`, celle que signait le legacy.
  try {
    const canonical = JSON.stringify(JSON.parse(rawBody));
    return canonical !== rawBody && (await verifyHmacSha256(`${timestamp}.${canonical}`, signature.toLowerCase(), secret));
  } catch {
    return false;
  }
}

export class CrossSyncError extends Error {}

/** Validation du message ; lève `CrossSyncError` (422) avec la raison. */
export function validateCrossSync(body: CrossSyncBody) {
  if (body.version !== "1.0") throw new CrossSyncError(`Unsupported version: ${body.version}`);
  const { source_guild_id: guildId, source_bot_id: botId, sanction, action } = body;
  if (!guildId || !botId || !sanction || !action)
    throw new CrossSyncError("Missing required fields: source_guild_id, source_bot_id, sanction, action");
  if (!sanction.userId || !sanction.type || !sanction.issuedBy)
    throw new CrossSyncError("Sanction payload missing userId, type, or issuedBy");
  const type = (Object.values(SanctionType) as string[]).includes(sanction.type) ? (sanction.type as SanctionType) : null;
  if (!type) throw new CrossSyncError(`Unknown sanction type: ${sanction.type}`);
  if (action !== "create" && action !== "revoke") throw new CrossSyncError(`Unknown action: ${action}`);
  const expiresAt = sanction.expiresAt ? new Date(sanction.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new CrossSyncError("Invalid expiresAt");
  return {
    guildId,
    botId,
    action,
    type,
    userId: sanction.userId,
    issuedBy: sanction.issuedBy,
    originalId: sanction.id ?? null,
    reason: sanction.reason ?? null,
    durationSec: typeof sanction.durationSec === "number" ? Math.trunc(sanction.durationSec) : null,
    expiresAt,
    evidence: Array.isArray(sanction.evidence) ? sanction.evidence : [],
  } as const;
}

type CrossSync = ReturnType<typeof validateCrossSync>;

async function findMirrored(db: Kysely<Database>, sync: CrossSync, activeOnly: boolean) {
  if (!sync.originalId) return null;
  let query = db
    .selectFrom("sanction")
    .select("id")
    .where("user_id", "=", sync.userId)
    .where("guild_id", "=", sync.guildId)
    .where(sql<boolean>`evidence -> 0 ->> 'original_id' = ${sync.originalId}`);
  if (activeOnly) query = query.where("revoked_at", "is", null);
  return (await query.executeTakeFirst()) ?? null;
}

/** Applique le message et le journalise (audit signé) dans une même transaction. */
export async function applyCrossSync(db: Kysely<Database>, sync: CrossSync): Promise<string> {
  return db.transaction().execute(async trx => {
    const sanctionId = await writeCrossSync(trx, sync);
    await journaliserAudit(trx, {
      acteur: null,
      action: `sanction.sync.${sync.action}`,
      cibleType: "sanction",
      cibleId: sanctionId,
      charge: {
        userId: sync.userId,
        type: sync.type,
        sourceGuildId: sync.guildId,
        sourceBotId: sync.botId,
        originalId: sync.originalId,
      },
      motif: sync.reason,
      guildeId: sync.guildId,
    });
    return sanctionId;
  });
}

async function writeCrossSync(db: Kysely<Database>, sync: CrossSync): Promise<string> {
  const origin = { from: sync.botId, source_guild: sync.guildId, original_id: sync.originalId };
  if (sync.action === "create") {
    const existing = await findMirrored(db, sync, false);
    if (existing) return existing.id;
    const inserted = await db
      .insertInto("sanction")
      .values({
        user_id: sync.userId,
        guild_id: sync.guildId,
        type: sync.type,
        reason: sync.reason,
        duration_sec: sync.durationSec,
        issued_by: sync.issuedBy,
        issued_by_type: SanctionIssuerType.System,
        expires_at: sync.expiresAt,
        revoked_at: null,
        revoked_by: null,
        revoke_reason: null,
        // `from` vient après la preuve d'origine : elle ne peut pas l'écraser (anti-boucle).
        evidence: [{ ...sync.evidence[0], ...origin }],
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return inserted.id;
  }

  const mirrored = await findMirrored(db, sync, true);
  if (mirrored) {
    await db
      .updateTable("sanction")
      .set({ revoked_at: new Date(), revoked_by: sync.botId, revoke_reason: `Cross-sync revoke from ${sync.botId}` })
      .where("id", "=", mirrored.id)
      .where("revoked_at", "is", null)
      .execute();
    return mirrored.id;
  }

  // Sanction miroir introuvable : on consigne la levée (unban / unmute).
  const revokeType =
    sync.type === SanctionType.Ban ? SanctionType.Unban : sync.type === SanctionType.Mute ? SanctionType.Unmute : sync.type;
  const inserted = await db
    .insertInto("sanction")
    .values({
      user_id: sync.userId,
      guild_id: sync.guildId,
      type: revokeType,
      reason: `Cross-sync revoke from ${sync.botId}`,
      duration_sec: null,
      issued_by: sync.botId,
      issued_by_type: SanctionIssuerType.System,
      expires_at: null,
      revoked_at: null,
      revoked_by: null,
      revoke_reason: null,
      evidence: [origin],
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return inserted.id;
}

const failure = t.Object({ message: t.String() });

export const moderationSyncController = new Elysia({ prefix: "/moderation" }).use(dbPlugin).post(
  "/sync",
  async ({ db, headers, body }) => {
    const signature = headers["x-achillea-signature"];
    const timestamp = headers["x-achillea-timestamp"];
    if (!signature || !timestamp)
      return status(403, { message: "Missing x-achillea-signature or x-achillea-timestamp headers" });
    const secret = process.env.ACHILLEA_CROSS_SYNC_RECEIVE_SECRET;
    if (!secret) return status(403, { message: "Cross-sync receive secret not configured" });
    const raw = typeof body === "string" ? body : "";
    if (!(await verifyCrossSyncSignature(timestamp, raw, signature, secret)))
      return status(403, { message: "Invalid signature or timestamp drift > 5 minutes" });
    let parsed: CrossSyncBody;
    try {
      parsed = JSON.parse(raw) as CrossSyncBody;
    } catch {
      return status(422, { message: "Invalid JSON body" });
    }
    try {
      const sanctionId = await applyCrossSync(db, validateCrossSync(parsed ?? {}));
      return { ok: true, sanctionId };
    } catch (err) {
      if (err instanceof CrossSyncError) return status(422, { message: err.message });
      throw err;
    }
  },
  {
    // Corps brut : la signature porte sur les octets reçus, pas sur un JSON re-sérialisé.
    parse: "text",
    response: { 200: t.Object({ ok: t.Boolean(), sanctionId: t.String() }), 403: failure, 422: failure },
  },
);
