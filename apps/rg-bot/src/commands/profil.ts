import { Discord, Slash, SlashOption } from "@rpbey/discordx";
import {
	ApplicationCommandOptionType,
	AttachmentBuilder,
	type ChatInputCommandInteraction,
} from "discord.js";

import { renderProfileCard } from "../lib/canvas/cards.js";
import { getProfile } from "../services/website.js";

@Discord()
export class ProfilCommand {
	@Slash({ name: "profil", description: "Affiche un profil RG par username ou Discord ID" })
	async run(
		@SlashOption({
			name: "query",
			description: "username, discord_id ou uuid",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		query: string,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const profile = await getProfile(query);
			if (!profile) {
				await interaction.editReply({ content: `Aucun profil trouvé pour « ${query} »` });
				return;
			}
			const png = await renderProfileCard(profile);
			const file = new AttachmentBuilder(png, { name: "rg-profil.png" });
			await interaction.editReply({ files: [file] });
		} catch (err) {
			await interaction.editReply({
				content: `❌ Erreur: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}
}
