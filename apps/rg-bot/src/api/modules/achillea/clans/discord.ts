/**
 * Effets Discord des mutations de clan, via l'application Achilléa.
 *
 * Messages privés et messages de salon passent par `lib/achillea-discord.ts`
 * (`envoyerMpAchillea`, `publierSalonAchillea`). Les autres opérations que le
 * legacy faisait avec discord.js (rôles, salon du clan, fil d'invitation,
 * édition de message, émoji) sont des appels REST directs avec le même jeton.
 * Rien ici ne lève : chaque échec est consigné (`console.warn`) et rendu à
 * l'appelant, qui décide s'il est bloquant (seule la création de clan l'est).
 *
 * Les `custom_id` des boutons sont ceux du legacy, pour que les gestionnaires
 * d'interaction portés côté bot s'y raccordent.
 */

import { CLAN_MEMBER_ROLE_LABELS } from "@rosegriffon/achillea-core/labels";
import { ClanMemberRole } from "@rosegriffon/achillea-core/enums";
import { ACHILLEA_GUILD_ID } from "@rosegriffon/types/discord";
import {
  envoyerMpAchillea,
  jetonBotAchillea,
  publierSalonAchillea,
  type MessageAchillea,
  type ResultatEnvoi,
} from "../../../../lib/achillea-discord";

const API_DISCORD = "https://discord.com/api/v10";

/** Couleur de marque Achilléa (embeds neutres). */
export const COULEUR_ACHILLEA = 0x6d00ce;
export const COULEUR_SUCCES = 0x57f287;
export const COULEUR_ERREUR = 0xed4245;
export const COULEUR_AVERTISSEMENT = 0xe67e22;

/** Identifiants du serveur central (valeurs de production du legacy, surchargeables). */
export function configAchillea(env: Record<string, string | undefined> = Bun.env) {
  const lire = (cle: string, defaut: string) => (env[cle] ?? "").trim() || defaut;
  return {
    guildId: lire("ACHILLEA_CORE_GUILD_ID", ACHILLEA_GUILD_ID),
    clanCategoryId: lire("ACHILLEA_CLAN_CATEGORY_ID", "1457486074874957917"),
    clanInvitesForumId: lire("ACHILLEA_CLAN_INVITES_FORUM_ID", "1398801519729709128"),
    clanAnnouncementsChannelId: lire("ACHILLEA_CLAN_ANNOUNCEMENTS_CHANNEL_ID", "1398801515694788719"),
  };
}

/** Bits de permission Discord utilisés par le salon de clan. */
const PERMISSIONS = {
  viewChannel: 1n << 10n,
  sendMessages: 1n << 11n,
  manageMessages: 1n << 13n,
  attachFiles: 1n << 15n,
  readMessageHistory: 1n << 16n,
  useApplicationCommands: 1n << 31n,
} as const;

const bits = (...values: bigint[]) => values.reduce((acc, value) => acc | value, 0n).toString();

export type ResultatRest<T> = { ok: true; data: T } | { ok: false; statut: number | null; motif: string };

/** Appel REST Discord avec le jeton Achilléa ; ne lève jamais. */
export async function restAchillea<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  chemin: string,
  body?: unknown,
  raison?: string,
): Promise<ResultatRest<T>> {
  const jeton = jetonBotAchillea();
  if (!jeton) return { ok: false, statut: null, motif: "ACHILLEA_DISCORD_BOT_TOKEN absent" };
  try {
    const headers: Record<string, string> = { Authorization: `Bot ${jeton}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (raison) headers["X-Audit-Log-Reason"] = encodeURIComponent(raison.slice(0, 400));
    const reponse = await fetch(`${API_DISCORD}${chemin}`, {
      method,
      headers,
      ...(body === undefined || method === "GET" ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!reponse.ok) {
      return { ok: false, statut: reponse.status, motif: (await reponse.text().catch(() => "")).slice(0, 200) };
    }
    const texte = await reponse.text();
    return { ok: true, data: (texte ? JSON.parse(texte) : null) as T };
  } catch (err) {
    return { ok: false, statut: null, motif: err instanceof Error ? err.message : String(err) };
  }
}

/** Consigne un échec Discord sans interrompre la mutation. */
export function consigner(action: string, resultat: ResultatRest<unknown> | ResultatEnvoi): void {
  if (!resultat.ok) console.warn(`[achillea/clans] ${action} : échec Discord (${resultat.statut ?? "réseau"}) ${resultat.motif}`);
}

const mention = (userId: string) => `<@${userId}>`;
const mentionRole = (roleId: string) => `<@&${roleId}>`;

/** Échappe le Markdown Discord d'un nom saisi par un joueur. */
export function echapper(texte: string): string {
  return texte.replace(/([\\*_~`|>#[\]()-])/g, "\\$1");
}

export type Joueur = { id: string; nom: string; avatar: string };

// ---------------------------------------------------------------------------
// Embeds et composants (textes du legacy)
// ---------------------------------------------------------------------------

export const embedSucces = (message: string) => ({ color: COULEUR_SUCCES, title: `✅ ${message}` });
export const embedErreur = (message: string) => ({ color: COULEUR_ERREUR, title: `❌ ${message}` });
export const embedAvertissement = (message: string) => ({ color: COULEUR_AVERTISSEMENT, title: `⚠️ ${message}` });

export function embedJoueur(joueur: Joueur, titre: string, couleur: number, description?: string) {
  return {
    color: couleur,
    title: `${echapper(joueur.nom)} - ${titre}`,
    thumbnail: { url: joueur.avatar },
    ...(description ? { description } : {}),
  };
}

function boutons(...items: Array<{ label: string; style: 3 | 4; custom_id: string; emoji?: string }>) {
  return {
    type: 1,
    components: items.map(({ emoji, ...item }) => ({ type: 2, ...item, ...(emoji ? { emoji: { name: emoji } } : {}) })),
  };
}

export const boutonsInvitation = (inviteId: number) =>
  boutons(
    { label: "Confirmer", style: 3, custom_id: `confirm_invite:${inviteId}`, emoji: "✅" },
    { label: "Refuser", style: 4, custom_id: `cancel_invite:${inviteId}`, emoji: "✖️" },
  );

export const boutonsCandidature = (applicationId: number) =>
  boutons(
    { label: "Accepter", style: 3, custom_id: `confirm_application:${applicationId}`, emoji: "✅" },
    { label: "Refuser", style: 4, custom_id: `refuse_application:${applicationId}`, emoji: "✖️" },
  );

export const boutonsVote = (proposalId: number) =>
  boutons(
    { label: "Approuver", style: 3, custom_id: `vote:approve:${proposalId}` },
    { label: "Rejeter", style: 4, custom_id: `vote:reject:${proposalId}` },
  );

// ---------------------------------------------------------------------------
// Salons d'un clan
// ---------------------------------------------------------------------------

export type ClanDiscord = { id: number; name: string; channelId: string; roleId: string; broadcastChannel: string | null };

/** Salon du clan sur le serveur central + salon de diffusion du serveur du clan (legacy `logOnClanChannels`). */
export async function publierSalonsClan(clan: ClanDiscord, message: MessageAchillea, action: string) {
  const cibles = [clan.channelId, clan.broadcastChannel].filter((id): id is string => Boolean(id && /^\d+$/.test(id)));
  await Promise.all(cibles.map(async salon => consigner(action, await publierSalonAchillea(salon, message))));
}

export async function annoncerClans(message: MessageAchillea, action: string) {
  consigner(action, await publierSalonAchillea(configAchillea().clanAnnouncementsChannelId, message));
}

export async function mp(userId: string, message: MessageAchillea, action: string) {
  const resultat = await envoyerMpAchillea(userId, message);
  consigner(action, resultat);
  return resultat;
}

export async function ajouterRoleClan(userId: string, roleId: string, raison: string) {
  const { guildId } = configAchillea();
  const resultat = await restAchillea("PUT", `/guilds/${guildId}/members/${userId}/roles/${roleId}`, undefined, raison);
  consigner("ajout du rôle de clan", resultat);
  return resultat;
}

export async function retirerRoleClan(userId: string, roleId: string, raison: string) {
  const { guildId } = configAchillea();
  const resultat = await restAchillea("DELETE", `/guilds/${guildId}/members/${userId}/roles/${roleId}`, undefined, raison);
  consigner("retrait du rôle de clan", resultat);
  return resultat;
}

export async function modifierMessage(salonId: string, messageId: string, message: MessageAchillea, action: string) {
  consigner(action, await restAchillea("PATCH", `/channels/${salonId}/messages/${messageId}`, message));
}

export async function supprimerSalon(salonId: string, raison: string) {
  consigner("suppression de salon", await restAchillea("DELETE", `/channels/${salonId}`, undefined, raison));
}

// ---------------------------------------------------------------------------
// Création de clan : rôle, salon, émoji
// ---------------------------------------------------------------------------

/** Les fondateurs doivent être sur le serveur central (legacy `getUserAsGuildMember`). */
export async function membresAbsents(ids: readonly string[]): Promise<ResultatRest<string[]>> {
  const { guildId } = configAchillea();
  const absents: string[] = [];
  for (const id of ids) {
    const resultat = await restAchillea("GET", `/guilds/${guildId}/members/${id}`);
    if (resultat.ok) continue;
    if (resultat.statut === 404) absents.push(id);
    else return resultat;
  }
  return { ok: true, data: absents };
}

export type ProvisionClan = { roleId: string; channelId: string; emojiId: string };

/**
 * Rôle mentionnable attribué au président et aux fondateurs, puis salon privé
 * du clan dans la catégorie des clans (mêmes permissions que le legacy).
 * Bloquant : sans rôle ni salon, le clan n'est pas créé.
 */
export async function provisionnerClan(input: {
  name: string;
  shortName: string;
  presidentId: string;
  founderIds: readonly string[];
  logo: string;
}): Promise<ResultatRest<ProvisionClan>> {
  const { guildId, clanCategoryId } = configAchillea();
  const raison = `Rôle automatique suite à la création du Clan ${input.name}`;
  const role = await restAchillea<{ id: string }>(
    "POST",
    `/guilds/${guildId}/roles`,
    { name: input.name, mentionable: true },
    raison,
  );
  if (!role.ok) return role;
  const bot = await restAchillea<{ id: string }>("GET", "/users/@me");
  if (!bot.ok) {
    await annulerProvision({ roleId: role.data.id, channelId: "", emojiId: "" });
    return bot;
  }
  const salon = await restAchillea<{ id: string }>(
    "POST",
    `/guilds/${guildId}/channels`,
    {
      name: input.name,
      type: 0,
      parent_id: clanCategoryId,
      topic: `Dedicated to the Clan ${input.name}`,
      permission_overwrites: [
        {
          id: guildId,
          type: 0,
          deny: bits(PERMISSIONS.viewChannel, PERMISSIONS.sendMessages),
          allow: bits(PERMISSIONS.useApplicationCommands, PERMISSIONS.attachFiles),
        },
        { id: role.data.id, type: 0, allow: bits(PERMISSIONS.viewChannel, PERMISSIONS.readMessageHistory) },
        {
          id: bot.data.id,
          type: 1,
          allow: bits(PERMISSIONS.viewChannel, PERMISSIONS.sendMessages, PERMISSIONS.manageMessages),
        },
        { id: input.presidentId, type: 1, allow: bits(PERMISSIONS.sendMessages) },
      ],
    },
    raison,
  );
  if (!salon.ok) {
    await annulerProvision({ roleId: role.data.id, channelId: "", emojiId: "" });
    return salon;
  }
  await ajouterRoleClan(input.presidentId, role.data.id, `Captain of the Clan ${input.name}`);
  for (const id of input.founderIds)
    if (id !== input.presidentId) await ajouterRoleClan(id, role.data.id, `Founder of the Clan ${input.name}`);
  const emojiId = await televerserEmoji(input.logo, input.shortName, bot.data.id);
  return { ok: true, data: { roleId: role.data.id, channelId: salon.data.id, emojiId } };
}

/** Supprime ce qui a été créé sur Discord quand l'écriture en base échoue. */
export async function annulerProvision(provision: ProvisionClan) {
  const { guildId } = configAchillea();
  if (provision.channelId) await supprimerSalon(provision.channelId, "Création de clan annulée");
  if (provision.roleId)
    consigner(
      "suppression du rôle",
      await restAchillea("DELETE", `/guilds/${guildId}/roles/${provision.roleId}`, undefined, "Création de clan annulée"),
    );
}

/** Taille maximale d'un émoji d'application Discord. */
const EMOJI_MAX_OCTETS = 256 * 1024;

/**
 * Émoji d'application à partir du logo (legacy `uploadAsEmoji`). Non bloquant :
 * `""` si le logo est illisible ou trop lourd, comme la valeur par défaut de
 * `clan.clan_emoji_id`. Le nom porte un suffixe aléatoire : deux clans au même
 * sigle normalisé ne se volent plus l'émoji.
 */
async function televerserEmoji(logo: string, sigle: string, applicationId: string): Promise<string> {
  try {
    const reponse = await fetch(logo, { signal: AbortSignal.timeout(10_000) });
    const type = reponse.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!reponse.ok || !/^image\/(png|jpeg|gif|webp)$/.test(type)) {
      console.warn(`[achillea/clans] émoji : logo illisible (${reponse.status} ${type})`);
      return "";
    }
    const octets = new Uint8Array(await reponse.arrayBuffer());
    if (octets.byteLength > EMOJI_MAX_OCTETS) {
      console.warn(`[achillea/clans] émoji : logo de ${octets.byteLength} octets, au-delà de la limite Discord`);
      return "";
    }
    const base = sigle.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20) || "clan";
    const nom = `${base}_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const resultat = await restAchillea<{ id: string }>("POST", `/applications/${applicationId}/emojis`, {
      name: nom,
      image: `data:${type};base64,${Buffer.from(octets).toString("base64")}`,
    });
    consigner("téléversement de l'émoji", resultat);
    return resultat.ok ? resultat.data.id : "";
  } catch (err) {
    console.warn(`[achillea/clans] émoji : ${err instanceof Error ? err.message : String(err)}`);
    return "";
  }
}

/** Message de vote de fondation dans le salon du clan (legacy `initFoundingVoteProcedure`). */
export function messageVoteFondation(input: {
  proposalId: number;
  clan: { name: string; shortName: string; biography: string; avatarUrl: string };
  president: Joueur;
  founderIds: readonly string[];
}): MessageAchillea {
  const fondateurs = input.founderIds.filter(id => id !== input.president.id);
  return {
    content: `${fondateurs.map(mention).join(", ")}\n${mention(input.president.id)} souhaite fonder le clan ${echapper(input.clan.name)} avec vous ! Acceptez-vous ?`,
    embeds: [
      {
        color: COULEUR_ACHILLEA,
        title: `[${input.clan.shortName}] ${input.clan.name} - Clan foundation`,
        description: input.clan.biography || "Pas de biographie fournie",
        thumbnail: { url: input.clan.avatarUrl },
        fields: [
          { name: "Président", value: mention(input.president.id), inline: true },
          { name: "Fondateurs", value: input.founderIds.map(id => `- ${mention(id)}`).join("\n"), inline: true },
          { name: "Votes", value: `0 / ${fondateurs.length}`, inline: true },
        ],
      },
    ],
    components: [boutonsVote(input.proposalId)],
  };
}

// ---------------------------------------------------------------------------
// Messages par action
// ---------------------------------------------------------------------------

export function messageCandidature(clan: ClanDiscord, joueur: Joueur, distinctions: readonly string[], applicationId: number) {
  return {
    content: `${mentionRole(clan.roleId)} Cet utilisateur postule en tant que **${distinctions.join(", ")}**`,
    embeds: [embedJoueur(joueur, "Candidature", COULEUR_ACHILLEA)],
    components: [boutonsCandidature(applicationId)],
  } satisfies MessageAchillea;
}

export function messageInvitation(clanName: string, cibleId: string, inviteurId: string, distinctions: readonly string[], inviteId: number) {
  return {
    content: `${mention(cibleId)}, vous avez été invité à rejoindre le Clan ${echapper(clanName)} par ${mention(inviteurId)} en qualité de **${distinctions.join(", ")}**`,
    components: [boutonsInvitation(inviteId)],
  } satisfies MessageAchillea;
}

/** Ouvre le fil d'invitation dans le forum des invitations ; rend l'identifiant du fil. */
export async function ouvrirFilInvitation(nomFil: string, message: MessageAchillea): Promise<string | null> {
  const { clanInvitesForumId } = configAchillea();
  const resultat = await restAchillea<{ id: string }>("POST", `/channels/${clanInvitesForumId}/threads`, {
    name: nomFil.slice(0, 100) || "Invitation",
    message: { ...message, allowed_mentions: { parse: ["users"] } },
  });
  consigner("ouverture du fil d'invitation", resultat);
  return resultat.ok ? resultat.data.id : null;
}

export function messageRole(joueur: Joueur, role: ClanMemberRole, promotion: boolean): MessageAchillea {
  const libelle = CLAN_MEMBER_ROLE_LABELS[role];
  return {
    ...(promotion && role < ClanMemberRole.SubCaptain ? {} : { content: mention(joueur.id) }),
    embeds: [
      embedJoueur(
        joueur,
        promotion ? "Promotion" : "Rétrogradation",
        promotion ? COULEUR_SUCCES : COULEUR_ERREUR,
        `${promotion ? "Promotion" : "Rétrogradation"} au rôle de ${libelle}`,
      ),
    ],
  };
}
