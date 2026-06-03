import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";
import { logAdminAction } from "../../lib/audit";
import { fmtDate, rgEmbed, rgUrl, truncate } from "../../lib/embeds";
import { withRgAdmin } from "../../lib/rbac";
import { deleteArticle, listArticlesAdmin, setArticleStatus } from "../../services/admin";

@Discord()
@SlashGroup({ name: "rg-chronique-admin", description: "Gestion chroniques/articles (admin)" })
@SlashGroup("rg-chronique-admin")
export class AdminArticleCommand {
	@Slash({ name: "list", description: "Liste articles (filtre par status)" })
	async list(
		@SlashChoice(
			{ name: "published", value: "published" },
			{ name: "draft", value: "draft" },
			{ name: "archived", value: "archived" }
		)
		@SlashOption({
			name: "status",
			description: "Filtrer par status",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		status: string | undefined,
		@SlashOption({
			name: "limit",
			description: "Nombre max (1-25)",
			type: ApplicationCommandOptionType.Integer,
			required: false,
			minValue: 1,
			maxValue: 25,
		})
		limit: number | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(async (_admin, i) => {
			await i.deferReply();
			const rows = await listArticlesAdmin(status ?? null, limit ?? 10);
			if (rows.length === 0) {
				await i.editReply({ content: "Aucun article trouvé" });
				return;
			}
			const lines = rows
				.map((a) => {
					const url =
						a.app === "azalee"
							? `https://azalee.rosegriffon.fr/news/${a.slug}`
							: rgUrl(`/chroniques/${a.slug}`);
					const badge = a.status === "published" ? "🟢" : a.status === "draft" ? "📝" : "📦";
					return `${badge} \`${a.id.slice(0, 8)}\` **[${truncate(a.title, 50)}](${url})** — *${a.app}/${a.category ?? "—"}* — ${fmtDate(a.updated_at)}`;
				})
				.join("\n");
			const embed = rgEmbed()
				.setTitle(`Articles${status ? ` (${status})` : ""} — ${rows.length}`)
				.setDescription(lines);
			await i.editReply({ embeds: [embed] });
		})(interaction);
	}

	@Slash({ name: "publish", description: "Publie un article (status='published')" })
	async publish(
		@SlashOption({
			name: "id",
			description: "UUID de l'article",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		id: string,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(async (admin, i) => {
			await i.deferReply();
			try {
				await setArticleStatus(id, "published");
				await logAdminAction({
					adminId: admin.profileId,
					discordId: admin.discordId,
					action: "article.publish",
					targetType: "article",
					targetId: id,
				});
				await i.editReply({ content: `✓ Article \`${id.slice(0, 8)}\` publié` });
			} catch (err) {
				await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
			}
		})(interaction);
	}

	@Slash({ name: "unpublish", description: "Repasse un article en draft" })
	async unpublish(
		@SlashOption({
			name: "id",
			description: "UUID de l'article",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		id: string,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(async (admin, i) => {
			await i.deferReply();
			try {
				await setArticleStatus(id, "draft");
				await logAdminAction({
					adminId: admin.profileId,
					discordId: admin.discordId,
					action: "article.unpublish",
					targetType: "article",
					targetId: id,
				});
				await i.editReply({ content: `✓ Article \`${id.slice(0, 8)}\` repassé en draft` });
			} catch (err) {
				await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
			}
		})(interaction);
	}

	@Slash({ name: "archive", description: "Archive un article (status='archived')" })
	async archive(
		@SlashOption({
			name: "id",
			description: "UUID de l'article",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		id: string,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(async (admin, i) => {
			await i.deferReply();
			try {
				await setArticleStatus(id, "archived");
				await logAdminAction({
					adminId: admin.profileId,
					discordId: admin.discordId,
					action: "article.archive",
					targetType: "article",
					targetId: id,
				});
				await i.editReply({ content: `📦 Article \`${id.slice(0, 8)}\` archivé` });
			} catch (err) {
				await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
			}
		})(interaction);
	}

	@Slash({ name: "delete", description: "SUPPRIME un article (admin strict, hard delete)" })
	async delete(
		@SlashOption({
			name: "id",
			description: "UUID de l'article",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		id: string,
		@SlashOption({
			name: "confirm",
			description: "Tape 'oui' pour confirmer la suppression définitive",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		confirm: string,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(
			async (admin, i) => {
				await i.deferReply();
				if (confirm.toLowerCase() !== "oui") {
					await i.editReply({ content: "Suppression annulée — il faut confirmer avec « oui »." });
					return;
				}
				try {
					await deleteArticle(id);
					await logAdminAction({
						adminId: admin.profileId,
						discordId: admin.discordId,
						action: "article.delete",
						targetType: "article",
						targetId: id,
					});
					await i.editReply({ content: `🗑 Article \`${id.slice(0, 8)}\` supprimé définitivement` });
				} catch (err) {
					await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
				}
			},
			{ strict: true }
		)(interaction);
	}
}
