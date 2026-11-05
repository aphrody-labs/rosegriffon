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
  Colors,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { z } from "zod";
import type { ClanCareer, ClanFiche, clanDtoSchema } from "@rosegriffon/achillea-client";

/** Clan de l'annuaire, tel que le rend `client.clans.list`. */
export type ClanDTO = z.output<typeof clanDtoSchema>;
import { ClanMemberDistinction, ClanMemberRole } from "@rosegriffon/achillea-core/enums";
import { toDistinction } from "@rosegriffon/achillea-core/clans";

import { borner, echapper } from "./ui";

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

// ─── Embeds simples de l'ancien bot ──────────────────────────────────────────

/**
 * Couleurs des embeds « une ligne » de l'ancien bot (`utils/functions/embeds.ts`).
 * `followUpWithErrorEmbed` prenait `Colors.Red`, `buildErrorEmbed` et les gardes
 * (`replyWithSimpleErrorEmbed`) le rouge Discord `0xed4245`.
 */
export const COULEURS_LEGACY = Object.freeze({
  succes: 0x57_f2_87,
  erreur: Colors.Red,
  refus: 0xed_42_45,
});

/** `buildSuccessEmbed` / `followUpWithSuccessEmbed` : `✅ message`, vert, rien d'autre. */
export function embedSuccesLegacy(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COULEURS_LEGACY.succes).setTitle(borner(`✅ ${message}`, 256));
}

/** `followUpWithErrorEmbed` : `❌ message`, `Colors.Red`. */
export function embedErreurLegacy(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COULEURS_LEGACY.erreur).setTitle(borner(`❌ ${message}`, 256));
}

/** Refus des gardes (`replyWithSimpleErrorEmbed` : `NoClan`, `ClanEnabled`, `ClanRole`) : `❌ message`, `0xed4245`. */
export function embedRefusLegacy(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COULEURS_LEGACY.refus).setTitle(borner(`❌ ${message}`, 256));
}

/** Messages des gardes de l'ancien bot, mot pour mot. */
export const REFUS_LEGACY = Object.freeze({
  dejaEnClan: "You are already in a Clan !",
  horsClan: "Vous ne faites pas partie d'un Clan.",
  permission: "You do not have permission to run this command.",
});

// ─── Liste paginée ─────────────────────────────────────────────────────────

/** Les quatre boutons de page de l'ancien bot (`buildPaginationButtons`), dans leur ordre. */
const BOUTONS_PAGE = [
  { cle: "first", libelle: "Début", emoji: "⏪" },
  { cle: "previous", libelle: "Précédent", emoji: "◀️" },
  { cle: "next", libelle: "Suivant", emoji: "▶️" },
  { cle: "last", libelle: "Fin", emoji: "⏩" },
] as const;

/**
 * Identifiant d'une page de `/clan infos`. Le suffixe distingue les quatre
 * boutons : « Début » et « Précédent » mènent à la même page en page 2, et
 * Discord refuse deux `custom_id` identiques dans une rangée.
 */
export function idPageClans(page: number, bouton?: string): string {
  return bouton ? `clan_infos_page:${page}:${bouton}` : `clan_infos_page:${page}`;
}

/** Rangée Début / Précédent / Suivant / Fin, toujours affichée (legacy `buildPaginationButtons`). */
export function rangeePaginationClans(page: number, pages: number) {
  const cibles = { first: 1, previous: Math.max(1, page - 1), next: Math.min(pages, page + 1), last: pages };
  const auDebut = pages === 0 || page === 1;
  const aLaFin = pages === 0 || page === pages;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    BOUTONS_PAGE.map(b =>
      new ButtonBuilder()
        .setLabel(b.libelle)
        .setStyle(ButtonStyle.Primary)
        .setCustomId(idPageClans(Math.max(1, cibles[b.cle]), b.cle))
        .setEmoji(b.emoji)
        .setDisabled(b.cle === "first" || b.cle === "previous" ? auDebut : aLaFin),
    ),
  );
}

/** Bouton « Retour » de l'ancien bot (`buildReturnButton`), ramené ici à l'annuaire. */
export function boutonRetourClans(page = 1) {
  return new ButtonBuilder().setLabel("Retour").setStyle(ButtonStyle.Primary).setCustomId(idPageClans(page)).setEmoji("↩️");
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

/** Auteur d'un embed de l'ancien bot : l'utilisateur qui a lancé la commande. */
export interface AuteurEmbed {
  nom: string;
  avatar?: string | null;
}

function poserAuteur(embed: EmbedBuilder, auteur: AuteurEmbed | null | undefined): EmbedBuilder {
  if (!auteur) return embed;
  return embed.setAuthor(auteur.avatar ? { name: borner(auteur.nom, 256), iconURL: auteur.avatar } : { name: borner(auteur.nom, 256) });
}

/** Valeur de champ : Discord refuse une valeur vide, l'ancien bot posait alors un espace. */
function valeurChamp(texte: string): string {
  return texte.trim().length > 0 ? borner(texte, 1024) : " ";
}

/** Liste des clans actifs (legacy `createAllActiveClansEmbed`). */
export function embedListeClans(
  clans: readonly ClanDTO[],
  page: number,
  pages: number,
  auteur: AuteurEmbed | null = null,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COULEUR_CARRIERE)
    .setTitle("Liste des Clans")
    .setDescription("Liste des clans en activité. Sélectionnez-en un ci-dessous pour voir ses informations détaillées.");
  poserAuteur(embed, auteur);
  return embed.setFields(
    { name: "Clan", value: valeurChamp(clans.map(c => c.name).join("\n")), inline: true },
    { name: "Id", value: valeurChamp(clans.map(c => String(c.id)).join("\n")), inline: true },
    {
      name: "Présidence",
      value: valeurChamp(clans.map(c => (/^\d+$/.test(c.president.id) ? `<@${c.president.id}>` : "")).join("\n")),
      inline: true,
    },
    { name: `Page ${page}/${pages}`, value: " ", inline: true },
  );
}

// ─── Fiche ────────────────────────────────────────────────────────────────

/** Logo d'Achilléa (PNG), affiché pour un clan sans logo propre. */
export const LOGO_ACHILLEA_PNG = "https://rosegriffon.fr/achillea/achillea.png";

/**
 * Miniature d'un clan pour Discord.
 *
 * Un clan sans logo porte en base le marqueur `/achillea/default-clan-avatar.svg?clan=<id>`
 * (la colonne est unique, d'où l'identifiant). Discord n'affiche ni une URL relative ni
 * un SVG : on montre le logo d'Achilléa à la place.
 */
export function miniatureClan(avatarUrl: string | null | undefined): string {
  if (!avatarUrl || avatarUrl.startsWith("/achillea/default-clan-avatar.svg")) return LOGO_ACHILLEA_PNG;
  return avatarUrl.startsWith("/") ? `https://rosegriffon.fr${avatarUrl}` : avatarUrl;
}

/** Liste « - <@id> » de l'ancien bot. */
function listeMentions(ids: readonly string[]): string {
  return ids.map(id => `- <@${id}>\n`).join("");
}

/** Préfixe `https://` manquant (legacy `formatUrl`). */
function avecHttps(u: string): string {
  return u.startsWith("https") ? u : `https://${u}`;
}

/** Réseaux en liens, un par ligne (legacy `buildSocialMediaString`). */
function lignesReseaux(socials: ClanFiche["socials"]): string {
  return [
    socials.x ? `[Twitter](${avecHttps(socials.x)})\n` : "",
    socials.instagram ? `[Instagram](${avecHttps(socials.instagram)})\n` : "",
    socials.tiktok ? `[TikTok](${avecHttps(socials.tiktok)})\n` : "",
  ].join("");
}

/**
 * Fiche d'un clan actif ou dissous (legacy `createActiveClanInfosEmbed` /
 * `createDisbandedClanInfosEmbed`). La fiche de l'API ne porte pas les
 * fondateurs : l'appelant les lit à part (`clans.get`).
 */
export function embedFicheClan(
  clan: ClanFiche,
  auteur: AuteurEmbed | null = null,
  fondateurs: readonly string[] = [],
): EmbedBuilder {
  const embed = new EmbedBuilder().setThumbnail(miniatureClan(clan.avatarUrl));
  if (clan.biography.trim().length > 0) embed.setDescription(borner(clan.biography, 4096));
  poserAuteur(embed, auteur);
  if (clan.isDisbanded) {
    return embed
      .setColor(Colors.Red)
      .setTitle(borner(`[${clan.shortName}] ${clan.name}\n - Clan dissout`, 256))
      .setFields({ name: "Fondateurs", value: valeurChamp(listeMentions(fondateurs)), inline: true });
  }
  const vices = clan.members.filter(m => m.role === ClanMemberRole.SubCaptain).map(m => `- <@${m.id}>`);
  return embed
    .setColor(COULEUR_CARRIERE)
    .setTitle(borner(`[${clan.shortName}] ${clan.name}\n`, 256))
    .setFields(
      { name: "Président", value: clan.president ? `<@${clan.president.id}>` : " ", inline: true },
      { name: "Vice-Présidents", value: valeurChamp(vices.join("\n")), inline: true },
      { name: "Fondateurs", value: valeurChamp(listeMentions(fondateurs)), inline: true },
      { name: "Membres", value: String(clan.members.length), inline: true },
      { name: "Discord", value: clan.guildId ? "Yes" : "No", inline: true },
      { name: "Réseaux sociaux", value: valeurChamp(lignesReseaux(clan.socials)), inline: true },
    );
}

// ─── Carrière ──────────────────────────────────────────────────────────────

/** Émojis personnalisés des flèches de l'ancien bot (serveur Achilléa de production). */
export const EMOJI_ENTREE = "<:green_arrow:1436631712368168971>";
export const EMOJI_SORTIE = "<:red_arrow:1436631768483627068>";

/** `JJ/MM/AAAA`, heure de Paris (legacy `formatDateToSlashDate`, serveur à Paris). */
export function dateBarree(iso: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

function nomClanAvecEmoji(clan: { shortName: string; emojiId: string; clanName: string }): string {
  return `<:${clan.shortName.replace(/[^A-Za-z0-9_]/g, "") || "clan"}:${clan.emojiId}> ${clan.clanName}`;
}

/**
 * Carrière d'un joueur (legacy `createMemberHistoryEmbed`) : clans quittés du
 * plus récent au plus ancien (ordre de l'API), puis le clan actuel.
 */
export function embedCarriere(carriere: ClanCareer, avatar: string | null = null): EmbedBuilder {
  const clans = [...carriere.past.map(nomClanAvecEmoji), ...carriere.current.map(nomClanAvecEmoji)];
  const entrees = [...carriere.past, ...carriere.current].map(c => `${EMOJI_ENTREE} ${dateBarree(c.joinedAt)}`);
  const sorties = [...carriere.past.map(p => `${EMOJI_SORTIE} ${dateBarree(p.leftAt)}`), ...carriere.current.map(() => "-")];
  const nom = echapper(carriere.displayName);
  const embed = new EmbedBuilder()
    .setColor(COULEUR_CARRIERE)
    .setTitle(borner(`${nom} - Carrière`, 256))
    .setDescription(
      `Historique des clans auxquels ${nom} a appartenu\n\n*__Ce joueur a débuté sa carrière le ${dateBarree(carriere.since)}__*`,
    );
  if (avatar) embed.setThumbnail(avatar);
  return embed.setFields(
    { name: "Clan", value: valeurChamp(clans.join("\n")), inline: true },
    { name: "Rejoint le", value: valeurChamp(entrees.join("\n")), inline: true },
    { name: "Quitté le", value: valeurChamp(sorties.join("\n")), inline: true },
  );
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
