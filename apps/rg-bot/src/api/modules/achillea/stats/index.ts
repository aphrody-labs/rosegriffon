/**
 * `/stats` — télémétrie d'usage du bot, portage de
 * `legacy/achillea-bot/src/api/controllers/stats.ts` et du service `Stats`.
 *
 * L'historique est calculé en base (`achillea.stat`, `achillea.guild`,
 * `achillea.user`), en agrégats SQL plutôt qu'une requête par jour comme le
 * legacy. Ce qui venait du cache Discord (membres cumulés, nombre et noms des
 * serveurs) est lu sur le bot via son serveur d'administration ; bot
 * injoignable → 503.
 */
import { Elysia, t } from "elysia";
import { sql } from "kysely";
import type { CommandUsageRow, DailyCountRow } from "@rosegriffon/achillea-client/v1";
import { dbPlugin } from "../../../plugins/db";
import { appelBotParDefaut, lireBot, type AppelBot, type GuildeBot } from "../bot-achillea";
import { chargerRoleEnBase, superAdminOuJetonDev, type ChargeurRole } from "../staff";

/** Types d'interaction comptés comme « commandes » (identiques au legacy). */
export const TYPES_INTERACTION = [
  "SIMPLE_COMMAND_MESSAGE",
  "CHAT_INPUT_COMMAND_INTERACTION",
  "USER_CONTEXT_MENU_COMMAND_INTERACTION",
  "MESSAGE_CONTEXT_MENU_COMMAND_INTERACTION",
] as const;

const JOURS_MAX = 90;

export function bornerJours(valeur: number | undefined): number {
  const jours = Math.floor(valeur ?? 7);
  return Number.isFinite(jours) ? Math.min(JOURS_MAX, Math.max(1, jours)) : 7;
}

/** `JJ/MM/AAAA`, format `onlyDate` du legacy. */
export function formaterJour(date: Date): string {
  const jj = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${jj}/${mm}/${date.getUTCFullYear()}`;
}

/** Les `n` derniers jours, du plus récent au plus ancien, en clés `AAAA-MM-JJ`. */
export function derniersJours(n: number, maintenant = new Date()): Date[] {
  const base = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate());
  return Array.from({ length: n }, (_, i) => new Date(base - i * 86_400_000));
}

function cleJour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Comptes par jour cumulés comme `cumulateStatPerInterval` du legacy : la
 * valeur d'un jour est la somme des jours de la fenêtre jusqu'à lui inclus.
 */
export function cumulerParJour(jours: Date[], comptes: Map<string, number>): DailyCountRow[] {
  let cumul = 0;
  const croissant = jours.toReversed().map(jour => {
    cumul += comptes.get(cleJour(jour)) ?? 0;
    return { date: formaterJour(jour), count: cumul };
  });
  return croissant.toReversed();
}

/** Tranches d'activité du legacy (un membre sans commande compte dans « 1-10 »). */
export function trancherActivite(comptes: Iterable<number>) {
  const tranches = { "1-10": 0, "11-50": 0, "51-100": 0, "101-1000": 0, ">1000": 0 };
  for (const n of comptes) {
    if (n <= 10) tranches["1-10"]++;
    else if (n <= 50) tranches["11-50"]++;
    else if (n <= 100) tranches["51-100"]++;
    else if (n <= 1000) tranches["101-1000"]++;
    else tranches[">1000"]++;
  }
  return tranches;
}

export type OptionsStats = { chargerRole?: ChargeurRole; appelBot?: AppelBot };

/** Classement legacy : serveurs que le bot voit encore, triés par commandes. */
export function classerGuildes(guildes: readonly GuildeBot[], comptes: ReadonlyMap<string, number>) {
  return guildes
    .map(guilde => ({ id: guilde.id, name: guilde.nom, totalCommands: comptes.get(guilde.id) ?? 0 }))
    .toSorted((a, b) => b.totalCommands - a.totalCommands);
}

export function creerStatsController(options: OptionsStats = {}) {
  const chargerRole = options.chargerRole ?? chargerRoleEnBase;
  const appelBot = options.appelBot ?? appelBotParDefaut;
  const types = sql.join(TYPES_INTERACTION.map(type => sql`${type}`));

  return new Elysia({ prefix: "/stats" })
    .use(dbPlugin)
    .onBeforeHandle(async ({ db, headers }) => {
      const auth = await superAdminOuJetonDev(db, headers, chargerRole);
      if (auth.error) return auth.error;
    })
    .get("/totals", async ({ db }) => {
      // Membres et serveurs : cache vivant du bot, comme le legacy.
      const bot = await lireBot<{ guildes: GuildeBot[] }>(appelBot, "/guildes");
      if (!bot.ok) return bot.reponse;
      const resultat = await sql<{ total_active_users: number; total_commands: number }>`
        SELECT
          (SELECT count(*)::int FROM achillea."user") AS total_active_users,
          (SELECT count(*)::int FROM achillea.stat WHERE type IN (${types})) AS total_commands
      `.execute(db);
      const ligne = resultat.rows[0];
      return {
        stats: {
          totalUsers: bot.valeur.guildes.reduce((somme, guilde) => somme + guilde.membres, 0),
          totalGuilds: bot.valeur.guildes.length,
          totalActiveUsers: Number(ligne?.total_active_users ?? 0),
          totalCommands: Number(ligne?.total_commands ?? 0),
        },
      };
    })
    .get("/interaction/last", async ({ db }) => {
      const ligne = await db
        .selectFrom("stat")
        .selectAll()
        .where("type", "in", [...TYPES_INTERACTION])
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst();
      return ligne
        ? {
            id: ligne.id,
            type: ligne.type,
            value: ligne.value,
            additionalData: ligne.additional_data,
            createdAt: ligne.created_at,
          }
        : null;
    })
    .get("/guilds/last", async ({ db }) => {
      const ligne = await db
        .selectFrom("guild")
        .select(["id", "created_at", "updated_at", "last_interact", "deleted", "prefix"])
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst();
      return ligne
        ? {
            id: ligne.id,
            createdAt: ligne.created_at,
            updatedAt: ligne.updated_at,
            lastInteract: ligne.last_interact,
            deleted: ligne.deleted,
            prefix: ligne.prefix,
          }
        : null;
    })
    .get(
      "/commands/usage",
      async ({ db, query }) => {
        const jours = derniersJours(bornerJours(query.numberOfDays));
        const debut = jours.at(-1)!;
        const lignes = await sql<{ jour: string; type: string; count: number }>`
          SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS jour, type, count(*)::int AS count
          FROM achillea.stat
          WHERE type IN (${types}) AND created_at >= ${debut}
          GROUP BY 1, 2
        `.execute(db);
        const parFamille = (filtre: (type: string) => boolean) => {
          const comptes = new Map<string, number>();
          for (const ligne of lignes.rows)
            if (filtre(ligne.type)) comptes.set(ligne.jour, (comptes.get(ligne.jour) ?? 0) + Number(ligne.count));
          return cumulerParJour(jours, comptes);
        };
        const slash = parFamille(type => type === "CHAT_INPUT_COMMAND_INTERACTION");
        const simples = parFamille(type => type === "SIMPLE_COMMAND_MESSAGE");
        const menus = parFamille(type => type.endsWith("_CONTEXT_MENU_COMMAND_INTERACTION"));
        return slash.map(
          (jour, i): CommandUsageRow => ({
            date: jour.date,
            slashCommands: jour.count,
            simpleCommands: simples[i]?.count ?? 0,
            contextMenus: menus[i]?.count ?? 0,
          }),
        );
      },
      { query: t.Object({ numberOfDays: t.Optional(t.Numeric()) }) },
    )
    .get("/commands/top", async ({ db }) => {
      const lignes = await sql<{ type: string; name: string | null; count: number }>`
        SELECT type, value AS name, count(*)::int AS count
        FROM achillea.stat
        WHERE type IN (${types})
        GROUP BY type, value
        ORDER BY count DESC
      `.execute(db);
      return lignes.rows.map(ligne => ({ type: ligne.type, name: ligne.name, count: Number(ligne.count) }));
    })
    .get("/users/activity", async ({ db }) => {
      const lignes = await sql<{ count: number }>`
        SELECT count(s.id)::int AS count
        FROM achillea."user" u
        LEFT JOIN achillea.stat s
          ON s.additional_data->>'user' = u.id AND s.type IN (${types})
        GROUP BY u.id
      `.execute(db);
      return trancherActivite(lignes.rows.map(ligne => Number(ligne.count)));
    })
    .get("/guilds/top", async ({ db }) => {
      const bot = await lireBot<{ guildes: GuildeBot[] }>(appelBot, "/guildes");
      if (!bot.ok) return bot.reponse;
      const lignes = await sql<{ id: string; total: number }>`
        SELECT g.id, count(s.id)::int AS total
        FROM achillea.guild g
        LEFT JOIN achillea.stat s
          ON s.additional_data->>'guild' = g.id AND s.type IN (${types})
        WHERE g.deleted = false
        GROUP BY g.id
      `.execute(db);
      // Comme le legacy : serveurs connus en base ET encore visibles par le bot,
      // nommés d'après le cache Discord.
      const enBase = new Set(lignes.rows.map(ligne => ligne.id));
      const comptes = new Map(lignes.rows.map(ligne => [ligne.id, Number(ligne.total)]));
      return classerGuildes(
        bot.valeur.guildes.filter(guilde => enBase.has(guilde.id)),
        comptes,
      );
    })
    .get(
      "/usersAndGuilds",
      async ({ db, query }) => {
        const jours = derniersJours(bornerJours(query.numberOfDays));
        const debut = jours.at(-1)!;
        const lignes = await sql<{ jour: string; type: string; count: number }>`
          SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS jour, type, count(*)::int AS count
          FROM achillea.stat
          WHERE type IN ('TOTAL_ACTIVE_USERS', 'TOTAL_USERS', 'TOTAL_GUILDS') AND created_at >= ${debut}
          GROUP BY 1, 2
        `.execute(db);
        const serie = (type: string) =>
          cumulerParJour(
            jours,
            new Map(lignes.rows.filter(ligne => ligne.type === type).map(ligne => [ligne.jour, Number(ligne.count)])),
          );
        return { activeUsers: serie("TOTAL_ACTIVE_USERS"), users: serie("TOTAL_USERS"), guilds: serie("TOTAL_GUILDS") };
      },
      { query: t.Object({ numberOfDays: t.Optional(t.Numeric()) }) },
    );
}

export const statsController = creerStatsController();
