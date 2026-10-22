/**
 * `/achillea-admin` — le back-office Achilléa dans Discord.
 *
 * Tout ce que fait le BO du site (`/achillea/admin`) a ici sa sous-commande :
 * serveurs, système, comptes, saisons, litiges ranked, licences, organisations,
 * sanctions et notes joueur. Aucune règle d'accès n'est écrite dans ce fichier :
 * chaque action appelle la méthode correspondante d'`AchilleaClient` au nom du
 * membre, et c'est l'API qui accepte ou refuse selon son rôle en base — le
 * même refus qu'il aurait obtenu sur le site.
 *
 * Seule exception, le relevé des serveurs : c'est une tâche cron
 * (`achillea:guildes`), lancée dans ce processus par `lancerTache`, après une
 * lecture staff (`/admin/ops/guilds`) qui fait office de garde.
 *
 * Les actions destructrices (réinitialisation d'un ladder, révocations,
 * suppression d'une note, annulation d'un match) demandent une confirmation
 * par bouton, valable 5 minutes et pour le seul auteur.
 */
import { randomUUID } from "node:crypto";
import { ButtonComponent, Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type InteractionEditReplyOptions,
  type User,
} from "discord.js";
import { PlayerNoteSeverity } from "@rosegriffon/achillea-types/enums/eventEnums";
import { OrganizationState } from "@rosegriffon/achillea-types/enums/organization";

import type { AchilleaClientResult, ClientAchilleaDelegue } from "../../lib/achillea-api";
import { appelApi, lireApi } from "../../lib/achillea-ui";
import { attention, differerEnPrive, echec, fiche, info, piedDeCommande, repondre, succes } from "../../lib/ui";
import {
  dateIso,
  LIBELLES_ROLE,
  ligneGuilde,
  ligneLitige,
  ligneNote,
  ligneOrganisation,
  ligneSaison,
  ligneSanction,
  listeBornee,
  quand,
  totalPage,
} from "./admin-format";

// ─── Relevé des serveurs ───────────────────────────────────────────────────

/** Lanceur de la tâche de relevé, remplaçable en test. */
export type LanceurReleve = () => Promise<{ success: boolean; error?: string; duree?: number }>;
const lanceurParDefaut: LanceurReleve = async () => {
  const { lancerTache } = await import("@rosegriffon/cron");
  const resultat = await lancerTache("achillea:guildes", { origine: "manuel" });
  return { success: resultat.success, error: resultat.error };
};
let lanceurReleve: LanceurReleve = lanceurParDefaut;
export function remplacerLanceurReleve(nouveau: LanceurReleve): () => void {
  const precedent = lanceurReleve;
  lanceurReleve = nouveau;
  return () => {
    lanceurReleve = precedent;
  };
}

// ─── Confirmations ──────────────────────────────────────────────────────────

/** Durée de validité d'une demande de confirmation. */
export const DUREE_CONFIRMATION_MS = 5 * 60 * 1000;
export const PREFIXE_CONFIRMATION = "achillea-admin";

interface ActionEnAttente {
  auteur: string;
  expire: number;
  titre: string;
  executer: (client: ClientAchilleaDelegue) => Promise<AchilleaClientResult<unknown>>;
  succes: (valeur: unknown) => string;
}

/** Actions en attente de confirmation, par jeton. Mémoire du processus : un redémarrage les expire. */
export const ACTIONS_EN_ATTENTE = new Map<string, ActionEnAttente>();

function purgerExpirees(maintenant = Date.now()): void {
  for (const [jeton, action] of ACTIONS_EN_ATTENTE) if (action.expire < maintenant) ACTIONS_EN_ATTENTE.delete(jeton);
}

async function demanderConfirmation(
  interaction: ChatInputCommandInteraction,
  titre: string,
  description: string,
  executer: ActionEnAttente["executer"],
  succesTexte: ActionEnAttente["succes"],
): Promise<void> {
  purgerExpirees();
  const jeton = randomUUID().replaceAll("-", "").slice(0, 16);
  ACTIONS_EN_ATTENTE.set(jeton, {
    auteur: interaction.user.id,
    expire: Date.now() + DUREE_CONFIRMATION_MS,
    titre,
    executer,
    succes: succesTexte,
  });
  const charge = attention(`${titre} — confirmation`, `${description}\n\nCette action est irréversible.`, { prive: true });
  await interaction.editReply({
    ...(charge as InteractionEditReplyOptions),
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${PREFIXE_CONFIRMATION}:ok:${jeton}`).setLabel("Confirmer").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`${PREFIXE_CONFIRMATION}:non:${jeton}`).setLabel("Annuler").setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

// ─── Réponses ───────────────────────────────────────────────────────────────

async function liste(interaction: ChatInputCommandInteraction, titre: string, lignes: string[], vide: string, note?: string) {
  const embed = fiche({ titre, intention: "marque" }).description(listeBornee(lignes, vide)).embed;
  piedDeCommande(embed, interaction, { note: note ?? null });
  await interaction.editReply({ embeds: [embed] });
}

async function fait(interaction: ChatInputCommandInteraction, titre: string, description?: string) {
  await repondre(interaction, succes(titre, description, { prive: true }));
}

// ─── Racine ─────────────────────────────────────────────────────────────────

@Discord()
@SlashGroup({ name: "achillea-admin", description: "Back-office Achilléa (staff) — mêmes droits que sur le site" })
export class RacineAchilleaAdmin {
  @ButtonComponent({ id: /^achillea-admin:(ok|non):[a-f0-9]{16}$/ })
  async confirmation(interaction: ButtonInteraction): Promise<void> {
    const [, choix, jeton] = interaction.customId.split(":");
    const action = jeton ? ACTIONS_EN_ATTENTE.get(jeton) : undefined;
    if (!action || action.expire < Date.now()) {
      if (jeton) ACTIONS_EN_ATTENTE.delete(jeton);
      await interaction.update({ ...(echec("Demande expirée", "Relance la commande.") as object), components: [] });
      return;
    }
    if (action.auteur !== interaction.user.id) {
      await interaction.reply(echec("Pas ta demande", "Seul l'auteur de la commande peut la confirmer.") as never);
      return;
    }
    ACTIONS_EN_ATTENTE.delete(jeton!);
    if (choix === "non") {
      await interaction.update({ ...(info("Action annulée", action.titre) as object), components: [] });
      return;
    }
    await interaction.deferUpdate();
    const resultat = await lireApi(interaction, action.executer);
    const charge = resultat.ok ? succes(action.titre, action.succes(resultat.valeur)) : echec(action.titre, resultat.motif);
    await interaction.editReply({ ...(charge as InteractionEditReplyOptions), components: [] });
  }
}

// ─── Serveurs ───────────────────────────────────────────────────────────────

@Discord()
@SlashGroup({ name: "guildes", description: "Serveurs où le bot Achilléa est présent", root: "achillea-admin" })
@SlashGroup("guildes", "achillea-admin")
export class AdminGuildes {
  @Slash({ name: "liste", description: "Serveurs rejoints par le bot, du plus grand au plus petit" })
  async liste(interaction: ChatInputCommandInteraction): Promise<void> {
    await differerEnPrive(interaction);
    const guildes = await appelApi(interaction, c => c.admin.guilds(), "Serveurs indisponibles");
    if (!guildes) return;
    const tries = guildes.data.toSorted((a, b) => b.memberCount - a.memberCount);
    await liste(interaction, `${tries.length} serveur(s)`, tries.map(ligneGuilde), "Le bot n'est sur aucun serveur.");
  }

  @Slash({ name: "invitation", description: "Invitation ponctuelle vers un serveur où le bot est présent" })
  async invitation(
    @SlashOption({ name: "serveur", description: "Identifiant du serveur", type: ApplicationCommandOptionType.String, required: true })
    serveur: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const invitation = await appelApi(interaction, c => c.admin.guildInvite(serveur.trim()), "Invitation impossible");
    if (!invitation) return;
    await fait(interaction, "Invitation créée", invitation.url);
  }

  @Slash({ name: "releve", description: "Relève maintenant les serveurs, rôles et salons (tâche achillea:guildes)" })
  async releve(interaction: ChatInputCommandInteraction): Promise<void> {
    await differerEnPrive(interaction);
    // Garde : seule une lecture staff de l'API autorise à lancer la tâche.
    const garde = await appelApi(interaction, c => c.admin.guilds(), "Relevé refusé");
    if (!garde) return;
    const debut = Date.now();
    const resultat = await lanceurReleve().catch((err: unknown) => ({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }));
    const duree = `${((Date.now() - debut) / 1000).toFixed(1)} s`;
    await repondre(
      interaction,
      resultat.success
        ? succes("Relevé terminé", `Serveurs, rôles et salons relevés en ${duree}.`, { prive: true })
        : echec("Relevé en échec", resultat.error ?? "La tâche n'a pas abouti (voir l'historique des tâches cron)."),
    );
  }
}

// ─── Système ────────────────────────────────────────────────────────────────

@Discord()
@SlashGroup({ name: "systeme", description: "Santé, maintenance et journal du bot Achilléa", root: "achillea-admin" })
@SlashGroup("systeme", "achillea-admin")
export class AdminSysteme {
  @Slash({ name: "sante", description: "État du bot et de l'hôte" })
  async sante(interaction: ChatInputCommandInteraction): Promise<void> {
    await differerEnPrive(interaction);
    const sante = await appelApi(interaction, c => c.admin.health(), "Santé indisponible");
    if (!sante) return;
    const embed = fiche({ titre: "Santé du bot Achilléa", intention: sante.bot.online ? "succes" : "echec" })
      .champ("Passerelle", sante.bot.online ? "🟢 en ligne" : "🔴 hors ligne", { enLigne: true })
      .champ("Identité", sante.bot.username ?? "—", { enLigne: true })
      .champ("Serveurs", String(sante.bot.guilds), { enLigne: true })
      .champ("En ligne depuis", `${Math.round(sante.bot.uptime / 60)} min`, { enLigne: true })
      .champ("Maintenance", sante.bot.maintenance ? "🛠️ activée" : "non", { enLigne: true }).embed;
    piedDeCommande(embed, interaction);
    await interaction.editReply({ embeds: [embed] });
  }

  @Slash({ name: "maintenance", description: "Active ou coupe le mode maintenance (super-administrateur)" })
  async maintenance(
    @SlashOption({ name: "actif", description: "Maintenance activée ?", type: ApplicationCommandOptionType.Boolean, required: true })
    actif: boolean,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const etat = await appelApi(interaction, c => c.admin.setMaintenance(actif), "Maintenance inchangée");
    if (!etat) return;
    await fait(interaction, etat.maintenance ? "Maintenance activée" : "Maintenance coupée");
  }

  @Slash({ name: "journal", description: "Dernières lignes du journal du bot (super-administrateur)" })
  async journal(interaction: ChatInputCommandInteraction): Promise<void> {
    await differerEnPrive(interaction);
    const journal = await appelApi(interaction, c => c.admin.logs(), "Journal indisponible");
    if (!journal) return;
    const texte = journal.data.slice(-40).join("\n").slice(-3_900);
    await repondre(interaction, info("Journal du bot", texte ? `\`\`\`\n${texte.replaceAll("```", "ʼʼʼ")}\n\`\`\`` : "Journal vide.", { prive: true }));
  }

  @Slash({ name: "audit", description: "Dernières actions du journal d'audit (administrateur)" })
  async audit(interaction: ChatInputCommandInteraction): Promise<void> {
    await differerEnPrive(interaction);
    const audit = await appelApi(interaction, c => c.admin.audit(20), "Audit indisponible");
    if (!audit) return;
    const lignes = audit.data.map(
      a => `${quand(a.ts)} · **${a.action}** · ${a.targetType}${a.targetId ? ` \`${a.targetId}\`` : ""}${a.actorId ? ` · <@${a.actorId}>` : ""}`,
    );
    await liste(interaction, "Journal d'audit", lignes, "Aucune entrée.");
  }
}

// ─── Comptes ────────────────────────────────────────────────────────────────

@Discord()
@SlashGroup({ name: "utilisateur", description: "Rôle et portefeuille d'un compte", root: "achillea-admin" })
@SlashGroup("utilisateur", "achillea-admin")
export class AdminUtilisateur {
  @Slash({ name: "role", description: "Change le rôle Achilléa d'un compte (administrateur)" })
  async role(
    @SlashOption({ name: "joueur", description: "Compte visé", type: ApplicationCommandOptionType.User, required: true })
    joueur: User,
    @SlashChoice({ name: "Joueur", value: 0 })
    @SlashChoice({ name: "Modérateur", value: 1 })
    @SlashChoice({ name: "Administrateur", value: 2 })
    @SlashChoice({ name: "Super-administrateur", value: 3 })
    @SlashOption({ name: "role", description: "Nouveau rôle", type: ApplicationCommandOptionType.Integer, required: true })
    role: number,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const resultat = await appelApi(interaction, c => c.admin.setUserRole(joueur.id, role), "Rôle inchangé");
    if (!resultat) return;
    await fait(interaction, "Rôle mis à jour", `<@${joueur.id}> est désormais **${LIBELLES_ROLE[resultat.role] ?? resultat.role}**.`);
  }

  @Slash({ name: "portefeuille", description: "Crédite (> 0) ou débite (< 0) le portefeuille d'un joueur" })
  async portefeuille(
    @SlashOption({ name: "joueur", description: "Joueur visé", type: ApplicationCommandOptionType.User, required: true })
    joueur: User,
    @SlashOption({ name: "montant", description: "Montant signé", type: ApplicationCommandOptionType.Integer, required: true })
    montant: number,
    @SlashOption({ name: "motif", description: "Motif consigné dans le journal", type: ApplicationCommandOptionType.String, required: true })
    motif: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    if (!Number.isInteger(montant) || montant === 0) {
      await repondre(interaction, echec("Montant invalide", "Le montant doit être un entier non nul."));
      return;
    }
    const resultat = await appelApi(interaction, c => c.admin.adjustWallet(joueur.id, montant, motif), "Ajustement refusé");
    if (!resultat) return;
    await fait(interaction, "Portefeuille ajusté", `<@${joueur.id}> : ${montant > 0 ? "+" : ""}${montant} → solde **${resultat.balance}**.`);
  }
}

// ─── Saisons ────────────────────────────────────────────────────────────────

@Discord()
@SlashGroup({ name: "saison", description: "Saisons ranked : création, activation, réinitialisation", root: "achillea-admin" })
@SlashGroup("saison", "achillea-admin")
export class AdminSaison {
  @Slash({ name: "liste", description: "Saisons, de la plus récente à la plus ancienne" })
  async liste(interaction: ChatInputCommandInteraction): Promise<void> {
    await differerEnPrive(interaction);
    const saisons = await appelApi(interaction, c => c.ranked.adminSeasons(), "Saisons indisponibles");
    if (!saisons) return;
    await liste(interaction, "Saisons ranked", saisons.map(ligneSaison), "Aucune saison.");
  }

  @Slash({ name: "creer", description: "Crée une saison à venir" })
  async creer(
    @SlashOption({ name: "nom", description: "Nom de la saison", type: ApplicationCommandOptionType.String, required: true })
    nom: string,
    @SlashOption({ name: "debut", description: "Date de début (AAAA-MM-JJ)", type: ApplicationCommandOptionType.String, required: true })
    debut: string,
    @SlashOption({ name: "fin", description: "Date de fin (AAAA-MM-JJ)", type: ApplicationCommandOptionType.String, required: true })
    fin: string,
    @SlashOption({ name: "k", description: "Facteur K (défaut 32)", type: ApplicationCommandOptionType.Integer, required: false })
    k: number | undefined,
    @SlashOption({ name: "base", description: "Note de base (défaut 1000)", type: ApplicationCommandOptionType.Integer, required: false })
    base: number | undefined,
    @SlashOption({ name: "decroissance", description: "Taux de décroissance (défaut 0)", type: ApplicationCommandOptionType.Number, required: false })
    decroissance: number | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const startsAt = dateIso(debut);
    const endsAt = dateIso(fin);
    if (!startsAt || !endsAt || startsAt >= endsAt) {
      await repondre(interaction, echec("Dates invalides", "Format attendu : AAAA-MM-JJ, la fin après le début."));
      return;
    }
    const saison = await appelApi(
      interaction,
      c =>
        c.ranked.adminCreateSeason({
          name: nom.trim(),
          startsAt,
          endsAt,
          config: { kFactor: k ?? 32, baseRating: base ?? 1000, decayRate: decroissance ?? 0 },
        }),
      "Saison non créée",
    );
    if (!saison) return;
    await fait(interaction, "Saison créée", ligneSaison(saison));
  }

  @Slash({ name: "activer", description: "Active une saison et clôt la précédente" })
  async activer(
    @SlashOption({ name: "id", description: "Identifiant de la saison", type: ApplicationCommandOptionType.String, required: true })
    id: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const saison = await appelApi(interaction, c => c.ranked.adminActivateSeason(id.trim()), "Saison non activée");
    if (!saison) return;
    await fait(interaction, "Saison activée", ligneSaison(saison));
  }

  @Slash({ name: "reinitialiser", description: "Remet le ladder d'une saison à la note de base (confirmation)" })
  async reinitialiser(
    @SlashOption({ name: "id", description: "Identifiant de la saison", type: ApplicationCommandOptionType.String, required: true })
    id: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    await demanderConfirmation(
      interaction,
      "Réinitialisation du ladder",
      `Toutes les notes de la saison \`${id.trim()}\` reviennent à la note de base.`,
      c => c.ranked.adminResetLadder(id.trim()),
      v => `${(v as { affected: number }).affected} joueur(s) réinitialisé(s).`,
    );
  }
}

// ─── Litiges ranked ─────────────────────────────────────────────────────────

@Discord()
@SlashGroup({ name: "litige", description: "Arbitrage des matchs ranked contestés", root: "achillea-admin" })
@SlashGroup("litige", "achillea-admin")
export class AdminLitige {
  @Slash({ name: "liste", description: "Matchs contestés en attente d'arbitrage" })
  async liste(interaction: ChatInputCommandInteraction): Promise<void> {
    await differerEnPrive(interaction);
    const litiges = await appelApi(interaction, c => c.ranked.adminDisputes(), "Litiges indisponibles");
    if (!litiges) return;
    await liste(interaction, `${litiges.length} litige(s)`, litiges.map(ligneLitige), "Aucun litige en attente.");
  }

  @Slash({ name: "valider", description: "Tranche un litige : applique le score et l'Elo" })
  async valider(
    @SlashOption({ name: "lobby", description: "Identifiant du lobby", type: ApplicationCommandOptionType.Integer, required: true })
    lobby: number,
    @SlashOption({ name: "score1", description: "Score de l'équipe 1", type: ApplicationCommandOptionType.Integer, required: true, minValue: 0 })
    score1: number,
    @SlashOption({ name: "score2", description: "Score de l'équipe 2", type: ApplicationCommandOptionType.Integer, required: true, minValue: 0 })
    score2: number,
    @SlashOption({ name: "forfait", description: "Joueur déclaré forfait", type: ApplicationCommandOptionType.User, required: false })
    forfait: User | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const resultat = await appelApi(
      interaction,
      c => c.ranked.adminValidateLobby(lobby, { scoreTeam1: score1, scoreTeam2: score2, ...(forfait ? { forfeitUserId: forfait.id } : {}) }),
      "Validation refusée",
    );
    if (!resultat) return;
    await fait(interaction, "Litige tranché", `Lobby \`${lobby}\` : ${score1} - ${score2}${forfait ? ` (forfait de <@${forfait.id}>)` : ""}.`);
  }

  @Slash({ name: "annuler", description: "Annule un match sans effet Elo (confirmation)" })
  async annuler(
    @SlashOption({ name: "lobby", description: "Identifiant du lobby", type: ApplicationCommandOptionType.Integer, required: true })
    lobby: number,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    await demanderConfirmation(
      interaction,
      "Annulation du match",
      `Le lobby \`${lobby}\` sera annulé, sans aucun effet Elo.`,
      c => c.ranked.adminCancelLobby(lobby),
      () => `Lobby \`${lobby}\` annulé.`,
    );
  }
}

// ─── Licences ───────────────────────────────────────────────────────────────

@Discord()
@SlashGroup({ name: "licence", description: "Licences joueur", root: "achillea-admin" })
@SlashGroup("licence", "achillea-admin")
export class AdminLicence {
  @Slash({ name: "emettre", description: "Émet une licence pour un joueur (administrateur)" })
  async emettre(
    @SlashOption({ name: "joueur", description: "Joueur", type: ApplicationCommandOptionType.User, required: true })
    joueur: User,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const licence = await appelApi(interaction, c => c.licenses.issue(joueur.id), "Licence non émise");
    if (!licence) return;
    await fait(
      interaction,
      "Licence émise",
      `N° **${licence.licenseNumber}** pour <@${joueur.id}>, valable jusqu'au ${quand(licence.validUntil, "D")}.\nIdentifiant : \`${licence.id}\``,
    );
  }

  @Slash({ name: "revoquer", description: "Révoque une licence (confirmation)" })
  async revoquer(
    @SlashOption({ name: "id", description: "Identifiant de la licence", type: ApplicationCommandOptionType.String, required: true })
    id: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    await demanderConfirmation(
      interaction,
      "Révocation de licence",
      `La licence \`${id.trim()}\` sera révoquée.`,
      c => c.licenses.revoke(id.trim()),
      v => `Licence ${(v as { licenseNumber: string }).licenseNumber} révoquée.`,
    );
  }
}

// ─── Organisations ──────────────────────────────────────────────────────────

@Discord()
@SlashGroup({ name: "organisation", description: "Revue des organisations", root: "achillea-admin" })
@SlashGroup("organisation", "achillea-admin")
export class AdminOrganisation {
  @Slash({ name: "attente", description: "Organisations en attente de revue" })
  async attente(interaction: ChatInputCommandInteraction): Promise<void> {
    await differerEnPrive(interaction);
    const page = await appelApi(
      interaction,
      c => c.organizations.list({ state: OrganizationState.Pending, pagination: 25 }),
      "Organisations indisponibles",
    );
    if (!page) return;
    await liste(interaction, `${totalPage(page)} organisation(s) en attente`, page.data.map(ligneOrganisation), "Aucune organisation en attente.");
  }

  @Slash({ name: "approuver", description: "Approuve une organisation en attente" })
  async approuver(
    @SlashOption({ name: "id", description: "Identifiant de l'organisation", type: ApplicationCommandOptionType.Integer, required: true })
    id: number,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const resultat = await appelApi(interaction, c => c.organizations.approve(id), "Approbation refusée");
    if (!resultat) return;
    if (!resultat.success) {
      await repondre(interaction, echec("Approbation refusée", resultat.error ?? "L'API a refusé l'approbation."));
      return;
    }
    await fait(interaction, "Organisation approuvée", `Organisation \`${id}\` approuvée.`);
  }

  @Slash({ name: "rejeter", description: "Rejette une organisation en attente" })
  async rejeter(
    @SlashOption({ name: "id", description: "Identifiant de l'organisation", type: ApplicationCommandOptionType.Integer, required: true })
    id: number,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const resultat = await appelApi(interaction, c => c.organizations.reject(id), "Rejet refusé");
    if (!resultat) return;
    if (!resultat.success) {
      await repondre(interaction, echec("Rejet refusé", resultat.error ?? "L'API a refusé le rejet."));
      return;
    }
    await fait(interaction, "Organisation rejetée", `Organisation \`${id}\` rejetée.`);
  }
}

// ─── Sanctions ──────────────────────────────────────────────────────────────

@Discord()
@SlashGroup({ name: "sanction", description: "Journal des sanctions cross-serveurs", root: "achillea-admin" })
@SlashGroup("sanction", "achillea-admin")
export class AdminSanction {
  @Slash({ name: "liste", description: "Sanctions, filtrées par joueur et activité" })
  async liste(
    @SlashOption({ name: "joueur", description: "Joueur visé", type: ApplicationCommandOptionType.User, required: false })
    joueur: User | undefined,
    @SlashOption({ name: "actives", description: "Seulement les sanctions actives", type: ApplicationCommandOptionType.Boolean, required: false })
    actives: boolean | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const page = await appelApi(
      interaction,
      c => c.sanctions.list({ ...(joueur ? { userId: joueur.id } : {}), ...(actives === undefined ? {} : { active: actives }), pageSize: 20 }),
      "Sanctions indisponibles",
    );
    if (!page) return;
    await liste(interaction, `${page.total} sanction(s)`, page.data.map(ligneSanction), "Aucune sanction.");
  }

  @Slash({ name: "revoquer", description: "Révoque une sanction active (confirmation)" })
  async revoquer(
    @SlashOption({ name: "id", description: "Identifiant de la sanction", type: ApplicationCommandOptionType.String, required: true })
    id: string,
    @SlashOption({ name: "motif", description: "Motif de la révocation", type: ApplicationCommandOptionType.String, required: false })
    motif: string | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    await demanderConfirmation(
      interaction,
      "Révocation de sanction",
      `La sanction \`${id.trim()}\` sera révoquée${motif ? ` (motif : ${motif})` : ""}.`,
      c => c.sanctions.revoke(id.trim(), motif),
      () => `Sanction \`${id.trim()}\` révoquée.`,
    );
  }
}

// ─── Notes joueur ───────────────────────────────────────────────────────────

@Discord()
@SlashGroup({ name: "note", description: "Notes du staff sur les joueurs", root: "achillea-admin" })
@SlashGroup("note", "achillea-admin")
export class AdminNote {
  @Slash({ name: "liste", description: "Notes, filtrées par joueur et état" })
  async liste(
    @SlashOption({ name: "joueur", description: "Joueur visé", type: ApplicationCommandOptionType.User, required: false })
    joueur: User | undefined,
    @SlashOption({ name: "ouvertes", description: "Seulement les notes non traitées", type: ApplicationCommandOptionType.Boolean, required: false })
    ouvertes: boolean | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const page = await appelApi(
      interaction,
      c => c.playerNotes.list({ ...(joueur ? { targetId: joueur.id } : {}), ...(ouvertes ? { resolved: false } : {}), pageSize: 15 }),
      "Notes indisponibles",
    );
    if (!page) return;
    await liste(interaction, `${page.total} note(s)`, page.data.map(ligneNote), "Aucune note.");
  }

  @Slash({ name: "resume", description: "Compteurs des notes d'un joueur" })
  async resume(
    @SlashOption({ name: "joueur", description: "Joueur visé", type: ApplicationCommandOptionType.User, required: true })
    joueur: User,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const resume = await appelApi(interaction, c => c.playerNotes.summary(joueur.id), "Résumé indisponible");
    if (!resume) return;
    await repondre(
      interaction,
      info(
        `Notes sur ${joueur.username}`,
        `**${resume.total}** note(s), dont **${resume.open}** ouverte(s).\n` +
          `Info : ${resume.bySeverity[PlayerNoteSeverity.INFO]} · Attention : ${resume.bySeverity[PlayerNoteSeverity.WARNING]} · Grave : ${resume.bySeverity[PlayerNoteSeverity.SERIOUS]}`,
        { prive: true },
      ),
    );
  }

  @Slash({ name: "resoudre", description: "Marque une note comme traitée" })
  async resoudre(
    @SlashOption({ name: "id", description: "Identifiant de la note", type: ApplicationCommandOptionType.String, required: true })
    id: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const note = await appelApi(interaction, c => c.playerNotes.resolve(id.trim()), "Note inchangée");
    if (!note) return;
    await fait(interaction, "Note traitée", ligneNote(note));
  }

  @Slash({ name: "rouvrir", description: "Rouvre une note traitée" })
  async rouvrir(
    @SlashOption({ name: "id", description: "Identifiant de la note", type: ApplicationCommandOptionType.String, required: true })
    id: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    const note = await appelApi(interaction, c => c.playerNotes.reopen(id.trim()), "Note inchangée");
    if (!note) return;
    await fait(interaction, "Note rouverte", ligneNote(note));
  }

  @Slash({ name: "supprimer", description: "Supprime une note (confirmation)" })
  async supprimer(
    @SlashOption({ name: "id", description: "Identifiant de la note", type: ApplicationCommandOptionType.String, required: true })
    id: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await differerEnPrive(interaction);
    await demanderConfirmation(
      interaction,
      "Suppression de note",
      `La note \`${id.trim()}\` sera supprimée définitivement.`,
      c => c.playerNotes.remove(id.trim()),
      () => `Note \`${id.trim()}\` supprimée.`,
    );
  }
}
