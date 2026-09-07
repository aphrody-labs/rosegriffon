import type { BaseMessageOptions, Client, TextChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

import { coreManagerConfig } from "@/configs";
import { Service } from "@/decorators";
import { Event, EventAnnouncement, Guild, Ranked } from "@/entities";
import { batchSend, createRankedQueueEmbed, resolveDependency } from "@/utils/functions";

import { logOnAchilleaRankedChannel } from "../utils/functions/messager";
import { Database } from "./Database";
import { Logger } from "./Logger";

@Service()
export class AnnouncementService {
	constructor(private db: Database) {}

	/**
	 * Send the “ranked queue open” message to every configured guild,
	 * batching N in parallel, and record each send in EventAnnouncement.
	 */
	async announceRankedQueue(client: Client, ranked: Ranked): Promise<void> {
		// 1) load all your Guild configs from the database
		const guilds = await this.db.em.find(Guild, {
			broadcastChannel: { $ne: null },
			rankedEnabled: true,
		});

		if (!guilds.length) {
			console.warn("No guilds configured for ranked announcements.");

			return;
		}

		const btnJoin = new ButtonBuilder()
			.setLabel("Join")
			.setStyle(ButtonStyle.Success)
			.setCustomId(`join_queue:${ranked.id}`);
		const btnLeave = new ButtonBuilder()
			.setLabel("Leave")
			.setStyle(ButtonStyle.Danger)
			.setCustomId(`leave_queue:${ranked.id}`);

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btnJoin, btnLeave) as any;

		const logger = await resolveDependency(Logger);

		const msg: BaseMessageOptions = {
			embeds: [createRankedQueueEmbed(ranked, 0)],
			components: [row],
		};

		const achilleaAnnouncement = await logOnAchilleaRankedChannel(logger, msg);
		const achilleaAnn = new EventAnnouncement();
		achilleaAnn.event = ranked;
		achilleaAnn.guildId = coreManagerConfig.coreGuildId;
		achilleaAnn.channelId = coreManagerConfig.rankedAnnouncementsChannelId;
		achilleaAnn.messageId = achilleaAnnouncement!.id;

		await this.db.em.persist(achilleaAnn).flush();

		// 2) batch‐size (tune as needed under Discord rate limits)
		const batchSize = 10;

		await batchSend(guilds, batchSize, async (guildEntity) => {
			// fetch the broadcast channel by its snowflake
			const channel = await client.channels
				.fetch(guildEntity.broadcastChannel!)
				.then((ch) => ch as TextChannel)
				.catch(() => null);
			if (!channel) return;

			// send the queue message with buttons
			const msg = await channel.send({
				embeds: [createRankedQueueEmbed(ranked, 0)],
				components: [row],
			});

			// 3) record this announcement for later edits/cleanup
			const ann = new EventAnnouncement();
			ann.event = ranked;
			ann.guildId = guildEntity.id;
			ann.channelId = channel.id;
			ann.messageId = msg.id;

			await this.db.em.persist(ann).flush();
		});

		console.info(`Announced Ranked#${ranked.id} to ${guilds.length} guilds.`);
	}

	async editEventAnnouncements(
		client: Client,
		event: Event,
		msgToSend: BaseMessageOptions
	): Promise<void> {
		// 1) fetch all announcements for this event
		const anns = await this.db.em.find(EventAnnouncement, { event });

		// 2) batch‐size under rate limits
		const batchSize = 10;

		await batchSend(anns, batchSize, async (ann) => {
			// fetch the channel
			const ch = await client.channels
				.fetch(ann.channelId)
				.then((c) => c as TextChannel)
				.catch(() => null);
			if (!ch) return;

			// fetch the message
			const msg = await ch.messages.fetch(ann.messageId).catch(() => null);
			if (!msg) return;

			// option A: remove all components entirely
			await msg.edit(msgToSend);
		});

		console.info(`Cleared buttons for event ${event.id} across all announcements.`);
	}
}
