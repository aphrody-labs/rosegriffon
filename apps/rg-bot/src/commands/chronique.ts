import { Discord, Slash, SlashGroup, SlashOption } from "@rpbey/discordx";
import {
	ApplicationCommandOptionType,
	AttachmentBuilder,
	type ChatInputCommandInteraction,
} from "discord.js";

import { renderChroniqueList } from "../lib/canvas/cards.ts";
import { fmtDate, rgEmbed, rgUrl, truncate } from "../lib/embeds.ts";
import { listChronicles, readChronicle } from "../services/website.ts";

@Discord()
@SlashGroup({ name: "chronique", description: "Chroniques Rose Griffon" })
@SlashGroup("chronique")
export class ChroniqueCommand {
	@Slash({ name: "list", description: "Liste les dernières chroniques" })
	async list(
		@SlashOption({
			name: "category",
			description: "Filtrer par catégorie",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		category: string | undefined,
		@SlashOption({
			name: "limit",
			description: "Nombre de chroniques (1-6)",
			type: ApplicationCommandOptionType.Integer,
			required: false,
			minValue: 1,
			maxValue: 6,
		})
		limit: number | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const rows = await listChronicles(category ?? null, limit ?? 4);
			if (rows.length === 0) {
				await interaction.editReply({ content: "Aucune chronique trouvée" });
				return;
			}
			const png = await renderChroniqueList(rows, category ? `Catégorie : ${category}` : undefined);
			const file = new AttachmentBuilder(png, { name: "rg-chroniques.png" });
			await interaction.editReply({ files: [file] });
		} catch (err) {
			await interaction.editReply({
				content: `❌ Erreur: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}

	@Slash({ name: "read", description: "Affiche une chronique par slug" })
	async read(
		@SlashOption({
			name: "slug",
			description: "Slug de la chronique (depuis l'URL)",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		slug: string,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const c = await readChronicle(slug);
			if (!c) {
				await interaction.editReply({ content: `Aucune chronique trouvée pour « ${slug} »` });
				return;
			}
			const embed = rgEmbed()
				.setTitle(c.title)
				.setURL(rgUrl(`/chroniques/${c.slug}`))
				.setDescription(truncate(c.excerpt ?? c.content?.replace(/<[^>]+>/g, ""), 1500))
				.addFields(
					{ name: "Catégorie", value: c.category, inline: true },
					{ name: "Vues", value: String(c.views_count ?? 0), inline: true },
					{ name: "Publié", value: fmtDate(c.created_at), inline: true }
				);
			if (c.featured_image) embed.setImage(c.featured_image);
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({
				content: `❌ Erreur: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}
}
