import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";
import { logAdminAction } from "../../lib/audit.ts";
import { sql } from "../../lib/db.ts";
import { rgEmbed } from "../../lib/embeds.ts";
import { withRgAdmin } from "../../lib/rbac.ts";
import { deleteTeamMember, setTeamMemberActive } from "../../services/admin.ts";

const TEAMS = [
  { name: "Bureau de l'Association", value: "bureauteam" },
  { name: "Association", value: "assoteam" },
  { name: "Partenaires & Collaborateurs", value: "collabteam" },
  { name: "Équipe Achilléa", value: "achilleateam" },
  { name: "Équipe Azalée", value: "azaleeteam" },
  { name: "Équipe Lore", value: "loreteam" },
  { name: "Équipe Dessinateur", value: "dessinateurteam" },
  { name: "Cellule de Médiation", value: "mediationteam" },
  { name: "Équipe Production", value: "productionteam" },
  { name: "Équipe Réseaux", value: "socialteam" },
];

@Discord()
@SlashGroup({ name: "rg-team-admin", description: "Gestion équipe / staff (admin)" })
@SlashGroup("rg-team-admin")
export class AdminTeamCommand {
  @Slash({ name: "add", description: "Ajoute un membre dans une équipe" })
  async add(
    @SlashChoice(...TEAMS)
    @SlashOption({
      name: "team",
      description: "Équipe cible",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    team: string,
    @SlashOption({
      name: "name",
      description: "Nom affiché",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    name: string,
    @SlashOption({
      name: "role",
      description: "Rôle dans l'équipe",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    role: string,
    @SlashOption({
      name: "image_url",
      description: "URL avatar/portrait",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    imageUrl: string | undefined,
    @SlashOption({
      name: "discord_user_id",
      description: "Discord ID (optionnel — pour autosync avatar)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    discordId: string | undefined,
    @SlashOption({
      name: "member_link",
      description: "URL externe (Twitter, etc.)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    memberLink: string | undefined,
    interaction: ChatInputCommandInteraction,
  ) {
    await withRgAdmin(async (admin, i) => {
      await i.deferReply();
      try {
        const rows = await sql<{ id: string }[]>`
          INSERT INTO team_members
            (team_id, name, role, image_url, discord_user_id, member_link, is_active, source)
          VALUES (${team}, ${name}, ${role}, ${imageUrl ?? null}, ${discordId ?? null},
                  ${memberLink ?? null}, true, 'discord-bot')
          RETURNING id
        `;
        const id = rows[0]!.id;
        await logAdminAction({
          adminId: admin.profileId,
          discordId: admin.discordId,
          action: "team.add",
          targetType: "team_member",
          targetId: id,
          details: { team_id: team, name, role },
        });
        await i.editReply({
          content: `✓ Membre \`${id.slice(0, 8)}\` ajouté à **${team}** — ${name} (${role})`,
        });
      } catch (err) {
        await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
      }
    })(interaction);
  }

  @Slash({ name: "edit", description: "Édite un membre (champs vides = inchangés)" })
  async edit(
    @SlashOption({
      name: "id",
      description: "UUID du membre",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    id: string,
    @SlashOption({
      name: "name",
      description: "Nouveau nom",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    name: string | undefined,
    @SlashOption({
      name: "role",
      description: "Nouveau rôle",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    role: string | undefined,
    @SlashOption({
      name: "image_url",
      description: "Nouvel avatar",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    imageUrl: string | undefined,
    @SlashOption({
      name: "member_link",
      description: "Nouveau lien externe",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    memberLink: string | undefined,
    interaction: ChatInputCommandInteraction,
  ) {
    await withRgAdmin(async (admin, i) => {
      await i.deferReply();
      const updates: { name: string; value: string | null }[] = [];
      if (name !== undefined) updates.push({ name: "name", value: name });
      if (role !== undefined) updates.push({ name: "role", value: role });
      if (imageUrl !== undefined) updates.push({ name: "image_url", value: imageUrl || null });
      if (memberLink !== undefined)
        updates.push({ name: "member_link", value: memberLink || null });
      if (updates.length === 0) {
        await i.editReply({ content: "Aucun champ fourni" });
        return;
      }
      try {
        await sql`
          UPDATE team_members SET
            name = COALESCE(${name ?? null}, name),
            role = COALESCE(${role ?? null}, role),
            image_url = CASE WHEN ${imageUrl !== undefined} THEN ${imageUrl ?? null} ELSE image_url END,
            member_link = CASE WHEN ${memberLink !== undefined} THEN ${memberLink ?? null} ELSE member_link END,
            updated_at = NOW()
          WHERE id = ${id}
        `;
        await logAdminAction({
          adminId: admin.profileId,
          discordId: admin.discordId,
          action: "team.edit",
          targetType: "team_member",
          targetId: id,
          details: Object.fromEntries(updates.map((u) => [u.name, u.value])),
        });
        await i.editReply({
          content: `✓ Membre \`${id.slice(0, 8)}\` mis à jour (${updates.length} champ(s))`,
        });
      } catch (err) {
        await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
      }
    })(interaction);
  }

  @Slash({ name: "deactivate", description: "Désactive un membre (sans le supprimer)" })
  async deactivate(
    @SlashOption({
      name: "id",
      description: "UUID",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    id: string,
    interaction: ChatInputCommandInteraction,
  ) {
    await withRgAdmin(async (admin, i) => {
      await i.deferReply();
      try {
        await setTeamMemberActive(id, false);
        await logAdminAction({
          adminId: admin.profileId,
          discordId: admin.discordId,
          action: "team.deactivate",
          targetType: "team_member",
          targetId: id,
        });
        await i.editReply({ content: `✓ Membre \`${id.slice(0, 8)}\` désactivé` });
      } catch (err) {
        await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
      }
    })(interaction);
  }

  @Slash({ name: "delete", description: "SUPPRIME un membre (admin strict)" })
  async delete(
    @SlashOption({
      name: "id",
      description: "UUID",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    id: string,
    @SlashOption({
      name: "confirm",
      description: "Tape 'oui' pour confirmer",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    confirm: string,
    interaction: ChatInputCommandInteraction,
  ) {
    await withRgAdmin(
      async (admin, i) => {
        await i.deferReply();
        if (confirm.toLowerCase() !== "oui") {
          await i.editReply({ content: "Suppression annulée" });
          return;
        }
        try {
          await deleteTeamMember(id);
          await logAdminAction({
            adminId: admin.profileId,
            discordId: admin.discordId,
            action: "team.delete",
            targetType: "team_member",
            targetId: id,
          });
          await i.editReply({ content: `🗑 Membre \`${id.slice(0, 8)}\` supprimé` });
        } catch (err) {
          await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
        }
      },
      { strict: true },
    )(interaction);
  }

  @Slash({
    name: "sync-photos",
    description: "Refresh les avatars Discord de tous les team_members (3 tables)",
  })
  async syncPhotos(interaction: ChatInputCommandInteraction) {
    await withRgAdmin(async (admin, i) => {
      await i.deferReply();
      try {
        const { syncStaffPhotos } = await import("../../services/teamPhotos.ts");
        const report = await syncStaffPhotos(i.client);
        await logAdminAction({
          adminId: admin.profileId,
          discordId: admin.discordId,
          action: "team.sync-photos",
          targetType: "team_members",
          details: {
            total: report.total,
            updated: report.updated,
            unchanged: report.unchanged,
            errors: report.errors.length,
            duration_ms: report.durationMs,
          },
        });
        const lines = [
          `✓ **${report.updated}** updated · ${report.unchanged} unchanged · ${report.errors.length} errors`,
          `⏱ ${(report.durationMs / 1000).toFixed(1)}s · ${report.total} team_members traités`,
        ];
        if (report.errors.length > 0) {
          lines.push("\n**Errors:**");
          for (const e of report.errors.slice(0, 5)) {
            lines.push(`• ${e.name} — ${e.reason}`);
          }
        }
        await i.editReply({ content: lines.join("\n") });
      } catch (err) {
        await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
      }
    })(interaction);
  }

  @Slash({ name: "audit", description: "Affiche les 10 dernières actions admin loggées" })
  async audit(interaction: ChatInputCommandInteraction) {
    await withRgAdmin(async (_admin, i) => {
      await i.deferReply();
      const rows = await sql<
        {
          action: string;
          entity_type: string;
          entity_id: string | null;
          created_at: Date;
          user_id: string;
        }[]
      >`
        SELECT action, entity_type, entity_id, created_at, user_id
        FROM admin_audit_log ORDER BY created_at DESC LIMIT 10
      `;
      if (rows.length === 0) {
        await i.editReply({ content: "Aucun log" });
        return;
      }
      const lines = rows
        .map(
          (r) =>
            `• \`${new Date(r.created_at).toLocaleTimeString("fr-FR")}\` **${r.action}** ${r.entity_type}${r.entity_id ? ` \`${r.entity_id.slice(0, 8)}\`` : ""} — par \`${r.user_id.slice(0, 8)}\``,
        )
        .join("\n");
      await i.editReply({
        embeds: [rgEmbed().setTitle("📜 Audit log — 10 dernières actions").setDescription(lines)],
      });
    })(interaction);
  }
}
