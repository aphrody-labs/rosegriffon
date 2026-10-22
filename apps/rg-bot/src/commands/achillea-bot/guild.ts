/**
 * `/guild settings` et les boutons du panneau de réglages du serveur.
 *
 * Porte `GuildSettingsCommand` (`legacy/achillea-bot/src/commands/General/guild-settings.ts`)
 * et `GuildButtons` (`events/components/guild-buttons.ts`). Les `custom_id` sont
 * ceux de l'ancien bot : un panneau ouvert avant la bascule reste cliquable.
 *
 * Tout passe par `/guilds/:id/settings` et `/guilds/:id/clan` (`api/modules/achillea/guilds/reglages.ts`),
 * au nom du membre qui clique. La garde locale « administrateur du serveur »
 * n'est qu'un raccourci d'affichage : l'API revérifie la permission auprès de
 * Discord avant toute écriture.
 */
import { ButtonComponent, Discord, ModalComponent, Slash, SlashGroup } from "discordx";
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  type RepliableInteraction,
} from "discord.js";

import type { AchilleaGuildSettings } from "@rosegriffon/achillea-client";
import { administreLeServeur, appelApi, lireApi } from "../../lib/achillea-ui";
import type { ClientAchilleaDelegue, AchilleaClientResult } from "../../lib/achillea-api";
import { echec, fiche, pied, refus, repondre, succes } from "../../lib/ui";

/** Préfixes des `custom_id` legacy. */
export const ID = {
  salon: "broadcast_channel_button",
  lier: "bind_clan_guild",
  delier: "unbind_clan_guild",
  fenetre: "modal_guild_broadcast_channel",
  gestion: "broadcast_management_button",
  menu: "guild_settings_menu",
  ranked: "ranked_broadcast_toggle",
  supprimer: "delete_broadcast_channel_button",
} as const;

/** Champs de la fenêtre (identifiants legacy, les deux formes sont lues). */
export const CHAMP_SAISIE = "input_guild_broadcast_channel";
export const CHAMP_SELECTION = "select_guild_broadcast_channel";

/** Serveur visé par un `custom_id` `prefixe:<guildId>`. */
export function serveurDuBouton(customId: string): string | null {
  const id = customId.split(":")[1] ?? "";
  return /^\d{15,25}$/u.test(id) ? id : null;
}

/** Embed des réglages (même grille que `guildSettingsEmbed` legacy). */
export function embedReglages(reglages: AchilleaGuildSettings) {
  return pied(
    fiche({ titre: "Paramètres du serveur", intention: "marque", icone: "⚙️" })
      .champ("Salon des annonces de Clan", reglages.broadcastChannel ? `<#${reglages.broadcastChannel}>` : "Aucun", {
        enLigne: true,
      })
      .champ("Clan lié", reglages.clan ? `${reglages.clan.name} [${reglages.clan.shortName}]` : "Aucun", { enLigne: true })
      .champ("Annonces Ranked", reglages.rankedEnabled ? "✅ Activées" : "❌ Désactivées", { enLigne: true }).embed,
  );
}

/** Rangée principale : salon, gestion des annonces, liaison du clan. */
export function rangeeReglages(reglages: AchilleaGuildSettings): ActionRowBuilder<ButtonBuilder> {
  const id = reglages.guildId;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel("Annonces de Clan").setStyle(ButtonStyle.Primary).setCustomId(`${ID.salon}:${id}`).setEmoji("📢"),
    new ButtonBuilder()
      .setLabel("Gérer les annonces")
      .setStyle(ButtonStyle.Primary)
      .setCustomId(`${ID.gestion}:${id}`)
      .setEmoji("🔇")
      .setDisabled(reglages.broadcastChannel === null),
    reglages.clan
      ? new ButtonBuilder().setLabel("Dissocier du Clan").setStyle(ButtonStyle.Danger).setCustomId(`${ID.delier}:${id}`).setEmoji("✖️")
      : new ButtonBuilder().setLabel("Lier à un Clan").setStyle(ButtonStyle.Primary).setCustomId(`${ID.lier}:${id}`).setEmoji("🔗"),
  );
}

/** Rangée de gestion des annonces : suppression du salon, bascule ranked, retour. */
export function rangeeGestion(reglages: AchilleaGuildSettings): ActionRowBuilder<ButtonBuilder> {
  const id = reglages.guildId;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Supprimer le salon d'annonces")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`${ID.supprimer}:${id}`)
      .setEmoji("🔇"),
    new ButtonBuilder()
      .setLabel("Annonces Ranked")
      .setStyle(reglages.rankedEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
      .setCustomId(`${ID.ranked}:${id}`)
      .setEmoji(reglages.rankedEnabled ? "📢" : "🔇"),
    new ButtonBuilder().setLabel("Retour").setStyle(ButtonStyle.Primary).setCustomId(`${ID.menu}:${id}`).setEmoji("↩️"),
  );
}

/** Fenêtre de choix du salon d'annonces : sélecteur natif (avec recherche), facultatif — vide = retirer. */
export function fenetreSalon(guildId: string): ModalBuilder {
  const selecteur = new ChannelSelectMenuBuilder()
    .setCustomId(CHAMP_SELECTION)
    .setPlaceholder("Choisissez un salon (vide : retirer le salon)")
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(0)
    .setMaxValues(1)
    .setRequired(false);
  return new ModalBuilder()
    .setCustomId(`${ID.fenetre}:${guildId}`)
    .setTitle("Salon des annonces du Clan")
    .addLabelComponents(new LabelBuilder().setLabel("Salon des annonces du Clan").setChannelSelectMenuComponent(selecteur));
}

/** Salon choisi dans la fenêtre : saisie libre (ancienne fenêtre) ou sélecteur. `null` = retirer. */
export function salonChoisi(interaction: ModalSubmitInteraction): string | null {
  try {
    const saisi = interaction.fields.getTextInputValue(CHAMP_SAISIE).trim();
    if (saisi) return saisi;
  } catch {
    // Champ absent de cette version de la fenêtre.
  }
  try {
    const salons = interaction.fields.getSelectedChannels(CHAMP_SELECTION, false);
    return salons?.first()?.id ?? null;
  } catch {
    return null;
  }
}

type Charge = InteractionReplyOptions & InteractionEditReplyOptions;

/** Garde des boutons : serveur, permission Discord. Répond lui-même en cas de refus. */
async function garder(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<string | null> {
  const guildId = serveurDuBouton(interaction.customId);
  if (!guildId || !interaction.guildId || interaction.guildId !== guildId) {
    await interaction.reply(refus("Ce panneau ne concerne pas ce serveur. Relance `/guild settings`.") as InteractionReplyOptions);
    return null;
  }
  if (!administreLeServeur(interaction.member as never)) {
    await interaction.reply(refus("Tu dois être administrateur du serveur pour modifier ces réglages.") as InteractionReplyOptions);
    return null;
  }
  return guildId;
}

/**
 * Applique une action sur le panneau : `deferUpdate`, appel API, mise à jour du
 * panneau, puis confirmation éphémère. Un échec part en éphémère et laisse le
 * panneau intact.
 */
async function actionPanneau(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  appel: (client: ClientAchilleaDelegue) => Promise<AchilleaClientResult<AchilleaGuildSettings>>,
  vue: "reglages" | "gestion",
  titreEchec: string,
  confirmation?: (reglages: AchilleaGuildSettings) => string,
): Promise<void> {
  await interaction.deferUpdate();
  const resultat = await lireApi(interaction, appel);
  if (!resultat.ok) {
    await interaction.followUp(echec(titreEchec, resultat.motif) as Charge);
    return;
  }
  const reglages = resultat.valeur;
  await interaction.editReply({
    embeds: [embedReglages(reglages)],
    components: [vue === "gestion" ? rangeeGestion(reglages) : rangeeReglages(reglages)],
  });
  if (confirmation) await interaction.followUp(succes(confirmation(reglages), undefined, { prive: true }) as Charge);
}

@Discord()
@SlashGroup({ name: "guild", description: "Gestion du bot sur votre serveur" })
@SlashGroup("guild")
export class GuildCommande {
  @Slash({ name: "settings", description: "Gestion du paramétrage du bot" })
  async settings(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await repondre(interaction, refus("Cette commande doit être effectuée sur un serveur."));
      return;
    }
    if (!administreLeServeur(interaction.member as never)) {
      await repondre(interaction, refus("Tu dois être administrateur du serveur pour utiliser cette commande."));
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guildId = interaction.guildId;
    const reglages = await appelApi(interaction, c => c.guilds.settings(guildId), "Réglages indisponibles");
    if (!reglages) return;
    await interaction.editReply({ embeds: [embedReglages(reglages)], components: [rangeeReglages(reglages)] });
  }
}

@Discord()
export class GuildBoutons {
  @ButtonComponent({ id: /^broadcast_channel_button:.+/ })
  async ouvrirFenetre(interaction: ButtonInteraction): Promise<void> {
    const guildId = await garder(interaction);
    if (!guildId) return;
    await interaction.showModal(fenetreSalon(guildId));
  }

  @ModalComponent({ id: /^modal_guild_broadcast_channel:\d+$/ })
  async fenetre(interaction: ModalSubmitInteraction): Promise<void> {
    const guildId = await garder(interaction);
    if (!guildId) return;
    const salon = salonChoisi(interaction);
    await actionPanneau(
      interaction,
      c => c.guilds.updateSettings(guildId, { broadcastChannel: salon }),
      "reglages",
      "Salon non modifié",
      () =>
        salon
          ? `Le salon des annonces du clan est désormais <#${salon}>.`
          : "Salon d'annonce supprimé. Un éventuel lien avec un Clan a également été coupé.",
    );
  }

  @ButtonComponent({ id: /^bind_clan_guild:.+/ })
  async lier(interaction: ButtonInteraction): Promise<void> {
    const guildId = await garder(interaction);
    if (!guildId) return;
    await actionPanneau(interaction, c => c.guilds.bindClan(guildId), "reglages", "Liaison impossible", r =>
      `Ce serveur est désormais lié au Clan ${r.clan?.name ?? ""} !`,
    );
  }

  @ButtonComponent({ id: /^unbind_clan_guild:.+/ })
  async delier(interaction: ButtonInteraction): Promise<void> {
    const guildId = await garder(interaction);
    if (!guildId) return;
    await actionPanneau(interaction, c => c.guilds.unbindClan(guildId), "reglages", "Dissociation impossible", () =>
      "Ce serveur n'est plus lié à aucun Clan.",
    );
  }

  @ButtonComponent({ id: /^broadcast_management_button:.+/ })
  async gestion(interaction: ButtonInteraction): Promise<void> {
    const guildId = await garder(interaction);
    if (!guildId) return;
    await actionPanneau(interaction, c => c.guilds.settings(guildId), "gestion", "Réglages indisponibles");
  }

  @ButtonComponent({ id: /^guild_settings_menu:.+/ })
  async menu(interaction: ButtonInteraction): Promise<void> {
    const guildId = await garder(interaction);
    if (!guildId) return;
    await actionPanneau(interaction, c => c.guilds.settings(guildId), "reglages", "Réglages indisponibles");
  }

  @ButtonComponent({ id: /^ranked_broadcast_toggle:.+/ })
  async basculerRanked(interaction: ButtonInteraction): Promise<void> {
    const guildId = await garder(interaction);
    if (!guildId) return;
    await actionPanneau(
      interaction,
      async c => {
        // Lire puis inverser : la bascule part de l'état en base, pas de la couleur du bouton.
        const actuel = await c.guilds.settings(guildId);
        if (!actuel.ok) return actuel;
        return c.guilds.updateSettings(guildId, { rankedEnabled: !actuel.value.rankedEnabled });
      },
      "gestion",
      "Bascule impossible",
      r => `Les annonces de la file classée sont ${r.rankedEnabled ? "activées" : "désactivées"}.`,
    );
  }

  @ButtonComponent({ id: /^delete_broadcast_channel_button:.+/ })
  async supprimerSalon(interaction: ButtonInteraction): Promise<void> {
    const guildId = await garder(interaction);
    if (!guildId) return;
    await actionPanneau(
      interaction,
      c => c.guilds.updateSettings(guildId, { broadcastChannel: null }),
      "reglages",
      "Suppression impossible",
      () => "Salon d'annonce supprimé. Un éventuel lien avec un Clan a également été coupé.",
    );
  }
}

/** Réexport pour les tests : type d'interaction répondable. */
export type { RepliableInteraction };
