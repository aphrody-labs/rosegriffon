/**
 * `/ranked-admin` — arbitrage des matchs classés (litiges, valider, annuler, logs).
 *
 * Port de `RankedAdminCommands`. L'ancien bot appelait le sous-processus
 * ranked avec un secret interne et vérifiait lui-même le rôle de l'appelant
 * en base ; ici chaque action passe par les routes d'administration ranked de
 * l'API, au nom de l'arbitre : lecture Modérateur+, actions Administrateur+,
 * décidées par l'API et par elle seule. Aucune logique Elo dans le bot.
 */
import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
} from "discord.js";

import { appelApi } from "../../lib/achillea-ui";
import { horodatage, libelleMode, lienCapture, signe, utilisateurDe } from "../../lib/achillea-moderation";
import { echapper, fiche, piedDeCommande } from "../../lib/ui";

/** Origine publique du ranked, qui sert les captures de litige (`/storage/disputes/*`). */
export function origineRanked(env: Record<string, string | undefined> = Bun.env): string {
  return (env.RANKED_PUBLIC_URL ?? "https://ranked.rosegriffon.fr").replace(/\/$/u, "");
}

@Discord()
@SlashGroup({ name: "ranked-admin", description: "Arbitrage des matchs classés (staff)" })
@SlashGroup("ranked-admin")
export class CommandeRankedAdmin {
  @Slash({ name: "litiges", description: "Lister les litiges ranked en attente d'arbitrage" })
  async litiges(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const litiges = await appelApi(interaction, c => c.ranked.adminDisputes(), "Litiges illisibles");
    if (!litiges) return;
    if (litiges.length === 0) {
      const embed = fiche({ intention: "succes", icone: "🎖️", titre: "Litiges ranked", description: "Aucun litige en attente. ✅" }).finir();
      await interaction.editReply({ embeds: [piedDeCommande(embed, interaction)] });
      return;
    }
    const origine = origineRanked();
    const vus = litiges.slice(0, 10);
    const embed = fiche({
      intention: "attention",
      icone: "🎖️",
      titre: `Litiges ranked en attente (${litiges.length})`,
      description: "Utilisez `/ranked-admin valider` ou `/ranked-admin annuler` avec l'ID du lobby.",
    });
    for (const litige of vus) {
      const joueur = (p: (typeof litige)["player1"]) =>
        `**${echapper(p.displayName)}** (<@${p.userId}>)\n→ a annoncé **${p.submittedScore}** · adverse réclamé **${p.claimedOpponentScore ?? "—"}** · ${lienCapture(p.screenshotUrl, origine)}`;
      embed.champ(
        `🆔 Lobby #${litige.lobbyId} — ${libelleMode(litige.mode)}`,
        `${joueur(litige.player1)}\n${joueur(litige.player2)}\nCréé ${horodatage(litige.createdAt, "R")}`.slice(0, 1024),
      );
    }
    await interaction.editReply({
      embeds: [
        piedDeCommande(embed.finir(), interaction, {
          note: litiges.length > vus.length ? `… et ${litiges.length - vus.length} autre(s) litige(s)` : null,
        }),
      ],
    });
  }

  @Slash({ name: "valider", description: "Trancher un litige : appliquer un score et l'ELO" })
  async valider(
    @SlashOption({ name: "lobby", description: "ID du lobby à trancher", type: ApplicationCommandOptionType.Integer, required: true, minValue: 1 })
    lobbyId: number,
    @SlashOption({ name: "score1", description: "Score de l'équipe 1 (joueur 1)", type: ApplicationCommandOptionType.Integer, required: true, minValue: 0, maxValue: 99 })
    score1: number,
    @SlashOption({ name: "score2", description: "Score de l'équipe 2 (joueur 2)", type: ApplicationCommandOptionType.Integer, required: true, minValue: 0, maxValue: 99 })
    score2: number,
    @SlashOption({ name: "forfait", description: "Joueur déclaré forfait (optionnel)", type: ApplicationCommandOptionType.User, required: false })
    forfait: User | GuildMember | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const forfeitUserId = forfait ? utilisateurDe(forfait).id : undefined;
    const resultat = await appelApi(
      interaction,
      c =>
        c.ranked.adminValidateLobby(lobbyId, {
          scoreTeam1: score1,
          scoreTeam2: score2,
          ...(forfeitUserId ? { forfeitUserId } : {}),
        }),
      `Validation du lobby #${lobbyId} refusée`,
    );
    if (!resultat) return;
    const embed = fiche({ intention: "succes", titre: `Litige tranché — Lobby #${lobbyId}` })
      .champ("Score appliqué", `**${score1}** — **${score2}**`, { enLigne: true })
      .champ("ΔELO", resultat.eloDelta === undefined ? "—" : signe(resultat.eloDelta), { enLigne: true })
      .champ("Forfait", forfeitUserId ? `<@${forfeitUserId}>` : "Aucun")
      .champ("Arbitre", `<@${interaction.user.id}>`)
      .finir();
    await interaction.editReply({ embeds: [piedDeCommande(embed, interaction)] });
  }

  @Slash({ name: "annuler", description: "Annuler un match (aucun ELO appliqué)" })
  async annuler(
    @SlashOption({ name: "lobby", description: "ID du lobby à annuler", type: ApplicationCommandOptionType.Integer, required: true, minValue: 1 })
    lobbyId: number,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const resultat = await appelApi(interaction, c => c.ranked.adminCancelLobby(lobbyId), `Annulation du lobby #${lobbyId} refusée`);
    if (!resultat) return;
    const embed = fiche({
      intention: "echec",
      icone: "🚫",
      titre: `Match annulé — Lobby #${lobbyId}`,
      description: "Aucun point d'ELO n'a été appliqué.",
    })
      .champ("Arbitre", `<@${interaction.user.id}>`)
      .finir();
    await interaction.editReply({ embeds: [piedDeCommande(embed, interaction)] });
  }

  @Slash({ name: "logs", description: "Consulter le journal des événements ranked" })
  async logs(
    @SlashOption({ name: "lobby", description: "Filtrer par ID de lobby (optionnel)", type: ApplicationCommandOptionType.Integer, required: false, minValue: 1 })
    lobbyId: number | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const limite = 15;
    const evenements = await appelApi(
      interaction,
      c => c.ranked.adminTelemetry({ limit: limite, ...(lobbyId != null ? { lobbyId } : {}) }),
      "Journal ranked illisible",
    );
    if (!evenements) return;
    const portee = lobbyId != null ? ` — Lobby #${lobbyId}` : "";
    const lignes = evenements.slice(0, limite).map(e => {
      const acteur = e.displayName ? echapper(e.displayName) : e.userId ? `<@${e.userId}>` : "système";
      const lobby = lobbyId == null && e.lobbyId != null ? ` · lobby #${e.lobbyId}` : "";
      return `${horodatage(e.createdAt, "t")} · \`${e.type}\` · ${acteur}${lobby}`;
    });
    const embed = fiche({
      intention: "info",
      icone: "📜",
      titre: `Journal ranked${portee}`,
      description: lignes.length ? lignes.join("\n").slice(0, 4000) : "Aucun événement.",
    }).finir();
    await interaction.editReply({
      embeds: [piedDeCommande(embed, interaction, { note: `${evenements.length} dernier(s) événement(s)` })],
    });
  }
}
