/**
 * Écritures de gestion de clan (création, candidatures, invitations, effectif).
 *
 * Port des règles de `legacy/achillea-bot/src/services/ClanService.ts` et du
 * contrôleur `legacy/achillea-bot/src/api/controllers/clans.ts`. L'état vit en
 * base (Kysely) ; les effets Discord (rôle, salon, fil d'invitation, messages,
 * MP) partent après la transaction via `./discord` et ne font jamais échouer la
 * mutation — sauf à la création, où rôle et salon du clan sont un préalable,
 * comme dans le legacy.
 */

import { sql, type Kysely, type Transaction } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { normalizeNames, resolveDiscordAvatarUrl } from "@rosegriffon/achillea-core";
import { canActOnMember, canManageRecruitment, toDistinction } from "@rosegriffon/achillea-core/clans";
import {
  ClanMemberDistinction,
  ClanMemberRole,
  ClanState,
  NotificationCategory,
  NotificationType,
} from "@rosegriffon/achillea-core/enums";
import { isValidUrl } from "@rosegriffon/achillea-core/validation";
import { CLAN_MEMBER_ROLE_LABELS } from "@rosegriffon/achillea-core/labels";
import { publierSalonAchillea } from "../../../../lib/achillea-discord";
import { ClanService } from "./service";
import * as discord from "./discord";

type Db = Kysely<Database> | Transaction<Database>;

export type Failure = { ok: false; status: 400 | 403 | 404 | 409 | 502 | 503; error: string; code?: string };
type Result<T> = ({ ok: true } & T) | Failure;

function fail(status: Failure["status"], error: string, code?: string): Failure {
  return code ? { ok: false, status, error, code } : { ok: false, status, error };
}

/** Motif de départ stocké dans `clan_member_history.leave_reason` (enum legacy `LeaveReason`). */
export const LEAVE_REASON_KICK = 0;

/** En dessous de ce nombre de membres, un clan passe sous la limite (legacy `onMembershipChange`). */
export const MIN_CLAN_MEMBERS = 5;

/** Président + 4 fondateurs (legacy `validateFounders`). */
export const CLAN_FOUNDERS_COUNT = 5;

/** Délai minimal entre deux relances d'une même invitation (legacy : 12 h). */
export const INVITE_NOTIFY_COOLDOWN_MS = 12 * 60 * 60 * 1000;

/** Messages de `ClanCreationErrors` du legacy, repris tels quels. */
export const CLAN_CREATION_ERRORS = {
  INVALID_NAME: "Le nom est invalide et ne respecte pas le format demandé",
  NAME_TAKEN: "Le nom est déjà pris par un autre Clan",
  INVALID_SHORTNAME: "Le sigle est invalide et ne respecte pas le format demandé",
  SHORTNAME_TAKEN: "Le sigle est déjà pris par un autre Clan",
  DUPLICATE_FOUNDERS: "Vous ne pouvez pas créer un Clan avec une duplication des membres fondateurs",
  FOUNDER_IN_CLAN: "Un fondateur est déjà dans un autre Clan",
  WRONG_FOUNDERS_NUMBER: "Les fondateurs doivent être au nombre de 5: Président + 4 fondateurs",
  CLAN_CREATION_FAIL: "La création de Clan n'a pas pu aboutir",
  INVALID_SOCIALS: "Les URLs des réseaux sociaux sont invalides",
  UNKNOWN_FOUNDER: "Au moins un fondateur n'a pas encore de compte Achilléa",
} as const;

// ---------------------------------------------------------------------------
// Limites de membres (clé/valeur `data`, mêmes défauts et bornes que le legacy)
// ---------------------------------------------------------------------------

export type ClanMemberLimits = { playerLimit: number; staffLimit: number };

export const DEFAULT_CLAN_MEMBER_LIMITS: ClanMemberLimits = { playerLimit: 30, staffLimit: 7 };

export function normalizeClanMemberLimits(input: { playerLimit?: unknown; staffLimit?: unknown }): ClanMemberLimits {
  const bound = (value: unknown, fallback: number, min: number, max: number) => {
    const n = typeof value === "number" ? value : Number(value);
    if (value === undefined || value === null || !Number.isFinite(n)) return fallback;
    return Math.round(Math.max(min, Math.min(max, n)));
  };
  return {
    playerLimit: bound(input.playerLimit, DEFAULT_CLAN_MEMBER_LIMITS.playerLimit, 1, 100),
    staffLimit: bound(input.staffLimit, DEFAULT_CLAN_MEMBER_LIMITS.staffLimit, 1, 50),
  };
}

/** Quota dépassé par les distinctions demandées, ou `null` (legacy `checkClanMemberLimitExceeded`). */
export function memberLimitExceeded(
  counts: { players: number; staff: number },
  limits: ClanMemberLimits,
  desired: readonly ClanMemberDistinction[],
): "player" | "staff" | null {
  if (desired.includes(ClanMemberDistinction.Player) && counts.players >= limits.playerLimit) return "player";
  if (desired.includes(ClanMemberDistinction.Staff) && counts.staff >= limits.staffLimit) return "staff";
  return null;
}

async function readMemberLimits(db: Db): Promise<ClanMemberLimits> {
  try {
    const { rows } = await sql<{ key: string; value: string }>`
      select key, value from data where key in ('clanPlayerLimit', 'clanStaffLimit')
    `.execute(db);
    const parsed: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        parsed[row.key] = JSON.parse(row.value);
      } catch {
        // Valeur illisible : le défaut s'applique.
      }
    }
    return normalizeClanMemberLimits({ playerLimit: parsed.clanPlayerLimit, staffLimit: parsed.clanStaffLimit });
  } catch {
    return DEFAULT_CLAN_MEMBER_LIMITS;
  }
}

async function checkMemberLimits(db: Db, clanId: number, desired: readonly ClanMemberDistinction[]) {
  if (!desired.includes(ClanMemberDistinction.Player) && !desired.includes(ClanMemberDistinction.Staff)) return null;
  const [limits, members] = await Promise.all([
    readMemberLimits(db),
    db.selectFrom("clan_member").select("distinctions").where("clan_id", "=", clanId).execute(),
  ]);
  const counts = {
    players: members.filter(m => (m.distinctions ?? []).includes(ClanMemberDistinction.Player)).length,
    staff: members.filter(m => (m.distinctions ?? []).includes(ClanMemberDistinction.Staff)).length,
  };
  const exceeded = memberLimitExceeded(counts, limits, desired);
  if (exceeded === "player") return fail(400, `Le clan a déjà atteint la limite de ${limits.playerLimit} joueurs.`);
  if (exceeded === "staff") return fail(400, `Le clan a déjà atteint la limite de ${limits.staffLimit} staff.`);
  return null;
}

// ---------------------------------------------------------------------------
// Validation des entrées
// ---------------------------------------------------------------------------

/**
 * Normalise des distinctions (valeur d'enum ou clé anglaise historique).
 * `null` si l'une d'elles est inconnue — le legacy voulait rejeter ce cas mais
 * son `forEach(... return res.status(400))` n'interrompait rien.
 */
export function parseDistinctions(values: readonly string[]): ClanMemberDistinction[] | null {
  const out: ClanMemberDistinction[] = [];
  for (const value of values) {
    const known = toDistinction(value);
    if (known === null) return null;
    if (!out.includes(known)) out.push(known);
  }
  return out;
}

export function isClanMemberRole(value: unknown): value is ClanMemberRole {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= ClanMemberRole.Trial &&
    value <= ClanMemberRole.Captain
  );
}

export type ClanSocials = { xUrl: string | null; instagramUrl: string | null; tiktokUrl: string | null };

/** URL canonique d'un réseau social de clan (legacy `parseSocialMediaUrl`, limité à X/Instagram/TikTok). */
export function canonicalSocial(url: string): { platform: keyof ClanSocials; url: string } | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");
    let username = parsed.pathname.split("/").filter(Boolean)[0];
    if (!username) return null;
    let result: { platform: keyof ClanSocials; url: string };
    if (host === "instagram.com") result = { platform: "instagramUrl", url: `https://instagram.com/${username}` };
    else if (host === "tiktok.com") {
      username = username.replace(/^@/, "");
      result = { platform: "tiktokUrl", url: `https://tiktok.com/@${username}` };
    } else if (host === "x.com" || host === "twitter.com") result = { platform: "xUrl", url: `https://x.com/${username}` };
    else return null;
    return /^[\w.-]{1,30}$/.test(username) ? result : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lectures partagées
// ---------------------------------------------------------------------------

type Membership = { clan_id: number; user_id: string; role: number };

/**
 * Adhésion de référence d'un utilisateur : un clan non dissous, l'adhésion à
 * un clan actif étant préférée à celle d'un clan inactif (prêt/transfert).
 */
async function membershipOf(db: Db, userId: string): Promise<Membership | undefined> {
  const row = await db
    .selectFrom("clan_member as cm")
    .innerJoin("clan as c", "c.id", "cm.clan_id")
    .select(["cm.clan_id", "cm.user_id", "cm.role"])
    .where("cm.user_id", "=", userId)
    .where("c.is_disbanded", "=", false)
    .orderBy("c.is_inactive", "asc")
    .limit(1)
    .executeTakeFirst();
  return row ? { clan_id: row.clan_id, user_id: row.user_id, role: Number(row.role) } : undefined;
}

/** Une adhésion à un clan inactif ne bloque pas une nouvelle adhésion (legacy `hasActiveClanMembership`). */
async function hasActiveMembership(db: Db, userId: string): Promise<boolean> {
  const row = await db
    .selectFrom("clan_member as cm")
    .innerJoin("clan as c", "c.id", "cm.clan_id")
    .select("cm.clan_id")
    .where("cm.user_id", "=", userId)
    .where("c.is_inactive", "=", false)
    .where("c.is_disbanded", "=", false)
    .executeTakeFirst();
  return Boolean(row);
}

/** Vice-président ou président de son clan (legacy : `role < SubCaptain` → refus). */
async function managerOf(db: Db, userId: string): Promise<Result<{ member: Membership }>> {
  const member = await membershipOf(db, userId);
  if (!member) return fail(400, "Vous ne faites pas partie d'un Clan.");
  if (!canManageRecruitment(member.role as ClanMemberRole))
    return fail(403, "Vous n'avez pas les droits pour effectuer cette action");
  return { ok: true, member };
}

/**
 * Vice-président au minimum, et rôle strictement supérieur à la cible — sauf
 * le président, qui garde la main sur tout son effectif.
 */
export function canManageMember(executorRole: ClanMemberRole, targetRole: ClanMemberRole): boolean {
  return (
    canManageRecruitment(executorRole) &&
    (canActOnMember(executorRole, targetRole) || executorRole === ClanMemberRole.Captain)
  );
}

/**
 * Changement de rôle autorisé ? Règles absentes du legacy, qui laissait un
 * vice-président nommer un président et un président se rétrograder (clan
 * sans président). `null` si le changement est permis.
 */
export function roleChangeError(
  executor: { userId: string; role: ClanMemberRole },
  target: { userId: string; role: ClanMemberRole },
  newRole: ClanMemberRole,
): Failure | null {
  if (newRole === target.role) return null;
  if (executor.userId === target.userId) return fail(400, "Vous ne pouvez pas modifier votre propre rôle.");
  if (newRole === ClanMemberRole.Captain) return fail(400, "La présidence ne se transmet pas par cette action.");
  if (executor.role !== ClanMemberRole.Captain && !canActOnMember(executor.role, newRole))
    return fail(403, "Vous ne pouvez pas attribuer un rôle égal ou supérieur au vôtre.");
  return null;
}

/**
 * Droits d'un membre sur un autre (legacy `verifyClanMemberManagementPermissions`) :
 * même clan, vice-président au minimum, et rôle strictement supérieur à la
 * cible — sauf le président, qui garde la main sur tout son effectif.
 */
async function memberManagement(
  db: Db,
  executorId: string,
  targetId: string,
): Promise<Result<{ executor: Membership; target: Membership }>> {
  const executor = await membershipOf(db, executorId);
  if (!executor) return fail(403, "Vous n'êtes pas dans un Clan.");
  const target = await db
    .selectFrom("clan_member")
    .select(["clan_id", "user_id", "role"])
    .where("user_id", "=", targetId)
    .where("clan_id", "=", executor.clan_id)
    .executeTakeFirst();
  if (!target) {
    const elsewhere = await membershipOf(db, targetId);
    return elsewhere
      ? fail(403, "Vous ne pouvez pas gérer les Membres d'autres Clans.")
      : fail(404, "Impossible de trouver le Membre ciblé.");
  }
  const targetRole = Number(target.role) as ClanMemberRole;
  if (!canManageMember(executor.role as ClanMemberRole, targetRole))
    return fail(403, "Vous n'avez pas les permissions pour modifier ce membre.");
  return { ok: true, executor, target: { ...target, role: targetRole } };
}

/** Effectif d'un clan, même projection que `GET /clans/:id/members`. */
export async function clanMembers(db: Db, clanId: number) {
  const rows = await db
    .selectFrom("clan_member as cm")
    .innerJoin("user as u", "u.id", "cm.user_id")
    .select([
      "cm.clan_id",
      "cm.user_id",
      "cm.created_at",
      "cm.updated_at",
      "cm.clan_fame_contributed",
      "cm.role",
      "cm.distinctions",
      "u.display_name",
      "u.username",
      "u.avatar",
      "u.role as user_role",
    ])
    .where("cm.clan_id", "=", clanId)
    .orderBy("cm.role", "asc")
    .execute();
  return rows.map(row => ({
    clanRole: Number(row.role),
    distinctions: row.distinctions ?? [],
    clanFameContributed: Number(row.clan_fame_contributed ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: row.user_id,
      type: "user" as const,
      username: row.display_name || row.username || row.user_id,
      avatar: resolveDiscordAvatarUrl(row.user_id, row.avatar),
      clanId: row.clan_id,
      role: Number(row.user_role ?? 0),
    },
  }));
}

// ---------------------------------------------------------------------------
// Contexte Discord (lectures après transaction)
// ---------------------------------------------------------------------------

async function clanDiscord(db: Db, clanId: number): Promise<discord.ClanDiscord | null> {
  const row = await db
    .selectFrom("clan as c")
    .leftJoin("guild as g", "g.id", "c.guild_id")
    .select(["c.id", "c.name", "c.channel_id", "c.role_id", "g.broadcast_channel"])
    .where("c.id", "=", clanId)
    .executeTakeFirst();
  return row
    ? {
        id: row.id,
        name: row.name,
        channelId: row.channel_id,
        roleId: row.role_id,
        broadcastChannel: row.broadcast_channel ?? null,
      }
    : null;
}

async function joueurs(db: Db, ids: readonly string[]): Promise<Map<string, discord.Joueur>> {
  const unique = [...new Set(ids)];
  const rows = unique.length
    ? await db.selectFrom("user").select(["id", "display_name", "username", "avatar"]).where("id", "in", unique).execute()
    : [];
  const map = new Map(
    rows.map(row => [
      row.id,
      { id: row.id, nom: row.display_name || row.username || row.id, avatar: resolveDiscordAvatarUrl(row.id, row.avatar) },
    ]),
  );
  for (const id of unique)
    if (!map.has(id)) map.set(id, { id, nom: id, avatar: resolveDiscordAvatarUrl(id, null) });
  return map;
}

type AcceptedApplication = {
  applicationId: number;
  userId: string;
  clanId: number;
  distinctions: string[];
  messageId: string | null;
};

async function acceptApplicationRow(
  trx: Transaction<Database>,
  application: { id: number; user_id: string; clan_id: number; distinctions: string[] | null; message_id: string | null },
): Promise<Result<{ accepted: AcceptedApplication }>> {
  if (await hasActiveMembership(trx, application.user_id))
    return fail(400, "Cet Utilisateur fait déjà partie d'un Clan");
  await trx.deleteFrom("clan_application").where("user_id", "=", application.user_id).execute();
  // Adhésion conservée à un clan inactif : la nouvelle s'y ajoute (prêt/transfert implicite).
  await trx
    .insertInto("clan_member")
    .values({
      clan_id: application.clan_id,
      user_id: application.user_id,
      role: ClanMemberRole.Trial,
      distinctions: application.distinctions ?? [],
    })
    .onConflict(oc => oc.columns(["clan_id", "user_id"]).doNothing())
    .execute();
  return {
    ok: true,
    accepted: {
      applicationId: application.id,
      userId: application.user_id,
      clanId: application.clan_id,
      distinctions: application.distinctions ?? [],
      messageId: application.message_id,
    },
  };
}

/** Effets Discord d'une candidature acceptée (legacy `acceptApplication`, après la transaction). */
async function annoncerAdmission(db: Kysely<Database>, accepted: AcceptedApplication, executorId: string | null) {
  const [clan, gens] = await Promise.all([
    clanDiscord(db, accepted.clanId),
    joueurs(db, executorId ? [accepted.userId, executorId] : [accepted.userId]),
  ]);
  if (!clan) return;
  const joueur = gens.get(accepted.userId)!;
  await discord.ajouterRoleClan(joueur.id, clan.roleId, `Candidature acceptée (Clan ${clan.name})`);
  if (accepted.messageId)
    await discord.modifierMessage(
      clan.channelId,
      accepted.messageId,
      { content: "", embeds: [discord.embedJoueur(joueur, "Candidature acceptée", discord.COULEUR_SUCCES)], components: [] },
      "mise à jour du message de candidature",
    );
  if (executorId) {
    const executeur = gens.get(executorId)!;
    await discord.publierSalonsClan(
      clan,
      {
        embeds: [
          discord.embedSucces(
            `La candidature de l'utilisateur ${discord.echapper(joueur.nom)} a été acceptée par ${discord.echapper(executeur.nom)}`,
          ),
        ],
      },
      "journal de candidature acceptée",
    );
  }
  await discord.publierSalonsClan(
    clan,
    {
      embeds: [
        {
          ...discord.embedJoueur(joueur, "Nouveau membre", discord.COULEUR_SUCCES),
          description: `__*Clan rejoint le ${new Date().toLocaleDateString("fr-FR")}*__`,
          fields: [
            { name: "Rôle", value: CLAN_MEMBER_ROLE_LABELS[ClanMemberRole.Trial], inline: true },
            { name: "Distinctions", value: accepted.distinctions.join("\n") || "—", inline: true },
          ],
        },
      ],
    },
    "annonce du nouveau membre",
  );
  await discord.annoncerClans(
    {
      embeds: [
        discord.embedJoueur(
          joueur,
          "Nouveau membre",
          discord.COULEUR_SUCCES,
          `${discord.echapper(joueur.nom)} a rejoint ${discord.echapper(clan.name)} !`,
        ),
      ],
    },
    "annonce générale du nouveau membre",
  );
  await discord.mp(
    joueur.id,
    {
      embeds: [
        {
          color: discord.COULEUR_ACHILLEA,
          title: `Bienvenue dans le Clan ${clan.name} !`,
          description: `Ta candidature au Clan **${discord.echapper(clan.name)}** a été acceptée. Tu rejoins l'effectif en tant que ${CLAN_MEMBER_ROLE_LABELS[ClanMemberRole.Trial]}.`,
        },
      ],
    },
    "MP de candidature acceptée",
  );
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export type NewClanInput = {
  founders: Array<{ id: string }>;
  logo: string;
  name: string;
  shortName: string;
  description: string;
  twitter?: string;
  instagram?: string;
  tiktok?: string;
  origin?: { code: string };
  languages?: Array<{ code: string }>;
};

/** Durée du vote de fondation (legacy : 24 h, majorité). */
export const FOUNDING_VOTE_DURATION_MS = 24 * 60 * 60 * 1000;

export abstract class ClanManagementService {
  /** `POST /clans/create` — legacy `ClansController.submitForm`. */
  static async create(db: Kysely<Database>, presidentId: string, dto: NewClanInput): Promise<Result<{ clanId: number }>> {
    if (await hasActiveMembership(db, presidentId)) return fail(400, "Vous faites déjà partie d'un Clan.", "IN_CLAN");

    const founderIds = [presidentId, ...dto.founders.map(founder => founder.id.trim())];
    if (founderIds.length !== CLAN_FOUNDERS_COUNT)
      return fail(400, CLAN_CREATION_ERRORS.WRONG_FOUNDERS_NUMBER, "FOUNDERS");
    if (new Set(founderIds).size !== founderIds.length)
      return fail(400, CLAN_CREATION_ERRORS.DUPLICATE_FOUNDERS, "FOUNDERS");
    // Le legacy synchronisait les fondateurs depuis Discord à la volée ; ici un
    // fondateur doit déjà avoir un compte Achilléa (toute connexion le crée).
    const known = await db.selectFrom("user").select("id").where("id", "in", founderIds).execute();
    if (known.length !== founderIds.length) return fail(400, CLAN_CREATION_ERRORS.UNKNOWN_FOUNDER, "FOUNDERS");
    const inClan = await db.selectFrom("clan_member").select("user_id").where("user_id", "in", founderIds).execute();
    if (inClan.length > 0) return fail(400, CLAN_CREATION_ERRORS.FOUNDER_IN_CLAN, "FOUNDERS");

    const name = dto.name.trim();
    const shortName = dto.shortName.trim();
    const validName = await ClanService.validateName(db, name);
    if (!validName.valid) return fail(400, CLAN_CREATION_ERRORS[validName.code], "NAME");
    const validShortName = await ClanService.validateShortName(db, shortName);
    if (!validShortName.valid) return fail(400, CLAN_CREATION_ERRORS[validShortName.code], "SHORT_NAME");

    const socials: ClanSocials = { xUrl: null, instagramUrl: null, tiktokUrl: null };
    for (const raw of [dto.twitter, dto.instagram, dto.tiktok]) {
      if (!raw?.trim()) continue;
      const social = canonicalSocial(raw);
      if (social && socials[social.platform] === null) socials[social.platform] = social.url;
    }
    if (!socials.xUrl && !socials.instagramUrl && !socials.tiktokUrl)
      return fail(400, CLAN_CREATION_ERRORS.INVALID_SOCIALS, "SOCIALS");

    const logo = dto.logo.trim();
    if (!isValidUrl(logo) || !/^https?:\/\//i.test(logo)) return fail(400, "Logo invalide.", "LOGO");
    const logoTaken = await db.selectFrom("clan").select("id").where("clan_avatar_url", "=", logo).executeTakeFirst();
    if (logoTaken) return fail(409, "Cette image est déjà utilisée par un autre clan.", "LOGO");

    const biography = dto.description.trim();
    if (biography.length > 1500) return fail(400, "Biographie trop longue (1500 caractères max).", "DESCRIPTION");

    // Présence sur le serveur central, puis rôle + salon du clan : préalables
    // Discord du legacy, vérifiés avant toute écriture en base.
    const absents = await discord.membresAbsents(founderIds);
    if (!absents.ok) return fail(503, "Discord Achilléa est indisponible, réessayez plus tard.", "DISCORD_UNAVAILABLE");
    if (absents.data.length > 0)
      return fail(400, "Au moins un fondateur n'est pas présent sur le Discord d'Achillea", "DISCORD_USER_FETCH_ERROR");
    const provision = await discord.provisionnerClan({ name, shortName, presidentId, founderIds, logo });
    if (!provision.ok) {
      discord.consigner("provisionnement du clan", provision);
      return fail(503, "Discord Achilléa est indisponible, réessayez plus tard.", "DISCORD_UNAVAILABLE");
    }

    let created: { clanId: number; proposalId: number };
    try {
      created = await db.transaction().execute(async trx => {
        const clan = await trx
          .insertInto("clan")
          .values({
            founders: founderIds,
            name,
            normalized_name: normalizeNames(name),
            shortened_name: shortName,
            normalized_short_name: normalizeNames(shortName),
            clan_avatar_url: logo,
            clan_biography: biography,
            x_url: socials.xUrl,
            instagram_url: socials.instagramUrl,
            tiktok_url: socials.tiktokUrl,
            role_id: provision.data.roleId,
            channel_id: provision.data.channelId,
            clan_emoji_id: provision.data.emojiId,
            state: ClanState.Creating,
            origin: dto.origin?.code ?? "",
            languages: dto.languages?.map(language => language.code) ?? [],
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        await trx
          .insertInto("clan_member")
          .values({
            clan_id: clan.id,
            user_id: presidentId,
            role: ClanMemberRole.Captain,
            distinctions: [ClanMemberDistinction.Staff],
          })
          .execute();
        // Vote de fondation (legacy `initFoundingVoteProcedure`) : tables MikroORM
        // historiques `vote_proposal` / `vote_proposal_eligible_voters`, hors schéma typé.
        const now = new Date();
        const presidentName = (await joueurs(trx, [presidentId])).get(presidentId)!.nom;
        const proposal = await sql<{ id: number }>`
          insert into vote_proposal
            (created_at, updated_at, type, target_entity_type, target_entity_id, reason, strategy, expires_at)
          values
            (${now}, ${now}, 'CLAN_CREATION', 'Clan', ${clan.id},
             ${`Proposition de création du Clan ${name} par ${presidentName}`.slice(0, 255)},
             'MAJORITY', ${new Date(now.getTime() + FOUNDING_VOTE_DURATION_MS)})
          returning id
        `.execute(trx);
        const proposalId = Number(proposal.rows[0]!.id);
        for (const voter of founderIds.slice(1))
          await sql`insert into vote_proposal_eligible_voters (vote_proposal_id, user_id) values (${proposalId}, ${voter})`.execute(
            trx,
          );
        return { clanId: clan.id, proposalId };
      });
    } catch (error) {
      await discord.annulerProvision(provision.data);
      // Course perdue sur une contrainte unique (nom, sigle, logo).
      if ((error as { code?: string })?.code === "23505")
        return fail(409, CLAN_CREATION_ERRORS.CLAN_CREATION_FAIL, "CLAN_CREATION_FAIL");
      throw error;
    }

    const president = (await joueurs(db, [presidentId])).get(presidentId)!;
    discord.consigner(
      "message de vote de fondation",
      await publierSalonAchilleaSafe(
        provision.data.channelId,
        discord.messageVoteFondation({
          proposalId: created.proposalId,
          clan: { name, shortName, biography, avatarUrl: logo },
          president,
          founderIds,
        }),
      ),
    );
    return { ok: true, clanId: created.clanId };
  }

  /** `POST /clans/applications/create` — legacy `applyToClan`. */
  static async apply(
    db: Kysely<Database>,
    userId: string,
    clanId: number,
    distinctions: ClanMemberDistinction[],
  ): Promise<Result<{ autojoin: boolean }>> {
    const result = await db.transaction().execute(
      async (trx): Promise<Result<{ applicationId: number; accepted: AcceptedApplication | null }>> => {
        const clan = await trx
          .selectFrom("clan")
          .select(["id", "auto_accept_members"])
          .where("id", "=", clanId)
          .where("is_disbanded", "=", false)
          .forUpdate()
          .executeTakeFirst();
        if (!clan) return fail(404, "Clan introuvable.");
        if (await hasActiveMembership(trx, userId)) return fail(400, "Vous faites déjà partie d'un Clan.");
        const already = await trx
          .selectFrom("clan_application")
          .select("id")
          .where("user_id", "=", userId)
          .where("clan_id", "=", clanId)
          .executeTakeFirst();
        if (already) return fail(400, "Vous avez déjà soumis votre candidature auprès de ce Clan.");
        const limit = await checkMemberLimits(trx, clanId, distinctions);
        if (limit) return limit;

        const application = await trx
          .insertInto("clan_application")
          .values({ user_id: userId, clan_id: clanId, distinctions })
          .returning(["id", "user_id", "clan_id", "distinctions", "message_id"])
          .executeTakeFirstOrThrow();
        if (!clan.auto_accept_members) return { ok: true, applicationId: application.id, accepted: null };
        const accepted = await acceptApplicationRow(trx, application);
        if (!accepted.ok) return accepted;
        return { ok: true, applicationId: application.id, accepted: accepted.accepted };
      },
    );
    if (!result.ok) return result;
    if (result.accepted) {
      await annoncerAdmission(db, result.accepted, null);
      return { ok: true, autojoin: true };
    }

    const [clan, gens] = await Promise.all([clanDiscord(db, clanId), joueurs(db, [userId])]);
    if (clan) {
      const envoi = await publierSalonAchilleaSafe(
        clan.channelId,
        discord.messageCandidature(clan, gens.get(userId)!, distinctions, result.applicationId),
      );
      discord.consigner("publication de la candidature", envoi);
      if (envoi.ok)
        await db
          .updateTable("clan_application")
          .set({ message_id: envoi.id })
          .where("id", "=", result.applicationId)
          .execute();
    }
    return { ok: true, autojoin: false };
  }

  /** `POST /clans/applications/accept` — legacy `acceptApplication`. */
  static async acceptApplication(db: Kysely<Database>, executorId: string, applicationId: number): Promise<Result<object>> {
    const result = await db.transaction().execute(async (trx): Promise<Result<{ accepted: AcceptedApplication }>> => {
      const access = await managerOf(trx, executorId);
      if (!access.ok) return access;
      const application = await trx
        .selectFrom("clan_application")
        .select(["id", "user_id", "clan_id", "distinctions", "message_id"])
        .where("id", "=", applicationId)
        .forUpdate()
        .executeTakeFirst();
      if (!application) return fail(404, "Candidature introuvable.");
      if (application.clan_id !== access.member.clan_id)
        return fail(403, "Vous ne pouvez pas gérer les candidatures des autres Clans.");
      return acceptApplicationRow(trx, application);
    });
    if (!result.ok) return result;
    await annoncerAdmission(db, result.accepted, executorId);
    return { ok: true };
  }

  /** `POST /clans/applications/reject` — legacy `rejectApplication`. */
  static async rejectApplication(db: Kysely<Database>, executorId: string, applicationId: number): Promise<Result<object>> {
    const access = await managerOf(db, executorId);
    if (!access.ok) return access;
    const application = await db
      .selectFrom("clan_application")
      .select(["id", "clan_id", "user_id", "message_id"])
      .where("id", "=", applicationId)
      .executeTakeFirst();
    if (!application) return fail(404, "Candidature introuvable.");
    if (application.clan_id !== access.member.clan_id)
      return fail(403, "Vous ne pouvez pas gérer les candidatures des autres Clans.");
    await db.deleteFrom("clan_application").where("id", "=", applicationId).execute();

    const [clan, gens] = await Promise.all([
      clanDiscord(db, application.clan_id),
      joueurs(db, [application.user_id, executorId]),
    ]);
    if (clan) {
      const joueur = gens.get(application.user_id)!;
      if (application.message_id)
        await discord.modifierMessage(
          clan.channelId,
          application.message_id,
          { content: "", embeds: [discord.embedJoueur(joueur, "Candidature rejetée", discord.COULEUR_ERREUR)], components: [] },
          "mise à jour du message de candidature",
        );
      await discord.publierSalonsClan(
        clan,
        {
          embeds: [
            discord.embedErreur(
              `La candidature de l'utilisateur ${discord.echapper(joueur.nom)} a été refusée par ${discord.echapper(gens.get(executorId)!.nom)}`,
            ),
          ],
        },
        "journal de candidature refusée",
      );
      await discord.mp(
        joueur.id,
        {
          embeds: [
            {
              color: discord.COULEUR_ACHILLEA,
              title: "Candidature refusée",
              description: `Ta candidature au Clan **${discord.echapper(clan.name)}** n'a pas été retenue.`,
            },
          ],
        },
        "MP de candidature refusée",
      );
    }
    return { ok: true };
  }

  /** `POST /clans/invites/create` — legacy `inviteUser` + `createInviteThread`. */
  static async invite(
    db: Kysely<Database>,
    executorId: string,
    targetId: string,
    distinctions: ClanMemberDistinction[],
  ): Promise<Result<object>> {
    const result = await db.transaction().execute(async (trx): Promise<Result<{ inviteId: number; clanId: number }>> => {
      const access = await managerOf(trx, executorId);
      if (!access.ok) return access;
      const clanId = access.member.clan_id;
      await trx.selectFrom("clan").select("id").where("id", "=", clanId).forUpdate().executeTakeFirst();
      const target = await trx.selectFrom("user").select("id").where("id", "=", targetId).executeTakeFirst();
      if (!target) return fail(404, "L'Utilisateur ciblé est introuvable.");
      if (await hasActiveMembership(trx, targetId)) return fail(400, "L'Utilisateur ciblé fait déjà partie d'un Clan.");
      const already = await trx
        .selectFrom("clan_invite")
        .select("id")
        .where("user_id", "=", targetId)
        .where("clan_id", "=", clanId)
        .executeTakeFirst();
      if (already) return fail(400, "L'utilisateur ciblé a déjà une invitation en attente de votre part !");
      const limit = await checkMemberLimits(trx, clanId, distinctions);
      if (limit) return limit;
      const invite = await trx
        .insertInto("clan_invite")
        .values({ user_id: targetId, clan_id: clanId, inviter_id: executorId, distinctions, thread_id: null })
        .returning("id")
        .executeTakeFirstOrThrow();
      return { ok: true, inviteId: invite.id, clanId };
    });
    if (!result.ok) return result;

    const [clan, gens] = await Promise.all([clanDiscord(db, result.clanId), joueurs(db, [targetId])]);
    if (clan) {
      const message = discord.messageInvitation(clan.name, targetId, executorId, distinctions, result.inviteId);
      const threadId = await discord.ouvrirFilInvitation(gens.get(targetId)!.nom, message);
      if (threadId)
        await db.updateTable("clan_invite").set({ thread_id: threadId }).where("id", "=", result.inviteId).execute();
      // Le legacy ne faisait que mentionner le joueur dans le fil ; le MP porte
      // les mêmes boutons pour qu'il puisse répondre sans chercher le forum.
      await discord.mp(targetId, message, "MP d'invitation de clan");
    }
    return { ok: true };
  }

  /**
   * Charge une invitation du clan de l'exécutant. Le legacy faisait confiance à
   * l'invitation envoyée dans le corps (rôle de l'inviteur compris) et ne
   * vérifiait pas qu'elle appartenait au clan de l'exécutant.
   */
  private static async managedInvite(db: Kysely<Database>, executorId: string, inviteId: number) {
    const access = await managerOf(db, executorId);
    if (!access.ok) return access;
    const invite = await db
      .selectFrom("clan_invite")
      .select(["id", "clan_id", "user_id", "inviter_id", "thread_id", "last_notified_at"])
      .where("id", "=", inviteId)
      .executeTakeFirst();
    if (!invite || invite.clan_id !== access.member.clan_id)
      return fail(400, "Cette invitation n'existe pas. Essayez de synchroniser les données !");
    return { ok: true as const, executor: access.member, invite };
  }

  /** `POST /clans/invites/revoke` — legacy `revokeInvite`. */
  static async revokeInvite(db: Kysely<Database>, executorId: string, inviteId: number): Promise<Result<object>> {
    const found = await ClanManagementService.managedInvite(db, executorId, inviteId);
    if (!found.ok) return found;
    const { executor, invite } = found;
    if (invite.inviter_id !== executor.user_id && executor.role !== ClanMemberRole.Captain) {
      const inviter = await db
        .selectFrom("clan_member")
        .select("role")
        .where("clan_id", "=", invite.clan_id)
        .where("user_id", "=", invite.inviter_id)
        .executeTakeFirst();
      // Inviteur parti du clan : plus de hiérarchie à protéger.
      if (inviter && executor.role <= Number(inviter.role))
        return fail(403, "Vous n'avez pas les droits pour effectuer cette action");
    }
    await db.deleteFrom("clan_invite").where("id", "=", invite.id).execute();
    if (invite.thread_id) await discord.supprimerSalon(invite.thread_id, "Invitation de clan révoquée");
    return { ok: true };
  }

  /**
   * `POST /clans/invites/notify` — legacy `sendInviteNotification` : relance
   * dans le fil d'invitation (MP si le fil manque), au plus toutes les 12 h.
   * Le legacy ne mettait jamais `last_notified_at` à jour : le délai ne
   * s'appliquait qu'à partir de la création.
   */
  static async notifyInvite(
    db: Kysely<Database>,
    executorId: string,
    inviteId: number,
    now = Date.now(),
  ): Promise<Result<object>> {
    const found = await ClanManagementService.managedInvite(db, executorId, inviteId);
    if (!found.ok) return found;
    const { invite } = found;
    if (now - new Date(invite.last_notified_at).getTime() < INVITE_NOTIFY_COOLDOWN_MS)
      return fail(400, "Vous avez notifié cet utilisateur trop récemment, veuillez patienter !");
    const relance = {
      content: `<@${invite.user_id}>, vous avez une invitation sans réponse de la part de <@${invite.inviter_id}> !`,
    };
    let envoi = invite.thread_id ? await publierSalonAchilleaSafe(invite.thread_id, relance) : null;
    if (!envoi?.ok) {
      if (envoi) discord.consigner("relance dans le fil d'invitation", envoi);
      envoi = await discord.mp(
        invite.user_id,
        { ...relance, components: [discord.boutonsInvitation(invite.id)] },
        "MP de relance d'invitation",
      );
    }
    if (!envoi.ok) return fail(502, "La relance n'a pas pu être envoyée sur Discord.");
    await db
      .updateTable("clan_invite")
      .set({ last_notified_at: new Date(now), updated_at: new Date(now) })
      .where("id", "=", inviteId)
      .execute();
    return { ok: true };
  }

  /** `POST /clans/kick/:id` — legacy `kickMember` + `turnClanMemberIntoHistory` + `onMembershipChange`. */
  static async kick(
    db: Kysely<Database>,
    executorId: string,
    targetId: string,
    rawReason: string | undefined,
  ): Promise<Result<{ clanId: number }>> {
    const result = await db.transaction().execute(
      async (trx): Promise<Result<{ clanId: number; clanName: string; underLimitNow: boolean }>> => {
        const access = await memberManagement(trx, executorId, targetId);
        if (!access.ok) return access;
        if (access.executor.user_id === targetId) return fail(400, "Vous ne pouvez pas vous exclure vous-même");
        const reason = rawReason?.trim() ?? "";
        if (reason.length < 3) return fail(400, "Veuillez fournir une raison valide (au moins 3 caractères).");

        const clanId = access.executor.clan_id;
        const clan = await trx
          .selectFrom("clan")
          .select(["id", "name", "under_member_limit"])
          .where("id", "=", clanId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        const member = await trx
          .deleteFrom("clan_member")
          .where("clan_id", "=", clanId)
          .where("user_id", "=", targetId)
          .returningAll()
          .executeTakeFirstOrThrow();
        await trx
          .insertInto("clan_member_history")
          .values({
            user_id: targetId,
            clan_id: clanId,
            join_date: member.created_at,
            leave_reason: LEAVE_REASON_KICK,
            kick_reason: reason,
            clan_fame_contributed: member.clan_fame_contributed,
            role: member.role,
          })
          .execute();

        const gens = await joueurs(trx, [targetId, executorId]);
        const cible = gens.get(targetId)!.nom;
        const executeur = gens.get(executorId)!.nom;
        const notification = await trx
          .insertInto("notification")
          .values({
            title: "Expulsion",
            message: `L'utilisateur ${cible} a été expulsé par ${executeur} !`,
            type: NotificationType.CLAN_MEMBER_KICK,
            category: NotificationCategory.CLAN,
            payload: {
              targetId,
              targetName: cible,
              clanId,
              clanName: clan.name,
              executorId,
              executorName: executeur,
            },
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        const remaining = await trx.selectFrom("clan_member").select("user_id").where("clan_id", "=", clanId).execute();
        if (remaining.length > 0)
          await trx
            .insertInto("user_notification")
            .values(remaining.map(({ user_id }) => ({ user_id, notification_id: notification.id })))
            .execute();

        // `under_member_limit` est l'état que lit la vérification de dissolution à 24 h.
        const underLimitNow = remaining.length < MIN_CLAN_MEMBERS && !clan.under_member_limit;
        if (underLimitNow)
          await trx
            .updateTable("clan")
            .set({ under_member_limit: true, updated_at: new Date() })
            .where("id", "=", clanId)
            .execute();
        return { ok: true, clanId, clanName: clan.name, underLimitNow };
      },
    );
    if (!result.ok) return result;

    const [clan, gens] = await Promise.all([clanDiscord(db, result.clanId), joueurs(db, [targetId, executorId])]);
    if (clan) {
      const cible = gens.get(targetId)!;
      const executeur = gens.get(executorId)!;
      const reason = rawReason!.trim();
      await discord.retirerRoleClan(targetId, clan.roleId, `Expulsé du Clan ${clan.name}`);
      await discord.publierSalonsClan(
        clan,
        {
          embeds: [
            discord.embedSucces(
              `L'utilisateur ${discord.echapper(cible.nom)} a été expulsé par ${discord.echapper(executeur.nom)} !`,
            ),
          ],
        },
        "journal d'expulsion",
      );
      await discord.publierSalonsClan(
        clan,
        { embeds: [discord.embedJoueur(cible, "Expulsion", discord.COULEUR_ERREUR, `**Raison :** ${reason}`)] },
        "fiche de départ",
      );
      await discord.annoncerClans(
        {
          embeds: [
            discord.embedJoueur(
              cible,
              "Expulsion",
              discord.COULEUR_ERREUR,
              `${discord.echapper(cible.nom)} a été exclu du Clan ${discord.echapper(clan.name)}\n\n**Raison :** ${reason}`,
            ),
          ],
        },
        "annonce générale d'expulsion",
      );
      await discord.mp(
        targetId,
        {
          embeds: [
            {
              color: discord.COULEUR_ACHILLEA,
              title: "Expulsion",
              description: `Tu as été exclu du Clan **${discord.echapper(clan.name)}**.\n\n**Raison :** ${reason}`,
            },
          ],
        },
        "MP d'expulsion",
      );
      if (result.underLimitNow)
        await discord.publierSalonsClan(
          clan,
          {
            embeds: [
              discord.embedAvertissement(
                `Nombre de membres inférieur au minimum autorisé ${MIN_CLAN_MEMBERS} ! Le clan sera dissout dans 24h si la situation n'a pas évolué.`,
              ),
            ],
          },
          "avertissement de sous-effectif",
        );
    }
    return { ok: true, clanId: result.clanId };
  }

  /** `POST /clans/updateMember` — legacy `UpdateMemberRolesAndDistinctions` + `logPromote` / `logDemote`. */
  static async updateMember(
    db: Kysely<Database>,
    executorId: string,
    targetId: string,
    role: ClanMemberRole,
    distinctions: ClanMemberDistinction[],
  ): Promise<Result<{ clanId: number }>> {
    const result = await db.transaction().execute(
      async (trx): Promise<Result<{ clanId: number; previousRole: ClanMemberRole }>> => {
        const access = await memberManagement(trx, executorId, targetId);
        if (!access.ok) return access;
        const { executor, target } = access;
        const refused = roleChangeError(
          { userId: executor.user_id, role: executor.role as ClanMemberRole },
          { userId: targetId, role: target.role as ClanMemberRole },
          role,
        );
        if (refused) return refused;
        await trx
          .updateTable("clan_member")
          .set({ role, distinctions, updated_at: new Date() })
          .where("clan_id", "=", executor.clan_id)
          .where("user_id", "=", targetId)
          .execute();
        return { ok: true, clanId: executor.clan_id, previousRole: target.role as ClanMemberRole };
      },
    );
    if (!result.ok) return result;
    if (role !== result.previousRole) {
      const [clan, gens] = await Promise.all([clanDiscord(db, result.clanId), joueurs(db, [targetId])]);
      if (clan)
        await discord.publierSalonsClan(
          clan,
          discord.messageRole(gens.get(targetId)!, role, role > result.previousRole),
          role > result.previousRole ? "annonce de promotion" : "annonce de rétrogradation",
        );
    }
    return { ok: true, clanId: result.clanId };
  }
}

/** `publierSalonAchillea` en garde : un identifiant non numérique (donnée ancienne) n'est pas un salon. */
function publierSalonAchilleaSafe(salonId: string, message: Parameters<typeof publierSalonAchillea>[1]) {
  if (!/^\d+$/.test(salonId)) return Promise.resolve({ ok: false as const, statut: null, motif: `salon invalide « ${salonId} »` });
  return publierSalonAchillea(salonId, message);
}
