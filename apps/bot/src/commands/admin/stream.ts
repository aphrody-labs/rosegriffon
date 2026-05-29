import { Discord, Slash, SlashGroup, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";
import { logAdminAction } from "../../lib/audit.ts";
import { DAYS_FR, rgEmbed } from "../../lib/embeds.ts";
import { withRgAdmin } from "../../lib/rbac.ts";
import { addStream, deleteStream, listStreamsAdmin } from "../../services/admin.ts";

@Discord()
@SlashGroup({ name: "rg-stream-admin", description: "Gestion planning stream (admin)" })
@SlashGroup("rg-stream-admin")
export class AdminStreamCommand {
	@Slash({ name: "list", description: "Liste tous les créneaux du planning" })
	async list(interaction: ChatInputCommandInteraction) {
		await withRgAdmin(async (_admin, i) => {
			await i.deferReply();
			const rows = await listStreamsAdmin();
			if (rows.length === 0) {
				await i.editReply({ content: "Aucun stream programmé" });
				return;
			}
			const lines = rows
				.map((r) => {
					const time =
						r.start_time && r.end_time
							? `${r.start_time.slice(0, 5)} → ${r.end_time.slice(0, 5)}`
							: r.start_time
								? r.start_time.slice(0, 5)
								: "—";
					return `\`${r.id.slice(0, 8)}\` **${DAYS_FR[r.day_of_week]}** · ${time} · ${r.streamer_name}${r.category ? ` · *${r.category}*` : ""} · \`${r.status}\``;
				})
				.join("\n");
			await i.editReply({
				embeds: [rgEmbed().setTitle(`Planning stream — ${rows.length}`).setDescription(lines)],
			});
		})(interaction);
	}

	@Slash({ name: "add", description: "Ajoute un créneau de stream" })
	async add(
		@SlashOption({
			name: "day",
			description: "Jour (0=Dim, 1=Lun, …, 6=Sam)",
			type: ApplicationCommandOptionType.Integer,
			required: true,
			minValue: 0,
			maxValue: 6,
		})
		day: number,
		@SlashOption({
			name: "streamer",
			description: "Nom du streamer",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		streamer: string,
		@SlashOption({
			name: "start",
			description: "Heure début (HH:MM)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		start: string | undefined,
		@SlashOption({
			name: "end",
			description: "Heure fin (HH:MM)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		end: string | undefined,
		@SlashOption({
			name: "category",
			description: "Catégorie / jeu",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		category: string | undefined,
		@SlashOption({
			name: "notes",
			description: "Notes",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		notes: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(async (admin, i) => {
			await i.deferReply();
			try {
				const id = await addStream({
					day_of_week: day,
					streamer_name: streamer,
					start_time: start ?? null,
					end_time: end ?? null,
					category: category ?? null,
					notes: notes ?? null,
				});
				await logAdminAction({
					adminId: admin.profileId,
					discordId: admin.discordId,
					action: "stream.add",
					targetType: "stream_schedule",
					targetId: id,
					details: { day_of_week: day, streamer_name: streamer, category },
				});
				await i.editReply({
					content: `✓ Créneau \`${id.slice(0, 8)}\` ajouté — **${DAYS_FR[day]}** ${start ?? "—"} · ${streamer}`,
				});
			} catch (err) {
				await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
			}
		})(interaction);
	}

	@Slash({ name: "remove", description: "Supprime un créneau" })
	async remove(
		@SlashOption({
			name: "id",
			description: "UUID du créneau",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		id: string,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(
			async (admin, i) => {
				await i.deferReply();
				try {
					await deleteStream(id);
					await logAdminAction({
						adminId: admin.profileId,
						discordId: admin.discordId,
						action: "stream.remove",
						targetType: "stream_schedule",
						targetId: id,
					});
					await i.editReply({ content: `🗑 Créneau \`${id.slice(0, 8)}\` supprimé` });
				} catch (err) {
					await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
				}
			},
			{ strict: true }
		)(interaction);
	}
}
