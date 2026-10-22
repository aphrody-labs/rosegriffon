/**
 * Boutons et menus des clans Achilléa — `custom_id` de l'ancien bot.
 *
 * Ces composants arrivent de trois sources : les réponses des commandes
 * `/clan`, les messages que l'API poste dans les salons de clan (candidatures,
 * votes de fondation) et les messages privés qu'elle envoie (invitations).
 * C'est pourquoi leurs identifiants et leurs expressions sont recopiés tels
 * quels de `legacy/achillea-bot/src/events/components/*` :
 *
 *   confirm_application:<id>   refuse_application:<id>   init_application:<clanId>
 *   create_application:<clanId>:<A|B>   cancel_application:<clanId>   apply_distinctions:<clanId>
 *   confirm_invite:<id>   cancel_invite:<id>   init_invite:<joueurId>   invite_distinctions:<joueurId>
 *   vote:(approve|reject):<propositionId>
 *   get_clan_history:<joueurId>   dismiss-message
 *
 * Un échec sur un message PUBLIC (candidature dans le salon du clan, vote de
 * fondation) ne remplace jamais ce message : il part en réponse privée à celui
 * qui a cliqué. Sinon un Vice-Président sans droit effacerait la candidature
 * pour tout le monde.
 */
import { ButtonComponent, Discord, SelectMenuComponent } from "discordx";
import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type InteractionReplyOptions,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { ClanVoteResult } from "@rosegriffon/achillea-client";

import { lireApi } from "../../lib/achillea-ui";
import {
  boutonInviter,
  boutonsCreationCandidature,
  CLES_DISTINCTION,
  distinctionsDepuis,
  embedCarriere,
  segments,
  selecteurDistinctions,
} from "../../lib/achillea-clan-format";
import { echapper, echec, repondre, succes } from "../../lib/ui";

type Composant = ButtonInteraction | StringSelectMenuInteraction;

/** Échec rendu à celui qui a cliqué, sans toucher au message d'origine. */
export async function echecPrive(interaction: Composant, titre: string, motif: string): Promise<void> {
  await interaction.followUp({ ...echec(titre, motif), flags: MessageFlags.Ephemeral } as InteractionReplyOptions);
}

/** Retire un message, en tolérant qu'il ait déjà disparu (fil d'invitation supprimé par l'API). */
async function effacer(interaction: Composant): Promise<void> {
  await interaction.deleteReply().catch(() => undefined);
}

/**
 * Message de vote mis à jour (legacy `createClanFoundationEmbed`) : le décompte
 * remplace le champ « Votes », et les boutons disparaissent quand la
 * proposition est close.
 */
export function messageVoteApres(origine: readonly { toJSON?: () => unknown }[] | undefined, vote: ClanVoteResult) {
  const brut = origine?.[0];
  const embed = brut ? EmbedBuilder.from(brut as never) : new EmbedBuilder();
  const champs = (embed.data.fields ?? []).filter(champ => champ.name !== "Votes" && champ.name !== "Issue");
  champs.push({ name: "Votes", value: `${vote.approvals + vote.rejections} / ${vote.eligible}`, inline: true });
  const close = vote.status !== "PENDING";
  if (close) {
    const libelle = vote.status === "APPROVED" ? "✅ Approuvée" : vote.status === "REJECTED" ? "❌ Rejetée" : "⌛ Expirée";
    champs.push({ name: "Issue", value: libelle, inline: true });
  }
  embed.setFields(champs);
  return { embeds: [embed], ...(close ? { components: [] } : {}) };
}

@Discord()
export class ComposantsClan {
  // ─── Candidatures ──────────────────────────────────────────────────────

  @ButtonComponent({ id: /^confirm_application:.+/ })
  async accepterCandidature(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const id = Number(segments(interaction.customId)[0]);
    const issue = await lireApi(interaction, c => c.clans.acceptApplicationById(id));
    if (!issue.ok) {
      await echecPrive(interaction, "Candidature non acceptée", issue.motif);
      return;
    }
    // L'API a déjà réécrit le message de candidature ; on retire les boutons au cas où.
    await interaction.editReply({ components: [] }).catch(() => undefined);
    await interaction.followUp({ ...succes("Candidature acceptée"), flags: MessageFlags.Ephemeral } as InteractionReplyOptions);
  }

  @ButtonComponent({ id: /^refuse_application:.+/ })
  async refuserCandidature(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const id = Number(segments(interaction.customId)[0]);
    const issue = await lireApi(interaction, c => c.clans.rejectApplicationById(id));
    if (!issue.ok) {
      await echecPrive(interaction, "Candidature non refusée", issue.motif);
      return;
    }
    await interaction.editReply({ components: [] }).catch(() => undefined);
    await interaction.followUp({ ...succes("Candidature refusée."), flags: MessageFlags.Ephemeral } as InteractionReplyOptions);
  }

  @ButtonComponent({ id: /^init_application:.+/ })
  async ouvrirCandidature(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const clanId = Number(segments(interaction.customId)[0]);
    const clan = await lireApi(interaction, c => c.clans.fiche(clanId));
    if (!clan.ok || clan.valeur.isDisbanded) {
      await repondre(interaction, echec("Clan introuvable", clan.ok ? "Ce Clan n'existe plus." : clan.motif));
      return;
    }
    if (!clan.valeur.isRecruiting) {
      await repondre(interaction, echec("Recrutement fermé", "Ce Clan ne recrute pas pour le moment !"));
      return;
    }
    await interaction.editReply({
      content: `Sélectionnez vos distinctions avant de postuler à [${clan.valeur.shortName}] ${echapper(clan.valeur.name)} :`,
      components: [selecteurDistinctions("apply", clan.valeur.id)],
    });
  }

  @SelectMenuComponent({ id: /^apply_distinctions:\d+$/ })
  async choisirDistinctionsCandidature(interaction: StringSelectMenuInteraction): Promise<void> {
    await interaction.deferUpdate();
    const clanId = Number(segments(interaction.customId)[0]);
    const cles = interaction.values.filter(v => (CLES_DISTINCTION as readonly string[]).includes(v));
    const clan = await lireApi(interaction, c => c.clans.fiche(clanId));
    if (!clan.ok) {
      await interaction.editReply({ content: "", components: [], ...echec("Clan introuvable", clan.motif) });
      return;
    }
    await interaction.editReply({
      content:
        `Vous allez postuler au Clan [${clan.valeur.shortName}] ${echapper(clan.valeur.name)} avec les distinctions suivantes : ` +
        `**${distinctionsDepuis(cles).join(", ")}**.\nSouhaitez-vous continuer ?`,
      components: [boutonsCreationCandidature(clanId, cles)],
    });
  }

  @ButtonComponent({ id: /^create_application:.+/ })
  async envoyerCandidature(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const [clanBrut, clesBrutes] = segments(interaction.customId);
    const clanId = Number(clanBrut);
    const distinctions = distinctionsDepuis((clesBrutes ?? "").split("|").filter(Boolean));
    const issue = await lireApi(interaction, c => c.clans.createApplication(clanId, distinctions));
    if (!issue.ok || !issue.valeur.success) {
      const motif = issue.ok ? (issue.valeur.error ?? "Candidature refusée par l'API.") : issue.motif;
      await interaction.editReply({ content: "", components: [], ...echec("Candidature impossible", motif) });
      return;
    }
    const texte = issue.valeur.autojoin ? "Vous avez rejoint le Clan !" : "Votre candidature a été envoyée au Clan.";
    await interaction.editReply({ content: "", components: [], ...succes(texte) });
  }

  @ButtonComponent({ id: /^cancel_application:.+/ })
  async annulerCandidature(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    await effacer(interaction);
  }

  // ─── Invitations ───────────────────────────────────────────────────────

  @ButtonComponent({ id: /^confirm_invite:.+/ })
  async accepterInvitation(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const id = Number(segments(interaction.customId)[0]);
    const issue = await lireApi(interaction, c => c.clans.acceptInvite(id));
    if (!issue.ok) {
      await echecPrive(interaction, "Invitation non acceptée", issue.motif);
      return;
    }
    // Dans un fil, l'API l'a déjà supprimé : l'édition peut échouer sans dommage.
    await interaction
      .editReply({ content: "", components: [], ...succes(`Vous avez rejoint le Clan ${issue.valeur.clanName} !`) })
      .catch(() => undefined);
  }

  @ButtonComponent({ id: /^cancel_invite:.+/ })
  async refuserInvitation(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const id = Number(segments(interaction.customId)[0]);
    const issue = await lireApi(interaction, c => c.clans.declineInvite(id));
    if (!issue.ok) {
      await echecPrive(interaction, "Invitation non refusée", issue.motif);
      return;
    }
    await interaction
      .editReply({ content: "", components: [], ...succes(`Invitation de ${issue.valeur.clanName} refusée.`) })
      .catch(() => undefined);
  }

  @ButtonComponent({ id: /^init_invite:.+/ })
  async ouvrirInvitation(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const joueurId = segments(interaction.customId)[0] ?? "";
    if (!/^\d{5,25}$/.test(joueurId)) {
      await repondre(interaction, echec("Joueur introuvable", "Utilisateur cible introuvable."));
      return;
    }
    await interaction.editReply({
      content: `Sélectionnez les distinctions à proposer à <@${joueurId}> :`,
      components: [selecteurDistinctions("invite", joueurId)],
    });
  }

  @SelectMenuComponent({ id: /^invite_distinctions:\d+$/ })
  async choisirDistinctionsInvitation(interaction: StringSelectMenuInteraction): Promise<void> {
    await interaction.deferUpdate();
    const joueurId = segments(interaction.customId)[0]!;
    const distinctions = distinctionsDepuis(interaction.values);
    const issue = await lireApi(interaction, c => c.clans.createInvite(joueurId, distinctions));
    if (!issue.ok || !issue.valeur.success) {
      const motif = issue.ok ? (issue.valeur.error ?? "Invitation refusée par l'API.") : issue.motif;
      await interaction.editReply({ content: "", components: [], ...echec("Invitation impossible", motif) });
      return;
    }
    await interaction.editReply({
      content: "",
      components: [],
      ...succes("Invitation envoyée", `<@${joueurId}> a reçu l'invitation (fil d'invitation et message privé).`),
    });
  }

  // ─── Votes ─────────────────────────────────────────────────────────────

  @ButtonComponent({ id: /vote:(approve|reject):(\d+)/ })
  async voter(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const [, choix, proposition] = /vote:(approve|reject):(\d+)/.exec(interaction.customId) ?? [];
    const issue = await lireApi(interaction, c => c.clans.vote(Number(proposition), choix === "approve"));
    if (!issue.ok) {
      await echecPrive(interaction, "Vote non pris en compte", issue.motif);
      return;
    }
    await interaction.editReply(messageVoteApres(interaction.message.embeds as never, issue.valeur)).catch(() => undefined);
    await interaction.followUp({ ...succes(issue.valeur.message), flags: MessageFlags.Ephemeral } as InteractionReplyOptions);
  }

  // ─── Divers ────────────────────────────────────────────────────────────

  @ButtonComponent({ id: /^get_clan_history:.+/ })
  async carriere(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const joueurId = segments(interaction.customId)[0] ?? "";
    const carriere = await lireApi(interaction, c => c.clans.history(joueurId));
    if (!carriere.ok) {
      await repondre(interaction, echec("Carrière indisponible", carriere.motif));
      return;
    }
    // Lecture purement Discord : l'avatar affiché est celui du compte, pas une donnée Achilléa.
    const avatar = await interaction.client.users
      .fetch(joueurId)
      .then(u => u.displayAvatarURL())
      .catch(() => null);
    await interaction.editReply({
      embeds: [embedCarriere(carriere.valeur, avatar)],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(boutonInviter(joueurId))],
    });
  }

  @ButtonComponent({ id: "dismiss-message" })
  async fermer(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    await effacer(interaction);
  }
}
