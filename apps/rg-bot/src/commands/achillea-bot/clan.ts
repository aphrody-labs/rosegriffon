/**
 * `/clan` — le groupe des Clans Achilléa (profil `achillea`).
 *
 * Ce module DÉCLARE le groupe et porte les sous-commandes de l'ancien bot :
 * `infos`, `invite-member`, `leave`, `poster`, `disband`, `transfer-ownership`,
 * `apply`. Les équipes et la gestion du clan (`teams`, `manage`…) vivent dans
 * leur propre module, rattaché au même groupe par `@SlashGroup("clan")`.
 *
 * Tout passe par l'API au nom de l'auteur (`lib/achillea-ui.ts`) : les droits
 * (Président, Vice-Président, administrateur) sont ceux du site.
 *
 * ── CE QUI CHANGE PAR RAPPORT À L'ANCIEN BOT ──────────────────────────────
 * Les confirmations passaient par des collecteurs de 10 à 20 secondes : un
 * clic une seconde trop tard ne répondait plus, et un redémarrage du bot
 * laissait des boutons morts. Elles passent ici par des boutons à état
 * (`clan_leave_confirm:<clanId>`, `clan_infos_page:<page>`…), traités quel que
 * soit le délai et quel que soit le processus.
 */
import { ButtonComponent, Discord, ModalComponent, SelectMenuComponent, Slash, SlashGroup, SlashOption } from "discordx";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type User,
} from "discord.js";
import { ClanMemberRole } from "@rosegriffon/achillea-core/enums";

import { appelApi, lireApi, urlAchillea } from "../../lib/achillea-ui";
import {
  boutonPostuler,
  CLANS_PAR_PAGE,
  embedFicheClan,
  embedListeClans,
  idPageClans,
  segments,
  selecteurClans,
  selecteurDistinctions,
} from "../../lib/achillea-clan-format";
import { echapper, echec, info, rangeePagination, repondre, succes } from "../../lib/ui";

/** Phrase à recopier pour céder la présidence (ancien bot : « Je confirme »). */
export const PHRASE_TRANSFERT = "Je confirme";

/** Rangée Confirmer / Annuler d'une action à état. */
export function boutonsConfirmation(idConfirmer: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel("Confirmer").setStyle(ButtonStyle.Success).setCustomId(idConfirmer).setEmoji("✅"),
    new ButtonBuilder().setLabel("Annuler").setStyle(ButtonStyle.Danger).setCustomId("clan_action_cancel").setEmoji("✖️"),
  );
}

/** Modale de validation du transfert (legacy `buildValidationModal`, champ `userInput`). */
export function modaleTransfert(cibleId: string) {
  const saisie = new TextInputBuilder()
    .setCustomId("userInput")
    .setStyle(TextInputStyle.Short)
    .setMinLength(PHRASE_TRANSFERT.length)
    .setMaxLength(PHRASE_TRANSFERT.length)
    .setPlaceholder(PHRASE_TRANSFERT);
  return new ModalBuilder()
    .setTitle("Validez votre action")
    .setCustomId(`clan_transfer_modal:${cibleId}`)
    .addLabelComponents(new LabelBuilder().setLabel("Réécrivez le message ci-dessous").setTextInputComponent(saisie));
}

type Interactif = ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction;

/** Page `page` de l'annuaire, rendue dans la réponse (déjà différée). */
async function afficherListe(interaction: Interactif, page: number): Promise<void> {
  const liste = await appelApi(interaction, c => c.clans.list({ page, pagination: CLANS_PAR_PAGE }), "Annuaire des clans indisponible");
  if (!liste) return;
  const total = liste.meta.total ?? liste.data.length;
  const pages = Math.max(1, Math.ceil(total / CLANS_PAR_PAGE));
  const courante = Math.min(Math.max(1, page), pages);
  const composants = [...rangeePagination({ prefixe: "clan_infos", page: courante, pages, identifiant: idPageClans })];
  if (liste.data.length > 0) composants.push(selecteurClans(liste.data) as never);
  await interaction.editReply({ embeds: [embedListeClans(liste.data, courante, pages, total)], components: composants });
}

/** Fiche d'un clan (par id ou sigle), avec le bouton « Postuler » s'il existe encore. */
async function afficherFiche(interaction: Interactif, ref: string | number, avecRetour: boolean): Promise<void> {
  const clan = await appelApi(interaction, c => c.clans.fiche(ref), "Clan introuvable");
  if (!clan) return;
  const boutons: ButtonBuilder[] = [];
  if (avecRetour)
    boutons.push(new ButtonBuilder().setLabel("Retour").setStyle(ButtonStyle.Primary).setCustomId(idPageClans(1)).setEmoji("↩️"));
  if (!clan.isDisbanded) boutons.push(boutonPostuler(clan.id, !clan.isRecruiting));
  await interaction.editReply({
    embeds: [embedFicheClan(clan, urlAchillea(`/clans/${clan.id}`))],
    components: boutons.length > 0 ? [new ActionRowBuilder<ButtonBuilder>().addComponents(...boutons)] : [],
  });
}

/** Clan actuel (actif) de l'auteur, avec son rôle — lu dans sa carrière. */
async function clanActuel(interaction: Interactif) {
  const carriere = await appelApi(interaction, c => c.clans.history(interaction.user.id), "Profil joueur introuvable");
  if (!carriere) return null;
  const actuel = carriere.current.at(-1) ?? null;
  if (!actuel) {
    await repondre(interaction, echec("Aucun Clan", "Vous ne faites pas partie d'un Clan."));
    return null;
  }
  return actuel;
}

@Discord()
@SlashGroup({ name: "clan", description: "Les Clans Achilléa : fiches, adhésion, présidence" })
@SlashGroup("clan")
export class ClanCommandes {
  @Slash({ name: "infos", description: "Récupère les informations d'un clan" })
  async infos(
    @SlashOption({
      name: "sigle",
      description: "Le sigle du Clan recherché",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    sigle: string | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (sigle && sigle.trim() !== "") {
      await afficherFiche(interaction, sigle.trim(), false);
      return;
    }
    await afficherListe(interaction, 1);
  }

  @ButtonComponent({ id: /^clan_infos_page:\d+$/ })
  async page(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    await afficherListe(interaction, Number(segments(interaction.customId)[0] ?? 1));
  }

  @SelectMenuComponent({ id: "clanSelector" })
  async choisir(interaction: StringSelectMenuInteraction): Promise<void> {
    await interaction.deferUpdate();
    const id = Number(interaction.values[0]);
    if (!Number.isInteger(id)) return;
    await afficherFiche(interaction, id, true);
  }

  @Slash({ name: "apply", description: "Postuler à un Clan" })
  async apply(
    @SlashOption({
      name: "shortname",
      description: "Sigle du Clan auprès duquel vous souhaitez postuler",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    sigle: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const clan = await appelApi(interaction, c => c.clans.fiche(sigle.trim()), "Clan introuvable");
    if (!clan) return;
    if (clan.isDisbanded) {
      await repondre(interaction, echec("Clan dissous", `Le Clan ${echapper(clan.name)} a été dissous.`));
      return;
    }
    if (!clan.isRecruiting) {
      await repondre(interaction, echec("Recrutement fermé", "Ce Clan ne recrute pas pour le moment !"));
      return;
    }
    await interaction.editReply({
      content: `Sélectionnez vos distinctions avant de postuler à [${clan.shortName}] ${echapper(clan.name)} :`,
      components: [selecteurDistinctions("apply", clan.id)],
    });
  }

  @Slash({ name: "invite-member", description: "Invitez un joueur dans votre Clan" })
  async inviteMember(
    @SlashOption({
      name: "user",
      description: "Joueur à inviter dans votre Clan",
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    cible: User,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (cible.bot) {
      await repondre(interaction, echec("Invitation impossible", "On n'invite pas un bot dans un Clan."));
      return;
    }
    const actuel = await clanActuel(interaction);
    if (!actuel) return;
    if (actuel.role < ClanMemberRole.SubCaptain) {
      await repondre(interaction, echec("Accès refusé", "Seuls le Président et les Vice-Présidents invitent des joueurs."));
      return;
    }
    await interaction.editReply({
      content: `Sélectionnez les distinctions à proposer à ${cible.toString()} :`,
      components: [selecteurDistinctions("invite", cible.id)],
    });
  }

  @Slash({ name: "leave", description: "Quittez votre Clan" })
  async leave(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const actuel = await clanActuel(interaction);
    if (!actuel) return;
    if (actuel.role === ClanMemberRole.Captain) {
      await repondre(
        interaction,
        echec("Départ impossible", "Le Président ne peut pas quitter son Clan ! Utilisez `/clan transfer-ownership` ou `/clan disband`."),
      );
      return;
    }
    await interaction.editReply({
      content: `Souhaitez-vous quitter le clan ${echapper(actuel.clanName)} ?`,
      components: [boutonsConfirmation(`clan_leave_confirm:${actuel.clanId}`)],
    });
  }

  @ButtonComponent({ id: /^clan_leave_confirm:\d+$/ })
  async confirmerDepart(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const clanId = Number(segments(interaction.customId)[0]);
    const issue = await lireApi(interaction, c => c.clans.leave(clanId));
    if (!issue.ok) {
      await interaction.editReply({ content: "", components: [], ...echec("Départ impossible", issue.motif) });
      return;
    }
    await interaction.editReply({ content: "", components: [], ...succes(`Vous avez quitté le Clan ${issue.valeur.clanName} !`) });
  }

  @Slash({ name: "disband", description: "Dissoudre votre Clan" })
  async disband(
    @SlashOption({
      name: "sigle",
      description: "Clan à dissoudre (administrateurs ; vide = le vôtre)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    sigle: string | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let cible: { id: number; nom: string };
    if (sigle && sigle.trim() !== "") {
      const clan = await appelApi(interaction, c => c.clans.fiche(sigle.trim()), "Clan introuvable");
      if (!clan) return;
      if (clan.isDisbanded) {
        await repondre(interaction, echec("Déjà dissous", `Le Clan ${echapper(clan.name)} est déjà dissous.`));
        return;
      }
      cible = { id: clan.id, nom: clan.name };
    } else {
      const actuel = await clanActuel(interaction);
      if (!actuel) return;
      if (actuel.role !== ClanMemberRole.Captain) {
        await repondre(interaction, echec("Accès refusé", "Seul le Président peut dissoudre son Clan."));
        return;
      }
      cible = { id: actuel.clanId, nom: actuel.clanName };
    }
    await interaction.editReply({
      content: `Voulez-vous vraiment __dissoudre__ ${echapper(cible.nom)} ? Cette action est définitive.`,
      components: [boutonsConfirmation(`clan_disband_confirm:${cible.id}`)],
    });
  }

  @ButtonComponent({ id: /^clan_disband_confirm:\d+$/ })
  async confirmerDissolution(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const clanId = Number(segments(interaction.customId)[0]);
    const issue = await lireApi(interaction, c => c.clans.disband(clanId));
    if (!issue.ok) {
      await interaction.editReply({ content: "", components: [], ...echec("Dissolution impossible", issue.motif) });
      return;
    }
    await interaction.editReply({ content: "", components: [], ...succes(`Le Clan ${issue.valeur.clanName} a été dissous.`) });
  }

  @ButtonComponent({ id: "clan_action_cancel" })
  async annuler(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    await interaction.editReply({ content: "", components: [], ...info("Action annulée") });
  }

  @Slash({ name: "transfer-ownership", description: "Transférer la présidence du Clan à un autre membre" })
  async transferOwnership(
    @SlashOption({
      name: "member",
      description: "Membre à qui céder la présidence du Clan",
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    membre: User,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    if (membre.id === interaction.user.id) {
      await repondre(interaction, echec("Transfert impossible", "Vous ne pouvez pas vous choisir comme cible de l'action !"));
      return;
    }
    // La modale doit partir dans les trois secondes : la vérification d'appartenance
    // se fait à la validation, par l'API, qui tranche de toute façon.
    await interaction.showModal(modaleTransfert(membre.id));
  }

  @ModalComponent({ id: /^clan_transfer_modal:\d+$/ })
  async validerTransfert(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (interaction.fields.getTextInputValue("userInput").trim() !== PHRASE_TRANSFERT) {
      await repondre(interaction, echec("La validation a échoué !", `Recopiez exactement « ${PHRASE_TRANSFERT} ».`));
      return;
    }
    const cibleId = segments(interaction.customId)[0]!;
    const issue = await appelApi(interaction, c => c.clans.transferOwnership(cibleId), "Transfert de présidence impossible");
    if (!issue) return;
    await repondre(interaction, succes("Présidence transférée", `<@${cibleId}> est maintenant le nouveau Président de ${echapper(issue.clanName)}.`));
  }

  @Slash({ name: "poster", description: "Génère l'affiche officielle d'un clan" })
  async poster(
    @SlashOption({
      name: "sigle",
      description: "Le sigle du Clan ciblé (vide = ton clan)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    sigle: string | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let cible: { id: number; nom: string; sigle: string };
    if (sigle && sigle.trim() !== "") {
      const clan = await appelApi(interaction, c => c.clans.fiche(sigle.trim()), "Clan introuvable");
      if (!clan) return;
      cible = { id: clan.id, nom: clan.name, sigle: clan.shortName };
    } else {
      const actuel = await clanActuel(interaction);
      if (!actuel) return;
      cible = { id: actuel.clanId, nom: actuel.clanName, sigle: actuel.shortName };
    }
    const octets = await appelApi(interaction, c => c.clans.poster(cible.id), "Affiche indisponible");
    if (!octets) return;
    await interaction.editReply({
      content: `Affiche officielle du Clan **${echapper(cible.nom)}** [${cible.sigle}]`,
      files: [new AttachmentBuilder(Buffer.from(octets), { name: `clan-${cible.id}-poster.png` })],
    });
  }
}
