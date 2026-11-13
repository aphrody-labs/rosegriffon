/**
 * Vues de la gestion de clan (`/clan manage`, `/clan teams`) — fonctions PURES.
 *
 * Embeds, rangées de boutons, menus et modales sont construits ici à partir
 * des DTO de l'API Achilléa, sans aucun appel : les commandes ne font que
 * lire l'API puis appeler ces fonctions, et les tests les vérifient sans
 * Discord ni réseau.
 *
 * ── IDENTIFIANTS ───────────────────────────────────────────────────────────
 * L'ancien `/clan manage` tenait son état dans un collecteur en mémoire
 * (« quel membre est sélectionné », « quelle page ») : il mourait au bout de
 * deux minutes d'inactivité ou au premier redémarrage, laissant des boutons
 * qui ne répondaient plus. Tout l'état vit désormais dans le `custom_id`
 * (`clan_manage:<action>[:arg…]`), relu à chaque clic : un panneau reste
 * utilisable tant que Discord garde le message.
 *
 * Les identifiants que l'ancien bot servait par des gestionnaires globaux —
 * donc portés par des messages encore visibles — sont conservés à
 * l'identique : `team_manager_btn:<clanId>:<1|2>`, `return_teams_menu`,
 * `team_edit_btn:<type>:<rôle>`, `team_settings_btn:<équipe>`,
 * `team_manager_modal:<équipe>:<rôle>`, `team_settings_modal:<équipe>`,
 * `editDistinctions:<joueur>:<clan>`, `return_to_member_menu:<joueur>:<clan>`,
 * `edit_distinctions:<joueur>:<clan>`.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  FileUploadBuilder,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  ClanMemberDistinction,
  ClanMemberRole,
} from "@rosegriffon/achillea-core/enums";
import { CLAN_MEMBER_ROLE_LABELS } from "@rosegriffon/achillea-core/labels";
import type {
  ClanDTO,
  ClanInviteDTO,
  ClanMemberDTO,
} from "@rosegriffon/achillea-types/domain/clan";
import type { ClanTeam } from "@rosegriffon/achillea-client";

import {
  COULEUR_CARRIERE,
  COULEURS_LEGACY,
  dateBarree,
  miniatureClan,
  type AuteurEmbed,
} from "./achillea-clan-format";
import { ABSENT, borner, fiche, leJour } from "./ui";

// ─── Constantes ──────────────────────────────────────────────────────────────

export const PREFIXE_GESTION = "clan_manage";
export const MEMBRES_PAR_PAGE = 15;

/** Rôle dans une équipe (legacy `TeamMemberRole`) et sa configuration de modale. */
export const ROLES_EQUIPE = Object.freeze({
  0: { libelle: "Joueur", pluriel: "joueurs", max: 5, prefixe: "player" },
  1: { libelle: "Remplaçant", pluriel: "remplaçants", max: 2, prefixe: "sub" },
  2: { libelle: "Coach", pluriel: "coach", max: 1, prefixe: "coach" },
} as const);
export type RoleEquipe = 0 | 1 | 2;

export function estRoleEquipe(valeur: number): valeur is RoleEquipe {
  return valeur === 0 || valeur === 1 || valeur === 2;
}

export function libelleRoleClan(role: number): string {
  return CLAN_MEMBER_ROLE_LABELS[role as ClanMemberRole] ?? `Rôle ${role}`;
}

/** `<@id>` — mention, jamais pingée dans un embed. */
const mention = (id: string) => `<@${id}>`;

// ─── Identifiants ────────────────────────────────────────────────────────────

/** `clan_manage:<action>:<args…>`. */
export function idGestion(
  action: string,
  ...args: Array<string | number>
): string {
  return [PREFIXE_GESTION, action, ...args.map(String)].join(":");
}

/** Décode `clan_manage:<action>:<args…>`, ou `null` si l'identifiant n'est pas de cette surface. */
export function decoderIdGestion(
  customId: string,
): { action: string; args: string[] } | null {
  const [prefixe, action, ...args] = customId.split(":");
  if (prefixe !== PREFIXE_GESTION || !action) return null;
  return { action, args };
}

/** Page bornée à [1, pages]. */
export function bornerPageMembres(
  page: number,
  total: number,
  parPage = MEMBRES_PAR_PAGE,
): number {
  const pages = Math.max(1, Math.ceil(total / parPage));
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), pages);
}

// ─── Clan : panneau principal ────────────────────────────────────────────────

/** Réseaux en liens, un par ligne (legacy `buildSocialMediaString`). */
function chaineReseaux(
  clan: Pick<ClanDTO, "xUrl" | "instagramUrl" | "tiktokUrl">,
): string {
  const lien = (u: string) => (u.startsWith("https") ? u : `https://${u}`);
  return [
    clan.xUrl ? `[Twitter](${lien(clan.xUrl)})\n` : "",
    clan.instagramUrl ? `[Instagram](${lien(clan.instagramUrl)})\n` : "",
    clan.tiktokUrl ? `[TikTok](${lien(clan.tiktokUrl)})\n` : "",
  ].join("");
}

/** Discord refuse une valeur de champ vide ; l'ancien bot posait un espace. */
function valeurChamp(texte: string): string {
  return texte.trim().length > 0 ? borner(texte, 1024) : " ";
}

/** Auteur des embeds de l'ancien bot : l'utilisateur qui a lancé la commande. */
function poserAuteur(
  embed: EmbedBuilder,
  auteur: AuteurEmbed | null | undefined,
): EmbedBuilder {
  if (!auteur) return embed;
  return embed.setAuthor(
    auteur.avatar
      ? { name: borner(auteur.nom, 256), iconURL: auteur.avatar }
      : { name: borner(auteur.nom, 256) },
  );
}

/** Nom affiché d'un compte (legacy `displayName`), « Unknown » à défaut. */
function nomAffiche(user: {
  username?: string | null;
  displayName?: string | null;
}): string {
  return user.displayName || user.username || "Unknown";
}

/** Date courte de l'ancien bot (`formatDateForInvites` : « 05 nov. »), « — » sans date. */
export function dateCourte(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
  });
}

/** Membres triés comme l'ancien bot : rôle décroissant, puis arrivée la plus récente. */
export function trierMembres(
  membres: readonly ClanMemberDTO[],
): ClanMemberDTO[] {
  return [...membres].sort(
    (a, b) =>
      b.clanRole - a.clanRole ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Fiche du clan en tête du panneau (legacy `createActiveClanInfosEmbed`).
 * `discord` : le clan a-t-il lié un serveur (lu dans la fiche, `null` si inconnu).
 */
export function embedInfosClan(
  clan: ClanDTO,
  membres: readonly ClanMemberDTO[],
  auteur: AuteurEmbed | null = null,
  discord: boolean | null = null,
): EmbedBuilder {
  const president =
    membres.find((m) => m.clanRole === ClanMemberRole.Captain)?.user.id ??
    clan.president?.id ??
    null;
  const vices = membres
    .filter((m) => m.clanRole === ClanMemberRole.SubCaptain)
    .map((m) => `- ${mention(m.user.id)}`);
  const fondateurs = clan.founders.map((id) => `- ${mention(id)}\n`).join("");
  const embed = new EmbedBuilder()
    .setColor(COULEUR_CARRIERE)
    .setTitle(borner(`[${clan.shortenedName}] ${clan.name}\n`, 256))
    .setThumbnail(miniatureClan(clan.clanAvatarUrl));
  if (clan.clanBiography.trim().length > 0)
    embed.setDescription(borner(clan.clanBiography, 4096));
  poserAuteur(embed, auteur);
  return embed.setFields(
    {
      name: "Président",
      value: president ? mention(president) : " ",
      inline: true,
    },
    {
      name: "Vice-Présidents",
      value: valeurChamp(vices.join("\n")),
      inline: true,
    },
    { name: "Fondateurs", value: valeurChamp(fondateurs), inline: true },
    {
      name: "Membres",
      value: String(membres.length || clan.membersCount),
      inline: true,
    },
    { name: "Discord", value: discord ? "Yes" : "No", inline: true },
    {
      name: "Réseaux sociaux",
      value: valeurChamp(chaineReseaux(clan)),
      inline: true,
    },
  );
}

export function rangeeMenuPrincipal(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    bouton(idGestion("infos"), "Infos", "📜"),
    bouton(idGestion("members", 1), "Membres", "👥"),
    bouton(idGestion("invites", 1), "Invitations", "📩"),
    bouton(idGestion("settings"), "Paramètres", "⚙️"),
  );
}

export function rangeeEditionInfos(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    bouton(idGestion("name"), "Nom", "📝"),
    bouton(idGestion("bio"), "Biographie", "📖"),
    bouton(idGestion("socials"), "Réseaux sociaux", "🌐"),
    bouton(idGestion("logo"), "Logo", "🖼️"),
    boutonMenu(),
  );
}

export function rangeeParametres(
  clan: Pick<ClanDTO, "isRecruiting" | "autoAcceptMembers" | "isHidden">,
) {
  const bascule = (id: string, libelle: string, actif: boolean) =>
    new ButtonBuilder()
      .setCustomId(idGestion("toggle", id))
      .setLabel(libelle)
      .setStyle(actif ? ButtonStyle.Success : ButtonStyle.Danger)
      .setEmoji(actif ? "✅" : "✖️");
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    bascule("recruiting", "Recrute", clan.isRecruiting),
    bascule("auto", "Recrutement auto", clan.autoAcceptMembers),
    bascule("hidden", "Clan caché", clan.isHidden),
    boutonMenu(),
  );
}

/** Champ du `PATCH /clans/:id` qui correspond à une bascule. */
export function patchBascule(
  cle: string,
  clan: Pick<ClanDTO, "isRecruiting" | "autoAcceptMembers" | "isHidden">,
):
  | { isRecruiting: boolean }
  | { autoAcceptMembers: boolean }
  | { isHidden: boolean }
  | null {
  switch (cle) {
    case "recruiting": {
      return { isRecruiting: !clan.isRecruiting };
    }
    case "auto": {
      return { autoAcceptMembers: !clan.autoAcceptMembers };
    }
    case "hidden": {
      return { isHidden: !clan.isHidden };
    }
    default: {
      return null;
    }
  }
}

function bouton(
  id: string,
  libelle: string,
  emoji?: string,
  style = ButtonStyle.Primary,
): ButtonBuilder {
  const b = new ButtonBuilder()
    .setCustomId(id)
    .setLabel(libelle)
    .setStyle(style);
  return emoji ? b.setEmoji(emoji) : b;
}

function boutonMenu(): ButtonBuilder {
  return bouton(idGestion("menu"), "Menu", "↩️");
}

// ─── Membres ─────────────────────────────────────────────────────────────────

/** Liste des membres (legacy `buildAllClanMembersEmbed`). */
export function embedListeMembres(
  clan: ClanDTO,
  membres: readonly ClanMemberDTO[],
  page: number,
  auteur: AuteurEmbed | null = null,
): EmbedBuilder {
  const tries = trierMembres(membres);
  const pages = Math.ceil(tries.length / MEMBRES_PAR_PAGE);
  const tranche = tries.slice(
    (page - 1) * MEMBRES_PAR_PAGE,
    page * MEMBRES_PAR_PAGE,
  );
  const embed = new EmbedBuilder()
    .setColor(COULEUR_CARRIERE)
    .setTitle(borner(`[${clan.shortenedName}] ${clan.name} - Members`, 256))
    .setDescription(
      `Liste des membres du clan ordonnées par rôle et ancienneté\n\n**${tries.length} Membres** - Page ${page}/${pages}`,
    )
    .setThumbnail(miniatureClan(clan.clanAvatarUrl));
  poserAuteur(embed, auteur);
  return embed.setFields(
    {
      name: "Membre",
      value: valeurChamp(tranche.map((m) => mention(m.user.id)).join("\n")),
      inline: true,
    },
    {
      name: "Rôle",
      value: valeurChamp(
        tranche.map((m) => libelleRoleClan(m.clanRole)).join("\n"),
      ),
      inline: true,
    },
    {
      name: "Dernière activité",
      value: valeurChamp(
        tranche.map((m) => dateCourte(m.user.lastInteract)).join("\n"),
      ),
      inline: true,
    },
  );
}

/** Les quatre boutons de page de l'ancien bot (`buildPaginationButtons`). */
const BOUTONS_PAGE = [
  { cle: "first", libelle: "Début", emoji: "⏪" },
  { cle: "prev", libelle: "Précédent", emoji: "◀️" },
  { cle: "next", libelle: "Suivant", emoji: "▶️" },
  { cle: "last", libelle: "Fin", emoji: "⏩" },
] as const;

/** Début / Précédent / Suivant / Fin + « Menu » ; identifiants uniques (Discord refuse deux fois le même). */
export function rangeePaginationGestion(
  vue: "members" | "invites",
  page: number,
  pages: number,
) {
  const p = Math.max(1, pages);
  const cibles = {
    first: 1,
    prev: Math.max(1, page - 1),
    next: Math.min(p, page + 1),
    last: p,
  };
  const auDebut = pages === 0 || page === 1;
  const aLaFin = pages === 0 || page === pages;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...BOUTONS_PAGE.map((b) =>
      bouton(
        idGestion(vue, cibles[b.cle], b.cle),
        b.libelle,
        b.emoji,
      ).setDisabled(b.cle === "first" || b.cle === "prev" ? auDebut : aLaFin),
    ),
    boutonMenu(),
  );
}

/** Menu des membres de la page (legacy `buildClanMembersSelector`). */
export function selecteurMembres(
  membres: readonly ClanMemberDTO[],
  page: number,
) {
  const tranche = trierMembres(membres).slice(
    (page - 1) * MEMBRES_PAR_PAGE,
    page * MEMBRES_PAR_PAGE,
  );
  if (tranche.length === 0) return null;
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(idGestion("member_select"))
      .setPlaceholder("Sélectionnez un Membre")
      .addOptions(
        tranche.map((m) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(borner(nomAffiche(m.user), 100))
            .setValue(m.user.id),
        ),
      ),
  );
}

/** Fiche d'un membre (legacy `buildClanMemberEmbed`) : vert pour un « Nouveau » membre, bleu sinon. */
export function embedMembre(
  membre: ClanMemberDTO,
  titre = "Gestion du membre",
  avatar: string | null = null,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(
      titre.toLowerCase().includes("nouveau")
        ? COULEURS_LEGACY.succes
        : COULEUR_CARRIERE,
    )
    .setTitle(borner(`${nomAffiche(membre.user)} - ${titre}`, 256))
    .setDescription(`__*Clan rejoint le ${dateBarree(membre.createdAt)}*__`);
  if (avatar) embed.setThumbnail(avatar);
  return embed.setFields(
    { name: "Rôle", value: libelleRoleClan(membre.clanRole), inline: true },
    {
      name: "Distinctions",
      value: valeurChamp(membre.distinctions.join("\n")),
      inline: true,
    },
    {
      name: "Dernière activité",
      value: dateCourte(membre.user.lastInteract),
      inline: true,
    },
    {
      name: "Contributions",
      value: String(membre.clanFameContributed),
      inline: true,
    },
    { name: "Stats Interclan", value: "0", inline: true },
    { name: "Stats Coupes des Clans", value: "0", inline: true },
  );
}

/**
 * Boutons de gestion d'un membre — mêmes règles d'activation que l'ancien bot
 * (`buildClanMemberManagementButtons`). L'API retranche de toute façon : un
 * bouton actif n'est jamais une autorisation, seulement une invitation à essayer.
 */
export function rangeeGestionMembre(
  membre: ClanMemberDTO,
  acteurRole: number,
  clanId: number,
) {
  const id = membre.user.id;
  const roleBouton =
    membre.clanRole > ClanMemberRole.Member
      ? bouton(
          idGestion("role", id, ClanMemberRole.Member),
          "Rétrograder",
          "⚽",
          ButtonStyle.Danger,
        ).setDisabled(acteurRole <= membre.clanRole)
      : bouton(
          idGestion("role", id, ClanMemberRole.Member),
          "Promouvoir",
          "⚽",
          ButtonStyle.Success,
        ).setDisabled(membre.clanRole >= ClanMemberRole.Member);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    roleBouton,
    bouton(
      idGestion("role", id, ClanMemberRole.SubCaptain),
      "Promouvoir Vice-Président",
      "🎖️",
      ButtonStyle.Success,
    ).setDisabled(
      acteurRole < ClanMemberRole.SubCaptain ||
        membre.clanRole > ClanMemberRole.Member,
    ),
    bouton(
      `editDistinctions:${id}:${clanId}`,
      "Editer les distinctions",
      "✏️",
    ).setDisabled(
      acteurRole !== ClanMemberRole.Captain && acteurRole <= membre.clanRole,
    ),
    bouton(
      idGestion("kick", id),
      "Expulser",
      "👢",
      ButtonStyle.Danger,
    ).setDisabled(
      acteurRole <= membre.clanRole ||
        membre.clanRole === ClanMemberRole.Captain,
    ),
    bouton(idGestion("members", 1, "back"), "Retour", "↩️"),
  );
}

/** Menu des distinctions (legacy `buildDistinctionsEditorSelector`) : valeur = clé de l'enum. */
export function selecteurDistinctions(membre: ClanMemberDTO, clanId: number) {
  const entrees = Object.entries(ClanMemberDistinction);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`edit_distinctions:${membre.user.id}:${clanId}`)
      .setPlaceholder("Choisissez les distinctions")
      .setMinValues(1)
      .setMaxValues(entrees.length)
      .addOptions(
        entrees.map(([cle, valeur]) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(valeur)
            .setValue(cle)
            .setDefault(membre.distinctions.includes(valeur)),
        ),
      ),
  );
}

export function rangeeRetourMembre(membreId: string, clanId: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    bouton(`return_to_member_menu:${membreId}:${clanId}`, "Retour", "↩️"),
  );
}

/** Clés (`Player`) ou libellés (`Joueur`) → libellés de l'enum ; inconnus écartés. */
export function distinctionsDepuisValeurs(
  valeurs: readonly string[],
): ClanMemberDistinction[] {
  const table = ClanMemberDistinction as Record<string, ClanMemberDistinction>;
  const connues = new Set<string>(Object.values(ClanMemberDistinction));
  const sortie: ClanMemberDistinction[] = [];
  for (const v of valeurs) {
    const d =
      table[v] ?? (connues.has(v) ? (v as ClanMemberDistinction) : undefined);
    if (d && !sortie.includes(d)) sortie.push(d);
  }
  return sortie;
}

// ─── Invitations ─────────────────────────────────────────────────────────────

function trierInvitations(
  invitations: readonly ClanInviteDTO[],
): ClanInviteDTO[] {
  return [...invitations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Liste des invitations (legacy `buildClanInvitesEmbed`). */
export function embedListeInvitations(
  clan: ClanDTO,
  invitations: readonly ClanInviteDTO[],
  page: number,
  auteur: AuteurEmbed | null = null,
): EmbedBuilder {
  const triees = trierInvitations(invitations);
  const pages = Math.ceil(triees.length / MEMBRES_PAR_PAGE);
  const tranche = triees.slice(
    (page - 1) * MEMBRES_PAR_PAGE,
    page * MEMBRES_PAR_PAGE,
  );
  const colonne = (lignes: string[]) =>
    lignes.length > 0 ? borner(lignes.join("\n"), 1024) : "-";
  const embed = new EmbedBuilder()
    .setColor(COULEUR_CARRIERE)
    .setTitle(borner(`[${clan.shortenedName}] ${clan.name} - Invites`, 256))
    .setDescription(
      `Liste des invitations émises par le clan ordonnées par ancienneté\n\n**${triees.length}/100** - Page ${page}/${pages === 0 ? 1 : pages}`,
    )
    .setThumbnail(miniatureClan(clan.clanAvatarUrl));
  poserAuteur(embed, auteur);
  return embed.setFields(
    {
      name: "Invité",
      value: colonne(tranche.map((i) => mention(i.user.id))),
      inline: true,
    },
    {
      name: "Invitant",
      value: colonne(tranche.map((i) => mention(i.inviter.user.id))),
      inline: true,
    },
    {
      name: "Invité le",
      value: colonne(tranche.map((i) => dateCourte(i.createdAt))),
      inline: true,
    },
  );
}

/** Menu des invitations de la page (legacy `buildClanInvitesSelector`). */
export function selecteurInvitations(
  invitations: readonly ClanInviteDTO[],
  page: number,
) {
  const tranche = trierInvitations(invitations).slice(
    (page - 1) * MEMBRES_PAR_PAGE,
    page * MEMBRES_PAR_PAGE,
  );
  if (tranche.length === 0) return null;
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(idGestion("invite_select"))
      .setPlaceholder("Sélectionnez une invitation")
      .addOptions(
        tranche.map((i) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(borner(nomAffiche(i.user), 100))
            .setValue(String(i.id)),
        ),
      ),
  );
}

/** Fiche d'une invitation (legacy `buildClanInviteManagementEmbed`, compteurs figés de l'ancien bot). */
export function embedInvitation(
  invitation: ClanInviteDTO,
  auteur: AuteurEmbed | null = null,
  avatar: string | null = null,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COULEUR_CARRIERE)
    .setTitle(
      borner(`${nomAffiche(invitation.user)} - Gestion de l'invitation`, 256),
    )
    .setDescription(
      `__*Invitation émise le ${dateCourte(invitation.createdAt)}*__`,
    );
  poserAuteur(embed, auteur);
  if (avatar) embed.setThumbnail(avatar);
  return embed.setFields(
    {
      name: "Dernière activité",
      value: dateCourte(invitation.user.lastInteract),
      inline: true,
    },
    { name: "Elo", value: "Non classé", inline: true },
    { name: "Tournois gagnés", value: "0", inline: true },
    { name: "Participations Interclan", value: "0", inline: true },
    { name: "Victoires Interclan", value: "0", inline: true },
    { name: "Victoires Coupes des Clans", value: "0", inline: true },
  );
}

export function rangeeGestionInvitation(invitation: ClanInviteDTO) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    bouton(
      idGestion("revoke", invitation.id),
      "Révoquer",
      "✖️",
      ButtonStyle.Danger,
    ),
    bouton(idGestion("invites", 1, "back"), "Retour", "↩️"),
  );
}

/** Confirmer / Annuler de l'ancien bot (`buildConfirmCancelButtons`), sur la demande privée de révocation. */
export function rangeeConfirmationRevocation(invitationId: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    bouton(
      idGestion("revoke_ok", invitationId),
      "Confirmer",
      "✅",
      ButtonStyle.Success,
    ),
    bouton(
      idGestion("revoke_no", invitationId),
      "Annuler",
      "✖️",
      ButtonStyle.Danger,
    ),
  );
}

/** Question posée avant de révoquer (texte de l'ancien bot). */
export function questionRevocation(invitation: ClanInviteDTO): string {
  return `Voulez-vous révoquer l'invitation envoyée à ${nomAffiche(invitation.user)} ?`;
}

// ─── Modales de gestion ──────────────────────────────────────────────────────

function champTexte(
  id: string,
  libelle: string,
  options: {
    valeur?: string | null;
    long?: boolean;
    requis?: boolean;
    min?: number;
    max?: number;
    aide?: string;
  } = {},
) {
  const entree = new TextInputBuilder()
    .setCustomId(id)
    .setStyle(options.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(options.requis ?? true);
  if (options.min !== undefined) entree.setMinLength(options.min);
  if (options.max !== undefined) entree.setMaxLength(options.max);
  if (options.valeur) entree.setValue(options.valeur);
  if (options.aide) entree.setPlaceholder(options.aide);
  return new LabelBuilder().setLabel(libelle).setTextInputComponent(entree);
}

export function modaleNom(
  clan: Pick<ClanDTO, "name" | "shortenedName">,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(idGestion("name_modal"))
    .setTitle("Changement de nom du Clan")
    .addLabelComponents(
      champTexte("nameInput", "Nom du Clan", { valeur: clan.name }),
      champTexte("shortNameInput", "Sigle du Clan", {
        valeur: clan.shortenedName,
      }),
    );
}

export function modaleBiographie(
  clan: Pick<ClanDTO, "clanBiography">,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(idGestion("bio_modal"))
    .setTitle("Change Clan Biography")
    .addLabelComponents(
      champTexte("textInput", "Clan biography", {
        valeur: clan.clanBiography,
        long: true,
        min: 5,
        max: 1500,
      }),
    );
}

export function modaleReseaux(
  clan: Pick<ClanDTO, "xUrl" | "instagramUrl" | "tiktokUrl">,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(idGestion("socials_modal"))
    .setTitle("Modifier les Réseaux du Clan")
    .addLabelComponents(
      // L'ancien bot posait la valeur actuelle, ou à défaut l'exemple.
      champTexte("xInput", "Lien du compte X", {
        valeur: clan.xUrl,
        requis: false,
        aide: clan.xUrl ? undefined : "https://twitter.com/youraccount",
      }),
      champTexte("instagramInput", "Lien du compte Instagram", {
        valeur: clan.instagramUrl,
        requis: false,
        aide: clan.instagramUrl
          ? undefined
          : "https://instagram.com/youraccount",
      }),
      champTexte("tikTokInput", "Lien du compte TikTok", {
        valeur: clan.tiktokUrl,
        requis: false,
        aide: clan.tiktokUrl ? undefined : "https://tiktok.com/@youraccount",
      }),
    );
}

/** Le logo arrive par un champ de fichier de la modale : plus de collecteur de messages de 60 s. */
export function modaleLogo(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(idGestion("logo_modal"))
    .setTitle("Logo du Clan")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Nouveau logo (png, jpg ou jpeg)")
        .setFileUploadComponent(
          new FileUploadBuilder()
            .setCustomId("logoInput")
            .setMinValues(1)
            .setMaxValues(1)
            .setRequired(true),
        ),
    );
}

export function modaleExpulsion(membreId: string, nom: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(idGestion("kick_modal", membreId))
    .setTitle(borner(`Expulser ${nom} du Clan`, 45))
    .addLabelComponents(
      champTexte("textInput", "Raison de l'expulsion", {
        long: true,
        min: 5,
        max: 1500,
      }),
    );
}

/** Extensions d'image acceptées pour le logo (comme l'ancien bot). */
export const EXTENSIONS_LOGO = ["png", "jpg", "jpeg"] as const;

/** Le type MIME d'une pièce jointe est-il un logo accepté ? */
export function logoAccepte(typeMime: string | null | undefined): boolean {
  if (!typeMime?.startsWith("image/")) return false;
  return (EXTENSIONS_LOGO as readonly string[]).includes(
    typeMime.slice("image/".length).toLowerCase(),
  );
}

// ─── Équipes ─────────────────────────────────────────────────────────────────

export const DESCRIPTION_EQUIPES =
  "Gérez vos équipes comme bon vous semble !\n\nUne équipe est composée de :\n" +
  "- 3 à 5 joueurs, dont 1 Capitaine\n- 2 remplaçants (optionnel)\n- 1 coach (optionnel)\n\n" +
  "Un membre n'occupe qu'une place, toutes équipes et tous rôles confondus.";

function validite(equipe: ClanTeam | undefined): string {
  if (!equipe) return "Absente";
  return equipe.valid
    ? "Valide ✅"
    : `Invalide ❌\n*${equipe.errors.join("\n")}*`;
}

export function embedMenuEquipes(
  clan: { name: string; shortenedName: string },
  equipes: readonly ClanTeam[],
): EmbedBuilder {
  const principale = equipes.find((e) => e.type === 0);
  const secondaire = equipes.find((e) => e.type === 1);
  return fiche({
    titre: `🏆 [${clan.shortenedName}] ${clan.name} — Équipes`,
    description: DESCRIPTION_EQUIPES,
    icone: "",
  })
    .champ(principale?.name ?? "Team 1", validite(principale), {
      enLigne: true,
    })
    .champ(secondaire?.name ?? "Team 2", validite(secondaire), {
      enLigne: true,
    })
    .finir();
}

export function rangeeMenuEquipes(
  clanId: number,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    bouton(`team_manager_btn:${clanId}:1`, "Team 1", "1️⃣"),
    bouton(`team_manager_btn:${clanId}:2`, "Team 2", "2️⃣"),
  );
}

export function embedEquipe(
  clan: { name: string; shortenedName: string },
  equipe: ClanTeam,
): EmbedBuilder {
  const noms = (role: RoleEquipe) =>
    equipe.members
      .filter((m) => m.role === role)
      .map((m) =>
        m.userId === equipe.captainUserId
          ? `**[C]** ${m.displayName}`
          : m.displayName,
      );
  return fiche({
    titre: `🏆 [${clan.shortenedName}] ${clan.name} — ${equipe.name}`,
    description: `*Dernière mise à jour ${leJour(equipe.updatedAt, "f")}*`,
    icone: "",
  })
    .champ("Joueurs", noms(0).join("\n") || "Aucun", { enLigne: true })
    .champ("Remplaçants", noms(1).join("\n") || "Aucun", { enLigne: true })
    .champ("Coach", noms(2).join("\n") || "Aucun", { enLigne: true })
    .champ("Validité", validite(equipe))
    .finir();
}

export function rangeeGestionEquipe(
  equipe: Pick<ClanTeam, "id" | "type">,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    bouton(`team_edit_btn:${equipe.type}:0`, "Joueurs"),
    bouton(`team_edit_btn:${equipe.type}:1`, "Remplaçants"),
    bouton(`team_edit_btn:${equipe.type}:2`, "Coach"),
    bouton(`team_settings_btn:${equipe.id}`, "Paramètres"),
    bouton("return_teams_menu", "Retour", "↩️"),
  );
}

/** Identifiant d'un champ de la modale d'effectif (legacy : `<prefixe>_<n>:<type>:<clanId>`). */
export function idChampEffectif(
  role: RoleEquipe,
  rang: number,
  equipe: Pick<ClanTeam, "type" | "clanId">,
): string {
  return `${ROLES_EQUIPE[role].prefixe}_${rang}:${equipe.type}:${equipe.clanId}`;
}

export function modaleEffectif(
  equipe: ClanTeam,
  role: RoleEquipe,
): ModalBuilder {
  const config = ROLES_EQUIPE[role];
  const actuels = equipe.members.filter((m) => m.role === role);
  const champs = Array.from({ length: config.max }, (_, i) => {
    const entree = new TextInputBuilder()
      .setCustomId(idChampEffectif(role, i + 1, equipe))
      .setStyle(TextInputStyle.Short)
      .setMinLength(17)
      .setMaxLength(20)
      .setRequired(false);
    const lien = actuels[i];
    if (lien) entree.setValue(lien.userId);
    else entree.setPlaceholder(`ID Discord — ${config.libelle} ${i + 1}`);
    return new LabelBuilder()
      .setLabel(`${config.libelle} ${i + 1}`)
      .setTextInputComponent(entree);
  });
  return new ModalBuilder()
    .setCustomId(`team_manager_modal:${equipe.id}:${role}`)
    .setTitle(`Gestion ${role === 2 ? "du" : "des"} ${config.pluriel}`)
    .addLabelComponents(champs);
}

export function modaleParametresEquipe(equipe: ClanTeam): ModalBuilder {
  const nom = new TextInputBuilder()
    .setCustomId(`team_settings_name:${equipe.id}`)
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(30)
    .setValue(equipe.name);
  const modale = new ModalBuilder()
    .setCustomId(`team_settings_modal:${equipe.id}`)
    .setTitle("Paramètres de l'équipe")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Nom de l'équipe")
        .setDescription("3 à 30 caractères")
        .setTextInputComponent(nom),
    );
  const joueurs = equipe.members.filter((m) => m.role === 0);
  if (joueurs.length > 0) {
    modale.addLabelComponents(
      new LabelBuilder()
        .setLabel("Capitaine de l'équipe")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId(`team_settings_captain:${equipe.id}`)
            .setRequired(false)
            .addOptions(
              joueurs.map((j) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(borner(j.displayName, 100))
                  .setValue(j.userId)
                  .setDefault(j.userId === equipe.captainUserId),
              ),
            ),
        ),
    );
  }
  return modale;
}

/** Équipe désignée par le bouton legacy `team_manager_btn:<clanId>:<1|2>` → type 0/1. */
export function typeDepuisNumero(numero: string | undefined): 0 | 1 | null {
  if (numero === "1") return 0;
  if (numero === "2") return 1;
  return null;
}
