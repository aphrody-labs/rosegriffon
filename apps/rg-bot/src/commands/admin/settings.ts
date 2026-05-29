import { Discord, Slash, SlashGroup, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";
import { logAdminAction } from "../../lib/audit.ts";
import { rgEmbed, truncate } from "../../lib/embeds.ts";
import { withRgAdmin } from "../../lib/rbac.ts";
import { getSettingDetail, listSettings, setSetting } from "../../services/admin.ts";

function fmtValue(v: unknown): string {
	if (v === null || v === undefined) return "null";
	if (typeof v === "string") return v;
	return JSON.stringify(v, null, 2);
}

@Discord()
@SlashGroup({ name: "rg-settings", description: "Settings k/v du website (admin)" })
@SlashGroup("rg-settings")
export class AdminSettingsCommand {
	@Slash({ name: "list", description: "Liste toutes les clés de settings" })
	async list(interaction: ChatInputCommandInteraction) {
		await withRgAdmin(async (_admin, i) => {
			await i.deferReply();
			const rows = await listSettings();
			if (rows.length === 0) {
				await i.editReply({ content: "Aucun setting" });
				return;
			}
			const lines = rows
				.map((s) => `\`${s.key}\` — ${truncate(s.description ?? fmtValue(s.value), 100)}`)
				.join("\n");
			await i.editReply({
				embeds: [rgEmbed().setTitle(`Settings — ${rows.length}`).setDescription(lines)],
			});
		})(interaction);
	}

	@Slash({ name: "get", description: "Affiche la valeur d'une clé" })
	async get(
		@SlashOption({
			name: "key",
			description: "Clé du setting",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		key: string,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(async (_admin, i) => {
			await i.deferReply();
			const row = await getSettingDetail(key);
			if (!row) {
				await i.editReply({ content: `Clé \`${key}\` introuvable` });
				return;
			}
			const value = fmtValue(row.value);
			const embed = rgEmbed()
				.setTitle(`⚙ ${row.key}`)
				.setDescription(row.description ?? "—")
				.addFields({
					name: "Valeur",
					value: `\`\`\`json\n${truncate(value, 1000)}\n\`\`\``,
				});
			await i.editReply({ embeds: [embed] });
		})(interaction);
	}

	@Slash({ name: "set", description: "Change la valeur d'une clé (admin strict)" })
	async set(
		@SlashOption({
			name: "key",
			description: "Clé",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		key: string,
		@SlashOption({
			name: "value",
			description: "Valeur (string brut ou JSON)",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		value: string,
		@SlashOption({
			name: "description",
			description: "Description (optionnel)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		description: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(
			async (admin, i) => {
				await i.deferReply();
				let parsed: unknown = value;
				try {
					parsed = JSON.parse(value);
				} catch {
					/* not JSON, store as string */
				}
				try {
					const before = await getSettingDetail(key);
					await setSetting(key, parsed, description);
					await logAdminAction({
						adminId: admin.profileId,
						discordId: admin.discordId,
						action: "settings.set",
						targetType: "settings",
						targetId: key,
						details: { before: before?.value, after: parsed },
					});
					await i.editReply({ content: `✓ \`${key}\` = \`${truncate(fmtValue(parsed), 200)}\`` });
				} catch (err) {
					await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
				}
			},
			{ strict: true }
		)(interaction);
	}
}
