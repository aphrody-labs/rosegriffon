/**
 * Interclans — lectures et écritures en base, effets Discord.
 *
 * Port de `InterclanCommand`, `InterclanButtons`, `InterclanRepository`,
 * `cancelInterclan` et `InterclanResultsValidationVoteHandler` de l'ancien bot.
 * Les décisions (dates, fenêtres, compositions, droits, transitions) viennent
 * de `./regles` ; ce module lit, applique, écrit.
 *
 * ── STOCKAGE ───────────────────────────────────────────────────────────────
 * Un interclan est une ligne `event` de type `INTERCLAN` (`clan_a_id` =
 * challenger, `clan_b_id` = défié, `state` = `InterclanState`, `fixed_date`,
 * `discord_channel_id`, `winner_clan_id` en texte). Compositions :
 * `interclan_lineup` (une par clan) et `interclan_lineup_member` (position
 * 1–5). Matchs : `lobby` (`event_type` INTERCLAN, 1 contre 1) + `lobby_user`
 * (équipe 1 = clan A, équipe 2 = clan B). Validation des scores :
 * `vote_proposal` de type `INTERCLAN_VALIDATION`, unanimité des dix joueurs
 * alignés, 24 h. `interclan_lineup_member`, `vote_proposal`, `vote` et
 * `vote_proposal_eligible_voters` sont des tables MikroORM hors du schéma
 * Kysely typé : elles passent par `sql`.
 *
 * ── EFFETS DISCORD ─────────────────────────────────────────────────────────
 * Salon privé de l'interclan (catégorie `ACHILLEA_INTERCLAN_CATEGORY_ID`),
 * défi dans le salon du clan défié, avis dans les salons des deux clans,
 * vote de validation, annonce du résultat. Ils passent par le jeton de
 * l'application Achilléa (`EffetsDiscord`, injectable) et ne font jamais
 * échouer une écriture — sauf l'ouverture du salon à l'acceptation, préalable
 * comme dans l'ancien bot.
 */
import { sql, type Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { normalizeNames } from "@rosegriffon/achillea-core";

import { publierSalonAchillea, type MessageAchillea } from "../../../../lib/achillea-discord";
import { enregistrerEffetVote } from "../clans/cycle-service";
import { configAchillea, consigner, restAchillea } from "../clans/discord";
import {
  embedErreur,
  embedScores,
  embedSucces,
  messageDefi,
  messageOuverture,
  messageVote,
  type DetailInterclan,
  type MessageDiscord,
} from "./messages";
import {
  apparier,
  calculerVainqueur,
  clanEnConflit,
  compositionValide,
  defiExpire,
  dirigeLeClan,
  dirigeUnDesClans,
  DUREE_VOTE_MS,
  estPret,
  ETAT,
  ETATS_ACTIFS,
  HORIZON_MS,
  LIBELLES_ETAT,
  lireDateDefi,
  peutLancer,
  peutVerrouiller,
  permis,
  refuser,
  ROLE_ADMIN,
  ROLE_CLAN,
  validerComposition,
  validerScore,
  type Acteur,
  type Placement,
  type Refus,
} from "./regles";

type Db = Kysely<Database>;
export type Issue<T> = { ok: true; valeur: T } | Refus;
const ok = <T>(valeur: T): Issue<T> => ({ ok: true, valeur });

// ─── Effets Discord ─────────────────────────────────────────────────────────

export interface EffetsDiscord {
  /** Ouvre le salon privé de l'interclan ; rend son identifiant, ou `null` si Discord refuse. */
  creerSalon(nom: string, rolesClans: readonly string[], interclanId: number): Promise<string | null>;
  supprimerSalon(salonId: string, raison: string): Promise<void>;
  publier(salonId: string | null | undefined, message: MessageDiscord, action: string): Promise<void>;
}

/** Catégorie Discord des salons d'interclan (valeur de production de l'ancien bot). */
export function categorieInterclans(env: Record<string, string | undefined> = Bun.env): string {
  return (env.ACHILLEA_INTERCLAN_CATEGORY_ID ?? "").trim() || "1433410236009545789";
}

const VOIR = 1n << 10n;
const ECRIRE = 1n << 11n;
const HISTORIQUE = 1n << 16n;
const bits = (...v: bigint[]) => v.reduce((a, b) => a | b, 0n).toString();

export const effetsParDefaut: EffetsDiscord = {
  async creerSalon(nom, rolesClans, interclanId) {
    const { guildId } = configAchillea();
    const bot = await restAchillea<{ id: string }>("GET", "/users/@me");
    if (!bot.ok) {
      consigner("identité du bot (salon d'interclan)", bot);
      return null;
    }
    const salon = await restAchillea<{ id: string }>(
      "POST",
      `/guilds/${guildId}/channels`,
      {
        name: nom.slice(0, 90),
        type: 0,
        parent_id: categorieInterclans(),
        permission_overwrites: [
          { id: guildId, type: 0, deny: bits(VOIR) },
          ...rolesClans.filter(Boolean).map(id => ({ id, type: 0, allow: bits(VOIR, ECRIRE, HISTORIQUE) })),
          { id: bot.data.id, type: 1, allow: bits(VOIR, ECRIRE, HISTORIQUE) },
        ],
      },
      `Création automatique d'un salon pour l'interclan #${interclanId}`,
    );
    consigner("création du salon d'interclan", salon);
    return salon.ok ? salon.data.id : null;
  },
  async supprimerSalon(salonId, raison) {
    consigner("suppression du salon d'interclan", await restAchillea("DELETE", `/channels/${salonId}`, undefined, raison));
  },
  async publier(salonId, message, action) {
    if (!salonId || !/^\d{5,25}$/u.test(salonId)) return;
    consigner(action, await publierSalonAchillea(salonId, message as MessageAchillea));
  },
};

// ─── Lectures ───────────────────────────────────────────────────────────────

/** Clan actif du joueur, son rang dans ce clan, et son rôle Achilléa. */
export async function acteurDe(db: Db, userId: string): Promise<Acteur> {
  const [membre, utilisateur] = await Promise.all([
    db
      .selectFrom("clan_member as cm")
      .innerJoin("clan as c", "c.id", "cm.clan_id")
      .select(["cm.clan_id", "cm.role"])
      .where("cm.user_id", "=", userId)
      .where("c.is_disbanded", "=", false)
      .orderBy("c.is_inactive", "asc")
      .limit(1)
      .executeTakeFirst(),
    db.selectFrom("user").select("role").where("id", "=", userId).executeTakeFirst(),
  ]);
  return {
    clanId: membre ? Number(membre.clan_id) : null,
    roleClan: membre ? Number(membre.role) : -1,
    roleUtilisateur: Number(utilisateur?.role ?? 0),
  };
}

async function clansParId(db: Db, ids: number[]) {
  const lignes = await db
    .selectFrom("clan")
    .select(["id", "name", "shortened_name", "normalized_short_name", "clan_emoji_id", "clan_avatar_url", "role_id", "channel_id"])
    .where("id", "in", ids)
    .execute();
  return new Map(
    lignes.map(c => [
      Number(c.id),
      {
        id: Number(c.id),
        name: c.name,
        shortName: c.shortened_name,
        normalizedShortName: c.normalized_short_name,
        emojiId: c.clan_emoji_id || null,
        avatarUrl: c.clan_avatar_url,
        roleId: c.role_id,
        channelId: c.channel_id,
      },
    ]),
  );
}

interface LigneEvent {
  id: number;
  name: string;
  description: string;
  state: number | null;
  fixed_date: Date | null;
  created_at: Date;
  updated_at: Date;
  discord_channel_id: string | null;
  winner_clan_id: string | null;
  clan_a_id: number | null;
  clan_b_id: number | null;
}

async function ligneInterclan(db: Db, id: number): Promise<LigneEvent | undefined> {
  return db
    .selectFrom("event")
    .select([
      "id",
      "name",
      "description",
      "state",
      "fixed_date",
      "created_at",
      "updated_at",
      "discord_channel_id",
      "winner_clan_id",
      "clan_a_id",
      "clan_b_id",
    ])
    .where("id", "=", id)
    .where("type", "=", "INTERCLAN")
    .executeTakeFirst();
}

/** Fiche complète d'un interclan, vue par `spectateur` (droits d'affichage des boutons). */
export async function chargerDetail(db: Db, id: number, spectateur: Acteur | null = null): Promise<DetailInterclan | null> {
  const ev = await ligneInterclan(db, id);
  if (!ev || ev.clan_a_id === null || ev.clan_b_id === null) return null;
  const clans = await clansParId(db, [Number(ev.clan_a_id), Number(ev.clan_b_id)]);
  const clanA = clans.get(Number(ev.clan_a_id));
  const clanB = clans.get(Number(ev.clan_b_id));
  if (!clanA || !clanB) return null;

  const lineups = await db
    .selectFrom("interclan_lineup")
    .select(["id", "clan_id", "locked_in"])
    .where("event_id", "=", id)
    .execute();
  const membres = lineups.length
    ? (
        await sql<{ lineup_id: number; user_id: string; position: number; nom: string | null }>`
          select ilm.lineup_id, ilm.user_id, ilm.position, coalesce(nullif(u.display_name, ''), u.username, ilm.user_id) as nom
          from interclan_lineup_member ilm
          left join "user" u on u.id = ilm.user_id
          where ilm.lineup_id in (${sql.join(lineups.map(l => l.id))})
          order by ilm.position
        `.execute(db)
      ).rows
    : [];

  const lobbies = await db
    .selectFrom("lobby")
    .select(["id", "state"])
    .where("event_id", "=", id)
    .where("event_type", "=", "INTERCLAN")
    .orderBy("id", "asc")
    .execute();
  const joueurs = lobbies.length
    ? await db
        .selectFrom("lobby_user as lu")
        .leftJoin("user as u", "u.id", "lu.user_id")
        .select(["lu.lobby_id", "lu.user_id", "lu.team", "lu.score", "u.display_name", "u.username"])
        .where("lu.lobby_id", "in", lobbies.map(l => l.id))
        .execute()
    : [];

  const proposition = (
    await sql<{
      id: number;
      status: string;
      expires_at: Date;
      closed_at: Date | null;
      min_participation_ratio: number;
      pour: number;
      contre: number;
      eligibles: number;
    }>`
      select vp.id, vp.status, vp.expires_at, vp.closed_at, vp.min_participation_ratio,
        (select count(*)::int from vote v where v.proposal_id = vp.id and v.vote = 'APPROVE') as pour,
        (select count(*)::int from vote v where v.proposal_id = vp.id and v.vote = 'REJECT') as contre,
        (select count(*)::int from vote_proposal_eligible_voters e where e.vote_proposal_id = vp.id) as eligibles
      from vote_proposal vp
      where vp.type = 'INTERCLAN_VALIDATION' and vp.target_entity_id = ${id}
      order by vp.id desc
      limit 1
    `.execute(db)
  ).rows[0];

  const etat = Number(ev.state ?? 0);
  return {
    id: Number(ev.id),
    name: ev.name,
    description: ev.description,
    state: etat,
    stateLabel: LIBELLES_ETAT[etat] ?? String(etat),
    fixedDate: ev.fixed_date ?? ev.created_at,
    createdAt: ev.created_at,
    updatedAt: ev.updated_at,
    discordChannelId: ev.discord_channel_id,
    winnerClanId: ev.winner_clan_id ? Number(ev.winner_clan_id) : null,
    clanA,
    clanB,
    lineups: lineups.map(l => {
      const liste = membres
        .filter(m => Number(m.lineup_id) === Number(l.id))
        .map(m => ({ userId: m.user_id, displayName: m.nom ?? m.user_id, position: Number(m.position) }));
      return { id: Number(l.id), clanId: Number(l.clan_id), lockedIn: Boolean(l.locked_in), valid: compositionValide(liste.length), members: liste };
    }),
    matches: lobbies.map(l => ({
      id: Number(l.id),
      state: l.state,
      players: joueurs
        .filter(j => Number(j.lobby_id) === Number(l.id))
        .map(j => ({
          userId: j.user_id,
          displayName: j.display_name || j.username || j.user_id,
          team: Number(j.team),
          score: Number(j.score ?? 0),
        })),
    })),
    validation: proposition
      ? {
          proposalId: Number(proposition.id),
          status: proposition.status,
          expiresAt: proposition.expires_at,
          closedAt: proposition.closed_at,
          approvals: Number(proposition.pour),
          rejections: Number(proposition.contre),
          eligible: Number(proposition.eligibles),
          minParticipationRatio: Number(proposition.min_participation_ratio ?? 1),
        }
      : null,
    viewer: spectateur
      ? {
          clanId: spectateur.clanId,
          clanRole: spectateur.clanId === null ? null : spectateur.roleClan,
          isAdmin: spectateur.roleUtilisateur >= ROLE_ADMIN,
        }
      : null,
  };
}

export interface ResumeInterclan {
  id: number;
  name: string;
  state: number;
  stateLabel: string;
  fixedDate: Date;
  clanA: { id: number; name: string; shortName: string };
  clanB: { id: number; name: string; shortName: string };
  winnerClanId: number | null;
}

/** Interclans d'un clan (ou tous), du plus récent au plus ancien. */
export async function lister(
  db: Db,
  filtres: { clanId?: number | null; state?: number | null; limit?: number },
): Promise<ResumeInterclan[]> {
  let requete = db
    .selectFrom("event as e")
    .innerJoin("clan as a", "a.id", "e.clan_a_id")
    .innerJoin("clan as b", "b.id", "e.clan_b_id")
    .select([
      "e.id",
      "e.name",
      "e.state",
      "e.fixed_date",
      "e.created_at",
      "e.winner_clan_id",
      "a.id as a_id",
      "a.name as a_name",
      "a.shortened_name as a_short",
      "b.id as b_id",
      "b.name as b_name",
      "b.shortened_name as b_short",
    ])
    .where("e.type", "=", "INTERCLAN");
  if (filtres.clanId) {
    const clanId = filtres.clanId;
    requete = requete.where(eb => eb.or([eb("e.clan_a_id", "=", clanId), eb("e.clan_b_id", "=", clanId)]));
  }
  if (filtres.state !== undefined && filtres.state !== null) requete = requete.where("e.state", "=", filtres.state);
  const lignes = await requete
    .orderBy("e.fixed_date", "desc")
    .limit(Math.min(Math.max(filtres.limit ?? 25, 1), 100))
    .execute();
  return lignes.map(l => {
    const etat = Number(l.state ?? 0);
    return {
      id: Number(l.id),
      name: l.name,
      state: etat,
      stateLabel: LIBELLES_ETAT[etat] ?? String(etat),
      fixedDate: l.fixed_date ?? l.created_at,
      clanA: { id: Number(l.a_id), name: l.a_name, shortName: l.a_short },
      clanB: { id: Number(l.b_id), name: l.b_name, shortName: l.b_short },
      winnerClanId: l.winner_clan_id ? Number(l.winner_clan_id) : null,
    };
  });
}

async function detailOu404(db: Db, id: number, acteur: Acteur | null): Promise<Issue<DetailInterclan>> {
  const detail = await chargerDetail(db, id, acteur);
  return detail ? ok(detail) : refuser(404, "Cet Interclan n'existe plus ou a été supprimé.");
}

async function changerEtat(db: Db, id: number, etat: number, extra: { discord_channel_id?: string | null; winner_clan_id?: string | null } = {}) {
  await db
    .updateTable("event")
    .set({ state: etat, updated_at: new Date(), ...extra })
    .where("id", "=", id)
    .execute();
}

// ─── Écritures ──────────────────────────────────────────────────────────────

export interface EntreeDefi {
  /** Sigle du clan défié (insensible à la casse et aux accents). */
  challengedShortName?: string;
  challengedClanId?: number;
  /** « JJ/MM HH:MM » (heure de Paris) ou ISO 8601. */
  date: string;
  motif?: string | null;
}

/** `/interclan request` — le challenger (Vice-Président+) défie un clan. */
export async function proposer(
  db: Db,
  userId: string,
  entree: EntreeDefi,
  maintenant = Date.now(),
  effets: EffetsDiscord = effetsParDefaut,
): Promise<Issue<DetailInterclan>> {
  const acteur = await acteurDe(db, userId);
  if (acteur.clanId === null) return refuser(400, "Vous ne faites pas partie d'un Clan.");
  const droits = dirigeLeClan({ ...acteur, roleUtilisateur: 0 }, acteur.clanId);
  if (!droits.ok) return droits;

  const cible = entree.challengedClanId
    ? await db.selectFrom("clan").select(["id", "name"]).where("id", "=", entree.challengedClanId).where("is_disbanded", "=", false).executeTakeFirst()
    : await db
        .selectFrom("clan")
        .select(["id", "name"])
        .where("normalized_short_name", "=", normalizeNames(entree.challengedShortName ?? ""))
        .where("is_disbanded", "=", false)
        .executeTakeFirst();
  if (!cible) return refuser(404, `Aucun clan avec le sigle ${entree.challengedShortName ?? entree.challengedClanId} n'a été trouvé.`);
  if (Number(cible.id) === acteur.clanId) return refuser(400, "Vous ne pouvez pas vous auto-défier !");

  const date = lireDateDefi(entree.date, maintenant);
  if (!date.ok) return date;

  const clanA = acteur.clanId;
  const clanB = Number(cible.id);
  const existants = await db
    .selectFrom("event")
    .select(["clan_a_id", "clan_b_id", "fixed_date", "state"])
    .where("type", "=", "INTERCLAN")
    .where("state", "in", [...ETATS_ACTIFS])
    .where("fixed_date", ">=", new Date(maintenant - HORIZON_MS))
    .where("fixed_date", "<=", new Date(maintenant + 2 * HORIZON_MS))
    .where(eb => eb.or([eb("clan_a_id", "in", [clanA, clanB]), eb("clan_b_id", "in", [clanA, clanB])]))
    .execute();
  const conflit = clanEnConflit(
    clanA,
    clanB,
    date.valeur,
    existants
      .filter(e => e.fixed_date && e.clan_a_id !== null && e.clan_b_id !== null)
      .map(e => ({ clanA: Number(e.clan_a_id), clanB: Number(e.clan_b_id), date: e.fixed_date!, etat: Number(e.state) })),
  );
  const clans = await clansParId(db, [clanA, clanB]);
  if (conflit !== null)
    return refuser(409, `Un interclan est déjà prévu à cette date pour ${clans.get(conflit)?.name ?? "l'un des clans"}.`);

  const a = clans.get(clanA)!;
  const b = clans.get(clanB)!;
  const now = new Date(maintenant);
  const cree = await sql<{ id: number }>`
    insert into event (created_at, updated_at, name, description, type, clan_a_id, clan_b_id, state, fixed_date)
    values (${now}, ${now}, ${`${a.shortName} vs ${b.shortName}`.slice(0, 255)},
      ${(entree.motif?.trim() || "Aucun motif fourni").slice(0, 1500)}, 'INTERCLAN', ${clanA}, ${clanB},
      ${ETAT.EN_ATTENTE}, ${date.valeur})
    returning id
  `.execute(db);
  const id = Number(cree.rows[0]!.id);
  const detail = (await chargerDetail(db, id, acteur))!;

  const dirigeants = await db
    .selectFrom("clan_member")
    .select("user_id")
    .where("clan_id", "=", clanB)
    .where("role", ">=", ROLE_CLAN.VICE_PRESIDENT)
    .orderBy("role", "desc")
    .execute();
  await effets.publier(b.channelId, messageDefi(detail, userId, dirigeants.map(d => d.user_id)), "défi d'interclan");
  return ok(detail);
}

/** Réponse du clan défié (Vice-Président+). Accepter ouvre le salon et les compositions. */
export async function repondre(
  db: Db,
  userId: string,
  id: number,
  accepte: boolean,
  maintenant = Date.now(),
  effets: EffetsDiscord = effetsParDefaut,
): Promise<Issue<DetailInterclan>> {
  const acteur = await acteurDe(db, userId);
  const lu = await detailOu404(db, id, acteur);
  if (!lu.ok) return lu;
  const detail = lu.valeur;
  if (acteur.clanId !== detail.clanB.id && acteur.roleUtilisateur < ROLE_ADMIN)
    return refuser(403, `Seuls les membres du clan défié (${detail.clanB.name}) peuvent répondre à ce défi.`);
  const droits = dirigeLeClan(acteur, detail.clanB.id);
  if (!droits.ok) return droits;
  const etat = permis("repondre", detail.state);
  if (!etat.ok) return etat;
  if (defiExpire(new Date(detail.createdAt), maintenant)) {
    await changerEtat(db, id, ETAT.ANNULE);
    await effets.publier(detail.clanA.channelId, { embeds: [embedErreur(`Le défi lancé à ${detail.clanB.name} a expiré sans réponse.`)] }, "expiration du défi");
    return refuser(409, "Ce défi a expiré (24 h sans réponse).");
  }

  if (!accepte) {
    await changerEtat(db, id, ETAT.REFUSE);
    await effets.publier(
      detail.clanA.channelId,
      { embeds: [embedErreur(`Le clan ${detail.clanB.name} a refusé le défi d'Interclan proposé par ${detail.clanA.name}.`)] },
      "refus du défi",
    );
    return detailOu404(db, id, acteur);
  }

  const salon = await effets.creerSalon(detail.name, [detail.clanA.roleId, detail.clanB.roleId], id);
  if (!salon) return { ok: false, statut: 409, message: "Discord Achilléa est indisponible : le salon de l'interclan n'a pas pu être créé. Réessayez." };
  try {
    await db.transaction().execute(async trx => {
      const existantes = await trx.selectFrom("interclan_lineup").select("clan_id").where("event_id", "=", id).execute();
      const presentes = new Set(existantes.map(l => Number(l.clan_id)));
      for (const clanId of [detail.clanA.id, detail.clanB.id])
        if (!presentes.has(clanId)) await trx.insertInto("interclan_lineup").values({ event_id: id, clan_id: clanId, locked_in: false }).execute();
      await trx
        .updateTable("event")
        .set({ state: ETAT.ACCEPTE, discord_channel_id: salon, updated_at: new Date() })
        .where("id", "=", id)
        .where("state", "=", ETAT.EN_ATTENTE)
        .execute();
    });
  } catch (err) {
    await effets.supprimerSalon(salon, "Rollback suite à une erreur pendant l'acceptation de l'interclan");
    throw err;
  }
  const accepteDetail = (await chargerDetail(db, id, acteur))!;
  await effets.publier(
    detail.clanA.channelId,
    { embeds: [embedSucces(`Le clan ${detail.clanB.name} a accepté le défi d'Interclan proposé par ${detail.clanA.name} !`)] },
    "acceptation du défi",
  );
  await effets.publier(salon, messageOuverture(accepteDetail), "ouverture du salon d'interclan");
  return ok(accepteDetail);
}

/** Remplace la composition d'un clan (Vice-Président+ de CE clan). */
export async function composer(db: Db, userId: string, id: number, clanId: number, placements: readonly Placement[]): Promise<Issue<DetailInterclan>> {
  const acteur = await acteurDe(db, userId);
  const lu = await detailOu404(db, id, acteur);
  if (!lu.ok) return lu;
  const detail = lu.valeur;
  if (clanId !== detail.clanA.id && clanId !== detail.clanB.id) return refuser(404, "Ce clan ne participe pas à cet interclan.");
  const droits = dirigeLeClan(acteur, clanId);
  if (!droits.ok) return droits;
  const etat = permis("composer", detail.state);
  if (!etat.ok) return etat;
  const lineup = detail.lineups.find(l => l.clanId === clanId);
  if (!lineup) return refuser(404, "Aucune lineup trouvée pour ce clan.");

  const ids = placements.map(p => p.userId.trim()).filter(Boolean);
  const membres = ids.length
    ? await db.selectFrom("clan_member").select("user_id").where("clan_id", "=", clanId).where("user_id", "in", ids).execute()
    : [];
  const verdict = validerComposition(placements, new Set(membres.map(m => m.user_id)), lineup.lockedIn);
  if (!verdict.ok) return verdict;

  await db.transaction().execute(async trx => {
    await sql`delete from interclan_lineup_member where lineup_id = ${lineup.id}`.execute(trx);
    for (const p of verdict.valeur)
      await sql`insert into interclan_lineup_member (lineup_id, user_id, position) values (${lineup.id}, ${p.userId}, ${p.position})`.execute(trx);
    await trx.updateTable("event").set({ updated_at: new Date() }).where("id", "=", id).execute();
  });
  return detailOu404(db, id, acteur);
}

/** Verrouille la composition d'un clan, dans l'heure qui précède la rencontre. */
export async function verrouiller(db: Db, userId: string, id: number, clanId: number, maintenant = Date.now()): Promise<Issue<DetailInterclan>> {
  const acteur = await acteurDe(db, userId);
  const lu = await detailOu404(db, id, acteur);
  if (!lu.ok) return lu;
  const detail = lu.valeur;
  if (clanId !== detail.clanA.id && clanId !== detail.clanB.id) return refuser(404, "Ce clan ne participe pas à cet interclan.");
  const droits = dirigeLeClan(acteur, clanId);
  if (!droits.ok) return droits;
  const etat = permis("verrouiller", detail.state);
  if (!etat.ok) return etat;
  if (!peutVerrouiller(new Date(detail.fixedDate), maintenant))
    return refuser(409, "Le verrouillage ne peut être effectué qu'une heure avant le début de l'Interclan.");
  const lineup = detail.lineups.find(l => l.clanId === clanId);
  if (!lineup) return refuser(404, "Aucune lineup trouvée pour ce clan.");
  if (lineup.lockedIn) return refuser(409, "Cette lineup est déjà verrouillée.");
  if (!lineup.valid) return refuser(400, "La lineup doit compter exactement 5 joueurs pour être verrouillée.");

  await db.updateTable("interclan_lineup").set({ locked_in: true }).where("id", "=", lineup.id).execute();
  const apres = detail.lineups.map(l => ({ verrouillee: l.id === lineup.id ? true : l.lockedIn, joueurs: l.members.length }));
  if (estPret(apres)) await changerEtat(db, id, ETAT.PRET);
  else await db.updateTable("event").set({ updated_at: new Date() }).where("id", "=", id).execute();
  return detailOu404(db, id, acteur);
}

/** Annule un interclan accepté ou prêt (Président de l'un des deux clans). */
export async function annuler(db: Db, userId: string, id: number, effets: EffetsDiscord = effetsParDefaut): Promise<Issue<DetailInterclan>> {
  const acteur = await acteurDe(db, userId);
  const lu = await detailOu404(db, id, acteur);
  if (!lu.ok) return lu;
  const detail = lu.valeur;
  const droits = dirigeUnDesClans(acteur, detail.clanA.id, detail.clanB.id, ROLE_CLAN.PRESIDENT);
  if (!droits.ok) return droits;
  const etat = permis("annuler", detail.state);
  if (!etat.ok) return etat;
  const auteur = droits.valeur === detail.clanA.id ? detail.clanA.name : detail.clanB.name;
  return clore(db, detail, `par ${auteur}`, effets, acteur);
}

async function clore(db: Db, detail: DetailInterclan, motif: string, effets: EffetsDiscord, acteur: Acteur | null): Promise<Issue<DetailInterclan>> {
  await changerEtat(db, detail.id, ETAT.ANNULE);
  if (detail.discordChannelId) await effets.supprimerSalon(detail.discordChannelId, `Interclan #${detail.id} annulé`);
  const avis: MessageDiscord = {
    embeds: [embedErreur(`L'interclan entre ${detail.clanA.name} et ${detail.clanB.name} a été annulé ${motif}.`)],
  };
  await effets.publier(detail.clanA.channelId, avis, "annulation de l'interclan");
  await effets.publier(detail.clanB.channelId, avis, "annulation de l'interclan");
  return detailOu404(db, detail.id, acteur);
}

/** Lance l'interclan : un match 1 contre 1 par position (Vice-Président+ de l'un des clans). */
export async function lancer(
  db: Db,
  userId: string,
  id: number,
  maintenant = Date.now(),
  effets: EffetsDiscord = effetsParDefaut,
): Promise<Issue<DetailInterclan>> {
  const acteur = await acteurDe(db, userId);
  const lu = await detailOu404(db, id, acteur);
  if (!lu.ok) return lu;
  const detail = lu.valeur;
  const droits = dirigeUnDesClans(acteur, detail.clanA.id, detail.clanB.id);
  if (!droits.ok) return droits;
  const etat = permis("lancer", detail.state);
  if (!etat.ok) return etat;
  if (!peutLancer(new Date(detail.fixedDate), maintenant))
    return refuser(409, "Le lancement de l'interclan s'effectue à partir de l'heure prévue, avec une tolérance de 4 heures de retard.");
  const a = detail.lineups.find(l => l.clanId === detail.clanA.id);
  const b = detail.lineups.find(l => l.clanId === detail.clanB.id);
  const paires = apparier(a?.members ?? [], b?.members ?? []);
  if (paires.length === 0) return refuser(409, "Impossible de générer des matchs : aucune lineup valide trouvée.");

  await db.transaction().execute(async trx => {
    const bascule = await trx
      .updateTable("event")
      .set({ state: ETAT.EN_COURS, updated_at: new Date() })
      .where("id", "=", id)
      .where("state", "=", ETAT.PRET)
      .executeTakeFirst();
    if (Number(bascule.numUpdatedRows) === 0) throw new ConflitConcurrent();
    const now = new Date();
    for (const p of paires) {
      const lobby = await trx
        .insertInto("lobby")
        .values({
          created_at: now,
          updated_at: now,
          event_type: "INTERCLAN",
          event_id: id,
          mode: 2,
          state: "Fresh",
          match_format: "double_leg",
          is_repool: false,
          ranked_elo_applied: false,
          bracket_match_id: null,
          channel_id: null,
          host_user_id: null,
          phase_id: null,
          swiss_round: null,
          custom_format_child_count: null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      const ligne = (userId: string, team: number) => ({
        created_at: now,
        updated_at: now,
        user_id: userId,
        lobby_id: lobby.id,
        team,
        score: 0,
        forfeit: false,
        elo_variation: 0,
        validated_result: false,
        claimed_opponent_score: null,
        screenshot_url: null,
        state: "Pending",
      });
      await trx.insertInto("lobby_user").values([ligne(p.joueurA, 1), ligne(p.joueurB, 2)]).execute();
    }
  }).catch(err => {
    if (err instanceof ConflitConcurrent) return;
    throw err;
  });
  const apres = (await chargerDetail(db, id, acteur))!;
  if (apres.state !== ETAT.EN_COURS) return refuser(409, "L'interclan a déjà été lancé.");
  await effets.publier(
    apres.discordChannelId,
    { embeds: [embedSucces(`Interclan ${apres.name} lancé ! Les matchs peuvent commencer.`), embedScores(apres)] },
    "lancement de l'interclan",
  );
  return ok(apres);
}

class ConflitConcurrent extends Error {}

export interface ResultatScore {
  detail: DetailInterclan;
  /** Tous les matchs sont joués : le vote de validation est ouvert. */
  termine: boolean;
  match: { id: number; scoreA: number; scoreB: number; joueurA: string; joueurB: string };
}

/** Saisit le score d'un match (dirigeant de l'un des clans, ou l'un des deux joueurs). */
export async function saisirScore(
  db: Db,
  userId: string,
  lobbyId: number,
  scoreA: number,
  scoreB: number,
  maintenant = Date.now(),
  effets: EffetsDiscord = effetsParDefaut,
): Promise<Issue<ResultatScore>> {
  const score = validerScore(scoreA, scoreB);
  if (!score.ok) return score;
  const lobby = await db
    .selectFrom("lobby")
    .select(["id", "event_id", "state"])
    .where("id", "=", lobbyId)
    .where("event_type", "=", "INTERCLAN")
    .executeTakeFirst();
  if (!lobby) return refuser(404, `Match #${lobbyId} introuvable.`);
  const id = Number(lobby.event_id);
  const acteur = await acteurDe(db, userId);
  const lu = await detailOu404(db, id, acteur);
  if (!lu.ok) return lu;
  const detail = lu.valeur;
  const etat = permis("saisir", detail.state);
  if (!etat.ok) return etat;
  const match = detail.matches.find(m => m.id === lobbyId)!;
  const joueur = match.players.some(p => p.userId === userId);
  if (!joueur) {
    const droits = dirigeUnDesClans(acteur, detail.clanA.id, detail.clanB.id);
    if (!droits.ok) return droits;
  }
  const joueurA = match.players.find(p => p.team === 1);
  const joueurB = match.players.find(p => p.team === 2);
  if (!joueurA || !joueurB) return refuser(409, "Impossible de trouver les joueurs du match.");

  await db.transaction().execute(async trx => {
    await trx.updateTable("lobby_user").set({ score: score.valeur.scoreA, updated_at: new Date() }).where("lobby_id", "=", lobbyId).where("team", "=", 1).execute();
    await trx.updateTable("lobby_user").set({ score: score.valeur.scoreB, updated_at: new Date() }).where("lobby_id", "=", lobbyId).where("team", "=", 2).execute();
    await trx.updateTable("lobby").set({ state: "Finished", updated_at: new Date() }).where("id", "=", lobbyId).execute();
    await trx.updateTable("event").set({ updated_at: new Date() }).where("id", "=", id).execute();
  });

  let apres = (await chargerDetail(db, id, acteur))!;
  const termine = apres.matches.length > 0 && apres.matches.every(m => m.state === "Finished");
  if (termine) {
    await ouvrirValidation(db, apres, maintenant);
    apres = (await chargerDetail(db, id, acteur))!;
    await effets.publier(apres.discordChannelId, messageVote(apres), "vote de validation de l'interclan");
  }
  return ok({
    detail: apres,
    termine,
    match: { id: lobbyId, scoreA: score.valeur.scoreA, scoreB: score.valeur.scoreB, joueurA: joueurA.displayName, joueurB: joueurB.displayName },
  });
}

/** Tous les matchs joués : état TERMINÉ et vote unanime des joueurs alignés (24 h). */
async function ouvrirValidation(db: Db, detail: DetailInterclan, maintenant: number) {
  const votants = [...new Set(detail.lineups.flatMap(l => l.members.map(m => m.userId)))];
  const now = new Date(maintenant);
  await db.transaction().execute(async trx => {
    const bascule = await trx
      .updateTable("event")
      .set({ state: ETAT.TERMINE, updated_at: now })
      .where("id", "=", detail.id)
      .where("state", "=", ETAT.EN_COURS)
      .executeTakeFirst();
    if (Number(bascule.numUpdatedRows) === 0) return;
    const cree = await sql<{ id: number }>`
      insert into vote_proposal (created_at, updated_at, type, target_entity_type, target_entity_id, reason, status, strategy, min_participation_ratio, expires_at)
      values (${now}, ${now}, 'INTERCLAN_VALIDATION', 'Interclan', ${detail.id},
        ${`Demande de validation des résultats de l'interclan ${detail.name}`.slice(0, 255)},
        'PENDING', 'UNANIMOUS', 1, ${new Date(maintenant + DUREE_VOTE_MS)})
      returning id
    `.execute(trx);
    const proposition = Number(cree.rows[0]!.id);
    for (const votant of votants)
      await sql`insert into vote_proposal_eligible_voters (vote_proposal_id, user_id) values (${proposition}, ${votant})`.execute(trx);
  });
}

export type IssueValidation = "APPROVED" | "REJECTED" | "EXPIRED";

/**
 * Conclut la validation des scores (appelée par le traitement des votes
 * `vote:approve|reject:<id>` quand la proposition se ferme, par l'arbitrage
 * staff et par l'entretien périodique).
 *
 *  - APPROVED : vainqueur calculé, état RÉSULTAT VALIDÉ, salon supprimé,
 *    annonce dans le salon général des clans ;
 *  - REJECTED : état RÉSULTAT CONTESTÉ, avis aux deux clans — un
 *    administrateur tranche ensuite (`arbitrer`). L'ancien bot ne faisait rien ;
 *  - EXPIRED : l'interclan n'est pas pris en compte (annulé), comme l'ancien bot.
 */
export async function conclureValidation(
  db: Db,
  id: number,
  issue: IssueValidation,
  effets: EffetsDiscord = effetsParDefaut,
): Promise<Issue<DetailInterclan>> {
  const lu = await detailOu404(db, id, null);
  if (!lu.ok) return lu;
  const detail = lu.valeur;
  const etat = permis("conclure", detail.state);
  if (!etat.ok) return etat;
  if (detail.validation && detail.validation.status === "PENDING")
    await sql`update vote_proposal set status = ${issue}, closed_at = ${new Date()}, updated_at = ${new Date()} where id = ${detail.validation.proposalId}`.execute(db);

  if (issue === "EXPIRED") {
    const avis: MessageDiscord = { embeds: [embedErreur(`La procédure de vote a expiré, l'interclan ${detail.name} ne sera donc pas pris en compte.`)] };
    await effets.publier(detail.clanA.channelId, { content: `<@&${detail.clanA.roleId}>`, ...avis }, "expiration du vote d'interclan");
    await effets.publier(detail.clanB.channelId, { content: `<@&${detail.clanB.roleId}>`, ...avis }, "expiration du vote d'interclan");
    return clore(db, detail, "pour expiration de la procédure de vote", effets, null);
  }
  if (issue === "REJECTED") {
    await changerEtat(db, id, ETAT.RESULTAT_CONTESTE);
    const avis: MessageDiscord = {
      embeds: [embedErreur(`Les résultats de l'interclan ${detail.name} sont contestés : le staff Achilléa va arbitrer.`)],
    };
    await effets.publier(detail.clanA.channelId, avis, "contestation de l'interclan");
    await effets.publier(detail.clanB.channelId, avis, "contestation de l'interclan");
    return detailOu404(db, id, null);
  }

  const bilan = calculerVainqueur(detail.matches.map(m => {
    const a = m.players.find(p => p.team === 1)?.score ?? 0;
    const b = m.players.find(p => p.team === 2)?.score ?? 0;
    return { scoreA: a, scoreB: b };
  }), detail.clanA.id, detail.clanB.id);
  await changerEtat(db, id, ETAT.RESULTAT_VALIDE, { winner_clan_id: bilan.vainqueur === null ? null : String(bilan.vainqueur) });
  if (detail.discordChannelId) await effets.supprimerSalon(detail.discordChannelId, `Interclan #${id} terminé`);
  const final = (await chargerDetail(db, id, null))!;
  const vainqueur = bilan.vainqueur === detail.clanA.id ? detail.clanA.name : bilan.vainqueur === detail.clanB.id ? detail.clanB.name : null;
  await effets.publier(
    configAchillea().clanAnnouncementsChannelId,
    {
      content: vainqueur
        ? `L'interclan ${detail.name} s'est terminé sur une victoire de ${vainqueur} (${bilan.pointsA}–${bilan.pointsB}).`
        : `L'interclan ${detail.name} s'est terminé sur un match nul (${bilan.pointsA}–${bilan.pointsB}).`,
      embeds: [embedScores(final)],
    },
    "annonce du résultat d'interclan",
  );
  return ok(final);
}

/** Arbitrage staff (administrateur Achilléa) d'un résultat terminé ou contesté. */
export async function arbitrer(db: Db, userId: string, id: number, valide: boolean, effets: EffetsDiscord = effetsParDefaut): Promise<Issue<DetailInterclan>> {
  const acteur = await acteurDe(db, userId);
  if (acteur.roleUtilisateur < ROLE_ADMIN) return refuser(403, "Seul un administrateur Achilléa peut arbitrer un interclan.");
  return conclureValidation(db, id, valide ? "APPROVED" : "EXPIRED", effets);
}

/**
 * Les boutons `vote:approve|reject:<id>` sont traités par `POST /clans/votes/:id`
 * (commun à tous les types de proposition). Quand une validation d'interclan se
 * ferme, c'est ici que son issue prend effet.
 */
enregistrerEffetVote("INTERCLAN_VALIDATION", async (db, proposition, statut) => {
  const issue = String(statut);
  if (issue !== "APPROVED" && issue !== "REJECTED" && issue !== "EXPIRED") return;
  const resultat = await conclureValidation(db, proposition.targetEntityId, issue);
  if (!resultat.ok) console.warn(`[achillea/interclans] validation #${proposition.id} : ${resultat.message}`);
});

/**
 * Entretien périodique : défis sans réponse depuis 24 h annulés, votes de
 * validation expirés conclus. Rend le nombre d'interclans traités.
 */
export async function entretenir(db: Db, maintenant = Date.now(), effets: EffetsDiscord = effetsParDefaut): Promise<{ defisExpires: number; votesExpires: number }> {
  const limite = new Date(maintenant - 24 * 60 * 60 * 1000);
  const defis = await db
    .selectFrom("event")
    .select(["id"])
    .where("type", "=", "INTERCLAN")
    .where("state", "=", ETAT.EN_ATTENTE)
    .where("created_at", "<", limite)
    .execute();
  for (const d of defis) {
    const detail = await chargerDetail(db, Number(d.id));
    if (!detail) continue;
    await changerEtat(db, detail.id, ETAT.ANNULE);
    await effets.publier(detail.clanA.channelId, { embeds: [embedErreur(`Le défi lancé à ${detail.clanB.name} a expiré sans réponse.`)] }, "expiration du défi");
  }
  const votes = (
    await sql<{ target_entity_id: number }>`
      select target_entity_id from vote_proposal
      where type = 'INTERCLAN_VALIDATION' and status = 'PENDING' and expires_at < ${new Date(maintenant)}
    `.execute(db)
  ).rows;
  for (const v of votes) await conclureValidation(db, Number(v.target_entity_id), "EXPIRED", effets);
  return { defisExpires: defis.length, votesExpires: votes.length };
}
