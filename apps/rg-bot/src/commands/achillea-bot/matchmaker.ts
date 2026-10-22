/**
 * Boutons de l'ancienne file ranked Discord : `join_queue:*`, `leave_queue:*`,
 * `confirm_presence:*`.
 *
 * L'ancien bot tenait la file dans son propre processus (événements `Ranked`,
 * BullMQ, appel de présence). Le ranked vit désormais sur le site : file
 * temps réel Colyseus, matchs, preuves et Elo dans l'API. Les messages déjà
 * publiés portent encore ces boutons ; ils font donc ce que la file actuelle
 * permet depuis Discord :
 *
 *   - `join_queue:<id>` crée un DÉFI classé au nom du joueur
 *     (`POST /ranked/challenge`) : un lien qu'il partage, et que le premier
 *     adversaire qui l'ouvre accepte — l'équivalent d'une file à deux places —,
 *     avec le lien de la file du site. La réponse porte un bouton
 *     `leave_queue:<code>` pour retirer ce défi ;
 *   - `leave_queue:<code>` annule le défi (`DELETE /ranked/challenge/:code`) ;
 *     sur un ancien message (`leave_queue:<identifiant numérique>`), il n'y a
 *     plus de file Discord à quitter : la réponse le dit et renvoie au site ;
 *   - `confirm_presence:<lobby>` : la présence se confirme en rejoignant la
 *     salle du match, qui seule sait si les deux joueurs sont là.
 */
import { ButtonComponent, Discord } from "discordx";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import { appelApi, urlAchillea } from "../../lib/achillea-ui";
import { horodatage } from "../../lib/achillea-moderation";
import { boutonLien, info, repondre, succes } from "../../lib/ui";

/** Code de défi : jamais purement numérique (les anciens identifiants de file l'étaient). */
export function estCodeDefi(valeur: string): boolean {
  return /^[A-Za-z0-9_-]{4,64}$/u.test(valeur) && !/^\d+$/u.test(valeur);
}

/** Partie après le premier `:` d'un `custom_id`. */
export function suffixe(customId: string): string {
  return customId.slice(customId.indexOf(":") + 1);
}

@Discord()
export class BoutonsFileRanked {
  @ButtonComponent({ id: /^join_queue:.+/ })
  async rejoindre(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const defi = await appelApi(interaction, c => c.ranked.createChallenge({ ranked: true }), "Défi ranked impossible");
    if (!defi) return;
    const charge = succes(
      "Défi classé ouvert",
      [
        "La file ranked se joue désormais sur le site. Ton défi est prêt : partage le lien, le premier adversaire qui l'ouvre lance le match.",
        `**Lien :** ${defi.url}`,
        `Expire ${horodatage(new Date(defi.expiresAt), "R")}.`,
      ].join("\n"),
    );
    await interaction.editReply({
      ...charge,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          boutonLien({ libelle: "File ranked du site", url: urlAchillea("/ranked") }),
          new ButtonBuilder().setCustomId(`leave_queue:${defi.code}`).setLabel("Retirer mon défi").setStyle(ButtonStyle.Danger),
        ),
      ],
    });
  }

  @ButtonComponent({ id: /^leave_queue:.+/ })
  async quitter(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const code = suffixe(interaction.customId);
    if (!estCodeDefi(code)) {
      await repondre(
        interaction,
        info(
          "Plus de file Discord",
          `Cette file a été remplacée par la file ranked du site : il n'y a rien à quitter ici. ${urlAchillea("/ranked")}`,
        ),
      );
      return;
    }
    const resultat = await appelApi(interaction, c => c.ranked.cancelChallenge(code), "Retrait du défi impossible");
    if (!resultat) return;
    await repondre(interaction, succes("Défi retiré", "Ton défi classé a été annulé ; son lien ne mène plus à aucun match."));
  }

  @ButtonComponent({ id: /^confirm_presence:.+/ })
  async confirmerPresence(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const profil = await appelApi(interaction, c => c.ranked.me(), "Profil ranked introuvable");
    if (!profil) return;
    await interaction.editReply({
      ...info(
        "Présence au match",
        "La présence se confirme en rejoignant la salle du match sur le site : c'est elle qui vérifie que les deux joueurs sont là et lance le chronomètre.",
      ),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(boutonLien({ libelle: "Rejoindre mon match", url: urlAchillea("/ranked/match") })),
      ],
    });
  }
}
