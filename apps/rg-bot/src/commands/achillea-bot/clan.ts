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
import {
  ButtonComponent,
  Discord,
  ModalComponent,
  SelectMenuComponent,
  Slash,
  SlashGroup,
  SlashOption,
} from "discordx";
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
  escapeMarkdown,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type StringSelectMenuInteraction,
  type User,
} from "discord.js";
import { ClanMemberRole } from "@rosegriffon/achillea-core/enums";
import type { AchilleaClientResult } from "@rosegriffon/achillea-client";

import {
  ConfigurationApiAchillea,
  type ClientAchilleaDelegue,
} from "../../lib/achillea-api";
import { clientDe } from "../../lib/achillea-ui";
import {
  boutonPostuler,
  boutonRetourClans,
  CLANS_PAR_PAGE,
  embedErreurLegacy,
  embedFicheClan,
  embedListeClans,
  embedRefusLegacy,
  embedSuccesLegacy,
  rangeePaginationClans,
  REFUS_LEGACY,
  segments,
  selecteurClans,
  selecteurDistinctions,
  type AuteurEmbed,
} from "../../lib/achillea-clan-format";

/** Phrase à recopier pour céder la présidence (ancien bot : « Je confirme »). */
export const PHRASE_TRANSFERT = "Je confirme";

/** Rangée Confirmer / Annuler d'une action à état (legacy `buildConfirmCancelButtons`). */
export function boutonsConfirmation(idConfirmer: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Confirmer")
      .setStyle(ButtonStyle.Success)
      .setCustomId(idConfirmer)
      .setEmoji("✅"),
    new ButtonBuilder()
      .setLabel("Annuler")
      .setStyle(ButtonStyle.Danger)
      .setCustomId("clan_action_cancel")
      .setEmoji("✖️"),
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
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Réécrivez le message ci-dessous")
        .setTextInputComponent(saisie),
    );
}

type Interactif =
  ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction;

/** Embed seul, sans texte ni composant, dans la réponse (différée ou non). */
async function afficher(
  interaction: RepliableInteraction,
  embed: EmbedBuilder,
): Promise<void> {
  const charge = { content: "", components: [], embeds: [embed] };
  if (interaction.deferred || interaction.replied)
    await interaction.editReply(charge);
  else await interaction.reply({ ...charge, flags: MessageFlags.Ephemeral });
}

/**
 * Appel API au nom de l'auteur ; un échec s'affiche comme `followUpWithErrorEmbed`
 * de l'ancien bot (`❌ motif`). `si404` remplace le motif quand la ressource n'existe pas.
 */
async function appelClan<T>(
  interaction: RepliableInteraction,
  appel: (client: ClientAchilleaDelegue) => Promise<AchilleaClientResult<T>>,
  si404?: string,
): Promise<T | null> {
  let client: ClientAchilleaDelegue;
  try {
    client = clientDe(interaction);
  } catch (err) {
    if (err instanceof ConfigurationApiAchillea) {
      await afficher(interaction, embedErreurLegacy(err.message));
      return null;
    }
    throw err;
  }
  const resultat = await appel(client);
  if (resultat.ok) return resultat.value;
  const motif =
    si404 && resultat.kind === "http" && resultat.status === 404
      ? si404
      : client.motifEchec(resultat);
  await afficher(interaction, embedErreurLegacy(motif));
  return null;
}

/** Auteur des embeds de l'ancien bot : celui qui a lancé la commande. */
function auteurDe(interaction: { user: User }): AuteurEmbed {
  const u = interaction.user as User & { displayAvatarURL?: () => string };
  return {
    nom: u.displayName ?? u.username,
    avatar:
      typeof u.displayAvatarURL === "function" ? u.displayAvatarURL() : null,
  };
}

/** Page `page` de l'annuaire, rendue dans la réponse (déjà différée). */
async function afficherListe(
  interaction: Interactif,
  page: number,
): Promise<void> {
  const liste = await appelClan(interaction, (c) =>
    c.clans.list({ page, pagination: CLANS_PAR_PAGE }),
  );
  if (!liste) return;
  const total = liste.meta.total ?? liste.data.length;
  const pages = Math.ceil(total / CLANS_PAR_PAGE);
  const courante = Math.min(Math.max(1, page), Math.max(1, pages));
  const composants: Array<
    ActionRowBuilder<ButtonBuilder> | ReturnType<typeof selecteurClans>
  > = [rangeePaginationClans(courante, pages)];
  if (liste.data.length > 0) composants.push(selecteurClans(liste.data));
  await interaction.editReply({
    embeds: [
      embedListeClans(liste.data, courante, pages, auteurDe(interaction)),
    ],
    components: composants as never,
  });
}

/** Fondateurs du clan (absents de la fiche) ; une lecture manquée laisse la liste vide. */
async function fondateursDe(
  interaction: Interactif,
  clanId: number,
): Promise<string[]> {
  try {
    const resultat = await clientDe(interaction).clans.get(clanId);
    return resultat.ok ? resultat.value.founders : [];
  } catch {
    return [];
  }
}

/**
 * Fiche d'un clan (par id ou sigle). Par sigle : bouton « Postuler » (grisé hors
 * recrutement), aucun pour un clan dissous. Depuis l'annuaire : « Retour » seul.
 */
async function afficherFiche(
  interaction: Interactif,
  ref: string | number,
  depuisAnnuaire: boolean,
): Promise<void> {
  const si404 = depuisAnnuaire
    ? "Le Clan sélectionné n'existe pas ou n'est pas actif."
    : `Le Clan recherché avec le sigle ${ref} n'existe pas.`;
  const clan = await appelClan(interaction, (c) => c.clans.fiche(ref), si404);
  if (!clan) return;
  if (depuisAnnuaire && clan.isDisbanded) {
    await afficher(interaction, embedErreurLegacy(si404));
    return;
  }
  const boutons: ButtonBuilder[] = depuisAnnuaire
    ? [boutonRetourClans()]
    : clan.isDisbanded
      ? []
      : [boutonPostuler(clan.id, !clan.isRecruiting)];
  await interaction.editReply({
    embeds: [
      embedFicheClan(
        clan,
        auteurDe(interaction),
        await fondateursDe(interaction, clan.id),
      ),
    ],
    components:
      boutons.length > 0
        ? [new ActionRowBuilder<ButtonBuilder>().addComponents(...boutons)]
        : [],
  });
}

/** Clan actuel (actif) de l'auteur, avec son rôle — lu dans sa carrière (garde `ClanEnabled`). */
async function clanActuel(interaction: Interactif) {
  const carriere = await appelClan(interaction, (c) =>
    c.clans.history(interaction.user.id),
  );
  if (!carriere) return null;
  const actuel = carriere.current.at(-1) ?? null;
  if (!actuel) {
    await afficher(interaction, embedRefusLegacy(REFUS_LEGACY.horsClan));
    return null;
  }
  return actuel;
}

/** Nom affiché d'un utilisateur, lu chez Discord ; la mention à défaut. */
async function nomDe(
  interaction: ModalSubmitInteraction,
  id: string,
): Promise<string> {
  try {
    const u = await interaction.client.users.fetch(id);
    return escapeMarkdown(u.displayName ?? u.username);
  } catch {
    return `<@${id}>`;
  }
}

@Discord()
@SlashGroup({ name: "clan", description: "Manage clans" })
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

  @ButtonComponent({ id: /^clan_infos_page:\d+(?::[a-z]+)?$/ })
  async page(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    await afficherListe(
      interaction,
      Number(segments(interaction.customId)[0] ?? 1),
    );
  }

  @SelectMenuComponent({ id: "clanSelector" })
  async choisir(interaction: StringSelectMenuInteraction): Promise<void> {
    await interaction.deferUpdate();
    const id = Number(interaction.values[0]);
    if (!Number.isInteger(id)) return;
    await afficherFiche(interaction, id, true);
  }

  @Slash({ name: "apply", description: "Apply to join a Clan" })
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
    // Garde `NoClan` de l'ancien bot : une adhésion active interdit de postuler.
    const carriere = await appelClan(interaction, (c) =>
      c.clans.history(interaction.user.id),
    );
    if (!carriere) return;
    if (carriere.current.length > 0) {
      await afficher(interaction, embedRefusLegacy(REFUS_LEGACY.dejaEnClan));
      return;
    }
    const sigleNormalise = sigle.trim().toUpperCase();
    const clan = await appelClan(
      interaction,
      (c) => c.clans.fiche(sigleNormalise),
      `Clan with short name ${sigleNormalise} doesn't exist`,
    );
    if (!clan) return;
    if (clan.isDisbanded || !clan.isRecruiting) {
      await afficher(
        interaction,
        embedErreurLegacy("This Clan is not currently recruiting !"),
      );
      return;
    }
    await interaction.editReply({
      content: `Sélectionnez vos distinctions avant de postuler à [${clan.shortName}] ${clan.name} :`,
      components: [selecteurDistinctions("apply", clan.id)],
    });
  }

  @Slash({
    name: "invite-member",
    description: "Invitez un joueur dans votre Clan",
  })
  async inviteMember(
    @SlashOption({
      name: "user",
      description: "User to invite to your Clan",
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    cible: User,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const actuel = await clanActuel(interaction);
    if (!actuel) return;
    if (actuel.role < ClanMemberRole.SubCaptain) {
      await afficher(interaction, embedRefusLegacy(REFUS_LEGACY.permission));
      return;
    }
    if (cible.bot) {
      await afficher(
        interaction,
        embedErreurLegacy("On n'invite pas un bot dans un Clan."),
      );
      return;
    }
    await interaction.editReply({
      content:
        "Sélectionnez les distinctions à proposer à l'utilisateur à inviter:",
      components: [selecteurDistinctions("invite", cible.id)],
    });
  }

  @Slash({ name: "leave", description: "Quittez votre Clan" })
  async leave(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const actuel = await clanActuel(interaction);
    if (!actuel) return;
    if (actuel.role === ClanMemberRole.Captain) {
      await afficher(
        interaction,
        embedErreurLegacy("Le Président ne peut pas quitter son Clan !"),
      );
      return;
    }
    await interaction.editReply({
      content: `Souhaitez-vous quitter le clan ${actuel.clanName} ?`,
      components: [boutonsConfirmation(`clan_leave_confirm:${actuel.clanId}`)],
    });
  }

  @ButtonComponent({ id: /^clan_leave_confirm:\d+$/ })
  async confirmerDepart(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const clanId = Number(segments(interaction.customId)[0]);
    const issue = await appelClan(interaction, (c) => c.clans.leave(clanId));
    if (!issue) return;
    await afficher(
      interaction,
      embedSuccesLegacy(`Vous avez quitté le Clan ${issue.clanName} !`),
    );
  }

  @Slash({ name: "disband", description: "Disband your Clan" })
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
      const ref = sigle.trim();
      const clan = await appelClan(
        interaction,
        (c) => c.clans.fiche(ref),
        `Le Clan recherché avec le sigle ${ref} n'existe pas.`,
      );
      if (!clan) return;
      if (clan.isDisbanded) {
        await afficher(
          interaction,
          embedErreurLegacy(`Le Clan ${clan.name} est déjà dissous.`),
        );
        return;
      }
      cible = { id: clan.id, nom: clan.name };
    } else {
      const actuel = await clanActuel(interaction);
      if (!actuel) return;
      if (actuel.role !== ClanMemberRole.Captain) {
        await afficher(interaction, embedRefusLegacy(REFUS_LEGACY.permission));
        return;
      }
      cible = { id: actuel.clanId, nom: actuel.clanName };
    }
    await interaction.editReply({
      content: `Do you really want to __disband__ ${cible.nom} ?`,
      components: [boutonsConfirmation(`clan_disband_confirm:${cible.id}`)],
    });
  }

  @ButtonComponent({ id: /^clan_disband_confirm:\d+$/ })
  async confirmerDissolution(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const clanId = Number(segments(interaction.customId)[0]);
    const issue = await appelClan(interaction, (c) => c.clans.disband(clanId));
    if (!issue) return;
    await afficher(
      interaction,
      embedSuccesLegacy(
        `Clan ${issue.clanName} has been disbanded successfully !`,
      ),
    );
  }

  /** « Annuler » : l'ancien bot supprimait la demande de confirmation. */
  @ButtonComponent({ id: "clan_action_cancel" })
  async annuler(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    await interaction.deleteReply();
  }

  @Slash({
    name: "transfer-ownership",
    description: "Permet de transférer la présidence du Clan à un autre membre",
  })
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
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await afficher(
        interaction,
        embedErreurLegacy(
          "Vous ne pouvez pas vous choisir comme cible de l'action !",
        ),
      );
      return;
    }
    // La modale doit partir dans les trois secondes : la vérification d'appartenance
    // se fait à la validation, par l'API, qui tranche de toute façon.
    await interaction.showModal(modaleTransfert(membre.id));
  }

  @ModalComponent({ id: /^clan_transfer_modal:\d+$/ })
  async validerTransfert(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (
      interaction.fields.getTextInputValue("userInput") !== PHRASE_TRANSFERT
    ) {
      await afficher(
        interaction,
        embedErreurLegacy("La validation a échoué !"),
      );
      return;
    }
    const cibleId = segments(interaction.customId)[0]!;
    const issue = await appelClan(interaction, (c) =>
      c.clans.transferOwnership(cibleId),
    );
    if (!issue) return;
    // Ancien texte : « … est est maintenant … » ; seul le doublon est corrigé.
    await afficher(
      interaction,
      embedSuccesLegacy(
        `${await nomDe(interaction, cibleId)} est maintenant le nouveau Président de votre Clan`,
      ),
    );
  }

  @Slash({
    name: "poster",
    description: "Génère l'affiche officielle d'un clan",
  })
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
      const clan = await appelClan(
        interaction,
        (c) => c.clans.fiche(sigle.trim()),
        `Le Clan avec le sigle "${sigle}" n'existe pas.`,
      );
      if (!clan) return;
      cible = { id: clan.id, nom: clan.name, sigle: clan.shortName };
    } else {
      const carriere = await appelClan(interaction, (c) =>
        c.clans.history(interaction.user.id),
      );
      if (!carriere) return;
      const actuel = carriere.current.at(-1);
      if (!actuel) {
        await afficher(
          interaction,
          embedErreurLegacy(
            "Vous n'êtes pas membre d'un Clan. Précisez un sigle.",
          ),
        );
        return;
      }
      cible = {
        id: actuel.clanId,
        nom: actuel.clanName,
        sigle: actuel.shortName,
      };
    }
    const octets = await appelClan(interaction, (c) =>
      c.clans.poster(cible.id),
    );
    if (!octets) return;
    await interaction.editReply({
      content: `Affiche officielle du Clan **${cible.nom}** [${cible.sigle}]`,
      files: [
        new AttachmentBuilder(Buffer.from(octets), {
          name: `clan-${cible.id}-poster.png`,
        }),
      ],
    });
  }
}
