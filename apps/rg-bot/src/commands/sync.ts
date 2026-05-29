import { Discord, Slash } from "@rpbey/discordx";
import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from "discord.js";

import { syncAllMembers } from "../services/syncMembers.ts";

@Discord()
export class SyncCommand {
	@Slash({
		name: "sync",
		description: "Force a full member sync to the database",
		defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
	})
	async run(interaction: ChatInputCommandInteraction) {
		if (!interaction.guild) {
			await interaction.reply({
				content: "❌ Guild-only command",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			const report = await syncAllMembers(interaction.guild);
			await interaction.editReply(
				`✓ Synced **${report.upserted}/${report.fetched}** members in ${report.durationMs}ms` +
					(report.errors.length ? ` — ${report.errors.length} error(s)` : "")
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await interaction.editReply(`❌ Sync failed: ${msg}`);
		}
	}
}
