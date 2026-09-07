import { EmbedBuilder } from "discord.js";
import { delay, inject } from "tsyringe";

import { Service } from "@/decorators";
import { AuditLog, Guild } from "@/entities";

import { Database } from "./Database";
import { Logger } from "./Logger";

export interface AuditLogParams {
	actor_id?: string | null;
	action: string;
	target_type: string;
	target_id?: string | null;
	payload?: Record<string, unknown> | null;
	reason?: string | null;
	ip?: string | null;
	guild_id?: string | null;
}

export interface AuditVerifyResult {
	valid: boolean;
	broken_at: string | null;
}

@Service()
export class AuditLogService {
	constructor(
		@inject(delay(() => Database)) private db: any,
		@inject(delay(() => Logger)) private logger: any
	) {}

	/**
	 * Compute SHA256 signature for a log entry.
	 * Chain: sha256(prevSignature + JSON.stringify({actor_id,action,target_type,target_id,payload,ts}))
	 */
	private computeSignature(
		prevSignature: string | null,
		entry: {
			actor_id: string | null;
			action: string;
			target_type: string;
			target_id: string | null;
			payload: Record<string, unknown> | null;
			ts: Date;
		}
	): string {
		const hasher = new Bun.CryptoHasher("sha256");
		const content =
			(prevSignature ?? "") +
			JSON.stringify({
				actor_id: entry.actor_id,
				action: entry.action,
				target_type: entry.target_type,
				target_id: entry.target_id,
				payload: entry.payload,
				ts: entry.ts.toISOString(),
			});
		hasher.update(content);
		return hasher.digest("hex");
	}

	/**
	 * Insert a new audit log entry with chained SHA256 signature.
	 */
	async log(params: AuditLogParams): Promise<AuditLog> {
		const em = this.db.em.fork();

		// Fetch last entry to get the chain head
		const last = await em.findOne(AuditLog, {}, { orderBy: { ts: "DESC" } });

		const ts = new Date();
		const actor_id = params.actor_id ?? null;
		const target_id = params.target_id ?? null;
		const payload = params.payload ?? null;

		const signature = this.computeSignature(last?.signature ?? null, {
			actor_id,
			action: params.action,
			target_type: params.target_type,
			target_id,
			payload,
			ts,
		});

		const record = em.create(AuditLog, {
			actorId: actor_id,
			action: params.action,
			targetType: params.target_type,
			targetId: target_id,
			payload,
			reason: params.reason ?? null,
			ip: params.ip ?? null,
			ts,
			prevSignature: last?.signature ?? null,
			signature,
		});

		await em.persist(record).flush();

		// Mirror to Discord channel if configured
		if (params.guild_id) {
			await this.mirrorToDiscord(record, params.guild_id);
		}

		return record;
	}

	/**
	 * Verify the entire chain by recomputing each signature.
	 * Returns { valid: true } if chain is intact, or { valid: false, broken_at: id } at first break.
	 */
	async verify(): Promise<AuditVerifyResult> {
		const em = this.db.em.fork();
		const entries = await em.findAll(AuditLog, { orderBy: { ts: "ASC" } });

		let prev: string | null = null;

		for (const entry of entries) {
			const expected = this.computeSignature(prev, {
				actor_id: entry.actorId,
				action: entry.action,
				target_type: entry.targetType,
				target_id: entry.targetId,
				payload: entry.payload,
				ts: entry.ts,
			});

			if (expected !== entry.signature) {
				return { valid: false, broken_at: entry.id };
			}

			prev = entry.signature;
		}

		return { valid: true, broken_at: null };
	}

	/**
	 * Post a summary embed to a guild's audit log channel.
	 */
	private async mirrorToDiscord(record: AuditLog, guildId: string): Promise<void> {
		try {
			const em = this.db.em.fork();
			const guild = await em.findOne(Guild, { id: guildId });
			if (!guild?.auditLogChannelId) return;

			const embed = new EmbedBuilder()
				.setTitle("Audit Log")
				.setColor(0x5865f2)
				.addFields(
					{ name: "Action", value: record.action, inline: true },
					{
						name: "Target",
						value: `${record.targetType}${record.targetId ? ` (${record.targetId})` : ""}`,
						inline: true,
					},
					{ name: "Actor", value: record.actorId ? `<@${record.actorId}>` : "System", inline: true }
				)
				.setTimestamp(record.ts)
				.setFooter({ text: `sig: ${record.signature.slice(0, 12)}…` });

			if (record.reason) embed.addFields({ name: "Reason", value: record.reason });

			await this.logger.discordChannel(guild.auditLogChannelId, { embeds: [embed] }, "info");
		} catch {
			// Mirror is best-effort — never block the main log
		}
	}
}
