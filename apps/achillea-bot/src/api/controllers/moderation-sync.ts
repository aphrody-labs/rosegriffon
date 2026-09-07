/**
 * ModerationSyncController — T-1.5
 *
 * POST /moderation/sync — point d'entrée des webhooks cross-serveurs.
 *
 * Sécurité :
 *   - Vérifie la signature HMAC (x-achillea-signature, x-achillea-timestamp)
 *   - Refuse les replays > 5 min
 *   - Anti-boucle : si evidence[0].from est défini, la sanction reçue n'est
 *     PAS re-propagée (CrossSyncService.pushSanction le détecte déjà).
 */

import { BodyParams, Controller, HeaderParams, Post, Req } from "@tsed/common";
import { Forbidden, UnprocessableEntity } from "@tsed/exceptions";
import type { Request } from "express";

import { Sanction } from "@/entities";
import { CrossSyncService, Database } from "@/services";
import { BaseController } from "@/utils/classes";
import { resolveDependenciesSync } from "@/utils/functions";
import { SanctionIssuerType, SanctionType } from "@/utils/enums";

// =============================================================================
// DTO / payload shape (permissive — validated inline)
// =============================================================================

interface IncomingSanction {
	id?: string;
	userId?: string;
	type?: string;
	reason?: string | null;
	durationSec?: number | null;
	expiresAt?: string | null;
	issuedBy?: string;
	issuedAt?: string;
	evidence?: Record<string, unknown>[] | null;
}

interface CrossSyncBody {
	version?: string;
	source_guild_id?: string;
	source_bot_id?: string;
	sanction?: IncomingSanction;
	action?: string;
	propagation_policy?: string;
}

// =============================================================================
// Controller
// =============================================================================

@Controller("/moderation/sync")
export class ModerationSyncController extends BaseController {
	private crossSync: CrossSyncService;
	private db: Database;

	constructor() {
		super();
		[this.crossSync, this.db] = resolveDependenciesSync([CrossSyncService, Database]);
	}

	@Post("/")
	async receive(
		@Req() req: Request,
		@HeaderParams("x-achillea-signature") signature: string | undefined,
		@HeaderParams("x-achillea-timestamp") timestamp: string | undefined,
		@BodyParams() body: CrossSyncBody
	): Promise<{ ok: boolean; sanctionId: string }> {
		// -------------------------------------------------------------------------
		// 1. Header presence
		// -------------------------------------------------------------------------
		if (!signature || !timestamp) {
			throw new Forbidden("Missing x-achillea-signature or x-achillea-timestamp headers");
		}

		// -------------------------------------------------------------------------
		// 2. HMAC verification
		// -------------------------------------------------------------------------
		const secret = process.env.ACHILLEA_CROSS_SYNC_RECEIVE_SECRET;
		if (!secret) {
			throw new Forbidden("Cross-sync receive secret not configured");
		}

		const rawBody = JSON.stringify(body);
		const valid = await this.crossSync.verifySignature(timestamp, rawBody, signature, secret);
		if (!valid) {
			throw new Forbidden("Invalid signature or timestamp drift > 5 minutes");
		}

		// -------------------------------------------------------------------------
		// 3. Payload validation
		// -------------------------------------------------------------------------
		const { version, source_guild_id, source_bot_id, sanction: s, action } = body;

		if (version !== "1.0") {
			throw new UnprocessableEntity(`Unsupported version: ${version}`);
		}

		if (!source_guild_id || !source_bot_id || !s || !action) {
			throw new UnprocessableEntity(
				"Missing required fields: source_guild_id, source_bot_id, sanction, action"
			);
		}

		if (!s.userId || !s.type || !s.issuedBy) {
			throw new UnprocessableEntity("Sanction payload missing userId, type, or issuedBy");
		}

		const sanctionType = Object.values(SanctionType).includes(s.type as SanctionType)
			? (s.type as SanctionType)
			: null;

		if (!sanctionType) {
			throw new UnprocessableEntity(`Unknown sanction type: ${s.type}`);
		}

		if (action !== "create" && action !== "revoke") {
			throw new UnprocessableEntity(`Unknown action: ${action}`);
		}

		// -------------------------------------------------------------------------
		// 4. Persist locally
		//    evidence[0].from = source_bot_id to prevent re-propagation
		// -------------------------------------------------------------------------
		const em = this.db.em.fork();

		if (action === "create") {
			const sanction = new Sanction();
			sanction.userId = s.userId;
			sanction.guildId = source_guild_id;
			sanction.type = sanctionType;
			sanction.reason = s.reason ?? null;
			sanction.durationSec = s.durationSec ?? null;
			sanction.issuedBy = s.issuedBy;
			sanction.issuedByType = SanctionIssuerType.System;
			sanction.expiresAt = s.expiresAt ? new Date(s.expiresAt) : null;
			sanction.evidence = [
				{
					from: source_bot_id,
					source_guild: source_guild_id,
					original_id: s.id ?? null,
					...s.evidence?.[0],
				},
			];

			await em.persist(sanction).flush();
			return { ok: true, sanctionId: sanction.id };
		}

		// action === "revoke"
		// Try to find the original sanction by original_id stored in evidence
		const original_id = s.id;
		let resolved: Sanction | null = null;

		if (original_id) {
			// Échappe les wildcards LIKE (% _ \) pour éviter de révoquer une mauvaise
			// sanction si l'id distant en contient.
			const escapedId = original_id.replace(/[\\%_]/g, "\\$&");
			// Look for an existing local sanction that mirrors the remote one
			resolved = await em.findOne(Sanction, {
				userId: s.userId,
				guildId: source_guild_id,
				evidence: { $like: `%"original_id":"${escapedId}"%` } as any,
				revokedAt: null,
			});
		}

		if (resolved) {
			resolved.revokedAt = new Date();
			resolved.revokedBy = source_bot_id;
			resolved.revokeReason = `Cross-sync revoke from ${source_bot_id}`;
			await em.flush();
			return { ok: true, sanctionId: resolved.id };
		}

		// Fallback: create a revocation record (unban/unmute) when no mirrored entry
		const revokeType =
			sanctionType === SanctionType.Ban
				? SanctionType.Unban
				: sanctionType === SanctionType.Mute
					? SanctionType.Unmute
					: sanctionType;

		const revokeSanction = new Sanction();
		revokeSanction.userId = s.userId;
		revokeSanction.guildId = source_guild_id;
		revokeSanction.type = revokeType;
		revokeSanction.reason = `Cross-sync revoke from ${source_bot_id}`;
		revokeSanction.issuedBy = source_bot_id;
		revokeSanction.issuedByType = SanctionIssuerType.System;
		revokeSanction.evidence = [
			{
				from: source_bot_id,
				source_guild: source_guild_id,
				original_id: s.id ?? null,
			},
		];

		await em.persist(revokeSanction).flush();
		return { ok: true, sanctionId: revokeSanction.id };
	}
}
