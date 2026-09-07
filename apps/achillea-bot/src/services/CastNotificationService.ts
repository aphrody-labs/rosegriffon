import { EmbedBuilder } from "discord.js";
import { Client } from "@aphrody/discordx";
import { singleton } from "tsyringe";

import { CastAttribution, CastEvent, CastSlot } from "@/entities";

import { Database } from "./Database";

export interface NotifyResult {
	sent: number;
	failed: number;
}

/** Fenêtre ±30 min autour de J-2 (48h) */
const J2_WINDOW_MS = 30 * 60 * 1000;
/** Fenêtre ±15 min autour de H-2 (2h) */
const H2_WINDOW_MS = 15 * 60 * 1000;
/** Target J-2 : 48h avant l'event */
const J2_OFFSET_MS = 48 * 60 * 60 * 1000;
/** Target H-2 : 2h avant l'event */
const H2_OFFSET_MS = 2 * 60 * 60 * 1000;

// CastNotificationService — T-2.4

/**
 * Envoie les rappels de cast par DM Discord (J-2 et H-2) + ping channel staff.
 *
 * Idempotence : les flags `notifiedJ2` / `notifiedH2` sur CastAttribution
 * empêchent le re-DM en cas de restart du bot.
 *
 * Tolère `DiscordAPIError 50007` (DM fermés) : log warn + continue.
 */
@singleton()
export class CastNotificationService {
	constructor(private db: Database) {}

	// notifyJ2

	/**
	 * Envoie les DM J-2 à tous les casters confirmés dont notifiedJ2 = false.
	 * Met à jour notifiedJ2 = true et envoie un récap sur le channel staff.
	 */
	async notifyJ2(event: CastEvent, client: Client): Promise<NotifyResult> {
		const em = this.db.em.fork();

		const attributions = await em.find(
			CastAttribution,
			{
				slot: { event: { id: event.id } },
				confirmedAt: { $ne: null },
				notifiedJ2: false,
				userId: { $ne: null },
			},
			{ populate: ["slot", "slot.event"] }
		);

		let sent = 0;
		let failed = 0;
		const notifiedUsers: string[] = [];

		for (const attribution of attributions) {
			const userId = attribution.userId!;
			try {
				const user = await client.users.fetch(userId);
				const embed = this._buildJ2Embed(event, attribution.slot);
				await user.send({ embeds: [embed] });
				attribution.notifiedJ2 = true;
				notifiedUsers.push(`<@${userId}>`);
				sent++;
			} catch (err: any) {
				// 50007 = Cannot send messages to this user (DM fermés)
				if (err?.code === 50007) {
					console.warn(
						`[CastNotificationService] J-2 DM bloqué pour userId=${userId} (50007) — event=${event.id}`
					);
					// On marque quand même notifiedJ2 pour éviter de respammer à chaque cron
					attribution.notifiedJ2 = true;
				} else {
					console.error(
						`[CastNotificationService] J-2 DM échoué pour userId=${userId} — event=${event.id}`,
						err
					);
					failed++;
					continue;
				}
			}
		}

		if (attributions.length > 0) {
			await em.flush();
			await this._pingStaffChannel(client, event, "J-2", notifiedUsers, sent, failed);
		}

		return { sent, failed };
	}

	// notifyH2

	/**
	 * Envoie les DM H-2 à tous les casters confirmés dont notifiedH2 = false.
	 * Template plus urgent que J-2.
	 */
	async notifyH2(event: CastEvent, client: Client): Promise<NotifyResult> {
		const em = this.db.em.fork();

		const attributions = await em.find(
			CastAttribution,
			{
				slot: { event: { id: event.id } },
				confirmedAt: { $ne: null },
				notifiedH2: false,
				userId: { $ne: null },
			},
			{ populate: ["slot", "slot.event"] }
		);

		let sent = 0;
		let failed = 0;
		const notifiedUsers: string[] = [];

		for (const attribution of attributions) {
			const userId = attribution.userId!;
			try {
				const user = await client.users.fetch(userId);
				const embed = this._buildH2Embed(event, attribution.slot);
				await user.send({ embeds: [embed] });
				attribution.notifiedH2 = true;
				notifiedUsers.push(`<@${userId}>`);
				sent++;
			} catch (err: any) {
				if (err?.code === 50007) {
					console.warn(
						`[CastNotificationService] H-2 DM bloqué pour userId=${userId} (50007) — event=${event.id}`
					);
					attribution.notifiedH2 = true;
				} else {
					console.error(
						`[CastNotificationService] H-2 DM échoué pour userId=${userId} — event=${event.id}`,
						err
					);
					failed++;
					continue;
				}
			}
		}

		if (attributions.length > 0) {
			await em.flush();
			await this._pingStaffChannel(client, event, "H-2", notifiedUsers, sent, failed);
		}

		return { sent, failed };
	}

	// dispatchUpcoming

	/**
	 * Appelé par le cron toutes les 15 min.
	 *
	 * Charge les events dont scheduledAt est dans la fenêtre J-2 ±30 min
	 * ET qui ont au moins une attribution confirmedAt != null avec notifiedJ2 = false.
	 * Idem pour H-2 ±15 min.
	 */
	async dispatchUpcoming(client: Client): Promise<void> {
		const now = new Date();

		// Fenêtre J-2 : [now+48h-30min, now+48h+30min]
		const j2Target = new Date(now.getTime() + J2_OFFSET_MS);
		const j2Low = new Date(j2Target.getTime() - J2_WINDOW_MS);
		const j2High = new Date(j2Target.getTime() + J2_WINDOW_MS);

		// Fenêtre H-2 : [now+2h-15min, now+2h+15min]
		const h2Target = new Date(now.getTime() + H2_OFFSET_MS);
		const h2Low = new Date(h2Target.getTime() - H2_WINDOW_MS);
		const h2High = new Date(h2Target.getTime() + H2_WINDOW_MS);

		const em = this.db.em.fork();

		// Events J-2 : scheduledAt dans la fenêtre ET au moins 1 attribution notifiedJ2=false+confirmed
		const j2Events = await em.getConnection().execute<Array<{ id: string }>>(
			`
      SELECT DISTINCT ce.id
      FROM cast_event ce
      JOIN cast_slot cs ON cs.event_id = ce.id
      JOIN cast_attribution ca ON ca.slot_id = cs.id
      WHERE ce.scheduled_at >= $1
        AND ce.scheduled_at <= $2
        AND ce.status NOT IN ('done', 'cancelled')
        AND ca.confirmed_at IS NOT NULL
        AND ca.notified_j2 = FALSE
        AND ca.user_id IS NOT NULL
      `,
			[j2Low.toISOString(), j2High.toISOString()]
		);

		for (const { id } of j2Events) {
			try {
				const event = await em.findOneOrFail(CastEvent, { id });
				const { sent, failed } = await this.notifyJ2(event, client);
				console.info(`[CastNotificationService] J-2 event=${id} — sent=${sent}, failed=${failed}`);
			} catch (err) {
				console.error(`[CastNotificationService] dispatchUpcoming J-2 event=${id} error:`, err);
			}
		}

		// Events H-2 : scheduledAt dans la fenêtre ET au moins 1 attribution notifiedH2=false+confirmed
		const h2Events = await em.getConnection().execute<Array<{ id: string }>>(
			`
      SELECT DISTINCT ce.id
      FROM cast_event ce
      JOIN cast_slot cs ON cs.event_id = ce.id
      JOIN cast_attribution ca ON ca.slot_id = cs.id
      WHERE ce.scheduled_at >= $1
        AND ce.scheduled_at <= $2
        AND ce.status NOT IN ('done', 'cancelled')
        AND ca.confirmed_at IS NOT NULL
        AND ca.notified_h2 = FALSE
        AND ca.user_id IS NOT NULL
      `,
			[h2Low.toISOString(), h2High.toISOString()]
		);

		for (const { id } of h2Events) {
			try {
				const event = await em.findOneOrFail(CastEvent, { id });
				const { sent, failed } = await this.notifyH2(event, client);
				console.info(`[CastNotificationService] H-2 event=${id} — sent=${sent}, failed=${failed}`);
			} catch (err) {
				console.error(`[CastNotificationService] dispatchUpcoming H-2 event=${id} error:`, err);
			}
		}
	}

	// Private helpers

	private _buildJ2Embed(event: CastEvent, slot: CastSlot): EmbedBuilder {
		const scheduledAtTs = Math.floor(event.scheduledAt.getTime() / 1000);
		return new EmbedBuilder()
			.setTitle("Rappel de cast — J-2")
			.setColor(0x5865f2)
			.setDescription(`Tu as un cast dans **2 jours** ! Voici les informations :`)
			.addFields(
				{ name: "Evenement", value: `${event.name} (${event.kind})`, inline: true },
				{ name: "Role", value: slot.role, inline: true },
				{ name: "Date", value: `<t:${scheduledAtTs}:F>`, inline: false },
				...(event.twitchUrl ? [{ name: "Twitch", value: event.twitchUrl, inline: false }] : [])
			)
			.setFooter({ text: "Achillea Cast — rappel J-2" })
			.setTimestamp();
	}

	private _buildH2Embed(event: CastEvent, slot: CastSlot): EmbedBuilder {
		const scheduledAtTs = Math.floor(event.scheduledAt.getTime() / 1000);
		return new EmbedBuilder()
			.setTitle("Rappel de cast — H-2 (dans 2h !)")
			.setColor(0xed4245)
			.setDescription(`Tu cast dans **2 heures** ! Verifie que tout est pret.`)
			.addFields(
				{ name: "Evenement", value: `${event.name} (${event.kind})`, inline: true },
				{ name: "Role", value: slot.role, inline: true },
				{ name: "Heure", value: `<t:${scheduledAtTs}:t>`, inline: false },
				...(event.twitchUrl ? [{ name: "Twitch", value: event.twitchUrl, inline: false }] : [])
			)
			.setFooter({ text: "Achillea Cast — rappel H-2" })
			.setTimestamp();
	}

	private async _pingStaffChannel(
		client: Client,
		event: CastEvent,
		label: "J-2" | "H-2",
		mentionedUsers: string[],
		sent: number,
		failed: number
	): Promise<void> {
		const channelId = process.env.ACHILLEA_STAFF_CHANNEL_ID;
		if (!channelId) {
			console.warn(
				`[CastNotificationService] ACHILLEA_STAFF_CHANNEL_ID non defini — ping staff skipped (event=${event.id}, label=${label})`
			);
			return;
		}

		try {
			const channel = await client.channels.fetch(channelId);
			if (!channel || !channel.isTextBased() || !("send" in channel)) {
				console.warn(
					`[CastNotificationService] Channel staff ${channelId} introuvable ou non textuel`
				);
				return;
			}

			const userList = mentionedUsers.length > 0 ? mentionedUsers.join(", ") : "_aucun_";

			await channel.send({
				content: [
					`**[Cast ${label}]** Rappels envoyés pour **${event.name}**`,
					`Casters notifiés : ${userList}`,
					`Bilan : ${sent} envoyé(s), ${failed} echec(s)`,
				].join("\n"),
			});
		} catch (err) {
			console.error(
				`[CastNotificationService] Echec ping staff channel (event=${event.id}, label=${label}):`,
				err
			);
		}
	}
}
