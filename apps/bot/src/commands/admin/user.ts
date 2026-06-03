import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "@rpbey/discordx";
import {
	ApplicationCommandOptionType,
	type ChatInputCommandInteraction,
	type User,
} from "discord.js";
import { logAdminAction } from "../../lib/audit";
import { rgEmbed, truncate } from "../../lib/embeds";
import { type RgAdmin, withRgAdmin } from "../../lib/rbac";
import { getUserByDiscord, getUserById, listUsers, setUserRole } from "../../services/admin";

const VALID_ROLES = ["user", "premium", "moderator", "staff", "admin", "banned"] as const;

@Discord()
@SlashGroup({ name: "rg-user", description: "Gestion des utilisateurs RG (admin)" })
@SlashGroup("rg-user")
export class AdminUserCommand {
	@Slash({ name: "list", description: "Liste les utilisateurs (search + filter rôle)" })
	async list(
		@SlashOption({
			name: "query",
			description: "Recherche username/email/full_name/discord_id",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		query: string | undefined,
		@SlashChoice(...VALID_ROLES.map((r) => ({ name: r, value: r })))
		@SlashOption({
			name: "role",
			description: "Filtrer par rôle",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		role: string | undefined,
		@SlashOption({
			name: "limit",
			description: "Nombre max (1-50, default 20)",
			type: ApplicationCommandOptionType.Integer,
			required: false,
			minValue: 1,
			maxValue: 50,
		})
		limit: number | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(async (_admin, i) => {
			await i.deferReply();
			const rows = await listUsers(query ?? null, role ?? null, limit ?? 20);
			if (rows.length === 0) {
				await i.editReply({ content: "Aucun utilisateur trouvé" });
				return;
			}
			const lines = rows
				.slice(0, 25)
				.map((u) => {
					const name = u.full_name ?? u.username ?? u.email ?? "—";
					const tag = u.username ? `@${u.username}` : "";
					const discord = u.discord_id ? `<@${u.discord_id}>` : "";
					return `\`${u.role ?? "user"}\` **${truncate(name, 40)}** ${tag} ${discord}\n  └ ${u.email ?? "—"} · \`${u.id.slice(0, 8)}…\``;
				})
				.join("\n");
			const embed = rgEmbed().setTitle(`Utilisateurs RG — ${rows.length}`).setDescription(lines);
			await i.editReply({ embeds: [embed] });
		})(interaction);
	}

	@Slash({ name: "info", description: "Détails d'un utilisateur" })
	async info(
		@SlashOption({
			name: "user",
			description: "Membre Discord (mention)",
			type: ApplicationCommandOptionType.User,
			required: false,
		})
		user: User | undefined,
		@SlashOption({
			name: "id",
			description: "Profile UUID ou Discord ID si pas de mention",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		id: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(async (_admin, i) => {
			await i.deferReply();
			const profile = user
				? await getUserByDiscord(user.id)
				: id
					? ((await getUserById(id)) ?? (await getUserByDiscord(id)))
					: null;
			if (!profile) {
				await i.editReply({ content: "Utilisateur introuvable" });
				return;
			}
			const embed = rgEmbed()
				.setTitle(profile.full_name ?? profile.username ?? "Profil")
				.setDescription(`\`${profile.id}\``)
				.addFields(
					{ name: "Username", value: profile.username ?? "—", inline: true },
					{ name: "Email", value: profile.email ?? "—", inline: true },
					{ name: "Rôle", value: profile.role ?? "user", inline: true },
					{
						name: "Discord",
						value: profile.discord_id ? `<@${profile.discord_id}>` : "—",
						inline: true,
					},
					{
						name: "Mis à jour",
						value: profile.updated_at ? new Date(profile.updated_at).toLocaleString("fr-FR") : "—",
						inline: true,
					}
				);
			if (profile.avatar_url) embed.setThumbnail(profile.avatar_url);
			await i.editReply({ embeds: [embed] });
		})(interaction);
	}

	@Slash({ name: "setrole", description: "Change le rôle d'un utilisateur (admin strict)" })
	async setrole(
		@SlashChoice(...VALID_ROLES.map((r) => ({ name: r, value: r })))
		@SlashOption({
			name: "role",
			description: "Nouveau rôle",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		role: (typeof VALID_ROLES)[number],
		@SlashOption({
			name: "user",
			description: "Membre Discord",
			type: ApplicationCommandOptionType.User,
			required: false,
		})
		user: User | undefined,
		@SlashOption({
			name: "id",
			description: "Profile UUID si pas de mention",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		id: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(
			async (admin: RgAdmin, i) => {
				await i.deferReply();
				const profile = user ? await getUserByDiscord(user.id) : id ? await getUserById(id) : null;
				if (!profile) {
					await i.editReply({ content: "Utilisateur introuvable" });
					return;
				}
				const before = profile.role;
				await setUserRole(profile.id, role);
				await logAdminAction({
					adminId: admin.profileId,
					discordId: admin.discordId,
					action: "user.setrole",
					targetType: "profile",
					targetId: profile.id,
					details: { before, after: role, target_username: profile.username },
				});
				await i.editReply({
					content: `✓ Rôle de **${profile.username ?? profile.id.slice(0, 8)}** : \`${before ?? "user"}\` → \`${role}\``,
				});
			},
			{ strict: true }
		)(interaction);
	}

	@Slash({ name: "ban", description: "Banni un utilisateur (role='banned'). Admin strict." })
	async ban(
		@SlashOption({
			name: "user",
			description: "Membre Discord",
			type: ApplicationCommandOptionType.User,
			required: false,
		})
		user: User | undefined,
		@SlashOption({
			name: "id",
			description: "Profile UUID",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		id: string | undefined,
		@SlashOption({
			name: "reason",
			description: "Raison (loggée)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		reason: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(
			async (admin, i) => {
				await i.deferReply();
				const profile = user ? await getUserByDiscord(user.id) : id ? await getUserById(id) : null;
				if (!profile) {
					await i.editReply({ content: "Utilisateur introuvable" });
					return;
				}
				await setUserRole(profile.id, "banned");
				await logAdminAction({
					adminId: admin.profileId,
					discordId: admin.discordId,
					action: "user.ban",
					targetType: "profile",
					targetId: profile.id,
					details: { reason: reason ?? null, prev_role: profile.role },
				});
				await i.editReply({
					content: `🔨 **${profile.username ?? profile.id.slice(0, 8)}** banni${reason ? ` — *${reason}*` : ""}`,
				});
			},
			{ strict: true }
		)(interaction);
	}

	@Slash({ name: "unban", description: "Lève le ban (role='user')" })
	async unban(
		@SlashOption({
			name: "user",
			description: "Membre Discord",
			type: ApplicationCommandOptionType.User,
			required: false,
		})
		user: User | undefined,
		@SlashOption({
			name: "id",
			description: "Profile UUID",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		id: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(
			async (admin, i) => {
				await i.deferReply();
				const profile = user ? await getUserByDiscord(user.id) : id ? await getUserById(id) : null;
				if (!profile) {
					await i.editReply({ content: "Utilisateur introuvable" });
					return;
				}
				await setUserRole(profile.id, "user");
				await logAdminAction({
					adminId: admin.profileId,
					discordId: admin.discordId,
					action: "user.unban",
					targetType: "profile",
					targetId: profile.id,
				});
				await i.editReply({
					content: `✓ **${profile.username ?? profile.id.slice(0, 8)}** débanni`,
				});
			},
			{ strict: true }
		)(interaction);
	}
}
