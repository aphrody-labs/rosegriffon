/**
 * `/player infos`, `/player settings`, `/player-card`, `/blacklist` — la fiche d'un joueur.
 *
 * Port de `PlayerInfosCommand`, `SettingsCommand`, `PlayerCardCommand` et
 * `BlacklistViewCommand`. Tout se lit dans l'API (`/users/:id`,
 * `/users/:id/card.png`, `/blacklist`) au nom de l'auteur. Les deux boutons de
 * la fiche gardent les `custom_id` de l'ancien bot (`init_invite:<id>`,
 * `get_clan_history:<id>`) : leurs gestionnaires vivent avec les clans.
 *
 * `/player settings` était désactivé dans l'ancien bot (garde `Disabled`) ; il
 * fonctionne ici : il rend le lien d'association Twitch généré par l'API
 * (`/auth/oauth/twitch/start`, valable 10 min) ou confirme la liaison.
 */
import { CLAN_MEMBER_ROLE_LABELS, type ClanMemberRole } from "@rosegriffon/achillea-core";
import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
} from "discord.js";

import { appelApi, urlAchillea } from "../../lib/achillea-ui";
import { horodatage, utilisateurDe } from "../../lib/achillea-moderation";
import { boutonLien, echapper, fiche, piedDeCommande, succes, repondre } from "../../lib/ui";

type StatsCompetition = { total: number; wins: number; losses: number; draws: number };

/** `12 matchs · 8V 2N 2D` */
export function bilan(stats: StatsCompetition | null | undefined): string {
  if (!stats || stats.total === 0) return "Aucun match";
  return `${stats.total} match${stats.total > 1 ? "s" : ""} · ${stats.wins}V ${stats.draws}N ${stats.losses}D`;
}

/** Boutons de la fiche joueur — `custom_id` de l'ancien bot. */
export function boutonsFicheJoueur(userId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Invitation de Clan")
      .setStyle(ButtonStyle.Success)
      .setCustomId(`init_invite:${userId}`)
      .setEmoji("📩"),
    new ButtonBuilder()
      .setLabel("Carrière")
      .setStyle(ButtonStyle.Primary)
      .setCustomId(`get_clan_history:${userId}`)
      .setEmoji("📜"),
  );
}

@Discord()
@SlashGroup({ name: "player", description: "Commandes joueur" })
@SlashGroup("player")
export class CommandePlayer {
  @Slash({ name: "infos", description: "Récupère les informations d'un joueur" })
  async infos(
    @SlashOption({
      name: "utilisateur",
      description: "Utilisateur dont vous cherchez les informations",
      type: ApplicationCommandOptionType.User,
      required: false,
    })
    brut: User | GuildMember | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const cible = brut ? utilisateurDe(brut) : interaction.user;
    const joueur = await appelApi(
      interaction,
      c => c.users.get(cible.id),
      brut ? `${cible.username} n'a pas de profil joueur actif` : "Tu n'as pas encore de profil joueur actif",
    );
    if (!joueur) return;

    const embed = fiche({
      intention: "marque",
      titre: joueur.rgProfileUsername ?? joueur.username,
      url: urlAchillea(`/users/${joueur.id}`),
      miniature: joueur.avatar ?? null,
      description: joueur.bio ? echapper(joueur.bio) : undefined,
    })
      .champ(
        "Clan",
        joueur.clan
          ? `**${echapper(joueur.clan.name)}** [${echapper(joueur.clan.shortenedName)}] — ${CLAN_MEMBER_ROLE_LABELS[joueur.clan.role as ClanMemberRole] ?? joueur.clan.role}`
          : "Aucun",
        { enLigne: true },
      )
      .champ(
        "Ranked",
        [
          `Solo : ${joueur.soloRank ? `${joueur.soloRank.key} (${joueur.soloRank.elo})` : "—"}`,
          `Duo : ${joueur.duoRank ? `${joueur.duoRank.key} (${joueur.duoRank.elo})` : "—"}`,
        ].join("\n"),
        { enLigne: true },
      )
      .champ("Matchs ranked", `Solo : ${bilan(joueur.ranked.solo)}\nDuo : ${bilan(joueur.ranked.duo)}`)
      .champ("Interclans", bilan(joueur.interclans), { enLigne: true })
      .champ("Tournois", bilan(joueur.tournaments), { enLigne: true });
    if (joueur.twitchUrl) embed.champ("Twitch", joueur.twitchUrl);
    if (joueur.lastInteract) embed.champ("Dernière activité", horodatage(joueur.lastInteract, "R"), { enLigne: true });

    await interaction.editReply({
      embeds: [piedDeCommande(embed.finir(), interaction)],
      components: [boutonsFicheJoueur(joueur.id)],
    });
  }

  @Slash({ name: "settings", description: "Permet d'éditer ses informations et paramètres personnels" })
  async settings(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const moi = await appelApi(interaction, c => c.users.get(interaction.user.id), "Profil joueur introuvable");
    if (!moi) return;
    if (moi.twitchUrl) {
      await repondre(interaction, succes("Twitch déjà lié", `Votre compte Twitch est déjà lié à cette application : ${moi.twitchUrl}`));
      return;
    }
    const lien = await appelApi(
      interaction,
      c => c.auth.providerOAuthUrl("twitch", interaction.user.id),
      "Liaison Twitch indisponible",
    );
    if (!lien) return;
    const embed = fiche({
      intention: "info",
      titre: "Lier votre compte Twitch",
      description:
        "Associez votre chaîne Twitch à votre profil Achilléa : elle s'affichera sur votre fiche et sur le site.\n" +
        "Le lien ci-dessous est personnel et valable 10 minutes.",
    }).finir();
    await interaction.editReply({
      embeds: [piedDeCommande(embed, interaction)],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(boutonLien({ libelle: "Lier Twitch", url: lien.url }))],
    });
  }
}

@Discord()
export class CommandeCarteJoueur {
  @Slash({ name: "player-card", description: "Génère ta carte joueur Achilléa (ou celle d'un autre joueur)" })
  async carte(
    @SlashOption({ name: "user", description: "Le joueur ciblé (vide = toi)", type: ApplicationCommandOptionType.User, required: false })
    brut: User | GuildMember | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const cible = brut ? utilisateurDe(brut) : interaction.user;
    const joueur = await appelApi(interaction, c => c.users.get(cible.id), `Utilisateur \`${cible.id}\` introuvable en base`);
    if (!joueur) return;
    const png = await appelApi(interaction, c => c.users.card(cible.id), "Génération de la carte impossible");
    if (!png) return;
    await interaction.editReply({
      content: `Carte joueur de **${echapper(joueur.rgProfileUsername ?? joueur.username)}**`,
      files: [new AttachmentBuilder(Buffer.from(png), { name: `player-${cible.id}-card.png` })],
    });
  }
}

@Discord()
export class CommandeListeNoire {
  @Slash({ name: "blacklist", description: "Consulter la liste noire Achilléa" })
  async blacklist(
    @SlashOption({ name: "user", description: "Joueur à vérifier (vide = toute la liste)", type: ApplicationCommandOptionType.User, required: false })
    brut: User | GuildMember | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();
    if (brut) {
      const cible = utilisateurDe(brut);
      const statut = await appelApi(interaction, c => c.blacklist.get(cible.id), "Impossible de trouver cet utilisateur");
      if (!statut) return;
      if (!statut.entry) {
        const embed = fiche({ intention: "succes", titre: `${echapper(cible.username)} n'est pas sur la liste noire` }).finir();
        await interaction.editReply({ embeds: [piedDeCommande(embed, interaction)] });
        return;
      }
      const entree = statut.entry;
      const embed = fiche({
        intention: "echec",
        icone: "⛔",
        titre: `${echapper(entree.displayName)} - Liste Noire`,
        description: `**Raison :** ${
          entree.reason || "Cet utilisateur est présent sur la Liste Noire d'Achilléa sur décision des Administrateurs."
        }`,
      })
        .champ("Identifiant", entree.userId, { enLigne: true })
        .champ("Nom d'utilisateur", entree.username ?? "—", { enLigne: true })
        .champ("Depuis le", horodatage(entree.since, "f"), { enLigne: true })
        .finir();
      await interaction.editReply({ embeds: [piedDeCommande(embed, interaction)] });
      return;
    }
    const liste = await appelApi(interaction, c => c.blacklist.list(), "Liste noire illisible");
    if (!liste) return;
    if (liste.data.length === 0) {
      const embed = fiche({ intention: "muet", titre: "Il n'y a aucun utilisateur sur la liste noire." }).finir();
      await interaction.editReply({ embeds: [piedDeCommande(embed, interaction)] });
      return;
    }
    const embed = fiche({
      intention: "marque",
      titre: `Liste noire (${liste.data.length})`,
      description: liste.data
        .map(e => `- \`${e.userId}\` : ${echapper(e.displayName)} (${echapper(e.username ?? "—")})`)
        .join("\n"),
    }).finir();
    await interaction.editReply({ embeds: [piedDeCommande(embed, interaction)] });
  }
}
