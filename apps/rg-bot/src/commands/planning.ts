import { Discord, Slash, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";

import { DAYS_FR, rgEmbed, rgUrl } from "../lib/embeds.js";
import { getPlanning } from "../services/website.js";

@Discord()
export class PlanningCommand {
	@Slash({ name: "planning", description: "Planning de streams Rose Griffon TV" })
	async run(
		@SlashOption({
			name: "day",
			description: "Jour (0=Dimanche, 1=Lundi, …, 6=Samedi)",
			type: ApplicationCommandOptionType.Integer,
			required: false,
			minValue: 0,
			maxValue: 6,
		})
		day: number | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const rows = await getPlanning(day ?? null);
			if (rows.length === 0) {
				await interaction.editReply({ content: "Aucun stream programmé" });
				return;
			}

			const grouped: Record<number, typeof rows> = {};
			for (const row of rows) {
				const bucket = grouped[row.day_of_week] ?? [];
				bucket.push(row);
				grouped[row.day_of_week] = bucket;
			}

			const sections = Object.keys(grouped)
				.map(Number)
				.toSorted((a, b) => a - b)
				.map((d) => {
					const lines = grouped[d]!.map((r) => {
						const time =
							r.start_time && r.end_time
								? `${r.start_time.slice(0, 5)} → ${r.end_time.slice(0, 5)}`
								: r.start_time
									? r.start_time.slice(0, 5)
									: "—";
						return `• **${r.streamer_name}** · ${time}${r.category ? ` · *${r.category}*` : ""}`;
					});
					return `__**${DAYS_FR[d]}**__\n${lines.join("\n")}`;
				});

			const embed = rgEmbed()
				.setTitle(day !== undefined ? `Planning — ${DAYS_FR[day]}` : "Planning hebdomadaire")
				.setURL(rgUrl("/rose-griffon-tv"))
				.setDescription(sections.join("\n\n"));

			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({
				content: `❌ Erreur: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}
}
