import { Discord, Slash, SlashOption } from "@rpbey/discordx";
import {
	ApplicationCommandOptionType,
	AttachmentBuilder,
	type ChatInputCommandInteraction,
} from "discord.js";

import { renderEventList } from "../lib/canvas/cards.js";
import { nextEvents } from "../services/website.js";

@Discord()
export class EventCommand {
	@Slash({ name: "event", description: "Prochains événements RG" })
	async run(
		@SlashOption({
			name: "count",
			description: "Nombre d'événements (1-10)",
			type: ApplicationCommandOptionType.Integer,
			required: false,
			minValue: 1,
			maxValue: 10,
		})
		count: number | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const rows = await nextEvents(count ?? 5);
			if (rows.length === 0) {
				await interaction.editReply({ content: "Aucun événement à venir" });
				return;
			}
			const png = await renderEventList(rows);
			const file = new AttachmentBuilder(png, { name: "rg-events.png" });
			await interaction.editReply({ files: [file] });
		} catch (err) {
			await interaction.editReply({
				content: `❌ Erreur: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}
}
