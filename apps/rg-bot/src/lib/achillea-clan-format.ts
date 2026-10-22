/**
 * Mise en forme des clans Achilléa pour Discord — fonctions pures.
 *
 * Aucun appel réseau ici : les commandes (`commands/achillea-bot/clan.ts`,
 * `composants-clan.ts`, `create-clan.ts`) lisent l'API puis passent les
 * valeurs à ces fabriques, testées sans Discord ni API.
 *
 * Les `custom_id` sont ceux de l'ancien bot, À L'IDENTIQUE : des messages déjà
 * postés (et les messages privés envoyés par l'API) les portent encore.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type EmbedBuilder,
} from "discord.js";
import type { z } from "zod";
import type { ClanCareer, ClanFiche, clanDtoSchema } from "@rosegriffon/achillea-client";

/** Clan de l'annuaire, tel que le rend `client.clans.list`. */
export type ClanDTO = z.output<typeof clanDtoSchema>;
import { ClanMemberDistinction, ClanMemberRole } from "@rosegriffon/achillea-core/enums";
import { toDistinction } from "@rosegriffon/achillea-core/clans";
import { CLAN_MEMBER_ROLE_LABELS } from "@rosegriffon/achillea-core/labels";

import { borner, echapper, fiche, leJour } from "./ui";

/** Clans par page de `/clan infos` (valeur de l'ancien bot). */
export const CLANS_PAR_PAGE = 15;

/** Couleur « carrière » de l'ancien bot. */
export const COULEUR_CARRIERE = 0x206694;

// ─── Distinctions ──────────────────────────────────────────────────────────

/** Clés de distinction (`Player`, `Staff`…) — ce que portent les menus et les boutons. */
export const CLES_DISTINCTION = Object.keys(ClanMemberDistinction) as Array<keyof typeof ClanMemberDistinction>;

/** Clés ou libellés → distinctions connues, sans doublon (les inconnues sont ignorées). */
export function distinctionsDepuis(valeurs: readonly string[]): ClanMemberDistinction[] {
  const sortie: ClanMemberDistinction[] = [];
  for (const valeur of valeurs) {
    const connue = toDistinction(valeur.trim());
    if (connue && !sortie.includes(connue)) sortie.push(connue);
  }
  return sortie;
}

/**
 * Menu des distinctions (legacy `buildApplicationDistinctionSelector`).
 * `apply_distinctions:<clanId>` pour une candidature, `invite_distinctions:<joueurId>` pour une invitation.
 */
export function selecteurDistinctions(cible: "apply" | "invite", identifiant: string | number) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${cible}_distinctions:${identifiant}`)
    .setPlaceholder("Choisissez vos distinctions")
    .setMinValues(1)
    .setMaxValues(CLES_DISTINCTION.length)
    .addOptions(
      CLES_DISTINCTION.map(cle =>
        new StringSelectMenuOptionBuilder().setLabel(ClanMemberDistinction[cle]).setValue(cle),
      ),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/** Boutons Oui / Non avant l'envoi d'une candidature (legacy `buildApplicationCreationButtons`). */
export function boutonsCreationCandidature(clanId: number | string, cles: readonly string[]) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Oui")
      .setStyle(ButtonStyle.Success)
      .setCustomId(`create_application:${clanId}:${cles.join("|")}`)
      .setEmoji("✅"),
    new ButtonBuilder()
      .setLabel("Non")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`cancel_application:${clanId}`)
      .setEmoji("✖️"),
  );
}

/** Bouton « Postuler » d'une fiche de clan (legacy `buildApplicationInitButton`). */
export function boutonPostuler(clanId: number, desactive = false) {
  return new ButtonBuilder()
    .setLabel("Postuler")
    .setStyle(ButtonStyle.Primary)
    .setCustomId(`init_application:${clanId}`)
    .setEmoji("📝")
    .setDisabled(desactive);
}

/** Bouton « Invitation de Clan » (legacy `buildInviteToClanButton`). */
export function boutonInviter(joueurId: string) {
  return new ButtonBuilder()
    .setLabel("Invitation de Clan")
    .setStyle(ButtonStyle.Success)
    .setCustomId(`init_invite:${joueurId}`)
    .setEmoji("📩");
}

/** Bouton « Carrière » (legacy `buildClanHistoryButton`). */
export function boutonCarriere(joueurId: string, desactive = false) {
  return new ButtonBuilder()
    .setLabel("Carrière")
    .setStyle(ButtonStyle.Primary)
    .setCustomId(`get_clan_history:${joueurId}`)
    .setEmoji("📜")
    .setDisabled(desactive);
}

/** Bouton « Fermer » qui efface une réponse privée (legacy `dismiss-message`). */
export function boutonFermer() {
  return new ButtonBuilder().setLabel("Fermer").setStyle(ButtonStyle.Secondary).setCustomId("dismiss-message");
}

/** Lit `<préfixe>:<a>[:<b>]` ; rend les segments après le préfixe. */
export function segments(customId: string): string[] {
  return customId.split(":").slice(1);
}

// ─── Liste paginée ─────────────────────────────────────────────────────────

/** Identifiant d'une page de `/clan infos`. */
export function idPageClans(page: number): string {
  return `clan_infos_page:${page}`;
}

/** Menu de sélection des clans de la page (legacy `buildClansSelector`, `clanSelector`). */
export function selecteurClans(clans: readonly ClanDTO[]) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("clanSelector")
      .setPlaceholder("Sélectionnez un Clan")
      .addOptions(
        clans.slice(0, 25).map(clan =>
          new StringSelectMenuOptionBuilder()
            .setLabel(borner(`[${clan.shortenedName}] ${clan.name}`, 100))
            .setValue(String(clan.id)),
        ),
      ),
  );
}

export function embedListeClans(clans: readonly ClanDTO[], page: number, pages: number, total: number): EmbedBuilder {
  const lignes = clans.map(
    (clan, index) =>
      `**${(page - 1) * CLANS_PAR_PAGE + index + 1}.** [${echapper(clan.shortenedName)}] ${echapper(clan.name)}` +
      ` — ${clan.fame ?? 0} renommée${clan.isRecruiting ? " · 📝 recrute" : ""}`,
  );
  return fiche({
    titre: "Clans Achilléa",
    icone: "🛡️",
    description: lignes.length > 0 ? lignes.join("\n") : "Aucun Clan actif pour le moment.",
    contexte: `${total} clan${total > 1 ? "s" : ""} actif${total > 1 ? "s" : ""}`,
  }).finir({ page, pages });
}

// ─── Fiche ────────────────────────────────────────────────────────────────

function lignesMembres(membres: ClanFiche["members"]): string {
  const roles = [ClanMemberRole.Captain, ClanMemberRole.SubCaptain, ClanMemberRole.Member, ClanMemberRole.Trial];
  return roles
    .map(role => {
      const noms = membres.filter(m => m.role === role).map(m => `<@${m.id}>`);
      return noms.length > 0 ? `**${CLAN_MEMBER_ROLE_LABELS[role]}** : ${noms.join(", ")}` : null;
    })
    .filter((ligne): ligne is string => ligne !== null)
    .join("\n");
}

/** Fiche d'un clan actif ou dissous (legacy `createActiveClanInfosEmbed` / `createDisbandedClanInfosEmbed`). */
export function embedFicheClan(clan: ClanFiche, urlSite: string | null = null): EmbedBuilder {
  const titre = `[${clan.shortName}] ${clan.name}`;
  if (clan.isDisbanded) {
    return fiche({ titre, intention: "muet", icone: "🪦", miniature: clan.avatarUrl })
      .description(`Ce Clan a été dissous.\n\n${borner(clan.biography, 1500)}`)
      .champ("Créé le", leJour(clan.createdAt, "D"), { enLigne: true })
      .finir();
  }
  const reseaux = [
    clan.socials.x ? `[X](${clan.socials.x})` : null,
    clan.socials.instagram ? `[Instagram](${clan.socials.instagram})` : null,
    clan.socials.tiktok ? `[TikTok](${clan.socials.tiktok})` : null,
  ].filter(Boolean);
  const carte = fiche({ titre, url: urlSite, miniature: clan.avatarUrl })
    .description(borner(clan.biography || "Pas de biographie fournie", 1500))
    .champ("Président", clan.president ? `<@${clan.president.id}>` : "—", { enLigne: true })
    .champ("Effectif", `${clan.members.length} membre${clan.members.length > 1 ? "s" : ""}`, { enLigne: true })
    .champ("Renommée", String(clan.fame), { enLigne: true })
    .champ("Niveau", `${clan.level} (${clan.totalXp} XP)`, { enLigne: true })
    .champ("Recrutement", clan.isRecruiting ? (clan.autoAcceptMembers ? "Ouvert (admission directe)" : "Ouvert") : "Fermé", {
      enLigne: true,
    })
    .champ("Créé le", leJour(clan.createdAt, "D"), { enLigne: true });
  if (reseaux.length > 0) carte.champ("Réseaux", reseaux.join(" · "), { enLigne: true });
  if (clan.languages.length > 0) carte.champ("Langues", clan.languages.join(", "), { enLigne: true });
  if (clan.isInactive) carte.champ("État", "Inactif", { enLigne: true });
  const membres = lignesMembres(clan.members);
  if (membres) carte.bloc("Membres", membres, 2);
  return carte.finir();
}

// ─── Carrière ──────────────────────────────────────────────────────────────

function nomClanAvecEmoji(clan: { shortName: string; emojiId: string; clanName: string }): string {
  const emoji = /^\d+$/.test(clan.emojiId) ? `<:${clan.shortName.replace(/[^A-Za-z0-9_]/g, "") || "clan"}:${clan.emojiId}> ` : "";
  return `${emoji}${echapper(clan.clanName)}`;
}

/** Carrière d'un joueur (legacy `createMemberHistoryEmbed`), du plus ancien au plus récent. */
export function embedCarriere(carriere: ClanCareer, avatar: string | null = null): EmbedBuilder {
  const passes = [...carriere.past].toReversed();
  const clans = [...passes.map(nomClanAvecEmoji), ...carriere.current.map(nomClanAvecEmoji)];
  const entrees = [...passes.map(p => `🟢 ${leJour(p.joinedAt, "d")}`), ...carriere.current.map(c => `🟢 ${leJour(c.joinedAt, "d")}`)];
  const sorties = [...passes.map(p => `🔴 ${leJour(p.leftAt, "d")}`), ...carriere.current.map(() => "-")];
  const carte = fiche({ titre: `${carriere.displayName} - Carrière`, icone: "", couleur: COULEUR_CARRIERE, miniature: avatar }).description(
    `Historique des clans auxquels ${echapper(carriere.displayName)} a appartenu\n\n*__Ce joueur a débuté sa carrière le ${leJour(carriere.since, "D")}__*`,
  );
  if (clans.length === 0) return carte.champ("Clan", "Aucun clan pour le moment.").finir();
  return carte
    .champ("Clan", borner(clans.join("\n"), 1024), { enLigne: true })
    .champ("Rejoint le", borner(entrees.join("\n"), 1024), { enLigne: true })
    .champ("Quitté le", borner(sorties.join("\n"), 1024), { enLigne: true })
    .finir();
}

// ─── Création de clan ──────────────────────────────────────────────────────

export type ReseauClan = "twitter" | "instagram" | "tiktok";

/** Réseau social reconnu dans une URL (même liste que l'API : X, Instagram, TikTok). */
export function reseauDe(url: string): ReseauClan | null {
  try {
    const hote = new URL(url.trim()).hostname.replace(/^www\./, "");
    if (hote === "x.com" || hote === "twitter.com") return "twitter";
    if (hote === "instagram.com") return "instagram";
    if (hote === "tiktok.com") return "tiktok";
    return null;
  } catch {
    return null;
  }
}

/** Formats de logo acceptés (legacy : png, jpg, jpeg). */
export const TYPES_LOGO = ["image/png", "image/jpeg", "image/jpg"] as const;

export function logoAccepte(typeContenu: string | null | undefined): boolean {
  const type = (typeContenu ?? "").split(";")[0]!.trim().toLowerCase();
  return (TYPES_LOGO as readonly string[]).includes(type);
}
