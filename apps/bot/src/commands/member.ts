import { Discord, Slash, SlashOption } from "@rpbey/discordx";
import {
	ApplicationCommandOptionType,
	AttachmentBuilder,
	type ChatInputCommandInteraction,
} from "discord.js";

import { renderMemberList } from "../lib/canvas/cards.ts";
import { findMember } from "../services/website.ts";

@Discord()
export class MemberCommand {
	@Slash({ name: "member", description: "Recherche un membre Discord (DB rosegriffon.fr)" })
	async run(
		@SlashOption({
			name: "query",
			description: "Username, display_name ou Discord ID",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		query: string,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const rows = await findMember(query);
			if (rows.length === 0) {
				await interaction.editReply({ content: `Aucun membre trouvé pour « ${query} »` });
				return;
			}
			const png = await renderMemberList(
				rows.map((m) => ({
					username: m.username,
					display_name: m.display_name,
					avatar_url: m.avatar_url,
					roles_count: m.roles?.length ?? 0,
					joined_at: m.joined_at,
				}))
			);
			const file = new AttachmentBuilder(png, { name: "rg-members.png" });
			await interaction.editReply({ files: [file] });
		} catch (err) {
			await interaction.editReply({
				content: `❌ Erreur: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}
}
