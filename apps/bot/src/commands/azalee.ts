import { Discord, Slash, SlashGroup, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";

import { fmtDate, rgEmbed, truncate } from "../lib/embeds.ts";
import { azaleeLatest } from "../services/website.ts";

const AZALEE_BASE = "https://azalee.rosegriffon.fr";

@Discord()
@SlashGroup({ name: "azalee", description: "Articles Azalée (azalee.rosegriffon.fr)" })
@SlashGroup("azalee")
export class AzaleeCommand {
	@Slash({ name: "latest", description: "Derniers articles publiés sur Azalée" })
	async latest(
		@SlashOption({
			name: "limit",
			description: "Nombre d'articles (1-10)",
			type: ApplicationCommandOptionType.Integer,
			required: false,
			minValue: 1,
			maxValue: 10,
		})
		limit: number | undefined,
		@SlashOption({
			name: "category",
			description: "Filtrer par catégorie",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		category: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const rows = await azaleeLatest(limit ?? 5, category);
			if (rows.length === 0) {
				await interaction.editReply({ content: "Aucun article trouvé" });
				return;
			}
			const embed = rgEmbed()
				.setTitle(`Azalée — ${rows.length} article${rows.length > 1 ? "s" : ""}`)
				.setURL(AZALEE_BASE)
				.setDescription(
					rows
						.map(
							(a) =>
								`**[${a.title}](${AZALEE_BASE}/news/${a.slug})**${a.category ? ` · *${a.category}*` : ""} — ${fmtDate(
									a.published_at
								)}\n${truncate(a.excerpt, 180)}`
						)
						.join("\n\n")
				);
			if (rows[0]?.featured_image_url) embed.setThumbnail(rows[0].featured_image_url);
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({
				content: `❌ Erreur: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}
}
