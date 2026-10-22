/**
 * Cycle de vie d'un clan : départ, dissolution, transfert de présidence, vote
 * de fondation, réponse d'un joueur à une invitation, fiche et carrière.
 *
 * Port de `leaveClan`, `disbandClan`, `deleteClan`, `transferOwnership`,
 * `VotingService` + `ClanFoundationVoteHandler` / `ClanApprovalVoteHandler`,
 * `InviteButtons.confirmInvite` / `cancelInvite` et `createMemberHistoryEmbed`
 * de l'ancien bot (`legacy/achillea-bot/src`). L'état vit en base ; les effets
 * Discord passent après la transaction par `./discord` et ne font jamais
 * échouer l'action (ils sont consignés).
 *
 * Les tables de vote (`vote_proposal`, `vote_proposal_eligible_voters`,
 * `vote`) sont des tables MikroORM historiques absentes du schéma Kysely typé :
 * elles sont lues et écrites en SQL brut, comme dans `./management`.
 */
import { sql, type Kysely, type Transaction } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { normalizeNames, resolveDiscordAvatarUrl } from "@rosegriffon/achillea-core";
import { evaluateProposalOutcome } from "@rosegriffon/achillea-core/votes";
import {
  ClanMemberRole,
  ClanState,
  InterclanState,
  ProposalStatus,
  ProposalType,
  VoteChoice,
  VotingStrategy,
} from "@rosegriffon/achillea-core/enums";
import { CLAN_MEMBER_ROLE_LABELS } from "@rosegriffon/achillea-core/labels";
import * as discord from "./discord";
import { MIN_CLAN_MEMBERS } from "./management";

type Db = Kysely<Database> | Transaction<Database>;

export type EchecCycle = { ok: false; status: 400 | 403 | 404 | 409; error: string };
type Issue<T> = ({ ok: true } & T) | EchecCycle;

function echec(status: EchecCycle["status"], error: string): EchecCycle {
  return { ok: false, status, error };
}

/** `LeaveReason` de l'ancien bot, tel que stocké dans `clan_member_history.leave_reason`. */
export const LEAVE_REASON = { Kick: 0, Trade: 1, Sale: 2, Leave: 3 } as const;

/** Rôle Achilléa minimal d'un administrateur (`UserRole.Administrator`). */
export const ROLE_ADMINISTRATEUR = 2;

/** États d'interclan terminés : une composition y est libre (legacy `isMemberInALockedInterclan`). */
export const ETATS_INTERCLAN_TERMINES: readonly number[] = [
  InterclanState.RESULT_OK,
  InterclanState.CANCELED,
  InterclanState.DENIED,
];

/** Rôle Discord « Président » du serveur central (legacy `coreManagerConfig.captainRoleId`). */
export function roleCapitaine(env: Record<string, string | undefined> = Bun.env): string {
  return (env.ACHILLEA_CAPTAIN_ROLE_ID ?? "").trim() || "1398801292079403121";
}

/**
 * Effet d'une proposition close, pour les types qui ne concernent pas un clan
 * (`INTERCLAN_VALIDATION`…). Les boutons `vote:approve|reject:<id>` sont
 * communs à tous les types : le module propriétaire enregistre ici ce qu'une
 * issue doit déclencher, et `POST /clans/votes/:id` l'appelle après la
 * transaction. Sans effet enregistré, le vote est consigné et la proposition
 * close, comme `RankedReclamation`/`TournamentAppeal` dans l'ancien bot.
 */
export type EffetVote = (
  db: Kysely<Database>,
  proposition: { id: number; type: string; targetEntityId: number },
  statut: ProposalStatus,
) => Promise<void>;

const EFFETS_VOTE = new Map<string, EffetVote>();

export function enregistrerEffetVote(type: string, effet: EffetVote): void {
  EFFETS_VOTE.set(type, effet);
}

// ---------------------------------------------------------------------------
// Règles pures (testées sans base)
// ---------------------------------------------------------------------------

/** Le président ne quitte pas son clan : il transfère la présidence ou dissout. */
export function refusDepart(role: number): string | null {
  return role === ClanMemberRole.Captain ? "Le Président ne peut pas quitter son Clan ! Transférez la présidence ou dissolvez le Clan." : null;
}

/** Qui peut dissoudre : le président du clan, ou un administrateur Achilléa. */
export function peutDissoudre(roleDansLeClan: number | null, roleUtilisateur: number): boolean {
  return roleDansLeClan === ClanMemberRole.Captain || roleUtilisateur >= ROLE_ADMINISTRATEUR;
}

/** Refus éventuel d'un transfert de présidence (legacy `TransferClanOwnershipCommand`). */
export function refusTransfert(
  executant: { userId: string; role: number } | null,
  cible: { userId: string; clanId: number } | null,
  clanExecutant: number | null,
): string | null {
  if (!executant || clanExecutant === null) return "Vous ne faites pas partie d'un Clan.";
  if (executant.role !== ClanMemberRole.Captain) return "Seul le Président peut transférer la présidence.";
  if (!cible) return "Ce joueur ne fait pas partie de votre Clan !";
  if (cible.userId === executant.userId) return "Vous ne pouvez pas vous choisir comme cible de l'action !";
  if (cible.clanId !== clanExecutant) return "Ce joueur ne fait pas partie de votre Clan !";
  return null;
}

export type ActionVote = "inserer" | "retirer" | "modifier" | "deja_vote";

/**
 * Effet d'un clic de vote (legacy `VotingService.handleVote`) : un même choix
 * recliqué retire le vote, un autre choix le modifie. Le vote de fondation
 * n'est PAS révisable — le legacy le refusait (« already voted ») parce qu'un
 * « pour » fait entrer le fondateur dans le clan.
 */
export function actionVote(type: string, existant: VoteChoice | null, choix: VoteChoice): ActionVote {
  if (existant === null) return "inserer";
  if (type === ProposalType.CLAN_CREATION) return "deja_vote";
  return existant === choix ? "retirer" : "modifier";
}

/** Issue d'une proposition en attente — délègue à `@rosegriffon/achillea-core/votes`. */
export function issueProposition(input: {
  approbations: number;
  rejets: number;
  eligibles: number;
  ratioParticipation: number;
  strategie: string;
  expireLe: Date | null;
  maintenant?: Date;
}): ProposalStatus | null {
  const strategie = (Object.values(VotingStrategy) as string[]).includes(input.strategie)
    ? (input.strategie as VotingStrategy)
    : VotingStrategy.MAJORITY;
  return evaluateProposalOutcome({
    approvals: input.approbations,
    rejections: input.rejets,
    totalEligible: input.eligibles,
    minParticipationRatio: Number.isFinite(input.ratioParticipation) ? input.ratioParticipation : 1,
    strategy: strategie,
    expired: Boolean(input.expireLe && input.expireLe.getTime() <= (input.maintenant ?? new Date()).getTime()),
  });
}

/** Proposition telle que lue pour la clôture des votes expirés. */
export interface PropositionEnAttente {
  id: number;
  type: string;
  status: string;
  expiresAt: Date | null;
}

/**
 * Propositions à clore par l'entretien : encore `PENDING`, échéance passée.
 * `INTERCLAN_VALIDATION` est exclu : l'entretien des interclans
 * (`POST /interclans/internal/maintenance`) le conclut lui-même.
 */
export function propositionsAExpirer<T extends PropositionEnAttente>(propositions: readonly T[], maintenant: Date): T[] {
  return propositions.filter(
    p =>
      p.status === ProposalStatus.PENDING &&
      p.type !== ProposalType.INTERCLAN_VALIDATION &&
      p.expiresAt !== null &&
      p.expiresAt.getTime() <= maintenant.getTime(),
  );
}

/**
 * Issue d'une proposition échue : celle qu'aurait rendue un clic à cet instant
 * (`issueProposition` avec l'échéance passée), et « expirée » quand le
 * décompte ne tranche pas (super-majorité ni atteinte ni hors de portée).
 */
export function issueEchue(input: {
  approbations: number;
  rejets: number;
  eligibles: number;
  ratioParticipation: number;
  strategie: string;
  expireLe: Date;
  maintenant: Date;
}): ProposalStatus {
  return issueProposition(input) ?? ProposalStatus.EXPIRED;
}

/** Référence de clan : identifiant numérique, sinon sigle (normalisé comme en base). */
export function referenceClan(ref: string): { id: number } | { sigle: string } {
  const brut = ref.trim();
  return /^\d{1,9}$/.test(brut) ? { id: Number(brut) } : { sigle: normalizeNames(brut) };
}

// ---------------------------------------------------------------------------
// Lectures communes
// ---------------------------------------------------------------------------

async function nomsJoueurs(db: Db, ids: readonly string[]): Promise<Map<string, discord.Joueur>> {
  const uniques = [...new Set(ids)];
  const lignes = uniques.length
    ? await db.selectFrom("user").select(["id", "display_name", "username", "avatar"]).where("id", "in", uniques).execute()
    : [];
  const carte = new Map(
    lignes.map(l => [l.id, { id: l.id, nom: l.display_name || l.username || l.id, avatar: resolveDiscordAvatarUrl(l.id, l.avatar) }]),
  );
  for (const id of uniques) if (!carte.has(id)) carte.set(id, { id, nom: id, avatar: resolveDiscordAvatarUrl(id, null) });
  return carte;
}

async function clanDiscord(db: Db, clanId: number): Promise<(discord.ClanDiscord & { emojiId: string }) | null> {
  const ligne = await db
    .selectFrom("clan as c")
    .leftJoin("guild as g", "g.id", "c.guild_id")
    .select(["c.id", "c.name", "c.channel_id", "c.role_id", "c.clan_emoji_id", "g.broadcast_channel"])
    .where("c.id", "=", clanId)
    .executeTakeFirst();
  return ligne
    ? {
        id: ligne.id,
        name: ligne.name,
        channelId: ligne.channel_id,
        roleId: ligne.role_id,
        broadcastChannel: ligne.broadcast_channel ?? null,
        emojiId: ligne.clan_emoji_id ?? "",
      }
    : null;
}

async function roleUtilisateur(db: Db, userId: string): Promise<number> {
  const ligne = await db.selectFrom("user").select("role").where("id", "=", userId).executeTakeFirst();
  return Number(ligne?.role ?? 0);
}

async function presidentDe(db: Db, clanId: number): Promise<string | null> {
  const ligne = await db
    .selectFrom("clan_member")
    .select("user_id")
    .where("clan_id", "=", clanId)
    .where("role", "=", ClanMemberRole.Captain)
    .executeTakeFirst();
  return ligne?.user_id ?? null;
}

/** Après un départ : passage sous la limite d'effectif (legacy `onMembershipChange`). */
async function marquerSousLimite(trx: Db, clanId: number): Promise<boolean> {
  const clan = await trx.selectFrom("clan").select("under_member_limit").where("id", "=", clanId).executeTakeFirst();
  const restants = await trx
    .selectFrom("clan_member")
    .select(({ fn }) => fn.countAll<number>().as("n"))
    .where("clan_id", "=", clanId)
    .executeTakeFirst();
  const sousLimite = Number(restants?.n ?? 0) < MIN_CLAN_MEMBERS && !clan?.under_member_limit;
  if (sousLimite)
    await trx.updateTable("clan").set({ under_member_limit: true, updated_at: new Date() }).where("id", "=", clanId).execute();
  return sousLimite;
}

/** Retire un rôle Discord du serveur central (rôle de clan, rôle de président). */
async function supprimerRoleServeur(roleId: string, raison: string) {
  if (!/^\d+$/.test(roleId)) return;
  const { guildId } = discord.configAchillea();
  discord.consigner("suppression du rôle de clan", await discord.restAchillea("DELETE", `/guilds/${guildId}/roles/${roleId}`, undefined, raison));
}

/** Supprime l'émoji d'application du clan (legacy `imgUploader.deleteEmoji`). */
async function supprimerEmoji(emojiId: string) {
  if (!/^\d+$/.test(emojiId)) return;
  const bot = await discord.restAchillea<{ id: string }>("GET", "/users/@me");
  if (!bot.ok) return discord.consigner("lecture de l'application", bot);
  discord.consigner("suppression de l'émoji du clan", await discord.restAchillea("DELETE", `/applications/${bot.data.id}/emojis/${emojiId}`));
}

/** Nettoyage Discord d'un clan dissous ou supprimé (legacy `achilleaRolesAndChannelsDeletion…`). */
async function nettoyerDiscordClan(clan: discord.ClanDiscord & { emojiId: string }, presidentId: string | null, raison: string) {
  if (/^\d+$/.test(clan.channelId)) await discord.supprimerSalon(clan.channelId, raison);
  await supprimerRoleServeur(clan.roleId, raison);
  if (presidentId) await discord.retirerRoleClan(presidentId, roleCapitaine(), raison);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export type FicheClan = {
  id: number;
  name: string;
  shortName: string;
  avatarUrl: string;
  biography: string;
  fame: number;
  emojiId: string;
  isRecruiting: boolean;
  isDisbanded: boolean;
  isInactive: boolean;
  autoAcceptMembers: boolean;
  underMemberLimit: boolean;
  state: number;
  createdAt: string;
  level: number;
  totalXp: number;
  socials: { x: string | null; instagram: string | null; tiktok: string | null };
  languages: string[];
  origin: string;
  guildId: string | null;
  president: { id: string; name: string } | null;
  members: Array<{ id: string; name: string; role: number; distinctions: string[]; joinedAt: string }>;
};

export type CarriereJoueur = {
  userId: string;
  displayName: string;
  since: string;
  current: Array<{ clanId: number; clanName: string; shortName: string; emojiId: string; role: number; joinedAt: string }>;
  past: Array<{
    clanId: number;
    clanName: string;
    shortName: string;
    emojiId: string;
    role: number;
    joinedAt: string;
    leftAt: string;
    leaveReason: number;
  }>;
};

export type ResultatVote = {
  proposalId: number;
  type: string;
  action: ActionVote | "force";
  status: string;
  approvals: number;
  rejections: number;
  eligible: number;
  clan: { id: number; name: string } | null;
  message: string;
};

const iso = (d: Date | string) => new Date(d).toISOString();

export abstract class ClanCycleService {
  /** `GET /clans/fiche/:ref` — fiche complète par identifiant ou par sigle (clans dissous compris). */
  static async fiche(db: Kysely<Database>, ref: string): Promise<FicheClan | null> {
    const cible = referenceClan(ref);
    let requete = db.selectFrom("clan").selectAll().where("is_hidden", "=", false);
    requete = "id" in cible ? requete.where("id", "=", cible.id) : requete.where("normalized_short_name", "=", cible.sigle);
    // Un sigle peut avoir servi à un clan dissous puis à un nouveau : le plus récent l'emporte.
    const clan = await requete.orderBy("is_disbanded", "asc").orderBy("id", "desc").executeTakeFirst();
    if (!clan) return null;
    const [xp, membres] = await Promise.all([
      db.selectFrom("clan_experience").select(["current_level", "total_xp"]).where("clan_id", "=", clan.id).executeTakeFirst(),
      db
        .selectFrom("clan_member as cm")
        .innerJoin("user as u", "u.id", "cm.user_id")
        .select(["cm.user_id", "cm.role", "cm.distinctions", "cm.created_at", "u.display_name", "u.username"])
        .where("cm.clan_id", "=", clan.id)
        .orderBy("cm.role", "desc")
        .orderBy("cm.created_at", "asc")
        .execute(),
    ]);
    const members = membres.map(m => ({
      id: m.user_id,
      name: m.display_name || m.username || m.user_id,
      role: Number(m.role),
      distinctions: m.distinctions ?? [],
      joinedAt: iso(m.created_at),
    }));
    const president = members.find(m => m.role === ClanMemberRole.Captain) ?? null;
    return {
      id: clan.id,
      name: clan.name,
      shortName: clan.shortened_name,
      avatarUrl: clan.clan_avatar_url,
      biography: clan.clan_biography,
      fame: Number(clan.clan_fame ?? 0),
      emojiId: clan.clan_emoji_id ?? "",
      isRecruiting: Boolean(clan.is_recruiting),
      isDisbanded: Boolean(clan.is_disbanded),
      isInactive: Boolean(clan.is_inactive),
      autoAcceptMembers: Boolean(clan.auto_accept_members),
      underMemberLimit: Boolean(clan.under_member_limit),
      state: Number(clan.state),
      createdAt: iso(clan.created_at),
      level: Number(xp?.current_level ?? 1),
      totalXp: Number(xp?.total_xp ?? 0),
      socials: { x: clan.x_url, instagram: clan.instagram_url, tiktok: clan.tiktok_url },
      languages: clan.languages ?? [],
      origin: clan.origin ?? "",
      guildId: clan.guild_id,
      president: president ? { id: president.id, name: president.name } : null,
      members,
    };
  }

  /** `GET /clans/history/:userId` — carrière d'un joueur (legacy `createMemberHistoryEmbed`). */
  static async carriere(db: Kysely<Database>, userId: string): Promise<CarriereJoueur | null> {
    const joueur = await db.selectFrom("user").select(["id", "display_name", "username", "created_at"]).where("id", "=", userId).executeTakeFirst();
    if (!joueur) return null;
    const [actuels, passes] = await Promise.all([
      db
        .selectFrom("clan_member as cm")
        .innerJoin("clan as c", "c.id", "cm.clan_id")
        .select(["c.id", "c.name", "c.shortened_name", "c.clan_emoji_id", "cm.role", "cm.created_at"])
        .where("cm.user_id", "=", userId)
        .orderBy("cm.created_at", "asc")
        .execute(),
      db
        .selectFrom("clan_member_history as h")
        .innerJoin("clan as c", "c.id", "h.clan_id")
        .select(["c.id", "c.name", "c.shortened_name", "c.clan_emoji_id", "h.role", "h.join_date", "h.created_at", "h.leave_reason"])
        .where("h.user_id", "=", userId)
        .orderBy("h.created_at", "desc")
        .execute(),
    ]);
    return {
      userId,
      displayName: joueur.display_name || joueur.username || userId,
      since: iso(joueur.created_at),
      current: actuels.map(a => ({
        clanId: a.id,
        clanName: a.name,
        shortName: a.shortened_name,
        emojiId: a.clan_emoji_id ?? "",
        role: Number(a.role),
        joinedAt: iso(a.created_at),
      })),
      past: passes.map(p => ({
        clanId: p.id,
        clanName: p.name,
        shortName: p.shortened_name,
        emojiId: p.clan_emoji_id ?? "",
        role: Number(p.role),
        joinedAt: iso(p.join_date),
        leftAt: iso(p.created_at),
        leaveReason: Number(p.leave_reason),
      })),
    };
  }

  /** `POST /clans/leave` — legacy `leaveClan` (+ compositions d'interclan, équipes, historique). */
  static async quitter(db: Kysely<Database>, userId: string, clanIdDemande: number | null): Promise<Issue<{ clanId: number; clanName: string }>> {
    const resultat = await db.transaction().execute(
      async (trx): Promise<Issue<{ clanId: number; clanName: string; sousLimite: boolean; interclans: string[] }>> => {
        let requete = trx
          .selectFrom("clan_member as cm")
          .innerJoin("clan as c", "c.id", "cm.clan_id")
          .select(["cm.clan_id", "cm.role", "cm.created_at", "cm.clan_fame_contributed", "c.name"])
          .where("cm.user_id", "=", userId)
          .where("c.is_disbanded", "=", false);
        if (clanIdDemande !== null) requete = requete.where("cm.clan_id", "=", clanIdDemande);
        const adhesion = await requete.orderBy("c.is_inactive", "asc").executeTakeFirst();
        if (!adhesion) return echec(400, "Vous ne faites pas partie d'un Clan.");
        const refus = refusDepart(Number(adhesion.role));
        if (refus) return echec(400, refus);

        // Compositions d'interclan : verrouillée → départ refusé, sinon le joueur en est retiré.
        const compositions = await sql<{ lineup_id: number; locked_in: boolean; name: string; state: number }>`
          select l.id as lineup_id, l.locked_in, e.name, e.state
          from interclan_lineup_member m
          join interclan_lineup l on l.id = m.lineup_id
          join event e on e.id = l.event_id
          where m.user_id = ${userId}
            and (e.clan_a_id = ${adhesion.clan_id} or e.clan_b_id = ${adhesion.clan_id})
        `.execute(trx);
        const actives = compositions.rows.filter(c => !ETATS_INTERCLAN_TERMINES.includes(Number(c.state)));
        const verrouillee = actives.find(c => c.locked_in);
        if (verrouillee)
          return echec(409, `Impossible de quitter le clan : vous êtes dans une composition verrouillée (interclan « ${verrouillee.name} »).`);
        for (const c of actives)
          await sql`delete from interclan_lineup_member where lineup_id = ${c.lineup_id} and user_id = ${userId}`.execute(trx);

        // Le lien d'équipe (`clan_team_member`) part en cascade avec l'adhésion.
        await trx.deleteFrom("clan_member").where("clan_id", "=", adhesion.clan_id).where("user_id", "=", userId).execute();
        await trx
          .insertInto("clan_member_history")
          .values({
            user_id: userId,
            clan_id: adhesion.clan_id,
            join_date: adhesion.created_at,
            leave_reason: LEAVE_REASON.Leave,
            kick_reason: null,
            clan_fame_contributed: adhesion.clan_fame_contributed,
            role: Number(adhesion.role),
          })
          .execute();
        const sousLimite = await marquerSousLimite(trx, adhesion.clan_id);
        return { ok: true, clanId: adhesion.clan_id, clanName: adhesion.name, sousLimite, interclans: [...new Set(actives.map(a => a.name))] };
      },
    );
    if (!resultat.ok) return resultat;

    const [clan, gens] = await Promise.all([clanDiscord(db, resultat.clanId), nomsJoueurs(db, [userId])]);
    if (clan) {
      const joueur = gens.get(userId)!;
      await discord.retirerRoleClan(userId, clan.roleId, `Départ du Clan ${clan.name}`);
      if (resultat.interclans.length > 0)
        await discord.publierSalonsClan(
          clan,
          {
            embeds: [
              discord.embedAvertissement(
                `${discord.echapper(joueur.nom)} a été retiré des compositions : ${resultat.interclans.map(discord.echapper).join(", ")}`,
              ),
            ],
          },
          "retrait des compositions d'interclan",
        );
      await discord.publierSalonsClan(clan, { embeds: [discord.embedJoueur(joueur, "Départ", discord.COULEUR_ERREUR)] }, "fiche de départ");
      await discord.annoncerClans(
        {
          embeds: [
            discord.embedJoueur(joueur, "Départ", discord.COULEUR_ERREUR, `${discord.echapper(joueur.nom)} a quitté le Clan ${discord.echapper(clan.name)}`),
          ],
        },
        "annonce générale de départ",
      );
      if (resultat.sousLimite)
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
    return { ok: true, clanId: resultat.clanId, clanName: resultat.clanName };
  }

  /**
   * `POST /clans/:id/disband` — legacy `disbandClan`.
   * Écart assumé : l'ancien bot effaçait les adhésions sans trace ; elles
   * passent ici dans `clan_member_history`, pour que la carrière des joueurs
   * garde le clan dissous.
   */
  static async dissoudre(db: Kysely<Database>, executantId: string, clanId: number): Promise<Issue<{ clanId: number; clanName: string }>> {
    const resultat = await db.transaction().execute(async (trx): Promise<Issue<{ clanName: string; presidentId: string | null; membres: string[]; fils: string[] }>> => {
      const clan = await trx.selectFrom("clan").select(["id", "name", "is_disbanded"]).where("id", "=", clanId).forUpdate().executeTakeFirst();
      if (!clan || clan.is_disbanded) return echec(404, "Clan introuvable ou déjà dissous.");
      const adhesion = await trx.selectFrom("clan_member").select("role").where("clan_id", "=", clanId).where("user_id", "=", executantId).executeTakeFirst();
      if (!peutDissoudre(adhesion ? Number(adhesion.role) : null, await roleUtilisateur(trx, executantId)))
        return echec(403, "Seul le Président du Clan (ou un administrateur) peut le dissoudre.");
      const presidentId = await presidentDe(trx, clanId);
      const membres = await trx.selectFrom("clan_member").selectAll().where("clan_id", "=", clanId).execute();
      if (membres.length > 0)
        await trx
          .insertInto("clan_member_history")
          .values(
            membres.map(m => ({
              user_id: m.user_id,
              clan_id: clanId,
              join_date: m.created_at,
              leave_reason: LEAVE_REASON.Leave,
              kick_reason: null,
              clan_fame_contributed: m.clan_fame_contributed,
              role: Number(m.role),
            })),
          )
          .execute();
      await trx.deleteFrom("clan_member").where("clan_id", "=", clanId).execute();
      await trx.deleteFrom("clan_application").where("clan_id", "=", clanId).execute();
      const invitations = await trx.deleteFrom("clan_invite").where("clan_id", "=", clanId).returning("thread_id").execute();
      await trx.updateTable("clan").set({ is_disbanded: true, is_recruiting: false, updated_at: new Date() }).where("id", "=", clanId).execute();
      const fils = invitations.map(i => i.thread_id).filter((id): id is string => Boolean(id));
      return { ok: true, clanName: clan.name, presidentId, membres: membres.map(m => m.user_id), fils };
    });
    if (!resultat.ok) return resultat;
    for (const fil of resultat.fils) await discord.supprimerSalon(fil, `Clan ${resultat.clanName} dissous`);

    const [clan, gens] = await Promise.all([clanDiscord(db, clanId), nomsJoueurs(db, [executantId])]);
    if (clan) {
      // Le serveur du clan apprend la dissolution AVANT que le salon central ne disparaisse.
      if (clan.broadcastChannel)
        await discord.publierSalonsClan(
          { ...clan, channelId: "" },
          {
            embeds: [
              {
                color: discord.COULEUR_ACHILLEA,
                description: `Votre Clan a été dissout par ${discord.echapper(gens.get(executantId)!.nom)} ! Merci d'avoir contribué à la communauté et au plaisir de vous revoir.`,
              },
            ],
          },
          "annonce de dissolution au serveur du clan",
        );
      await nettoyerDiscordClan(clan, resultat.presidentId, `Clan ${clan.name} dissous`);
      await discord.annoncerClans(
        { embeds: [{ color: discord.COULEUR_ERREUR, title: `${discord.echapper(clan.name)} - Dissolution`, description: `Le Clan ${discord.echapper(clan.name)} a été dissout.` }] },
        "annonce générale de dissolution",
      );
    }
    return { ok: true, clanId, clanName: resultat.clanName };
  }

  /** `POST /clans/transfer-ownership` — legacy `transferOwnership` + `changeCaptain`. */
  static async transferer(db: Kysely<Database>, executantId: string, cibleId: string): Promise<Issue<{ clanId: number; clanName: string }>> {
    const resultat = await db.transaction().execute(async (trx): Promise<Issue<{ clanId: number; clanName: string }>> => {
      const executant = await trx
        .selectFrom("clan_member as cm")
        .innerJoin("clan as c", "c.id", "cm.clan_id")
        .select(["cm.clan_id", "cm.role", "c.name"])
        .where("cm.user_id", "=", executantId)
        .where("c.is_disbanded", "=", false)
        .orderBy("cm.role", "desc")
        .executeTakeFirst();
      const clanId = executant?.clan_id ?? null;
      const cible = clanId === null
        ? undefined
        : await trx.selectFrom("clan_member").select(["user_id", "clan_id"]).where("clan_id", "=", clanId).where("user_id", "=", cibleId).executeTakeFirst();
      const refus = refusTransfert(
        executant ? { userId: executantId, role: Number(executant.role) } : null,
        cible ? { userId: cible.user_id, clanId: cible.clan_id } : null,
        clanId,
      );
      if (refus || !executant) {
        const statut = executant && Number(executant.role) !== ClanMemberRole.Captain ? 403 : 400;
        return echec(statut, refus ?? "Vous ne faites pas partie d'un Clan.");
      }
      await trx.selectFrom("clan").select("id").where("id", "=", executant.clan_id).forUpdate().executeTakeFirst();
      await trx.updateTable("clan_member").set({ role: ClanMemberRole.Member, updated_at: new Date() }).where("clan_id", "=", executant.clan_id).where("user_id", "=", executantId).execute();
      await trx.updateTable("clan_member").set({ role: ClanMemberRole.Captain, updated_at: new Date() }).where("clan_id", "=", executant.clan_id).where("user_id", "=", cibleId).execute();
      return { ok: true, clanId: executant.clan_id, clanName: executant.name };
    });
    if (!resultat.ok) return resultat;

    const [clan, gens] = await Promise.all([clanDiscord(db, resultat.clanId), nomsJoueurs(db, [cibleId])]);
    await discord.retirerRoleClan(executantId, roleCapitaine(), `Présidence du Clan ${resultat.clanName} transférée`);
    await discord.ajouterRoleClan(cibleId, roleCapitaine(), `Nouveau Président du Clan ${resultat.clanName}`);
    if (clan) {
      const joueur = gens.get(cibleId)!;
      const description = `${discord.echapper(joueur.nom)} est maintenant le nouveau Président du Clan ${discord.echapper(clan.name)} !`;
      await discord.publierSalonsClan(clan, { embeds: [discord.embedJoueur(joueur, "Nouveau Président", 0x206694, description)] }, "annonce du nouveau président");
      await discord.annoncerClans({ embeds: [discord.embedJoueur(joueur, "Nouveau Président", 0x206694, description)] }, "annonce générale du nouveau président");
    }
    return resultat;
  }

  /** `POST /clans/invites/accept` — l'invité accepte (legacy `InviteButtons.confirmInvite`). */
  static async accepterInvitation(db: Kysely<Database>, userId: string, inviteId: number): Promise<Issue<{ clanId: number; clanName: string }>> {
    const resultat = await db.transaction().execute(
      async (trx): Promise<Issue<{ clanId: number; clanName: string; threadId: string | null; distinctions: string[] }>> => {
        const invitation = await trx
          .selectFrom("clan_invite as i")
          .innerJoin("clan as c", "c.id", "i.clan_id")
          .select(["i.id", "i.user_id", "i.clan_id", "i.thread_id", "i.distinctions", "c.name", "c.is_disbanded"])
          .where("i.id", "=", inviteId)
          .forUpdate()
          .executeTakeFirst();
        if (!invitation) return echec(404, "Cette invitation n'existe plus.");
        if (invitation.user_id !== userId) return echec(403, "Cette invitation ne vous est pas adressée.");
        if (invitation.is_disbanded) return echec(409, "Le Clan que vous essayez de rejoindre a été dissout !");
        const actif = await trx
          .selectFrom("clan_member as cm")
          .innerJoin("clan as c", "c.id", "cm.clan_id")
          .select("cm.clan_id")
          .where("cm.user_id", "=", userId)
          .where("c.is_inactive", "=", false)
          .where("c.is_disbanded", "=", false)
          .executeTakeFirst();
        if (actif) return echec(409, "Vous êtes déjà dans un Clan !");
        await trx
          .insertInto("clan_member")
          .values({ clan_id: invitation.clan_id, user_id: userId, role: ClanMemberRole.Trial, distinctions: invitation.distinctions ?? [] })
          .onConflict(oc => oc.columns(["clan_id", "user_id"]).doNothing())
          .execute();
        await trx.deleteFrom("clan_invite").where("user_id", "=", userId).execute();
        await trx.deleteFrom("clan_application").where("user_id", "=", userId).execute();
        return { ok: true, clanId: invitation.clan_id, clanName: invitation.name, threadId: invitation.thread_id, distinctions: invitation.distinctions ?? [] };
      },
    );
    if (!resultat.ok) return resultat;

    const [clan, gens] = await Promise.all([clanDiscord(db, resultat.clanId), nomsJoueurs(db, [userId])]);
    if (resultat.threadId) await discord.supprimerSalon(resultat.threadId, "Invitation de clan acceptée");
    if (clan) {
      const joueur = gens.get(userId)!;
      await discord.ajouterRoleClan(userId, clan.roleId, `Invitation acceptée (Clan ${clan.name})`);
      await discord.publierSalonsClan(
        clan,
        {
          embeds: [
            {
              ...discord.embedJoueur(joueur, "Nouveau membre", discord.COULEUR_SUCCES),
              description: `__*Clan rejoint le ${new Date().toLocaleDateString("fr-FR")}*__`,
              fields: [
                { name: "Rôle", value: CLAN_MEMBER_ROLE_LABELS[ClanMemberRole.Trial], inline: true },
                { name: "Distinctions", value: resultat.distinctions.join("\n") || "—", inline: true },
              ],
            },
          ],
        },
        "annonce du nouveau membre",
      );
      await discord.annoncerClans(
        {
          embeds: [
            discord.embedJoueur(joueur, "Nouveau membre", discord.COULEUR_SUCCES, `${discord.echapper(joueur.nom)} a rejoint ${discord.echapper(clan.name)} !`),
          ],
        },
        "annonce générale du nouveau membre",
      );
    }
    return { ok: true, clanId: resultat.clanId, clanName: resultat.clanName };
  }

  /** `POST /clans/invites/decline` — l'invité refuse (legacy `InviteButtons.cancelInvite`). */
  static async refuserInvitation(db: Kysely<Database>, userId: string, inviteId: number): Promise<Issue<{ clanName: string }>> {
    const invitation = await db
      .selectFrom("clan_invite as i")
      .innerJoin("clan as c", "c.id", "i.clan_id")
      .select(["i.user_id", "i.thread_id", "i.inviter_id", "c.name"])
      .where("i.id", "=", inviteId)
      .executeTakeFirst();
    if (!invitation) return echec(404, "Cette invitation n'existe plus.");
    if (invitation.user_id !== userId) return echec(403, "Cette invitation ne vous est pas adressée.");
    await db.deleteFrom("clan_invite").where("id", "=", inviteId).execute();
    if (invitation.thread_id) await discord.supprimerSalon(invitation.thread_id, "Invitation de clan refusée");
    const gens = await nomsJoueurs(db, [userId]);
    await discord.mp(
      invitation.inviter_id,
      { embeds: [discord.embedErreur(`${gens.get(userId)!.nom} a refusé l'invitation à rejoindre ${invitation.name}.`)] },
      "MP de refus d'invitation",
    );
    return { ok: true, clanName: invitation.name };
  }

  /**
   * `POST /clans/votes/:id` — vote sur une proposition (legacy `VoteButtons` + `VotingService`).
   *
   * Effets par type : `CLAN_CREATION` (un « pour » fait entrer le fondateur ;
   * l'approbation valide le clan, le rejet ou l'expiration le supprime) et
   * `CLAN_APPROVAL` (vote des administrateurs). Les autres types n'avaient
   * aucun effet dans l'ancien bot : le vote y est consigné et la proposition
   * close à la majorité, sans plus.
   */
  static async voter(
    db: Kysely<Database>,
    votantId: string,
    propositionId: number,
    approuve: boolean,
    devs: readonly string[],
    maintenant = new Date(),
  ): Promise<Issue<{ resultat: ResultatVote }>> {
    const choix = approuve ? VoteChoice.APPROVE : VoteChoice.REJECT;
    const issue = await db.transaction().execute(async (trx): Promise<Issue<{ resultat: ResultatVote; effet: ProposalStatus | null; cible: number }>> => {
      const proposition = (
        await sql<{
          id: number;
          type: string;
          target_entity_id: number;
          status: string;
          strategy: string;
          min_participation_ratio: number | null;
          expires_at: Date | null;
        }>`select id, type, target_entity_id, status, strategy, min_participation_ratio, expires_at
           from vote_proposal where id = ${propositionId} for update`.execute(trx)
      ).rows[0];
      if (!proposition) return echec(404, "Cette proposition n'existe pas.");
      if (proposition.status !== ProposalStatus.PENDING) return echec(409, "Ce vote est clos.");
      const eligibles = (await sql<{ user_id: string }>`select user_id from vote_proposal_eligible_voters where vote_proposal_id = ${propositionId}`.execute(trx)).rows.map(
        r => r.user_id,
      );
      const force = devs.includes(votantId);
      if (!eligibles.includes(votantId) && !force) return echec(403, "Vous n'êtes pas éligible pour ce vote.");
      const clanId = proposition.type === ProposalType.CLAN_CREATION || proposition.type === ProposalType.CLAN_APPROVAL ? Number(proposition.target_entity_id) : null;
      const clan = clanId === null ? undefined : await trx.selectFrom("clan").select(["id", "name"]).where("id", "=", clanId).executeTakeFirst();

      const existant = (await sql<{ id: number; vote: VoteChoice }>`select id, vote from vote where proposal_id = ${propositionId} and voter_id = ${votantId}`.execute(trx))
        .rows[0];
      // Un développeur tranche d'un clic, comme `generalConfig.devs` dans l'ancien bot.
      const action: ActionVote | "force" = force ? "force" : actionVote(proposition.type, existant?.vote ?? null, choix);
      if (action === "deja_vote") return echec(409, "Vous avez déjà voté sur cette proposition.");

      const expire = Boolean(proposition.expires_at && new Date(proposition.expires_at).getTime() <= maintenant.getTime());
      if (expire && !force && proposition.type === ProposalType.CLAN_APPROVAL)
        return echec(409, "Le vote n'a pas été pris en compte car la période de vote a expiré.");

      if (!expire || force) {
        if (!existant && (action === "inserer" || action === "force"))
          await sql`insert into vote (created_at, updated_at, proposal_id, voter_id, vote) values (${maintenant}, ${maintenant}, ${propositionId}, ${votantId}, ${choix})`.execute(trx);
        else if (action === "retirer" && existant) await sql`delete from vote where id = ${existant.id}`.execute(trx);
        else if (existant) await sql`update vote set vote = ${choix}, updated_at = ${maintenant} where id = ${existant.id}`.execute(trx);
        // Fondation : un « pour » fait entrer le fondateur dans le clan, comme Membre.
        if (proposition.type === ProposalType.CLAN_CREATION && choix === VoteChoice.APPROVE && clan && eligibles.includes(votantId))
          await trx
            .insertInto("clan_member")
            .values({ clan_id: clan.id, user_id: votantId, role: ClanMemberRole.Member })
            .onConflict(oc => oc.columns(["clan_id", "user_id"]).doNothing())
            .execute();
      }

      const votes = (await sql<{ vote: VoteChoice }>`select vote from vote where proposal_id = ${propositionId}`.execute(trx)).rows;
      const approvals = votes.filter(v => v.vote === VoteChoice.APPROVE).length;
      const rejections = votes.length - approvals;
      const statut: ProposalStatus | null = force
        ? choix === VoteChoice.APPROVE
          ? ProposalStatus.APPROVED
          : ProposalStatus.REJECTED
        : issueProposition({
            approbations: approvals,
            rejets: rejections,
            eligibles: eligibles.length,
            ratioParticipation: Number(proposition.min_participation_ratio ?? 1),
            strategie: proposition.strategy,
            expireLe: proposition.expires_at ? new Date(proposition.expires_at) : null,
            maintenant,
          });
      if (statut) await sql`update vote_proposal set status = ${statut}, closed_at = ${maintenant}, updated_at = ${maintenant} where id = ${propositionId}`.execute(trx);
      if (statut === ProposalStatus.APPROVED && clan) {
        await trx.updateTable("clan").set({ state: ClanState.Approved, updated_at: maintenant }).where("id", "=", clan.id).execute();
        if (proposition.type === ProposalType.CLAN_CREATION) {
          await trx.insertInto("clan_experience").values({ clan_id: clan.id }).onConflict(oc => oc.column("clan_id").doNothing()).execute();
          // Les deux équipes du legacy (`ClanTeamType.MAIN` = 0, `SUB` = 1).
          await sql`insert into clan_team (created_at, updated_at, clan_id, name, type)
                    values (${maintenant}, ${maintenant}, ${clan.id}, 'Equipe principale', 0),
                           (${maintenant}, ${maintenant}, ${clan.id}, 'Equipe secondaire', 1)`.execute(trx);
        }
      }

      const libelleStatut =
        statut === ProposalStatus.APPROVED ? "approuvée" : statut === ProposalStatus.REJECTED ? "rejetée" : statut === ProposalStatus.EXPIRED ? "expirée" : null;
      const message =
        action === "force"
          ? `🧩 Vote forcé par un développeur : proposition ${libelleStatut ?? "en attente"}.`
          : expire
            ? "Le vote n'a pas été pris en compte car la période de vote a expiré."
            : action === "retirer"
              ? "Votre vote a été retiré."
              : proposition.type === ProposalType.CLAN_CREATION && choix === VoteChoice.APPROVE && clan
                ? `Vous avez rejoint le Clan ${clan.name} !`
                : `Votre vote a été enregistré : ${choix === VoteChoice.APPROVE ? "✅ Pour" : "❌ Contre"}.`;
      return {
        ok: true,
        effet: statut,
        cible: Number(proposition.target_entity_id),
        resultat: {
          proposalId: propositionId,
          type: proposition.type,
          action,
          status: statut ?? ProposalStatus.PENDING,
          approvals,
          rejections,
          eligible: eligibles.length,
          clan: clan ? { id: clan.id, name: clan.name } : null,
          message: libelleStatut ? `${message} La proposition est ${libelleStatut}.` : message,
        },
      };
    });
    if (!issue.ok) return issue;
    const { resultat, effet, cible } = issue;
    if (effet && resultat.clan) await ClanCycleService.effetsIssue(db, resultat.clan.id, resultat.type, effet, votantId);
    else if (effet) await EFFETS_VOTE.get(resultat.type)?.(db, { id: propositionId, type: resultat.type, targetEntityId: cible }, effet);
    return { ok: true, resultat };
  }

  /**
   * `POST /clans/internal/votes/expire` (tâche `achillea:votes`) — clôt les
   * propositions échues sans attendre un clic, avec les mêmes effets que la
   * clôture au clic : fondation expirée → clan supprimé, salon/rôle/émoji
   * retirés, message privé au Président ; autres types → effet enregistré.
   * Chaque proposition est close dans sa propre transaction (verrou de ligne,
   * statut relu) : un clic simultané ne la conclut pas deux fois.
   */
  static async expirerVotes(db: Kysely<Database>, maintenant = new Date()): Promise<{ closes: number }> {
    const candidates = (
      await sql<{ id: number; type: string; status: string; expires_at: Date | null }>`
        select id, type, status, expires_at from vote_proposal
        where status = ${ProposalStatus.PENDING} and expires_at is not null and expires_at <= ${maintenant}
        order by expires_at asc`.execute(db)
    ).rows.map(r => ({ ...r, id: Number(r.id), expiresAt: r.expires_at ? new Date(r.expires_at) : null }));

    let closes = 0;
    for (const candidate of propositionsAExpirer(candidates, maintenant)) {
      const close = await db.transaction().execute(async trx => {
        const p = (
          await sql<{
            type: string;
            status: string;
            target_entity_id: number;
            strategy: string;
            min_participation_ratio: number | null;
            expires_at: Date | null;
          }>`select type, status, target_entity_id, strategy, min_participation_ratio, expires_at
             from vote_proposal where id = ${candidate.id} for update`.execute(trx)
        ).rows[0];
        if (!p || p.status !== ProposalStatus.PENDING || !p.expires_at) return null;
        const eligibles = Number(
          (await sql<{ n: number }>`select count(*)::int as n from vote_proposal_eligible_voters where vote_proposal_id = ${candidate.id}`.execute(trx))
            .rows[0]?.n ?? 0,
        );
        const votes = (await sql<{ vote: VoteChoice }>`select vote from vote where proposal_id = ${candidate.id}`.execute(trx)).rows;
        const approbations = votes.filter(v => v.vote === VoteChoice.APPROVE).length;
        const statut = issueEchue({
          approbations,
          rejets: votes.length - approbations,
          eligibles,
          ratioParticipation: Number(p.min_participation_ratio ?? 1),
          strategie: p.strategy,
          expireLe: new Date(p.expires_at),
          maintenant,
        });
        await sql`update vote_proposal set status = ${statut}, closed_at = ${maintenant}, updated_at = ${maintenant} where id = ${candidate.id}`.execute(trx);
        const clanVise = p.type === ProposalType.CLAN_CREATION || p.type === ProposalType.CLAN_APPROVAL;
        if (statut === ProposalStatus.APPROVED && clanVise) {
          const clanId = Number(p.target_entity_id);
          await trx.updateTable("clan").set({ state: ClanState.Approved, updated_at: maintenant }).where("id", "=", clanId).execute();
          if (p.type === ProposalType.CLAN_CREATION) {
            await trx.insertInto("clan_experience").values({ clan_id: clanId }).onConflict(oc => oc.column("clan_id").doNothing()).execute();
            await sql`insert into clan_team (created_at, updated_at, clan_id, name, type)
                      values (${maintenant}, ${maintenant}, ${clanId}, 'Equipe principale', 0),
                             (${maintenant}, ${maintenant}, ${clanId}, 'Equipe secondaire', 1)`.execute(trx);
          }
        }
        return { type: p.type, cible: Number(p.target_entity_id), statut, clanVise };
      });
      if (!close) continue;
      closes += 1;
      if (close.clanVise) await ClanCycleService.effetsIssue(db, close.cible, close.type, close.statut, null);
      else await EFFETS_VOTE.get(close.type)?.(db, { id: candidate.id, type: close.type, targetEntityId: close.cible }, close.statut);
    }
    return { closes };
  }

  /** Effets Discord (et suppression du clan refusé) une fois la proposition close. */
  private static async effetsIssue(
    db: Kysely<Database>,
    clanId: number,
    type: string,
    statut: ProposalStatus,
    votantId: string | null,
  ) {
    const clan = await clanDiscord(db, clanId);
    if (!clan) return;
    const presidentId = await presidentDe(db, clanId);
    if (statut === ProposalStatus.APPROVED) {
      if (presidentId) await discord.ajouterRoleClan(presidentId, roleCapitaine(), `Président du Clan ${clan.name}`);
      const felicitations =
        type === ProposalType.CLAN_CREATION ? `Félicitations, votre Clan ${clan.name} a été créé !` : "Félicitations, votre Clan a été approuvé par les Administrateurs !";
      await discord.publierSalonsClan(clan, { ...(presidentId ? { content: `<@${presidentId}>` } : {}), embeds: [discord.embedSucces(felicitations)] }, "annonce de création");
      await discord.annoncerClans(
        { embeds: [{ color: discord.COULEUR_SUCCES, title: `Nouveau Clan : ${discord.echapper(clan.name)}`, description: presidentId ? `Président : <@${presidentId}>` : undefined }] },
        "annonce générale du nouveau clan",
      );
      return;
    }
    // Rejet ou expiration : le clan en création est supprimé, avec ce qui a été créé sur Discord.
    const auteur = votantId ? (await nomsJoueurs(db, [votantId])).get(votantId)!.nom : "les fondateurs";
    const motif =
      statut === ProposalStatus.EXPIRED
        ? `La procédure de vote a expiré, la fondation du Clan ${clan.name} a donc été annulée.`
        : type === ProposalType.CLAN_CREATION
          ? `La création du Clan ${clan.name} a été annulée par ${auteur}.`
          : `Votre demande de création du Clan ${clan.name} a été rejetée par les Administrateurs.`;
    await ClanCycleService.supprimerClan(db, clanId);
    await nettoyerDiscordClan(clan, null, motif);
    await supprimerEmoji(clan.emojiId);
    if (presidentId) await discord.mp(presidentId, { embeds: [discord.embedErreur(motif)] }, "MP d'annulation de fondation");
  }

  /** Supprime un clan qui n'a jamais existé (fondation refusée) — legacy `deleteClan`. */
  static async supprimerClan(db: Kysely<Database>, clanId: number) {
    await db.transaction().execute(async trx => {
      await trx.deleteFrom("clan_application").where("clan_id", "=", clanId).execute();
      await trx.deleteFrom("clan_invite").where("clan_id", "=", clanId).execute();
      await trx.deleteFrom("clan_member").where("clan_id", "=", clanId).execute();
      await trx.deleteFrom("clan_experience").where("clan_id", "=", clanId).execute();
      await sql`delete from clan_team where clan_id = ${clanId}`.execute(trx);
      await trx.deleteFrom("clan").where("id", "=", clanId).execute();
    });
  }
}
