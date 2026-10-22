/**
 * `/report` et `/report-tournois` — signaler un joueur au staff.
 *
 * Port de `ReportCommand`. Le signalement écrit la même note joueur que le
 * tableau de bord (`POST /player-notes`) : l'API vérifie que l'auteur est staff,
 * ou organisateur du tournoi passé en option. Réponse toujours privée — un
 * signalement affiché dans un salon serait une mise au pilori.
 */
import { PlayerNoteCategory, PlayerNoteSeverity, TournamentState } from "@rosegriffon/achillea-core";
import { Discord, Slash, SlashChoice, SlashOption } from "discordx";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
} from "discord.js";

import { appelApi } from "../../lib/achillea-ui";
import { utilisateurDe } from "../../lib/achillea-moderation";
import { echapper, echec, fiche, piedDeCommande, repondre } from "../../lib/ui";

export const LIBELLES_CATEGORIE: Readonly<Record<string, string>> = Object.freeze({
  [PlayerNoteCategory.BEHAVIOR]: "Comportement",
  [PlayerNoteCategory.CHEATING]: "Triche suspectée",
  [PlayerNoteCategory.NO_SHOW]: "Absence / no-show",
  [PlayerNoteCategory.SCORE_DISPUTE]: "Litige de score",
  [PlayerNoteCategory.POSITIVE]: "Positif",
  [PlayerNoteCategory.OTHER]: "Autre",
});

export const LIBELLES_GRAVITE: Readonly<Record<string, string>> = Object.freeze({
  [PlayerNoteSeverity.INFO]: "Info",
  [PlayerNoteSeverity.WARNING]: "Attention",
  [PlayerNoteSeverity.SERIOUS]: "Grave",
});

const COULEURS_GRAVITE: Readonly<Record<string, number>> = Object.freeze({
  [PlayerNoteSeverity.INFO]: 0x3b82f6,
  [PlayerNoteSeverity.WARNING]: 0xf59e0b,
  [PlayerNoteSeverity.SERIOUS]: 0xef4444,
});

/** États d'un tournoi encore ouvert aux signalements. */
const ETATS_OUVERTS = [TournamentState.PREREGISTERING, TournamentState.PREPARING, TournamentState.ONGOING];

@Discord()
export class CommandeReport {
  @Slash({ name: "report", description: "Signaler un joueur au staff (comportement, triche, absence…)" })
  async report(
    @SlashOption({ name: "joueur", description: "Le joueur concerné", type: ApplicationCommandOptionType.User, required: true })
    brut: User | GuildMember,
    @SlashOption({ name: "details", description: "Ce que tu as constaté", type: ApplicationCommandOptionType.String, required: true })
    details: string,
    @SlashChoice({ name: "Comportement", value: PlayerNoteCategory.BEHAVIOR })
    @SlashChoice({ name: "Triche suspectée", value: PlayerNoteCategory.CHEATING })
    @SlashChoice({ name: "Absence / no-show", value: PlayerNoteCategory.NO_SHOW })
    @SlashChoice({ name: "Litige de score", value: PlayerNoteCategory.SCORE_DISPUTE })
    @SlashChoice({ name: "Positif", value: PlayerNoteCategory.POSITIVE })
    @SlashChoice({ name: "Autre", value: PlayerNoteCategory.OTHER })
    @SlashOption({ name: "categorie", description: "Type de signalement", type: ApplicationCommandOptionType.String, required: false })
    categorie: PlayerNoteCategory | undefined,
    @SlashChoice({ name: "Info", value: PlayerNoteSeverity.INFO })
    @SlashChoice({ name: "Attention", value: PlayerNoteSeverity.WARNING })
    @SlashChoice({ name: "Grave", value: PlayerNoteSeverity.SERIOUS })
    @SlashOption({ name: "gravite", description: "Gravité", type: ApplicationCommandOptionType.String, required: false })
    gravite: PlayerNoteSeverity | undefined,
    @SlashOption({
      name: "tournoi",
      description: "Identifiant du tournoi concerné (laisser vide hors tournoi)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
    })
    tournoi: number | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const cible = utilisateurDe(brut);
    if (cible.bot) {
      await repondre(interaction, echec("Signalement impossible", "On ne signale pas un bot."));
      return;
    }
    if (cible.id === interaction.user.id) {
      await repondre(interaction, echec("Signalement impossible", "Tu ne peux pas te signaler toi-même."));
      return;
    }

    let nomTournoi: string | null = null;
    if (tournoi) {
      const detail = await appelApi(interaction, c => c.tournaments.get(tournoi), `Tournoi ${tournoi} introuvable`);
      if (!detail) return;
      nomTournoi = detail[0].name;
    }

    const note = await appelApi(
      interaction,
      c =>
        c.playerNotes.create({
          targetId: cible.id,
          tournamentId: tournoi ?? null,
          content: details,
          ...(categorie ? { category: categorie } : {}),
          ...(gravite ? { severity: gravite } : {}),
        }),
      "Signalement refusé",
    );
    if (!note) return;

    const embed = fiche({
      intention: "info",
      titre: "Signalement enregistré",
      description: `Ton signalement sur **${echapper(cible.displayName ?? cible.username)}** est visible du staff.`,
      couleur: COULEURS_GRAVITE[note.severity] ?? null,
    })
      .champ("Gravité", LIBELLES_GRAVITE[note.severity] ?? note.severity, { enLigne: true })
      .champ("Catégorie", LIBELLES_CATEGORIE[note.category] ?? note.category, { enLigne: true })
      .champ("Tournoi", nomTournoi ?? "—", { enLigne: true });
    if (note.docsUrl) embed.champ("Registre", `[Ouvrir le document](${note.docsUrl})`);
    await interaction.editReply({
      embeds: [piedDeCommande(embed.finir(), interaction, { note: "Visible du staff uniquement — le joueur n'en est pas informé" })],
    });
  }

  /** Identifiants des tournois en cours, à passer à `/report tournoi:<id>`. */
  @Slash({ name: "report-tournois", description: "Affiche les identifiants des tournois en cours (pour /report)" })
  async tournois(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const page = await appelApi(
      interaction,
      c => c.tournaments.list({ states: ETATS_OUVERTS, pageSize: 25 }),
      "Tournois illisibles",
    );
    if (!page) return;
    if (page.data.length === 0) {
      const embed = fiche({ intention: "muet", titre: "Aucun tournoi ouvert actuellement." }).finir();
      await interaction.editReply({ embeds: [piedDeCommande(embed, interaction)] });
      return;
    }
    const embed = fiche({
      intention: "marque",
      titre: "Tournois en cours",
      description: page.data.map(t => `\`${t.id}\` — ${echapper(t.name)} (${t.status ?? "—"})`).join("\n"),
    }).finir();
    await interaction.editReply({
      embeds: [piedDeCommande(embed, interaction, { note: "Utilise l'identifiant dans /report tournoi:<id>" })],
    });
  }
}
