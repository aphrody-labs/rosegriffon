import { ESCALATION_WINDOW_SEC, evaluateEscalation } from "@achillea/core";
import type { Job } from "bullmq";
import { Client } from "@aphrody/discordx";
import { singleton } from "tsyringe";

import { Sanction } from "@/entities";
import { sanctionsQueue } from "../queues/sanctions.queues";
import { CrossSyncService } from "@/services/CrossSyncService";
import { Database } from "@/services/Database";
import { MetricsService } from "@/services/MetricsService";
import { SanctionIssuerType, SanctionType } from "@/utils/enums";

export interface IssueOpts {
	userId: string;
	guildId: string;
	type: SanctionType;
	reason?: string | null;
	durationSec?: number | null;
	issuedBy: string;
	issuerType?: SanctionIssuerType;
	evidence?: Record<string, unknown>[] | null;
}

@singleton()
export class SanctionService {
	constructor(
		private db: Database,
		private client: Client,
		private crossSync: CrossSyncService,
		private metrics: MetricsService
	) {}

	/**
	 * Creates a sanction, persists it, and schedules TTL revocation via BullMQ
	 * if durationSec is provided.
	 */
	async issue(opts: IssueOpts): Promise<Sanction> {
		const em = this.db.em.fork();

		const sanction = new Sanction();
		sanction.userId = opts.userId;
		sanction.guildId = opts.guildId;
		sanction.type = opts.type;
		sanction.reason = opts.reason ?? null;
		sanction.durationSec = opts.durationSec ?? null;
		sanction.issuedBy = opts.issuedBy;
		sanction.issuedByType = opts.issuerType ?? SanctionIssuerType.Staff;
		sanction.evidence = opts.evidence ?? null;

		if (opts.durationSec) {
			sanction.expiresAt = new Date(Date.now() + opts.durationSec * 1000);
		}

		await em.persist(sanction).flush();

		if (opts.durationSec && sanction.id) {
			await sanctionsQueue.add(
				"revoke",
				{ sanctionId: sanction.id },
				{
					delay: opts.durationSec * 1000,
					jobId: `revoke_${sanction.id}`,
					removeOnComplete: true,
					removeOnFail: false,
				}
			);
		}

		// Cross-sync: fire-and-forget, never throw
		this.crossSync.pushSanction(sanction, "create").catch((err: unknown) => {
			const msg = err instanceof Error ? err.message : String(err);
			console.warn(`[SanctionService] cross-sync issue failed: ${msg}`);
		});

		this.metrics.increment("achillea_sanctions_issued_total", { type: opts.type });

		return sanction;
	}

	/**
	 * Revokes a sanction, sets revokedAt/revokedBy, and applies inverse Discord
	 * effect for mute (untimeout) and ban (unban). Tolerates DiscordAPIError if
	 * the member has already left or the ban was already removed.
	 */
	async revoke(sanctionId: string, revokedBy: string, revokeReason?: string): Promise<Sanction> {
		const em = this.db.em.fork();

		const sanction = await em.findOneOrFail(Sanction, { id: sanctionId });

		sanction.revokedAt = new Date();
		sanction.revokedBy = revokedBy;
		if (revokeReason) sanction.revokeReason = revokeReason;

		await em.flush();

		// Apply inverse Discord effect for active mute / ban
		if (sanction.type === SanctionType.Mute || sanction.type === SanctionType.Ban) {
			try {
				const guild = await this.client.guilds.fetch(sanction.guildId);

				if (sanction.type === SanctionType.Mute) {
					const member = await guild.members.fetch(sanction.userId);
					await member.timeout(null, `Sanction ${sanctionId} expirée / révoquée`);
				} else {
					// Ban
					await guild.bans.remove(sanction.userId, `Sanction ${sanctionId} expirée / révoquée`);
				}
			} catch (err: unknown) {
				// Tolerate DiscordAPIError (member left, ban already removed, etc.)
				const msg = err instanceof Error ? err.message : String(err);
				console.warn(`[SanctionService] revoke Discord effect skipped (${msg})`);
			}
		}

		// Cross-sync: fire-and-forget, never throw
		this.crossSync.pushSanction(sanction, "revoke").catch((err: unknown) => {
			const msg = err instanceof Error ? err.message : String(err);
			console.warn(`[SanctionService] cross-sync revoke failed: ${msg}`);
		});

		return sanction;
	}

	/**
	 * Returns active sanctions for a user in a guild:
	 * not revoked AND (no expiry OR expiry in the future).
	 */
	async listActive(userId: string, guildId: string): Promise<Sanction[]> {
		const em = this.db.em.fork();

		return em.find(Sanction, {
			userId,
			guildId,
			revokedAt: null,
			$or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
		});
	}

	/**
	 * Applies the Discord effect matching the sanction type.
	 * warn / note / unmute / unban are no-ops here (handled elsewhere).
	 */
	async applyDiscordEffect(sanction: Sanction): Promise<void> {
		if (
			sanction.type === SanctionType.Warn ||
			sanction.type === SanctionType.Note ||
			sanction.type === SanctionType.Unmute ||
			sanction.type === SanctionType.Unban
		) {
			return;
		}

		const guild = await this.client.guilds.fetch(sanction.guildId);

		switch (sanction.type) {
			case SanctionType.Mute: {
				const member = await guild.members.fetch(sanction.userId);
				const timeoutMs = sanction.durationSec ? sanction.durationSec * 1000 : 10 * 60 * 1000;
				await member.timeout(timeoutMs, sanction.reason ?? undefined);
				break;
			}

			case SanctionType.Kick: {
				const member = await guild.members.fetch(sanction.userId);
				await member.kick(sanction.reason ?? undefined);
				break;
			}

			case SanctionType.Ban: {
				await guild.bans.create(sanction.userId, {
					reason: sanction.reason ?? undefined,
				});
				break;
			}
		}
	}

	/**
	 * Auto-escalation rule evaluated after issuing a warn:
	 *   3 active warns in 30 days → mute 1h
	 *   5 active warns in 30 days → mute 24h
	 *   8 active warns in 30 days → ban 7 days
	 *
	 * Returns the escalation Sanction created, or null if no threshold reached.
	 */
	async escalate(userId: string, guildId: string, issuedBy: string): Promise<Sanction | null> {
		const em = this.db.em.fork();

		const since = new Date(Date.now() - ESCALATION_WINDOW_SEC * 1000);

		const activeWarns = await em.count(Sanction, {
			userId,
			guildId,
			type: SanctionType.Warn,
			revokedAt: null,
			createdAt: { $gte: since },
			$or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
		});

		// Décision d'escalade : règle pure déléguée à @achillea/core.
		const decision = evaluateEscalation(activeWarns);
		if (!decision) return null;

		const escalation = await this.issue({
			userId,
			guildId,
			type: decision.type,
			reason: `Escalade automatique après ${activeWarns} avertissements actifs`,
			durationSec: decision.durationSec,
			issuedBy,
			issuerType: SanctionIssuerType.Bot,
		});

		return escalation;
	}
}
