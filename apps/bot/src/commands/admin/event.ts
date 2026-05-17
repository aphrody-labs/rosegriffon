import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";
import { logAdminAction } from "../../lib/audit.ts";
import { fmtDate, rgEmbed, truncate } from "../../lib/embeds.ts";
import { withRgAdmin } from "../../lib/rbac.ts";
import { createEvent, deleteEvent, listEventsAdmin, updateEvent } from "../../services/admin.ts";

function parseDate(input: string): Date | null {
  // Accepte ISO 8601 ou formats simples "YYYY-MM-DD HH:mm"
  const cleaned = input.replace(" ", "T").trim();
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Discord()
@SlashGroup({ name: "rg-event-admin", description: "Gestion événements (admin)" })
@SlashGroup("rg-event-admin")
export class AdminEventCommand {
  @Slash({ name: "list", description: "Liste les événements (à venir, passés, tous)" })
  async list(
    @SlashChoice(
      { name: "À venir", value: "upcoming" },
      { name: "Passés", value: "past" },
      { name: "Tous", value: "all" },
    )
    @SlashOption({
      name: "scope",
      description: "Filtrer (default: upcoming)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    scope: "upcoming" | "past" | "all" | undefined,
    @SlashOption({
      name: "limit",
      description: "Nombre max (1-25)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1,
      maxValue: 25,
    })
    limit: number | undefined,
    interaction: ChatInputCommandInteraction,
  ) {
    await withRgAdmin(async (_admin, i) => {
      await i.deferReply();
      const rows = await listEventsAdmin(scope ?? "upcoming", limit ?? 10);
      if (rows.length === 0) {
        await i.editReply({ content: "Aucun événement" });
        return;
      }
      const lines = rows
        .map(
          (e) =>
            `\`${e.id.slice(0, 8)}\` **${truncate(e.title, 50)}** — ${fmtDate(e.start_time)}${e.location ? ` · 📍 ${truncate(e.location, 30)}` : ""}`,
        )
        .join("\n");
      const embed = rgEmbed()
        .setTitle(`Événements (${scope ?? "upcoming"}) — ${rows.length}`)
        .setDescription(lines);
      await i.editReply({ embeds: [embed] });
    })(interaction);
  }

  @Slash({ name: "create", description: "Crée un événement (start/end ISO 8601)" })
  async create(
    @SlashOption({
      name: "title",
      description: "Titre de l'événement",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    title: string,
    @SlashOption({
      name: "start",
      description: "Début (ISO: 2026-05-01T20:00 ou 2026-05-01 20:00)",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    start: string,
    @SlashOption({
      name: "end",
      description: "Fin (ISO)",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    end: string,
    @SlashOption({
      name: "location",
      description: "Lieu (optionnel)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    location: string | undefined,
    @SlashOption({
      name: "description",
      description: "Description (optionnel)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    description: string | undefined,
    @SlashOption({
      name: "image_url",
      description: "URL image (optionnel)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    imageUrl: string | undefined,
    interaction: ChatInputCommandInteraction,
  ) {
    await withRgAdmin(async (admin, i) => {
      await i.deferReply();
      const startDate = parseDate(start);
      const endDate = parseDate(end);
      if (!startDate || !endDate) {
        await i.editReply({
          content: "❌ Date invalide. Format attendu: ISO 8601 (`2026-05-01T20:00:00+02:00`)",
        });
        return;
      }
      if (endDate <= startDate) {
        await i.editReply({ content: "❌ La fin doit être après le début" });
        return;
      }
      try {
        const id = await createEvent({
          title,
          description: description ?? null,
          start_time: startDate,
          end_time: endDate,
          location: location ?? null,
          image_url: imageUrl ?? null,
        });
        await logAdminAction({
          adminId: admin.profileId,
          discordId: admin.discordId,
          action: "event.create",
          targetType: "event",
          targetId: id,
          details: { title, start: startDate.toISOString() },
        });
        await i.editReply({
          content: `✓ Événement créé \`${id}\` — **${title}** (${fmtDate(startDate)})`,
        });
      } catch (err) {
        await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
      }
    })(interaction);
  }

  @Slash({
    name: "edit",
    description: "Édite les champs d'un événement (champs vides = inchangés)",
  })
  async edit(
    @SlashOption({
      name: "id",
      description: "UUID de l'événement",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    id: string,
    @SlashOption({
      name: "title",
      description: "Nouveau titre",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    title: string | undefined,
    @SlashOption({
      name: "start",
      description: "Nouveau début (ISO)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    start: string | undefined,
    @SlashOption({
      name: "end",
      description: "Nouvelle fin (ISO)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    end: string | undefined,
    @SlashOption({
      name: "location",
      description: "Nouveau lieu",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    location: string | undefined,
    @SlashOption({
      name: "description",
      description: "Nouvelle description",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    description: string | undefined,
    interaction: ChatInputCommandInteraction,
  ) {
    await withRgAdmin(async (admin, i) => {
      await i.deferReply();
      const patch: Parameters<typeof updateEvent>[1] = {};
      if (title) patch.title = title;
      if (location !== undefined) patch.location = location || null;
      if (description !== undefined) patch.description = description || null;
      if (start) {
        const d = parseDate(start);
        if (!d) {
          await i.editReply({ content: "❌ Date 'start' invalide" });
          return;
        }
        patch.start_time = d;
      }
      if (end) {
        const d = parseDate(end);
        if (!d) {
          await i.editReply({ content: "❌ Date 'end' invalide" });
          return;
        }
        patch.end_time = d;
      }
      if (Object.keys(patch).length === 0) {
        await i.editReply({ content: "Aucun champ fourni" });
        return;
      }
      try {
        await updateEvent(id, patch);
        await logAdminAction({
          adminId: admin.profileId,
          discordId: admin.discordId,
          action: "event.update",
          targetType: "event",
          targetId: id,
          details: patch as Record<string, unknown>,
        });
        await i.editReply({ content: `✓ Événement \`${id.slice(0, 8)}\` mis à jour` });
      } catch (err) {
        await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
      }
    })(interaction);
  }

  @Slash({ name: "delete", description: "SUPPRIME un événement (admin strict)" })
  async delete(
    @SlashOption({
      name: "id",
      description: "UUID de l'événement",
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
          await deleteEvent(id);
          await logAdminAction({
            adminId: admin.profileId,
            discordId: admin.discordId,
            action: "event.delete",
            targetType: "event",
            targetId: id,
          });
          await i.editReply({ content: `🗑 Événement \`${id.slice(0, 8)}\` supprimé` });
        } catch (err) {
          await i.editReply({ content: `❌ ${err instanceof Error ? err.message : err}` });
        }
      },
      { strict: true },
    )(interaction);
  }
}
