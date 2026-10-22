/**
 * `/clans/teams` — équipes internes d'un clan.
 *
 * Port de `TeamManagerButtons` et des entités `ClanTeam` / `ClanTeamMember` de
 * l'ancien bot. Un clan a deux équipes (`type` 0 = principale, 1 = secondaire),
 * créées à la validation du clan ; chacune compte 3 à 5 joueurs dont un
 * capitaine, jusqu'à 2 remplaçants et un coach.
 *
 * ── LES TABLES ─────────────────────────────────────────────────────────────
 * Tables MikroORM historiques, hors du schéma Kysely typé (DDL de
 * `legacy/achillea-bot/database/migrations/Migration20251108123648.ts`) :
 *
 *   clan_team(id, created_at, updated_at, clan_id, name, type, captain_id)
 *   clan_team_member(id, created_at, updated_at, team_id, member_clan_id,
 *                    member_user_id, role, added_by_id)
 *
 * `clan_team_member` est UNIQUE sur (member_clan_id, member_user_id) : un membre
 * n'occupe qu'une place, toutes équipes et tous rôles confondus. L'ancien texte
 * d'aide promettait qu'un coach pouvait encadrer deux équipes ; la contrainte
 * l'a toujours interdit, et c'est elle qui fait foi — on le dit au joueur avant
 * d'écrire au lieu de laisser la base lever.
 *
 * ── QUI A LE DROIT ─────────────────────────────────────────────────────────
 * Lecture publique (le site affiche les équipes d'un clan). Écriture : membre
 * du clan au rang de Vice-Président ou plus (garde `ClanRole(SubCaptain)` du
 * legacy), ou administrateur Achilléa (`user.role >= 2`).
 */
import { Elysia, status, t } from "elysia";
import { sql, type Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";

import { dbPlugin } from "../../../plugins/db";
import { resolveAchilleaSession } from "../../auth/session";

// ─── Règles pures ────────────────────────────────────────────────────────────

export const TYPE_EQUIPE = { principale: 0, secondaire: 1 } as const;
export type TypeEquipe = 0 | 1;

/** Rôle dans une équipe (enum legacy `TeamMemberRole`). */
export const ROLE_EQUIPE = { joueur: 0, remplacant: 1, coach: 2 } as const;
export type RoleEquipe = 0 | 1 | 2;

export const LIMITE_PAR_ROLE: Readonly<Record<RoleEquipe, number>> = Object.freeze({ 0: 5, 1: 2, 2: 1 });
export const LIBELLE_ROLE_PLURIEL: Readonly<Record<RoleEquipe, string>> = Object.freeze({
  0: "joueurs",
  1: "remplaçants",
  2: "coachs",
});
export const NOM_EQUIPE_DEFAUT: Readonly<Record<TypeEquipe, string>> = Object.freeze({
  0: "Equipe principale",
  1: "Equipe secondaire",
});

/** Rang de clan minimal pour gérer les équipes (Vice-Président). */
export const RANG_GESTION = 2;
/** Rôle Achilléa minimal pour passer outre (administrateur). */
export const ROLE_ADMIN = 2;

export interface LienEquipe {
  linkId: number;
  userId: string;
  displayName: string;
  avatar: string | null;
  role: RoleEquipe;
}

export interface EquipeClan {
  id: number;
  clanId: number;
  name: string;
  type: TypeEquipe;
  captainUserId: string | null;
  updatedAt: Date;
  members: LienEquipe[];
  valid: boolean;
  errors: string[];
}

export function estRoleEquipe(valeur: unknown): valeur is RoleEquipe {
  return valeur === 0 || valeur === 1 || valeur === 2;
}

export function estTypeEquipe(valeur: unknown): valeur is TypeEquipe {
  return valeur === 0 || valeur === 1;
}

/** Erreurs de validité d'une équipe (legacy `ClanTeam.getValidityErrors`). */
export function erreursValidite(liens: ReadonlyArray<{ role: RoleEquipe }>): string[] {
  const compte = (role: RoleEquipe) => liens.filter(l => l.role === role).length;
  const erreurs: string[] = [];
  if (compte(0) < 3) erreurs.push("Il faut au moins 3 joueurs.");
  if (compte(1) > 2) erreurs.push("Pas plus de 2 remplaçants.");
  if (compte(2) > 1) erreurs.push("Pas plus d'un coach.");
  return erreurs;
}

/** Nom d'équipe accepté : 3 à 30 caractères une fois rogné. */
export function nomEquipeValide(nom: string): boolean {
  const n = nom.trim();
  return n.length >= 3 && n.length <= 30;
}

export type PlanEffectif =
  | { ok: true; retirer: number[]; ajouter: string[] }
  | { ok: false; statut: 400 | 409; message: string };

/**
 * Plan de remplacement de l'effectif d'UN rôle.
 *
 * - `demandes` : identifiants saisis (doublons et vides ignorés) ;
 * - `membresDuClan` : identifiants des membres du clan ;
 * - `liensDuRole` : liens actuels de ce rôle dans cette équipe ;
 * - `occupes` : TOUS les liens des membres du clan (autres équipes, autres rôles).
 */
export function planifierEffectif(input: {
  role: RoleEquipe;
  equipeId: number;
  demandes: readonly string[];
  membresDuClan: ReadonlySet<string>;
  liensDuRole: ReadonlyArray<{ linkId: number; userId: string }>;
  occupes: ReadonlyArray<{ userId: string; teamId: number; teamName: string; role: RoleEquipe }>;
}): PlanEffectif {
  const voulus = [...new Set(input.demandes.map(id => id.trim()).filter(id => id !== ""))];
  const invalides = voulus.filter(id => !input.membresDuClan.has(id));
  if (invalides.length > 0)
    return { ok: false, statut: 400, message: `Ces identifiants ne sont pas membres du clan : ${invalides.join(", ")}` };
  const limite = LIMITE_PAR_ROLE[input.role];
  if (voulus.length > limite)
    return { ok: false, statut: 400, message: `Trop de ${LIBELLE_ROLE_PLURIEL[input.role]} (limite ${limite}).` };

  const actuels = new Set(input.liensDuRole.map(l => l.userId));
  const ajouter = voulus.filter(id => !actuels.has(id));
  for (const id of ajouter) {
    const place = input.occupes.find(o => o.userId === id);
    if (place) {
      const ou = place.teamId === input.equipeId ? "cette équipe" : `l'équipe « ${place.teamName} »`;
      return {
        ok: false,
        statut: 409,
        message: `<@${id}> occupe déjà une place dans ${ou} (${LIBELLE_ROLE_PLURIEL[place.role]}). Un membre n'a qu'une place, toutes équipes confondues.`,
      };
    }
  }
  const garder = new Set(voulus);
  const retirer = input.liensDuRole.filter(l => !garder.has(l.userId)).map(l => l.linkId);
  return { ok: true, retirer, ajouter };
}

/**
 * Capitaine après une modification des joueurs (legacy `updateTeamLinksForRole`) :
 * conservé s'il reste joueur, sinon le premier joueur restant, sinon le premier ajouté.
 */
export function capitaineApres(input: {
  capitaineActuel: number | null;
  joueursRestants: readonly number[];
  joueursAjoutes: readonly number[];
}): number | null {
  if (input.capitaineActuel !== null && input.joueursRestants.includes(input.capitaineActuel)) return input.capitaineActuel;
  return input.joueursRestants[0] ?? input.joueursAjoutes[0] ?? null;
}

// ─── Accès base ──────────────────────────────────────────────────────────────

type Db = Kysely<Database>;

interface LigneEquipe {
  id: number;
  clan_id: number;
  name: string;
  type: number;
  captain_id: number | null;
  updated_at: Date;
}
interface LigneLien {
  id: number;
  team_id: number;
  member_user_id: string;
  role: number;
  display_name: string | null;
  username: string | null;
  avatar: string | null;
}

function versEquipe(ligne: LigneEquipe, liens: readonly LigneLien[]): EquipeClan {
  const membres: LienEquipe[] = liens
    .filter(l => Number(l.team_id) === Number(ligne.id))
    .map(l => ({
      linkId: Number(l.id),
      userId: l.member_user_id,
      displayName: l.display_name || l.username || l.member_user_id,
      avatar: l.avatar ?? null,
      role: (estRoleEquipe(Number(l.role)) ? Number(l.role) : 0) as RoleEquipe,
    }));
  const capitaine = ligne.captain_id === null ? null : membres.find(m => m.linkId === Number(ligne.captain_id));
  const erreurs = erreursValidite(membres);
  return {
    id: Number(ligne.id),
    clanId: Number(ligne.clan_id),
    name: ligne.name,
    type: (Number(ligne.type) === 1 ? 1 : 0) as TypeEquipe,
    captainUserId: capitaine?.userId ?? null,
    updatedAt: new Date(ligne.updated_at),
    members: membres,
    valid: erreurs.length === 0,
    errors: erreurs,
  };
}

async function liensDesEquipes(db: Db, equipes: readonly number[]): Promise<LigneLien[]> {
  if (equipes.length === 0) return [];
  const resultat = await sql<LigneLien>`
    select ctm.id, ctm.team_id, ctm.member_user_id, ctm.role, u.display_name, u.username, u.avatar
    from clan_team_member ctm
    left join "user" u on u.id = ctm.member_user_id
    where ctm.team_id in (${sql.join(equipes)})
    order by ctm.id asc
  `.execute(db);
  return resultat.rows;
}

export async function equipesDuClan(db: Db, clanId: number): Promise<EquipeClan[]> {
  const equipes = await sql<LigneEquipe>`
    select id, clan_id, name, type, captain_id, updated_at from clan_team where clan_id = ${clanId} order by type asc, id asc
  `.execute(db);
  const liens = await liensDesEquipes(
    db,
    equipes.rows.map(e => Number(e.id)),
  );
  return equipes.rows.map(e => versEquipe(e, liens));
}

export async function equipeParId(db: Db, equipeId: number): Promise<EquipeClan | null> {
  const resultat = await sql<LigneEquipe>`
    select id, clan_id, name, type, captain_id, updated_at from clan_team where id = ${equipeId}
  `.execute(db);
  const ligne = resultat.rows[0];
  if (!ligne) return null;
  return versEquipe(ligne, await liensDesEquipes(db, [Number(ligne.id)]));
}

/** Clan actif du joueur et son rang dans ce clan. */
export async function appartenance(db: Db, userId: string) {
  return db
    .selectFrom("clan_member as cm")
    .innerJoin("clan as c", "c.id", "cm.clan_id")
    .select(["c.id", "c.name", "c.shortened_name", "c.clan_avatar_url", "cm.role"])
    .where("cm.user_id", "=", userId)
    .where("c.is_disbanded", "=", false)
    .executeTakeFirst();
}

type Refus = { ok: false; statut: 403 | 404; message: string };

/** Le joueur peut-il gérer les équipes de ce clan ? */
export async function verifierGestion(db: Db, userId: string, clanId: number): Promise<{ ok: true } | Refus> {
  const [utilisateur, membre] = await Promise.all([
    db.selectFrom("user").select("role").where("id", "=", userId).executeTakeFirst(),
    db
      .selectFrom("clan_member")
      .select("role")
      .where("user_id", "=", userId)
      .where("clan_id", "=", clanId)
      .executeTakeFirst(),
  ]);
  if (Number(utilisateur?.role ?? 0) >= ROLE_ADMIN) return { ok: true };
  if (!membre) return { ok: false, statut: 403, message: "Tu n'es pas membre de ce clan." };
  if (Number(membre.role) < RANG_GESTION)
    return { ok: false, statut: 403, message: "Gérer les équipes est réservé au Président et aux Vice-Présidents." };
  return { ok: true };
}

// ─── Contrôleur ──────────────────────────────────────────────────────────────

const message = t.Object({ message: t.String() });
const lienModel = t.Object({
  linkId: t.Number(),
  userId: t.String(),
  displayName: t.String(),
  avatar: t.Nullable(t.String()),
  role: t.Number(),
});
const equipeModel = t.Object({
  id: t.Number(),
  clanId: t.Number(),
  name: t.String(),
  type: t.Number(),
  captainUserId: t.Nullable(t.String()),
  updatedAt: t.Date(),
  members: t.Array(lienModel),
  valid: t.Boolean(),
  errors: t.Array(t.String()),
});
const erreurs = { 400: message, 401: message, 403: message, 404: message, 409: message };
const nonAuthentifie = { message: "Authentication required" };

export const clanTeamsController = new Elysia({ prefix: "/clans/teams" })
  .use(dbPlugin)
  .get(
    "/membership",
    async ({ db, headers }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      const ligne = await appartenance(db, session.id);
      return ligne
        ? {
            clanId: Number(ligne.id),
            clanRole: Number(ligne.role),
            clan: {
              id: Number(ligne.id),
              name: ligne.name,
              shortenedName: ligne.shortened_name,
              avatarUrl: ligne.clan_avatar_url,
            },
          }
        : { clanId: null, clanRole: null, clan: null };
    },
    {
      response: {
        200: t.Object({
          clanId: t.Nullable(t.Number()),
          clanRole: t.Nullable(t.Number()),
          clan: t.Nullable(
            t.Object({ id: t.Number(), name: t.String(), shortenedName: t.String(), avatarUrl: t.String() }),
          ),
        }),
        401: message,
      },
    },
  )
  .get("/clan/:clanId", async ({ db, params }) => equipesDuClan(db, params.clanId), {
    params: t.Object({ clanId: t.Numeric() }),
    response: { 200: t.Array(equipeModel) },
  })
  .post(
    "/",
    async ({ db, headers, body, set }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      if (!estTypeEquipe(body.type)) return status(400, { message: "Type d'équipe invalide (0 ou 1)." });
      const nom = (body.name ?? NOM_EQUIPE_DEFAUT[body.type]).trim();
      if (!nomEquipeValide(nom)) return status(400, { message: "Le nom de l'équipe doit contenir entre 3 et 30 caractères." });
      const clan = await db
        .selectFrom("clan")
        .select(["id", "is_disbanded"])
        .where("id", "=", body.clanId)
        .executeTakeFirst();
      if (!clan || clan.is_disbanded) return status(404, { message: "Clan introuvable." });
      const droit = await verifierGestion(db, session.id, body.clanId);
      if (!droit.ok) return status(droit.statut, { message: droit.message });
      const existant = await sql<{ id: number }>`
        select id from clan_team where clan_id = ${body.clanId} and type = ${body.type}
      `.execute(db);
      if (existant.rows.length > 0) return status(409, { message: "Cette équipe existe déjà pour ce clan." });
      const maintenant = new Date();
      const cree = await sql<{ id: number }>`
        insert into clan_team (created_at, updated_at, clan_id, name, type, captain_id)
        values (${maintenant}, ${maintenant}, ${body.clanId}, ${nom}, ${body.type}, null)
        returning id
      `.execute(db);
      set.status = 201;
      const equipe = await equipeParId(db, Number(cree.rows[0]!.id));
      return equipe!;
    },
    {
      body: t.Object({ clanId: t.Number(), type: t.Number(), name: t.Optional(t.String()) }),
      response: { 201: equipeModel, ...erreurs },
    },
  )
  .get(
    "/:teamId",
    async ({ db, params }) => {
      const equipe = await equipeParId(db, params.teamId);
      return equipe ?? status(404, { message: "Équipe introuvable." });
    },
    { params: t.Object({ teamId: t.Numeric() }), response: { 200: equipeModel, 404: message } },
  )
  .put(
    "/:teamId/roster",
    async ({ db, headers, params, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      if (!estRoleEquipe(body.role)) return status(400, { message: "Rôle d'équipe invalide (0, 1 ou 2)." });
      const role = body.role;
      const equipe = await equipeParId(db, params.teamId);
      if (!equipe) return status(404, { message: "Équipe introuvable." });
      const droit = await verifierGestion(db, session.id, equipe.clanId);
      if (!droit.ok) return status(droit.statut, { message: droit.message });

      const [membres, toutes] = await Promise.all([
        db.selectFrom("clan_member").select("user_id").where("clan_id", "=", equipe.clanId).execute(),
        equipesDuClan(db, equipe.clanId),
      ]);
      const liensDuRole = equipe.members.filter(m => m.role === role);
      const occupes = toutes.flatMap(e =>
        e.members
          .filter(m => !(e.id === equipe.id && m.role === role))
          .map(m => ({ userId: m.userId, teamId: e.id, teamName: e.name, role: m.role })),
      );
      const plan = planifierEffectif({
        role,
        equipeId: equipe.id,
        demandes: body.userIds,
        membresDuClan: new Set(membres.map(m => m.user_id)),
        liensDuRole,
        occupes,
      });
      if (!plan.ok) return status(plan.statut, { message: plan.message });

      try {
        await db.transaction().execute(async trx => {
          const maintenant = new Date();
          if (plan.retirer.length > 0)
            await sql`delete from clan_team_member where id in (${sql.join(plan.retirer)})`.execute(trx);
          const ajoutes: number[] = [];
          for (const userId of plan.ajouter) {
            const insere = await sql<{ id: number }>`
              insert into clan_team_member
                (created_at, updated_at, team_id, member_clan_id, member_user_id, role, added_by_id)
              values (${maintenant}, ${maintenant}, ${equipe.id}, ${equipe.clanId}, ${userId}, ${role}, ${session.id})
              returning id
            `.execute(trx);
            ajoutes.push(Number(insere.rows[0]!.id));
          }
          let capitaine = equipe.members.find(m => m.userId === equipe.captainUserId)?.linkId ?? null;
          if (role === ROLE_EQUIPE.joueur) {
            const restants = liensDuRole.filter(l => !plan.retirer.includes(l.linkId)).map(l => l.linkId);
            capitaine = capitaineApres({ capitaineActuel: capitaine, joueursRestants: restants, joueursAjoutes: ajoutes });
          }
          await sql`update clan_team set captain_id = ${capitaine}, updated_at = ${maintenant} where id = ${equipe.id}`.execute(
            trx,
          );
        });
      } catch (err) {
        // Course perdue contre une autre écriture : la contrainte d'unicité a tranché.
        console.warn("[clans/teams] effectif refusé par la base :", err instanceof Error ? err.message : err);
        return status(409, { message: "Impossible de mettre à jour l'équipe : ce joueur est déjà utilisé." });
      }
      return (await equipeParId(db, equipe.id))!;
    },
    {
      params: t.Object({ teamId: t.Numeric() }),
      body: t.Object({ role: t.Number(), userIds: t.Array(t.String(), { maxItems: 10 }) }),
      response: { 200: equipeModel, ...erreurs },
    },
  )
  .patch(
    "/:teamId",
    async ({ db, headers, params, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      const equipe = await equipeParId(db, params.teamId);
      if (!equipe) return status(404, { message: "Équipe introuvable." });
      const droit = await verifierGestion(db, session.id, equipe.clanId);
      if (!droit.ok) return status(droit.statut, { message: droit.message });

      let nom = equipe.name;
      if (body.name !== undefined) {
        if (!nomEquipeValide(body.name))
          return status(400, { message: "Le nom de l'équipe doit contenir entre 3 et 30 caractères." });
        nom = body.name.trim();
      }
      let capitaine = equipe.members.find(m => m.userId === equipe.captainUserId)?.linkId ?? null;
      if (body.captainUserId !== undefined && body.captainUserId !== null) {
        const lien = equipe.members.find(m => m.role === ROLE_EQUIPE.joueur && m.userId === body.captainUserId);
        if (!lien) return status(400, { message: "Le capitaine choisi n'est pas un joueur de cette équipe." });
        capitaine = lien.linkId;
      }
      if (nom === equipe.name && (capitaine ?? null) === (equipe.members.find(m => m.userId === equipe.captainUserId)?.linkId ?? null))
        return equipe;
      await sql`update clan_team set name = ${nom}, captain_id = ${capitaine}, updated_at = ${new Date()} where id = ${equipe.id}`.execute(
        db,
      );
      return (await equipeParId(db, equipe.id))!;
    },
    {
      params: t.Object({ teamId: t.Numeric() }),
      body: t.Object({ name: t.Optional(t.String()), captainUserId: t.Optional(t.Nullable(t.String())) }),
      response: { 200: equipeModel, ...erreurs },
    },
  )
  .delete(
    "/:teamId",
    async ({ db, headers, params }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      const equipe = await equipeParId(db, params.teamId);
      if (!equipe) return status(404, { message: "Équipe introuvable." });
      const droit = await verifierGestion(db, session.id, equipe.clanId);
      if (!droit.ok) return status(droit.statut, { message: droit.message });
      // `clan_team_member.team_id` est en ON DELETE CASCADE : l'effectif part avec l'équipe.
      await sql`delete from clan_team where id = ${equipe.id}`.execute(db);
      return { success: true as const };
    },
    {
      params: t.Object({ teamId: t.Numeric() }),
      response: { 200: t.Object({ success: t.Literal(true) }), ...erreurs },
    },
  );
