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
import {
  CLAN_MEMBER_ROLE_LABELS,
  type ClanMemberRole,
} from "@rosegriffon/achillea-core";
import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
} from "discord.js";

import { appelApi, urlAchillea } from "../../lib/achillea-ui";
import {
  COULEURS_LEGACY,
  dateFrancaiseLegacy,
  embedEchecLegacy,
  embedSuccesLegacy,
} from "../../lib/achillea-legacy";
import { horodatage, utilisateurDe } from "../../lib/achillea-moderation";
import { echapper, fiche } from "../../lib/ui";

type StatsCompetition = {
  total: number;
  wins: number;
  losses: number;
  draws: number;
};

/** `12 matchs · 8V 2N 2D` */
export function bilan(stats: StatsCompetition | null | undefined): string {
  if (!stats || stats.total === 0) return "Aucun match";
  return `${stats.total} match${stats.total > 1 ? "s" : ""} · ${stats.wins}V ${stats.draws}N ${stats.losses}D`;
}

/** Boutons de la fiche joueur — `custom_id` de l'ancien bot. */
export function boutonsFicheJoueur(
  userId: string,
): ActionRowBuilder<ButtonBuilder> {
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
@SlashGroup({ name: "player", description: "Player commands" })
@SlashGroup("player")
export class CommandePlayer {
  @Slash({
    name: "infos",
    description: "Récupère les informations d'un joueur",
  })
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
      (c) => c.users.get(cible.id),
      brut
        ? `${cible.username} n'a pas de profil joueur actif`
        : "Tu n'as pas encore de profil joueur actif",
    );
    if (!joueur) return;

    // Cadre de `buildUserEmbed(…, "Infos", Colors.Blue)` de l'ancien bot :
    // « <nom affiché> - Infos », bleu, avatar Discord, ni pied ni horodatage.
    const embed = fiche({
      couleur: COULEURS_LEGACY.bleu,
      horodater: false,
      titre: `${cible.displayName ?? cible.username} - Infos`,
      url: urlAchillea(`/users/${joueur.id}`),
      miniature: cible.displayAvatarURL?.() ?? joueur.avatar ?? null,
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
      .champ(
        "Matchs ranked",
        `Solo : ${bilan(joueur.ranked.solo)}\nDuo : ${bilan(joueur.ranked.duo)}`,
      )
      .champ("Interclans", bilan(joueur.interclans), { enLigne: true })
      .champ("Tournois", bilan(joueur.tournaments), { enLigne: true });
    if (joueur.twitchUrl) embed.champ("Twitch", joueur.twitchUrl);
    if (joueur.lastInteract)
      embed.champ("Dernière activité", horodatage(joueur.lastInteract, "R"), {
        enLigne: true,
      });

    await interaction.editReply({
      embeds: [embed.embed],
      components: [boutonsFicheJoueur(joueur.id)],
    });
  }

  @Slash({
    name: "settings",
    description: "Permet d'éditer ses informations et paramètres personnels",
  })
  async settings(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const moi = await appelApi(
      interaction,
      (c) => c.users.get(interaction.user.id),
      "Profil joueur introuvable",
    );
    if (!moi) return;
    if (moi.twitchUrl) {
      await interaction.editReply({
        embeds: [
          embedSuccesLegacy(
            "Votre compte Twitch est déjà lié à cette application !",
          ),
        ],
      });
      return;
    }
    const lien = await appelApi(
      interaction,
      (c) => c.auth.providerOAuthUrl("twitch", interaction.user.id),
      "Liaison Twitch indisponible",
    );
    if (!lien) return;
    await interaction.editReply({
      embeds: [embedOAuthTwitch()],
      components: [boutonsOAuthTwitch(lien.url)],
    });
  }
}

/** Émoji Twitch du serveur de production de l'ancien bot. */
const EMOJI_TWITCH = "<:twitch_logo:1436631494146658326>";

/** `OAuthService.OAuthTwitchEmbed()` de l'ancien bot, mot pour mot. */
export function embedOAuthTwitch(): EmbedBuilder {
  return new EmbedBuilder()
    .setDescription(
      "Ce procédé appelé OAuth permet à AchilleaBot :\n" +
        "- De récupérer votre identifiant Twitch \n" +
        "- De récupérer l'adresse mail utilisée pour créer le compte Twitch\n" +
        "\n" +
        "__AchilleaBot ne reçoit et ne stocke que l'identifiant Twitch.__\n" +
        "\n\n" +
        "**Pour quoi faire ?**\n" +
        "__Pour pouvoir vous mettre en avant lorsque vous streamez, le bot a besoin de cet identifiant pour interroger Twitch sur votre statut.__" +
        '\nEn effet, pour pouvoir demander à Twitch *"Monsieur X est-il en stream ?"*, il nous faut un moyen de lui indiquer de quel Monsieur X nous parlons !\n' +
        "\n\n" +
        "**Toujours pas convaincu ?**\n" +
        "[L'article 15 du RGPD](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3#Article15) nous impose un devoir de transparence quant au traitement de vos données.\n" +
        "__Vous pouvez donc à tout moment vous adresser à nous afin de confirmer les données vous concernant et la manière dont elles sont utilisées.__\n",
    )
    .setTitle(`${EMOJI_TWITCH} Twitch - OAuth`)
    .setColor(0x91_46_ff)
    .setFooter({
      text: "Powered by alessss_",
      iconURL:
        "https://cdn.discordapp.com/avatars/238660901375442954/00febf9a57a91e1f922411b0531a9684",
    })
    .setTimestamp(new Date());
}

/** `OAuthService.OAuthButtons(url)` : lien Twitch + refus (`dismiss-message`). */
export function boutonsOAuthTwitch(
  url: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Me connecter à Twitch")
      .setStyle(ButtonStyle.Link)
      .setURL(url)
      .setEmoji(EMOJI_TWITCH),
    new ButtonBuilder()
      .setLabel("Je refuse la connexion")
      .setStyle(ButtonStyle.Danger)
      .setCustomId("dismiss-message")
      .setEmoji("🙅‍♂️"),
  );
}

@Discord()
export class CommandeCarteJoueur {
  @Slash({
    name: "player-card",
    description: "Génère ta carte joueur Achilléa (ou celle d'un autre joueur)",
  })
  async carte(
    @SlashOption({
      name: "user",
      description: "Le joueur ciblé (vide = toi)",
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
      (c) => c.users.get(cible.id),
      `Utilisateur \`${cible.id}\` introuvable en base`,
    );
    if (!joueur) return;
    const png = await appelApi(
      interaction,
      (c) => c.users.card(cible.id),
      "Génération de la carte impossible",
    );
    if (!png) return;
    await interaction.editReply({
      content: `Carte joueur de **${echapper(joueur.rgProfileUsername ?? joueur.username)}**`,
      files: [
        new AttachmentBuilder(Buffer.from(png), {
          name: `player-${cible.id}-card.png`,
        }),
      ],
    });
  }
}

@Discord()
export class CommandeListeNoire {
  @Slash({
    name: "blacklist",
    description: "Consulter la liste noire Achilléa",
  })
  async blacklist(
    @SlashOption({
      name: "user",
      description: "Joueur à vérifier (vide = toute la liste)",
      type: ApplicationCommandOptionType.User,
      required: false,
    })
    brut: User | GuildMember | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();
    if (brut) {
      const cible = utilisateurDe(brut);
      const statut = await appelApi(
        interaction,
        (c) => c.blacklist.get(cible.id),
        "Impossible de trouver cet utilisateur",
      );
      if (!statut) return;
      if (!statut.entry) {
        await interaction.editReply({
          embeds: [
            embedEchecLegacy(
              `L'utilisateur ${cible.displayName ?? cible.username} n'est pas sur la liste noire`,
            ),
          ],
        });
        return;
      }
      await interaction.editReply({ embeds: [ficheListeNoire(statut.entry)] });
      return;
    }
    const liste = await appelApi(
      interaction,
      (c) => c.blacklist.list(),
      "Liste noire illisible",
    );
    if (!liste) return;
    await interaction.editReply({ content: texteListeNoire(liste.data) });
  }
}

type EntreeListeNoire = {
  userId: string;
  displayName: string;
  username?: string | null;
  reason?: string | null;
  since?: string | Date | null;
};

/** `blacklistedUserEmbed` de l'ancien bot. */
export function ficheListeNoire(entree: EntreeListeNoire): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COULEURS_LEGACY.presqueNoir)
    .setTitle(`${entree.displayName} - Liste Noire`.slice(0, 256))
    .setDescription(
      `**Raison:** ${
        entree.reason ||
        "Cet utilisateur est présent sur la Liste Noire d'Achillea sur décision des Administrateurs."
      }`.slice(0, 4096),
    )
    .addFields(
      { name: "Identifiant", value: `${entree.userId}`, inline: true },
      {
        name: "Nom d'utilisateur",
        value: `${entree.username ?? "—"}`,
        inline: true,
      },
      {
        name: "Depuis le",
        value: dateFrancaiseLegacy(entree.since),
        inline: true,
      },
    )
    .setTimestamp();
}

/** Liste complète, en texte brut comme l'ancien bot (bornée aux 2 000 caractères d'un message). */
export function texteListeNoire(entrees: readonly EntreeListeNoire[]): string {
  if (entrees.length === 0)
    return "Il n'y a aucun utilisateur sur la liste noire.";
  const lignes = entrees
    .map((e) => `- ${e.userId}: ${e.displayName} (${e.username ?? "—"})`)
    .join("\n");
  return `Liste des utilisateurs sur la liste noire:\n${lignes}`.slice(0, 2000);
}
