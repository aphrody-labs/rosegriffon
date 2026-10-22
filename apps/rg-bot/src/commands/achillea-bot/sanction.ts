/**
 * `/sanction` — sanctions de modération Achilléa (warn, mute, kick, ban, list, revoke).
 *
 * Port de `SanctionCommands` de l'ancien bot. L'ordre ne change pas : la
 * sanction est d'abord ENREGISTRÉE par l'API, au nom du modérateur (c'est elle
 * qui vérifie son rôle), puis son effet est appliqué sur Discord (timeout,
 * expulsion, bannissement). Un effet Discord qui échoue ne défait pas la
 * sanction : la réponse dit les deux choses, la trace reste en base.
 *
 * L'escalade automatique (3 avertissements actifs → mute 1 h, 5 → 24 h,
 * 8 → ban 7 j) est décidée par `evaluateEscalation` d'`achillea-core` sur la
 * liste rendue par l'API, puis émise comme une sanction ordinaire.
 *
 * La levée automatique à l'expiration (mute, ban temporaire) ne dépend plus
 * d'une file BullMQ du bot : c'est la tâche cron `achillea:sanctions`.
 */
import { SanctionType } from "@rosegriffon/achillea-core";
import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
} from "discord.js";

import { appelApi, lireApi } from "../../lib/achillea-ui";
import {
  appliquerEffet,
  DUREE_MAX_MUTE_S,
  effetDeRevocation,
  effetDeSanction,
  escaladeApres,
  formaterDureeCourte,
  horodatage,
  lireDuree,
  utilisateurDe,
  type Sanction,
  type ServeurModerable,
} from "../../lib/achillea-moderation";
import { echapper, echec, fiche, piedDeCommande, repondre } from "../../lib/ui";

/** Serveur Discord où appliquer l'effet, ou `null` hors serveur. */
async function serveurDe(interaction: ChatInputCommandInteraction, guildId: string): Promise<ServeurModerable | null> {
  try {
    return (await interaction.client.guilds.fetch(guildId)) as unknown as ServeurModerable;
  } catch {
    return null;
  }
}

/** Applique l'effet ; rend `null` si tout va bien, sinon la phrase d'échec. */
async function effet(
  interaction: ChatInputCommandInteraction,
  sanction: Sanction,
  revocation = false,
): Promise<string | null> {
  const voulu = revocation ? effetDeRevocation(sanction) : effetDeSanction(sanction);
  if (voulu.action === "aucun") return null;
  const serveur = await serveurDe(interaction, sanction.guildId);
  if (!serveur) return "le bot n'a pas accès à ce serveur";
  try {
    await appliquerEffet(
      serveur,
      sanction.userId,
      voulu,
      revocation ? `Sanction ${sanction.id} révoquée` : (sanction.reason ?? undefined),
    );
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** Contrôles communs à toute sanction. Rend vrai si la cible est sanctionnable. */
async function cibleValide(interaction: ChatInputCommandInteraction, cible: User, verbe: string): Promise<boolean> {
  if (!interaction.guildId) {
    await repondre(interaction, echec("Sanction impossible", "Cette commande s'utilise sur un serveur."));
    return false;
  }
  if (cible.id === interaction.user.id) {
    await repondre(interaction, echec("Sanction impossible", "Vous ne pouvez pas vous sanctionner vous-même."));
    return false;
  }
  if (cible.bot) {
    await repondre(interaction, echec("Sanction impossible", `Impossible de ${verbe} un bot.`));
    return false;
  }
  return true;
}

function ligneUtilisateur(cible: User): string {
  return `<@${cible.id}> (${echapper(cible.username)})`;
}

@Discord()
@SlashGroup({ name: "sanction", description: "Gestion des sanctions de modération" })
@SlashGroup("sanction")
export class CommandeSanction {
  @Slash({ name: "warn", description: "Avertir un utilisateur" })
  async warn(
    @SlashOption({ name: "user", description: "Utilisateur à avertir", type: ApplicationCommandOptionType.User, required: true })
    brut: User | GuildMember,
    @SlashOption({ name: "reason", description: "Raison de l'avertissement", type: ApplicationCommandOptionType.String, required: true })
    raison: string,
    @SlashOption({ name: "evidence", description: "Preuve / note libre (optionnel)", type: ApplicationCommandOptionType.String, required: false })
    preuve: string | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();
    const cible = utilisateurDe(brut);
    if (!(await cibleValide(interaction, cible, "avertir"))) return;
    const guildId = interaction.guildId as string;

    const sanction = await appelApi(
      interaction,
      c =>
        c.sanctions.create({
          type: SanctionType.Warn,
          userId: cible.id,
          guildId,
          reason: raison,
          evidence: preuve ? [{ note: preuve }] : null,
        }),
      "Avertissement refusé",
    );
    if (!sanction) return;

    const embed = fiche({ intention: "attention", icone: "⚠️", titre: "Avertissement émis" })
      .champ("Utilisateur", ligneUtilisateur(cible), { enLigne: true })
      .champ("ID sanction", `\`${sanction.id}\``, { enLigne: true })
      .champ("Raison", raison)
      .finir();

    // Escalade : relue sur la liste de l'API, jamais bloquante pour l'avertissement lui-même.
    const historique = await sanctionsActives(interaction, cible.id, guildId);
    const decision = historique ? escaladeApres(historique) : null;
    if (decision) {
      const escalade = await appelApi(
        interaction,
        c =>
          c.sanctions.create({
            type: decision.type,
            userId: cible.id,
            guildId,
            reason: `Escalade automatique après ${decision.avertissements} avertissements actifs`,
            durationSec: decision.durationSec,
          }),
        "Escalade automatique refusée",
      );
      if (!escalade) return;
      const probleme = await effet(interaction, escalade);
      const libelle = escalade.type === "ban" ? "ban" : "mute";
      const duree = escalade.durationSec ? ` ${formaterDureeCourte(escalade.durationSec)}` : "";
      embed.addFields({
        name: "Escalade automatique",
        value:
          `⚠️ ${decision.avertissements} warns actifs → ${libelle}${duree} automatique (ID \`${escalade.id}\`)` +
          (probleme ? `\nEffet Discord échoué : ${probleme}` : ""),
      });
    }
    piedDeCommande(embed, interaction);
    await interaction.editReply({ embeds: [embed] });
  }

  @Slash({ name: "mute", description: "Rendre silencieux un utilisateur" })
  async mute(
    @SlashOption({ name: "user", description: "Utilisateur à mute", type: ApplicationCommandOptionType.User, required: true })
    brut: User | GuildMember,
    @SlashOption({ name: "reason", description: "Raison", type: ApplicationCommandOptionType.String, required: true })
    raison: string,
    @SlashOption({ name: "duration", description: "Durée (ex: 30m, 2h, 7d) — max 28j", type: ApplicationCommandOptionType.String, required: true })
    dureeBrute: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();
    const cible = utilisateurDe(brut);
    if (!(await cibleValide(interaction, cible, "mute"))) return;
    const duree = lireDuree(dureeBrute);
    if (!duree) {
      await repondre(interaction, echec("Durée invalide", `\`${dureeBrute}\` : exemples valides \`30m\`, \`2h\`, \`7d\`.`));
      return;
    }
    if (duree > DUREE_MAX_MUTE_S) {
      await repondre(interaction, echec("Durée trop longue", "La durée maximale d'un mute Discord est de 28 jours."));
      return;
    }
    await this.emettre(interaction, cible, SanctionType.Mute, raison, duree, {
      titre: "Mute appliqué",
      icone: "🔇",
      echecEffet: "effet Discord échoué",
    });
  }

  @Slash({ name: "kick", description: "Expulser un utilisateur du serveur" })
  async kick(
    @SlashOption({ name: "user", description: "Utilisateur à expulser", type: ApplicationCommandOptionType.User, required: true })
    brut: User | GuildMember,
    @SlashOption({ name: "reason", description: "Raison", type: ApplicationCommandOptionType.String, required: true })
    raison: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();
    const cible = utilisateurDe(brut);
    if (!(await cibleValide(interaction, cible, "kick"))) return;
    await this.emettre(interaction, cible, SanctionType.Kick, raison, null, {
      titre: "Utilisateur expulsé",
      icone: "👢",
      echecEffet: "expulsion échouée",
    });
  }

  @Slash({ name: "ban", description: "Bannir un utilisateur du serveur" })
  async ban(
    @SlashOption({ name: "user", description: "Utilisateur à bannir", type: ApplicationCommandOptionType.User, required: true })
    brut: User | GuildMember,
    @SlashOption({ name: "reason", description: "Raison", type: ApplicationCommandOptionType.String, required: true })
    raison: string,
    @SlashOption({ name: "duration", description: "Durée (ex: 7d, 30d) — permanent si absent", type: ApplicationCommandOptionType.String, required: false })
    dureeBrute: string | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();
    const cible = utilisateurDe(brut);
    if (!(await cibleValide(interaction, cible, "bannir"))) return;
    let duree: number | null = null;
    if (dureeBrute) {
      duree = lireDuree(dureeBrute);
      if (!duree) {
        await repondre(interaction, echec("Durée invalide", `\`${dureeBrute}\` : exemples valides \`7d\`, \`30d\`.`));
        return;
      }
    }
    await this.emettre(interaction, cible, SanctionType.Ban, raison, duree, {
      titre: "Utilisateur banni",
      icone: "🔨",
      echecEffet: "bannissement Discord échoué",
    });
  }

  @Slash({ name: "list", description: "Lister les sanctions actives d'un utilisateur" })
  async list(
    @SlashOption({ name: "user", description: "Utilisateur à consulter", type: ApplicationCommandOptionType.User, required: true })
    brut: User | GuildMember,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();
    const cible = utilisateurDe(brut);
    const page = await appelApi(
      interaction,
      c => c.sanctions.list({ userId: cible.id, guildId: interaction.guildId ?? undefined, active: true, pageSize: 100 }),
      "Sanctions illisibles",
    );
    if (!page) return;
    const sanctions = page.data;
    const titre = `${echapper(cible.username)} — Sanctions actives${sanctions.length ? ` (${sanctions.length})` : ""}`;
    if (sanctions.length === 0) {
      const embed = fiche({ intention: "succes", titre, description: "Aucune sanction active." }).finir();
      await interaction.editReply({ embeds: [piedDeCommande(embed, interaction)] });
      return;
    }
    const MAX = 20;
    const vus = sanctions.slice(0, MAX);
    const embed = fiche({ intention: "attention", titre, description: `<@${cible.id}>` })
      .champ("Type", vus.map(s => s.type).join("\n"), { enLigne: true })
      .champ("Raison", vus.map(s => (s.reason ? s.reason.slice(0, 40) : "—")).join("\n"), { enLigne: true })
      .champ("Durée", vus.map(s => (s.durationSec ? formaterDureeCourte(s.durationSec) : "—")).join("\n"), { enLigne: true })
      .champ("Expire", vus.map(s => horodatage(s.expiresAt, "R")).join("\n"), { enLigne: true })
      .champ("ID", vus.map(s => `\`${s.id}\``).join("\n"), { enLigne: true })
      .finir();
    piedDeCommande(embed, interaction, {
      note: sanctions.length > MAX ? `… et ${sanctions.length - MAX} autre(s) non affichée(s)` : null,
    });
    await interaction.editReply({ embeds: [embed] });
  }

  @Slash({ name: "revoke", description: "Révoquer une sanction par son ID" })
  async revoke(
    @SlashOption({ name: "id", description: "UUID de la sanction à révoquer", type: ApplicationCommandOptionType.String, required: true })
    id: string,
    @SlashOption({ name: "reason", description: "Raison de la révocation", type: ApplicationCommandOptionType.String, required: true })
    raison: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();
    const sanction = await appelApi(interaction, c => c.sanctions.revoke(id.trim(), raison), "Révocation refusée");
    if (!sanction) return;
    const probleme = await effet(interaction, sanction, true);
    const embed = fiche({ intention: "succes", titre: "Sanction révoquée" })
      .champ("ID sanction", `\`${sanction.id}\``, { enLigne: true })
      .champ("Type", sanction.type, { enLigne: true })
      .champ("Utilisateur", `<@${sanction.userId}>`, { enLigne: true })
      .champ("Raison de révocation", raison)
      .finir();
    if (probleme) embed.addFields({ name: "Effet Discord", value: `Révoquée en base mais effet Discord échoué : ${probleme}` });
    await interaction.editReply({ embeds: [piedDeCommande(embed, interaction)] });
  }

  /** Enregistre la sanction, applique son effet, rend compte. */
  private async emettre(
    interaction: ChatInputCommandInteraction,
    cible: User,
    type: SanctionType,
    raison: string,
    duree: number | null,
    textes: { titre: string; icone: string; echecEffet: string },
  ): Promise<void> {
    const guildId = interaction.guildId as string;
    const sanction = await appelApi(
      interaction,
      c => c.sanctions.create({ type, userId: cible.id, guildId, reason: raison, durationSec: duree }),
      "Sanction refusée",
    );
    if (!sanction) return;
    const probleme = await effet(interaction, sanction);
    if (probleme) {
      await repondre(
        interaction,
        echec("Effet Discord échoué", `Sanction enregistrée (\`${sanction.id}\`) mais ${textes.echecEffet} : ${probleme}`),
      );
      return;
    }
    const embed = fiche({ intention: "echec", icone: textes.icone, titre: textes.titre })
      .champ("Utilisateur", ligneUtilisateur(cible), { enLigne: true });
    if (type !== SanctionType.Kick)
      embed.champ("Durée", sanction.durationSec ? formaterDureeCourte(sanction.durationSec) : "Permanent", { enLigne: true });
    embed.champ("Raison", raison).champ("ID sanction", `\`${sanction.id}\``, { enLigne: true });
    if (type !== SanctionType.Kick)
      embed.champ("Expire le", sanction.expiresAt ? horodatage(sanction.expiresAt) : "Jamais", { enLigne: true });
    await interaction.editReply({ embeds: [piedDeCommande(embed.finir(), interaction)] });
  }
}

/** Sanctions actives d'un joueur, sans rien afficher si la lecture échoue (l'escalade est facultative). */
async function sanctionsActives(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string,
): Promise<Sanction[] | null> {
  const lu = await lireApi(interaction, c =>
    c.sanctions.list({ userId, guildId, type: SanctionType.Warn, active: true, pageSize: 100 }),
  );
  if (!lu.ok) {
    console.warn(`[sanction] escalade non évaluée pour ${userId} : ${lu.motif}`);
    return null;
  }
  return lu.valeur.data;
}
