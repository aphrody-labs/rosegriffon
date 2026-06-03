import { Discord, Slash } from "@rpbey/discordx";
import type { ChatInputCommandInteraction } from "discord.js";

import { rgEmbed } from "../../lib/embeds.js";
import { withRgAdmin } from "../../lib/rbac.js";
import { getAdminStats } from "../../services/admin.js";

@Discord()
export class AdminStatsCommand {
	@Slash({
		name: "rg-admin",
		description: "Dashboard admin Rose Griffon (counts, activité 24h)",
	})
	async run(interaction: ChatInputCommandInteraction) {
		await withRgAdmin(async (admin, i) => {
			await i.deferReply();
			const s = await getAdminStats();
			const embed = rgEmbed()
				.setTitle("📊 Dashboard administration")
				.setDescription(`Connecté en tant que **${admin.role}**`)
				.addFields(
					{
						name: "👥 Profils",
						value: `**${s.profiles_total}** (24h: +${s.profiles_24h})`,
						inline: true,
					},
					{ name: "🛡 Admins", value: `${s.admins}`, inline: true },
					{ name: "🚫 Bannis", value: `${s.banned}`, inline: true },
					{ name: "📰 Articles publiés", value: `${s.articles_published}`, inline: true },
					{ name: "📝 Brouillons", value: `${s.articles_draft}`, inline: true },
					{
						name: "📅 Events à venir / passés",
						value: `${s.events_upcoming} / ${s.events_past}`,
						inline: true,
					},
					{ name: "🎭 Membres équipe", value: `${s.team_members}`, inline: true },
					{ name: "💬 Discord membres", value: `${s.discord_members}`, inline: true }
				);
			await i.editReply({ embeds: [embed] });
		})(interaction);
	}
}
