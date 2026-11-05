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

import { ClanMemberRole } from "@rosegriffon/achillea-core/enums";

import { lireApi } from "../../lib/achillea-ui";
import {
  boutonInviter,
  boutonsCreationCandidature,
  CLES_DISTINCTION,
  distinctionsDepuis,
  embedCarriere,
  embedErreurLegacy,
  embedRefusLegacy,
  embedSuccesLegacy,
  REFUS_LEGACY,
  segments,
  selecteurDistinctions,
} from "../../lib/achillea-clan-format";

type Composant = ButtonInteraction | StringSelectMenuInteraction;

/** Échec rendu à celui qui a cliqué, sans toucher au message d'origine (legacy `followUpWithErrorEmbed(…, true)`). */
export async function echecPrive(interaction: Composant, motif: string): Promise<void> {
  await interaction.followUp({ embeds: [embedErreurLegacy(motif)], flags: MessageFlags.Ephemeral } as InteractionReplyOptions);
}

/** Succès privé (legacy `followUpWithSuccessEmbed(…, true)`). */
async function succesPrive(interaction: Composant, message: string): Promise<void> {
  await interaction.followUp({ embeds: [embedSuccesLegacy(message)], flags: MessageFlags.Ephemeral } as InteractionReplyOptions);
}

/** Remplace la réponse (privée) par un seul embed. */
async function afficher(interaction: Composant, embed: EmbedBuilder): Promise<void> {
  await interaction.editReply({ content: "", components: [], embeds: [embed] });
}

/** Refus d'une garde de l'ancien bot pour ce rôle (`null` = `NoClan`), ou `null` si l'action peut suivre. */
export function refusGarde(actuel: { role: number } | undefined, role: ClanMemberRole | null): string | null {
  if (role === null) return actuel ? REFUS_LEGACY.dejaEnClan : null;
  if (!actuel) return REFUS_LEGACY.horsClan;
  return actuel.role < role ? REFUS_LEGACY.permission : null;
}

/** Gardes `NoClan` / `ClanEnabled` + `ClanRole`, lues dans la carrière de l'auteur. */
async function garde(interaction: Composant, role: ClanMemberRole | null): Promise<boolean> {
  const carriere = await lireApi(interaction, c => c.clans.history(interaction.user.id));
  if (!carriere.ok) {
    await afficher(interaction, embedErreurLegacy(carriere.motif));
    return false;
  }
  const refus = refusGarde(carriere.valeur.current.at(-1), role);
  if (refus) await afficher(interaction, embedRefusLegacy(refus));
  return refus === null;
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
      await echecPrive(interaction, issue.motif);
      return;
    }
    // L'API a déjà réécrit le message de candidature ; on retire les boutons au cas où.
    await interaction.editReply({ components: [] }).catch(() => undefined);
  }

  @ButtonComponent({ id: /^refuse_application:.+/ })
  async refuserCandidature(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const id = Number(segments(interaction.customId)[0]);
    const issue = await lireApi(interaction, c => c.clans.rejectApplicationById(id));
    if (!issue.ok) {
      await echecPrive(interaction, issue.motif);
      return;
    }
    await interaction.editReply({ components: [] }).catch(() => undefined);
    await succesPrive(interaction, "Candidature refusée.");
  }

  @ButtonComponent({ id: /^init_application:.+/ })
  async ouvrirCandidature(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!(await garde(interaction, null))) return;
    const clanId = Number(segments(interaction.customId)[0]);
    const clan = await lireApi(interaction, c => c.clans.fiche(clanId));
    if (!clan.ok || clan.valeur.isDisbanded) {
      await afficher(interaction, embedErreurLegacy("Ce Clan n'existe plus"));
      return;
    }
    if (!clan.valeur.isRecruiting) {
      await afficher(interaction, embedErreurLegacy("Ce Clan ne recrute pas pour le moment !"));
      return;
    }
    await interaction.editReply({
      content: `Sélectionnez vos distinctions avant de postuler à [${clan.valeur.shortName}] ${clan.valeur.name} :`,
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
      await interaction.deleteReply().catch(() => undefined);
      await echecPrive(interaction, "Clan introuvable.");
      return;
    }
    await interaction.editReply({
      content:
        `Vous allez postuler au Clan [${clan.valeur.shortName}] ${clan.valeur.name} avec les distinctions suivantes : ` +
        `**${distinctionsDepuis(cles).join(", ")}**.\nSouhaitez-vous confirmer ?`,
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
      await afficher(interaction, embedErreurLegacy(motif));
      return;
    }
    const clan = await lireApi(interaction, c => c.clans.fiche(clanId));
    const nom = clan.ok ? clan.valeur.name : "";
    const texte = issue.valeur.autojoin ? `Vous avez rejoint le Clan ${nom}` : `Votre candidature a été envoyée à ${nom}`;
    await afficher(interaction, embedSuccesLegacy(texte.trimEnd()));
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
      await echecPrive(interaction, issue.motif);
      return;
    }
    // Dans un fil, l'API l'a déjà supprimé : l'édition peut échouer sans dommage.
    await interaction
      .editReply({ content: "", components: [], embeds: [embedSuccesLegacy(`Vous avez rejoint le Clan ${issue.valeur.clanName} !`)] })
      .catch(() => undefined);
  }

  @ButtonComponent({ id: /^cancel_invite:.+/ })
  async refuserInvitation(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const id = Number(segments(interaction.customId)[0]);
    const issue = await lireApi(interaction, c => c.clans.declineInvite(id));
    if (!issue.ok) {
      await echecPrive(interaction, issue.motif);
      return;
    }
    await interaction
      .editReply({ content: "", components: [], embeds: [embedSuccesLegacy(`Invitation de ${issue.valeur.clanName} refusée.`)] })
      .catch(() => undefined);
  }

  @ButtonComponent({ id: /^init_invite:.+/ })
  async ouvrirInvitation(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!(await garde(interaction, ClanMemberRole.SubCaptain))) return;
    const joueurId = segments(interaction.customId)[0] ?? "";
    if (!/^\d{5,25}$/.test(joueurId)) {
      await afficher(interaction, embedErreurLegacy("Utilisateur cible introuvable."));
      return;
    }
    await interaction.editReply({
      content: "Sélectionnez les distinctions à proposer à l'utilisateur à inviter:",
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
      await echecPrive(interaction, motif);
      await interaction.deleteReply().catch(() => undefined);
      return;
    }
    // L'ancien bot retirait simplement le menu : l'invitation part dans son fil.
    await interaction.deleteReply().catch(() => undefined);
  }

  // ─── Votes ─────────────────────────────────────────────────────────────

  @ButtonComponent({ id: /vote:(approve|reject):(\d+)/ })
  async voter(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const [, choix, proposition] = /vote:(approve|reject):(\d+)/.exec(interaction.customId) ?? [];
    const issue = await lireApi(interaction, c => c.clans.vote(Number(proposition), choix === "approve"));
    if (!issue.ok) {
      await echecPrive(interaction, issue.motif);
      return;
    }
    await interaction.editReply(messageVoteApres(interaction.message.embeds as never, issue.valeur)).catch(() => undefined);
    await succesPrive(interaction, issue.valeur.message);
  }

  // ─── Divers ────────────────────────────────────────────────────────────

  @ButtonComponent({ id: /^get_clan_history:.+/ })
  async carriere(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const joueurId = segments(interaction.customId)[0] ?? "";
    const carriere = await lireApi(interaction, c => c.clans.history(joueurId));
    if (!carriere.ok) {
      await afficher(interaction, embedErreurLegacy(carriere.motif));
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
