/**
 * `/interclan` — défis entre clans (profil Achilléa).
 *
 * Port de `InterclanCommand` de l'ancien bot (`/interclan request`), plus deux
 * lectures qui manquaient sur Discord et existaient sur le site :
 *
 *   /interclan request sigle date [motif]   défier un clan (Vice-Président+)
 *   /interclan liste [tous]                 interclans de son clan (ou tous)
 *   /interclan infos id                     fiche + boutons d'action selon l'état
 *
 * Tout passe par l'API au nom de l'auteur (`/interclans`) : droits, conflits
 * d'agenda et lecture de la date (« JJ/MM HH:MM », heure de Paris) sont tranchés
 * là-bas, exactement comme pour le site. Les boutons des messages vivent dans
 * `composants-interclan.ts`.
 *
 * L'ancien bot gardait cette commande derrière la garde `Disabled` : elle est
 * désormais ouverte, l'API portant toutes les vérifications.
 */
import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction, type InteractionEditReplyOptions } from "discord.js";

import { messagePourEtat, quand, type DetailInterclan } from "../../api/modules/achillea/interclans/messages";
import { appelApi } from "../../lib/achillea-ui";
import { differerEnPrive, fiche, piedDeCommande, repondre, succes, vide } from "../../lib/ui";

/** Charge Discord brute (embeds et composants JSON de l'API) acceptée par `editReply`. */
export function chargeBrute(message: { content?: string; embeds?: unknown[]; components?: unknown[] }): InteractionEditReplyOptions {
  return { content: message.content ?? "", embeds: message.embeds ?? [], components: message.components ?? [] } as InteractionEditReplyOptions;
}

/** Ligne de liste : `#12 · ABC vs XYZ · <date> · état`. */
export function ligneInterclan(i: {
  id: number;
  clanA: { shortName: string };
  clanB: { shortName: string };
  fixedDate: Date | string;
  stateLabel: string;
}): string {
  return `\`#${i.id}\` · **${i.clanA.shortName}** vs **${i.clanB.shortName}** · ${quand(i.fixedDate, "f")} · ${i.stateLabel}`;
}

@Discord()
@SlashGroup({ name: "interclan", description: "Gestion des interclans" })
@SlashGroup("interclan")
export class InterclanCommande {
  @Slash({ name: "request", description: "Défier un clan rival (délai max. de 7 jours)" })
  async request(
    @SlashOption({
      name: "sigle",
      description: "Le sigle du Clan recherché",
      type: ApplicationCommandOptionType.String,
      required: true,
      maxLength: 20,
    })
    sigle: string,
    @SlashOption({
      name: "date",
      description: "La date et l'heure du défi au format JJ/mm HH:MM (heure de Paris)",
      type: ApplicationCommandOptionType.String,
      required: true,
      maxLength: 20,
    })
    date: string,
    @SlashOption({
      name: "motif",
      description: "Une raison/message à déclarer au clan défié",
      type: ApplicationCommandOptionType.String,
      required: false,
      maxLength: 1000,
    })
    motif: string | undefined,
    interaction: ChatInputCommandInteraction,
  ) {
    await differerEnPrive(interaction);
    const detail = await appelApi(
      interaction,
      c => c.interclans.create({ challengedShortName: sigle, date, motif: motif ?? null }),
      "Défi impossible",
    );
    if (!detail) return;
    await repondre(
      interaction,
      succes(
        `Proposition d'Interclan envoyée avec succès au Clan ${detail.clanB.name}`,
        `Rencontre proposée ${quand(detail.fixedDate)}. Le clan défié a 24 h pour répondre dans son salon.`,
        { prive: true, note: `Interclan #${detail.id}` },
      ),
    );
  }

  @Slash({ name: "liste", description: "Les interclans de ton clan (ou de tous les clans)" })
  async liste(
    @SlashOption({
      name: "tous",
      description: "Afficher les interclans de tous les clans",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    tous: boolean | undefined,
    interaction: ChatInputCommandInteraction,
  ) {
    await differerEnPrive(interaction);
    const page = await appelApi(interaction, c => c.interclans.list(tous ? { limit: 20 } : { mine: true, limit: 20 }), "Liste indisponible");
    if (!page) return;
    if (page.data.length === 0) {
      await repondre(
        interaction,
        vide(
          "Aucun interclan",
          tous ? "Aucun clan n'a encore lancé de défi." : "Ton clan n'a aucun interclan. Lance un défi avec `/interclan request`.",
          { prive: true },
        ),
      );
      return;
    }
    const embed = fiche({ titre: tous ? "Interclans" : "Interclans de ton clan", intention: "marque", icone: "🏆" })
      .description(page.data.map(ligneInterclan).join("\n"))
      .finir();
    piedDeCommande(embed, interaction, { note: "Détail : /interclan infos" });
    await interaction.editReply({ embeds: [embed] });
  }

  @Slash({ name: "infos", description: "Fiche d'un interclan, avec ses actions selon l'état" })
  async infos(
    @SlashOption({
      name: "id",
      description: "Identifiant de l'interclan (voir /interclan liste)",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      minValue: 1,
    })
    id: number,
    interaction: ChatInputCommandInteraction,
  ) {
    await differerEnPrive(interaction);
    const detail: DetailInterclan | null = await appelApi(interaction, c => c.interclans.get(id), "Interclan introuvable");
    if (!detail) return;
    await interaction.editReply(chargeBrute(messagePourEtat(detail)));
  }
}
