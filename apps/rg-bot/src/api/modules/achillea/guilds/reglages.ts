/**
 * `/guilds/:id/settings` et `/guilds/:id/clan` — réglages du bot Achilléa sur un serveur.
 *
 * Porte `GuildSettingsCommand` et `GuildButtons` de l'ancien bot : salon des
 * annonces de clan (`guild.broadcast_channel`), annonces de la file classée
 * (`guild.ranked_enabled`) et clan lié au serveur (`clan.guild_id`).
 *
 * ── QUI A LE DROIT ─────────────────────────────────────────────────────────
 * L'ancien bot vérifiait la permission Discord « Administrateur » dans son
 * propre processus. L'API, elle, reçoit des appels du site, de la CLI et du
 * bot : elle ne peut pas croire sur parole un appelant qui se dit
 * administrateur du serveur. Elle VÉRIFIE donc elle-même, par l'API REST
 * Discord et le jeton de l'application Achilléa :
 *
 *   - le propriétaire du serveur, ou un membre dont un rôle (ou `@everyone`)
 *     porte `ADMINISTRATOR` ou `MANAGE_GUILD`, administre le serveur ;
 *   - un administrateur Achilléa (`user.role >= 2`) passe outre, pour le support.
 *
 * Discord injoignable ou jeton absent : 503 avec la raison, jamais un accès
 * accordé par défaut.
 *
 * Lier un clan exige EN PLUS d'en être Président ou Vice-Président : un simple
 * membre administrateur d'un serveur ne doit pas pouvoir y attacher le clan.
 */
import { Elysia, status, t } from "elysia";
import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";

import { dbPlugin } from "../../../plugins/db";
import { resolveAchilleaSession } from "../../auth/session";
import { restAchillea, type ResultatRest } from "../clans/discord";

/** Bits de permission Discord utiles ici. */
export const PERMISSION_ADMINISTRATEUR = 0x8n;
export const PERMISSION_GERER_SERVEUR = 0x20n;

/** Types de salon acceptés pour les annonces : texte (0) et annonces (5). */
export const TYPES_SALON_ANNONCE: readonly number[] = [0, 5];

/** Rôle Achilléa minimal pour passer outre la permission Discord. */
export const ROLE_ADMIN_ACHILLEA = 2;
/** Rôle de clan minimal pour lier son clan à un serveur (Vice-Président). */
export const ROLE_CLAN_LIAISON = 2;
/** État d'un clan validé (`ClanState.Approved`). */
export const ETAT_CLAN_APPROUVE = 2;

export interface ReglagesGuilde {
  guildId: string;
  broadcastChannel: string | null;
  rankedEnabled: boolean;
  clan: { id: number; name: string; shortName: string } | null;
}

export interface GuildeDiscord {
  owner_id: string;
  roles: Array<{ id: string; permissions: string }>;
}
export interface MembreDiscord {
  roles: string[];
}

/**
 * Le membre administre-t-il le serveur ? Pur : testé sans réseau.
 * `@everyone` a l'identifiant du serveur et s'applique à tous.
 */
export function administreServeur(guildId: string, userId: string, guilde: GuildeDiscord, membre: MembreDiscord): boolean {
  if (guilde.owner_id === userId) return true;
  const roles = new Set([guildId, ...membre.roles]);
  let permissions = 0n;
  for (const role of guilde.roles) {
    if (!roles.has(role.id)) continue;
    try {
      permissions |= BigInt(role.permissions);
    } catch {
      // Permission illisible : ignorée, jamais accordée.
    }
  }
  return (permissions & (PERMISSION_ADMINISTRATEUR | PERMISSION_GERER_SERVEUR)) !== 0n;
}

/** Accès Discord injectable (tests). */
export interface PorteDiscord {
  rest<T>(methode: "GET", chemin: string): Promise<ResultatRest<T>>;
}
export const discordParDefaut: PorteDiscord = { rest: (methode, chemin) => restAchillea(methode, chemin) };

/** Accès base injectable (tests). */
export interface DepotReglages {
  roleUtilisateur(userId: string): Promise<number>;
  lireGuilde(guildId: string): Promise<{ broadcastChannel: string | null; rankedEnabled: boolean } | null>;
  clanLie(guildId: string): Promise<{ id: number; name: string; shortName: string } | null>;
  ecrireGuilde(guildId: string, patch: { broadcastChannel?: string | null; rankedEnabled?: boolean }): Promise<void>;
  /** Clan du joueur (actif), avec son rôle dans le clan. */
  clanDuJoueur(userId: string): Promise<{ id: number; name: string; shortName: string; state: number; guildId: string | null; role: number } | null>;
  lierClan(clanId: number, guildId: string | null): Promise<void>;
  delierServeur(guildId: string): Promise<void>;
}

export function depotKysely(db: Kysely<Database>): DepotReglages {
  return {
    async roleUtilisateur(userId) {
      const ligne = await db.selectFrom("user").select("role").where("id", "=", userId).executeTakeFirst();
      return ligne?.role ?? 0;
    },
    async lireGuilde(guildId) {
      const ligne = await db
        .selectFrom("guild")
        .select(["broadcast_channel", "ranked_enabled"])
        .where("id", "=", guildId)
        .where("deleted", "=", false)
        .executeTakeFirst();
      return ligne ? { broadcastChannel: ligne.broadcast_channel, rankedEnabled: ligne.ranked_enabled } : null;
    },
    async clanLie(guildId) {
      const ligne = await db
        .selectFrom("clan")
        .select(["id", "name", "shortened_name"])
        .where("guild_id", "=", guildId)
        .where("is_disbanded", "=", false)
        .executeTakeFirst();
      return ligne ? { id: ligne.id, name: ligne.name, shortName: ligne.shortened_name } : null;
    },
    async ecrireGuilde(guildId, patch) {
      const valeurs: { broadcast_channel?: string | null; ranked_enabled?: boolean; updated_at: Date } = {
        updated_at: new Date(),
      };
      if (patch.broadcastChannel !== undefined) valeurs.broadcast_channel = patch.broadcastChannel;
      if (patch.rankedEnabled !== undefined) valeurs.ranked_enabled = patch.rankedEnabled;
      await db.updateTable("guild").set(valeurs).where("id", "=", guildId).execute();
    },
    async clanDuJoueur(userId) {
      const ligne = await db
        .selectFrom("clan_member as cm")
        .innerJoin("clan as c", "c.id", "cm.clan_id")
        .select(["c.id", "c.name", "c.shortened_name", "c.state", "c.guild_id", "cm.role"])
        .where("cm.user_id", "=", userId)
        .where("c.is_disbanded", "=", false)
        .executeTakeFirst();
      return ligne
        ? { id: ligne.id, name: ligne.name, shortName: ligne.shortened_name, state: ligne.state, guildId: ligne.guild_id, role: ligne.role }
        : null;
    },
    async lierClan(clanId, guildId) {
      await db.updateTable("clan").set({ guild_id: guildId, updated_at: new Date() }).where("id", "=", clanId).execute();
    },
    async delierServeur(guildId) {
      await db.updateTable("clan").set({ guild_id: null, updated_at: new Date() }).where("guild_id", "=", guildId).execute();
    },
  };
}

export type Echec = { ok: false; statut: 403 | 404 | 409 | 400 | 503; message: string };
export type Issue<T> = { ok: true; valeur: T } | Echec;

const refus = (statut: Echec["statut"], message: string): Echec => ({ ok: false, statut, message });

/** Vérifie que `userId` administre `guildId` (Discord) ou est administrateur Achilléa. */
export async function verifierAdministration(
  depot: DepotReglages,
  discord: PorteDiscord,
  guildId: string,
  userId: string,
): Promise<Issue<true>> {
  if ((await depot.roleUtilisateur(userId)) >= ROLE_ADMIN_ACHILLEA) return { ok: true, valeur: true };
  const [guilde, membre] = await Promise.all([
    discord.rest<GuildeDiscord>("GET", `/guilds/${guildId}`),
    discord.rest<MembreDiscord>("GET", `/guilds/${guildId}/members/${userId}`),
  ]);
  if (!guilde.ok) {
    if (guilde.statut === 403 || guilde.statut === 404)
      return refus(404, "Le bot Achilléa n'est pas présent sur ce serveur.");
    return refus(503, `Discord injoignable pour vérifier tes permissions : ${guilde.motif}`);
  }
  if (!membre.ok) {
    if (membre.statut === 404) return refus(403, "Tu n'es pas membre de ce serveur.");
    return refus(503, `Discord injoignable pour vérifier tes permissions : ${membre.motif}`);
  }
  return administreServeur(guildId, userId, guilde.data, membre.data)
    ? { ok: true, valeur: true }
    : refus(403, "Tu dois être administrateur du serveur (Administrateur ou Gérer le serveur) pour modifier ces réglages.");
}

export async function lireReglages(depot: DepotReglages, guildId: string): Promise<Issue<ReglagesGuilde>> {
  const guilde = await depot.lireGuilde(guildId);
  if (!guilde) return refus(404, "Le bot Achilléa n'a pas encore relevé ce serveur. Réessaie après le prochain relevé des guildes.");
  return { ok: true, valeur: { guildId, ...guilde, clan: await depot.clanLie(guildId) } };
}

/**
 * Modifie les réglages. Retirer le salon d'annonce coupe aussi le lien avec le
 * clan (comportement legacy : un clan lié sans salon n'a nulle part où annoncer).
 */
export async function modifierReglages(
  depot: DepotReglages,
  discord: PorteDiscord,
  guildId: string,
  patch: { broadcastChannel?: string | null; rankedEnabled?: boolean },
): Promise<Issue<ReglagesGuilde>> {
  const actuel = await lireReglages(depot, guildId);
  if (!actuel.ok) return actuel;
  if (patch.broadcastChannel) {
    const salon = await discord.rest<{ guild_id?: string; type: number }>("GET", `/channels/${patch.broadcastChannel}`);
    if (!salon.ok) {
      if (salon.statut === 404 || salon.statut === 403)
        return refus(400, `Le salon <#${patch.broadcastChannel}> est introuvable ou inaccessible au bot.`);
      return refus(503, `Discord injoignable pour vérifier le salon : ${salon.motif}`);
    }
    if (salon.data.guild_id !== guildId) return refus(400, "Ce salon n'appartient pas à ce serveur.");
    if (!TYPES_SALON_ANNONCE.includes(salon.data.type))
      return refus(400, "Le salon choisi n'est pas un salon texte ou d'annonce.");
  }
  await depot.ecrireGuilde(guildId, patch);
  if (patch.broadcastChannel === null) await depot.delierServeur(guildId);
  return lireReglages(depot, guildId);
}

/** Lie le clan de l'appelant au serveur. */
export async function lierClanAuServeur(depot: DepotReglages, guildId: string, userId: string): Promise<Issue<ReglagesGuilde>> {
  const actuel = await lireReglages(depot, guildId);
  if (!actuel.ok) return actuel;
  if (actuel.valeur.clan) return refus(409, `Un Clan est déjà lié à ce serveur (${actuel.valeur.clan.name}).`);
  if (!actuel.valeur.broadcastChannel)
    return refus(409, "Ce serveur n'a pas paramétré de salon d'annonces pour le Clan : choisis-le d'abord.");
  const clan = await depot.clanDuJoueur(userId);
  if (!clan) return refus(403, "Tu ne fais partie d'aucun Clan.");
  if (clan.state < ETAT_CLAN_APPROUVE) return refus(403, "Ton Clan n'est pas encore approuvé par les Administrateurs.");
  if (clan.role < ROLE_CLAN_LIAISON) return refus(403, "Seuls le Président et les Vice-Présidents peuvent lier le Clan à un serveur.");
  if (clan.guildId && clan.guildId !== guildId)
    return refus(409, "Ton Clan est déjà lié à un autre serveur : dissocie-le d'abord.");
  await depot.lierClan(clan.id, guildId);
  return lireReglages(depot, guildId);
}

/** Dissocie le clan lié au serveur, quel qu'il soit. */
export async function delierClanDuServeur(depot: DepotReglages, guildId: string): Promise<Issue<ReglagesGuilde>> {
  const actuel = await lireReglages(depot, guildId);
  if (!actuel.ok) return actuel;
  if (!actuel.valeur.clan) return refus(409, "Aucun Clan n'est lié à ce serveur.");
  await depot.delierServeur(guildId);
  return lireReglages(depot, guildId);
}

const parametres = t.Object({ id: t.String({ pattern: "^\\d{15,25}$" }) });

/** Exécute une opération protégée : session, droits sur le serveur, puis l'action. */
async function proteger(
  db: Kysely<Database>,
  headers: { authorization?: string; cookie?: string },
  guildId: string,
  action: (depot: DepotReglages, userId: string) => Promise<Issue<ReglagesGuilde>>,
) {
  const session = await resolveAchilleaSession(headers);
  if (!session) return status(401, { message: "Authentication required" });
  const depot = depotKysely(db);
  const droit = await verifierAdministration(depot, discordParDefaut, guildId, session.id);
  if (!droit.ok) return status(droit.statut, { message: droit.message });
  const issue = await action(depot, session.id);
  return issue.ok ? issue.valeur : status(issue.statut, { message: issue.message });
}

export const guildSettingsController = new Elysia({ prefix: "/guilds" })
  .use(dbPlugin)
  .get(
    "/:id/settings",
    ({ db, headers, params }) => proteger(db, headers, params.id, depot => lireReglages(depot, params.id)),
    { params: parametres },
  )
  .patch(
    "/:id/settings",
    ({ db, headers, params, body }) =>
      proteger(db, headers, params.id, depot => modifierReglages(depot, discordParDefaut, params.id, body)),
    {
      params: parametres,
      body: t.Object({
        broadcastChannel: t.Optional(t.Nullable(t.String({ pattern: "^\\d{15,25}$" }))),
        rankedEnabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .post(
    "/:id/clan",
    ({ db, headers, params }) => proteger(db, headers, params.id, (depot, userId) => lierClanAuServeur(depot, params.id, userId)),
    { params: parametres },
  )
  .delete(
    "/:id/clan",
    ({ db, headers, params }) => proteger(db, headers, params.id, depot => delierClanDuServeur(depot, params.id)),
    { params: parametres },
  );
