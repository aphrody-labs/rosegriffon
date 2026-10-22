/**
 * Exploitation Achilléa : `/admin/ops/*` (back-office, session staff) et `/bot/*`
 * (API développeur, secret `API_ADMIN_TOKEN`), portés de l'ancien bot.
 *
 * L'ancien bot répondait depuis son propre processus Discord. Ici, l'état vivant
 * (guildes rejointes, commandes chargées, latence, journal) vient du serveur
 * d'administration en boucle locale du profil `achillea` (`lib/achillea-discord.ts`),
 * et tout ce qui est en base (maintenance, audit, compteurs) est lu directement.
 * Un bot injoignable rend 503 avec la raison : jamais des zéros inventés.
 */
import { loadavg, cpus, totalmem, freemem, hostname, uptime as uptimeHote } from "node:os";
import { Elysia, status, t } from "elysia";
import { sql, type Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { verifyAdminBearerToken } from "@rosegriffon/achillea-core";
import type { CommandeBot, EtatBot, GuildeBot } from "@rosegriffon/types/bot";

import { dbPlugin } from "../../plugins/db";
import { appelerBotAchillea, BotAchilleaInjoignable } from "../../../lib/achillea-discord";
import { journaliserAudit } from "./audit";
import { ROLE_STAFF, staff, type EnTetesAuth } from "./staff";

/** Rôles de `achillea."user".role`, noms courts pour ce module. */
const ROLE = {
  moderateur: ROLE_STAFF.Moderateur,
  administrateur: ROLE_STAFF.Administrateur,
  superAdministrateur: ROLE_STAFF.SuperAdministrateur,
} as const;

/** Garde staff partagée (`staff.ts`) : 401 sans session, 403 sous le rôle requis. */
async function exigerStaff(db: Kysely<Database>, headers: EnTetesAuth, minimum: number) {
  const garde = await staff(db, headers, minimum);
  return "error" in garde && garde.error ? { erreur: garde.error } : { acteur: garde.actor! };
}

/** Traduit l'échec d'un appel au bot en statut HTTP explicite. */
function echecBot(err: unknown) {
  if (err instanceof BotAchilleaInjoignable) {
    if (err.statut === 404) return status(404, { message: err.message });
    if (err.statut === 409) return status(409, { message: err.message });
    return status(503, { message: `Bot Discord Achilléa indisponible : ${err.message}` });
  }
  throw err;
}

/** Mode maintenance, stocké comme le legacy dans `achillea.data` (clé `maintenance`, JSON). */
export async function lireMaintenance(db: Kysely<Database>): Promise<boolean> {
  const ligne = await sql<{ value: string }>`SELECT value FROM achillea.data WHERE key = 'maintenance'`.execute(db);
  const brut = ligne.rows[0]?.value;
  if (brut === undefined) return false;
  try {
    return JSON.parse(brut) === true;
  } catch {
    return brut === "true";
  }
}

async function ecrireMaintenance(db: Kysely<Database>, valeur: boolean): Promise<void> {
  await sql`
    INSERT INTO achillea.data (key, value, created_at, updated_at)
    VALUES ('maintenance', ${JSON.stringify(valeur)}, now(), now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`.execute(db);
}

/** Mesures de l'hôte et du processus API, au format lu par l'onglet « Santé ». */
export function mesuresHote() {
  const [charge1, charge5, charge15] = loadavg();
  const memoire = process.memoryUsage();
  return {
    host: {
      hostname: hostname(),
      cpus: cpus().length,
      loadAverage: { "1m": charge1, "5m": charge5, "15m": charge15 },
      memory: { total: totalmem(), free: freemem(), used: totalmem() - freemem() },
      uptime: Math.round(uptimeHote()),
    },
    pid: {
      pid: process.pid,
      rss: memoire.rss,
      heapUsed: memoire.heapUsed,
      heapTotal: memoire.heapTotal,
      uptime: Math.round(process.uptime()),
      bun: Bun.version,
    },
  };
}

/** Ligne de guilde du contrat `AdminGuildRow`. */
export function versLigneGuilde(guilde: GuildeBot) {
  return {
    id: guilde.id,
    name: guilde.nom,
    iconURL: guilde.icone,
    memberCount: guilde.membres,
    ownerId: guilde.proprietaire,
    createdAt: guilde.rejointeLe,
  };
}

/** Commande au format de l'onglet legacy (`name`, `description`, `type`). */
export function versLigneCommande(commande: CommandeBot) {
  return { name: commande.chemin, description: commande.description, type: 1 };
}

const identifiant = t.Object({ id: t.String({ pattern: "^\\d{15,25}$" }) });

export const opsController = new Elysia({ prefix: "/admin/ops" })
  .use(dbPlugin)
  .get("/health", async ({ db, headers }) => {
    const garde = await exigerStaff(db, headers, ROLE.moderateur);
    if (garde.erreur) return garde.erreur;
    const maintenance = await lireMaintenance(db);
    const { host, pid } = mesuresHote();
    try {
      const etat = await appelerBotAchillea<EtatBot>("/etat");
      return {
        bot: {
          online: true,
          // Secondes : unité lue par le back-office Next (`formaterDuree`).
          uptime: etat.uptimeSecondes,
          username: etat.etiquette,
          guilds: etat.guildes.length,
          maintenance,
        },
        host,
        pid: { ...pid, bot: { rss: etat.memoireOctets, commandes: etat.nombreCommandes } },
        latency: { ws: etat.latenceMs },
      };
    } catch (err) {
      if (!(err instanceof BotAchilleaInjoignable)) throw err;
      // Le tableau de bord doit voir le bot HORS LIGNE et pourquoi, pas une erreur de page.
      return {
        bot: { online: false, uptime: 0, username: null, guilds: 0, maintenance },
        host,
        pid: { ...pid, bot: null, erreur: err.message },
        latency: null,
      };
    }
  })
  .post(
    "/maintenance",
    async ({ db, headers, body }) => {
      const garde = await exigerStaff(db, headers, ROLE.superAdministrateur);
      if (garde.erreur) return garde.erreur;
      const maintenance = body.maintenance;
      await db.transaction().execute(async trx => {
        await ecrireMaintenance(trx, maintenance);
        await journaliserAudit(trx, {
          acteur: garde.acteur.id,
          action: "bot.maintenance",
          cibleType: "bot",
          charge: { maintenance },
        });
      });
      return { maintenance };
    },
    { body: t.Object({ maintenance: t.Boolean() }) },
  )
  .get(
    "/audit",
    async ({ db, headers, query }) => {
      const garde = await exigerStaff(db, headers, ROLE.administrateur);
      if (garde.erreur) return garde.erreur;
      const limite = Math.min(200, Math.max(1, Math.trunc(query.limit ?? 50)));
      const lignes = await sql<{
        id: string;
        ts: Date;
        actor_id: string | null;
        action: string;
        target_type: string;
        target_id: string | null;
        reason: string | null;
      }>`SELECT id, ts, actor_id, action, target_type, target_id, reason
           FROM achillea.audit_log ORDER BY ts DESC LIMIT ${limite}`.execute(db);
      return {
        data: lignes.rows.map(ligne => ({
          id: ligne.id,
          ts: new Date(ligne.ts).toISOString(),
          actorId: ligne.actor_id,
          action: ligne.action,
          targetType: ligne.target_type,
          targetId: ligne.target_id,
          reason: ligne.reason,
        })),
      };
    },
    { query: t.Object({ limit: t.Optional(t.Numeric()) }) },
  )
  .get("/metrics-summary", async ({ db, headers }) => {
    const garde = await exigerStaff(db, headers, ROLE.moderateur);
    if (garde.erreur) return garde.erreur;
    const [compteurs] = (
      await sql<Record<string, string>>`
        SELECT
          (SELECT count(*) FROM achillea."user") AS achillea_users_total,
          (SELECT count(*) FROM achillea."user" WHERE last_interact > now() - interval '1 day') AS achillea_users_active_24h,
          (SELECT count(*) FROM achillea.clan WHERE NOT is_disbanded) AS achillea_clans_total,
          (SELECT count(*) FROM achillea.event WHERE type = 'TOURNAMENT') AS achillea_tournaments_total,
          (SELECT count(*) FROM achillea.sanction WHERE revoked_at IS NULL) AS achillea_sanctions_active,
          (SELECT count(*) FROM achillea.guild WHERE NOT deleted AND name IS NOT NULL) AS achillea_guilds_scanned,
          (SELECT count(*) FROM achillea.audit_log) AS achillea_audit_entries`.execute(db)
    ).rows;
    const counters: Record<string, number> = {};
    for (const [nom, valeur] of Object.entries(compteurs ?? {})) counters[nom] = Number(valeur);
    const { pid } = mesuresHote();
    counters.api_process_rss_bytes = pid.rss;
    counters.api_process_uptime_seconds = pid.uptime;
    try {
      const etat = await appelerBotAchillea<EtatBot>("/etat");
      counters.bot_guilds = etat.guildes.length;
      counters.bot_commands = etat.nombreCommandes;
      counters.bot_ws_latency_ms = etat.latenceMs;
      counters.bot_uptime_seconds = etat.uptimeSecondes;
      counters.bot_process_rss_bytes = etat.memoireOctets;
      counters.bot_up = 1;
    } catch (err) {
      if (!(err instanceof BotAchilleaInjoignable)) throw err;
      counters.bot_up = 0;
    }
    return { counters, rawLines: Object.keys(counters).length };
  })
  .get("/guilds", async ({ db, headers }) => {
    const garde = await exigerStaff(db, headers, ROLE.moderateur);
    if (garde.erreur) return garde.erreur;
    try {
      const { guildes } = await appelerBotAchillea<{ guildes: GuildeBot[] }>("/guildes");
      return { data: guildes.map(versLigneGuilde) };
    } catch (err) {
      return echecBot(err);
    }
  })
  .get(
    "/guilds/:id/invite",
    async ({ db, headers, params }) => {
      const garde = await exigerStaff(db, headers, ROLE.administrateur);
      if (garde.erreur) return garde.erreur;
      try {
        const { url } = await appelerBotAchillea<{ url: string }>(`/guildes/${params.id}/invitation`, { method: "POST" });
        await journaliserAudit(db, {
          acteur: garde.acteur.id,
          action: "guild.invite",
          cibleType: "guild",
          cibleId: params.id,
        });
        return { url };
      } catch (err) {
        return echecBot(err);
      }
    },
    { params: identifiant },
  )
  .get("/commands", async ({ db, headers }) => {
    const garde = await exigerStaff(db, headers, ROLE.moderateur);
    if (garde.erreur) return garde.erreur;
    try {
      const { commandes } = await appelerBotAchillea<{ commandes: CommandeBot[] }>("/commandes");
      return { data: commandes.map(versLigneCommande) };
    } catch (err) {
      return echecBot(err);
    }
  })
  .get("/logs", async ({ db, headers }) => {
    const garde = await exigerStaff(db, headers, ROLE.superAdministrateur);
    if (garde.erreur) return garde.erreur;
    try {
      const { lignes } = await appelerBotAchillea<{ lignes: string[] }>("/journal");
      return { data: lignes };
    } catch (err) {
      return echecBot(err);
    }
  });

/** Garde de l'API développeur : `Authorization: Bearer <API_ADMIN_TOKEN>`. */
function exigerDev(headers: { authorization?: string }) {
  const entete = headers.authorization ?? "";
  if (!entete.startsWith("Bearer ")) return status(400, { message: "Missing token" as const });
  const jeton = entete.slice(7).trim();
  if (!verifyAdminBearerToken(jeton, process.env.API_ADMIN_TOKEN)) {
    return status(401, { message: "Unauthorized" as const });
  }
  return null;
}

/** Développeurs déclarés : `ACHILLEA_DEV_IDS` (liste séparée par des virgules) + propriétaire. */
export function developpeurs(env: Record<string, string | undefined> = process.env): string[] {
  const ids = (env.ACHILLEA_DEV_IDS ?? "")
    .split(",")
    .map(id => id.trim())
    .filter(id => /^\d{15,25}$/.test(id));
  const proprietaire = (env.ACHILLEA_BOT_OWNER_ID ?? env.BOT_OWNER_ID ?? "").trim();
  if (/^\d{15,25}$/.test(proprietaire) && !ids.includes(proprietaire)) ids.unshift(proprietaire);
  return ids;
}

export const botController = new Elysia({ prefix: "/bot" })
  .use(dbPlugin)
  .onBeforeHandle(({ headers }) => exigerDev(headers) ?? undefined)
  .get("/info", async () => {
    try {
      return await appelerBotAchillea<{ user: unknown; owner: unknown }>("/identite");
    } catch (err) {
      return echecBot(err);
    }
  })
  .get("/commands", async () => {
    try {
      return await appelerBotAchillea<unknown[]>("/commandes/brutes");
    } catch (err) {
      return echecBot(err);
    }
  })
  .get("/guilds", async ({ db }) => {
    try {
      const { guildes } = await appelerBotAchillea<{ guildes: GuildeBot[] }>("/guildes");
      const lignes = await sql<Record<string, unknown> & { id: string }>`
        SELECT * FROM achillea.guild WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(guildes.map(g => g.id))}::jsonb))`.execute(db);
      const parId = new Map(lignes.rows.map(ligne => [ligne.id, ligne]));
      return Promise.all(
        guildes.map(async guilde => ({
          discord: await appelerBotAchillea<unknown>(`/guildes/${guilde.id}/detail`),
          database: parId.get(guilde.id) ?? null,
        })),
      );
    } catch (err) {
      return echecBot(err);
    }
  })
  .get(
    "/guilds/:id",
    async ({ db, params }) => {
      try {
        const discord = await appelerBotAchillea<unknown>(`/guildes/${params.id}/detail`);
        const ligne = await sql<Record<string, unknown>>`SELECT * FROM achillea.guild WHERE id = ${params.id}`.execute(db);
        return { discord, database: ligne.rows[0] ?? null };
      } catch (err) {
        return echecBot(err);
      }
    },
    { params: identifiant },
  )
  .delete(
    "/guilds/:id",
    async ({ db, params }) => {
      try {
        const resultat = await appelerBotAchillea<{ success: true; message: string }>(`/guildes/${params.id}/quitter`, {
          method: "POST",
        });
        await db.transaction().execute(async trx => {
          await sql`UPDATE achillea.guild SET deleted = true, updated_at = now() WHERE id = ${params.id}`.execute(trx);
          await journaliserAudit(trx, { acteur: null, action: "guild.leave", cibleType: "guild", cibleId: params.id, motif: "API développeur" });
        });
        return resultat;
      } catch (err) {
        return echecBot(err);
      }
    },
    { params: identifiant },
  )
  .get(
    "/guilds/:id/invite",
    async ({ params }) => {
      try {
        return await appelerBotAchillea<{ url: string }>(`/guildes/${params.id}/invitation`, { method: "POST" });
      } catch (err) {
        return echecBot(err);
      }
    },
    { params: identifiant },
  )
  .get("/users", async ({ db }) => {
    try {
      const membres = await appelerBotAchillea<Array<{ id: string }>>("/membres");
      const lignes = await db
        .selectFrom("user")
        .selectAll()
        .where("id", "in", membres.length > 0 ? membres.map(m => m.id) : [""])
        .execute();
      const parId = new Map(lignes.map(ligne => [ligne.id, ligne]));
      return membres.map(membre => ({ discord: membre, database: parId.get(membre.id) ?? null }));
    } catch (err) {
      return echecBot(err);
    }
  })
  // Avant `/users/:id` : sinon « cached » serait lu comme un identifiant (bug du legacy, déjà corrigé là-bas).
  .get("/users/cached", async () => {
    try {
      return await appelerBotAchillea<unknown[]>("/utilisateurs/cache");
    } catch (err) {
      return echecBot(err);
    }
  })
  .get(
    "/users/:id",
    async ({ db, params }) => {
      try {
        const discord = await appelerBotAchillea<unknown>(`/utilisateurs/${params.id}`);
        const database = await db.selectFrom("user").selectAll().where("id", "=", params.id).executeTakeFirst();
        return { discord, database: database ?? null };
      } catch (err) {
        return echecBot(err);
      }
    },
    { params: identifiant },
  )
  .get("/maintenance", async ({ db }) => ({ maintenance: await lireMaintenance(db) }))
  .post(
    "/maintenance",
    async ({ db, body }) => {
      await db.transaction().execute(async trx => {
        await ecrireMaintenance(trx, body.maintenance);
        await journaliserAudit(trx, {
          acteur: null,
          action: "bot.maintenance",
          cibleType: "bot",
          charge: { maintenance: body.maintenance },
          motif: "API développeur",
        });
      });
      return { maintenance: body.maintenance };
    },
    { body: t.Object({ maintenance: t.Boolean() }) },
  )
  .get("/devs", () => developpeurs())
  .get("/devs/:id", ({ params }) => developpeurs().includes(params.id), { params: identifiant });
