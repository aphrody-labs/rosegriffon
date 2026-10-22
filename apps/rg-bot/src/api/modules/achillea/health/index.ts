/**
 * `/health` — sondes de santé, portage de `legacy/achillea-bot/src/api/controllers/health.ts`.
 *
 * L'état du bot (présence, uptime, ping de passerelle, mémoire, journal) vient
 * du serveur d'administration loopback du profil Discord `achillea`
 * (`GET /etat`, `GET /journal`). L'hôte est mesuré ici : l'API et le bot
 * tournent sur la même machine (`rg-core`). Le mode maintenance et le dernier
 * démarrage sont lus dans `achillea.data`, comme le `DataStore` legacy.
 * Bot injoignable → 503 avec le motif, jamais de valeurs inventées.
 */
import { cpus, freemem, hostname, platform, release, totalmem, type, uptime as uptimeHote } from "node:os";
import { Elysia } from "elysia";
import { sql } from "kysely";
import { dbPlugin } from "../../../plugins/db";
import { appelBotParDefaut, lireBot, lireDataStore, type AppelBot, type EtatBot } from "../bot-achillea";
import { chargerRoleEnBase, superAdminOuJetonDev, type ChargeurRole } from "../staff";

const MIO = 1024 * 1024;

function instantaneCpu() {
  let actif = 0;
  let total = 0;
  for (const coeur of cpus()) {
    const { user, nice, sys, irq, idle } = coeur.times;
    actif += user + nice + sys + irq;
    total += user + nice + sys + irq + idle;
  }
  return { actif, total };
}

/** Occupation CPU de l'hôte en %, mesurée sur un court intervalle. */
async function usageCpuHote(intervalleMs = 200): Promise<number> {
  const avant = instantaneCpu();
  await Bun.sleep(intervalleMs);
  const apres = instantaneCpu();
  const total = apres.total - avant.total;
  return total > 0 ? Number((((apres.actif - avant.actif) / total) * 100).toFixed(1)) : 0;
}

/** Forme `getHostUsage` du legacy (node-os-utils), mesurée avec `node:os`. */
export async function usageHote() {
  const totalMo = totalmem() / MIO;
  const libreMo = freemem() / MIO;
  const utiliseMo = totalMo - libreMo;
  return {
    cpu: await usageCpuHote(),
    memory: {
      totalMemMb: Number(totalMo.toFixed(1)),
      usedMemMb: Number(utiliseMo.toFixed(1)),
      freeMemMb: Number(libreMo.toFixed(1)),
      usedMemPercentage: Number(((utiliseMo / totalMo) * 100).toFixed(1)),
      freeMemPercentage: Number(((libreMo / totalMo) * 100).toFixed(1)),
    },
    os: `${type()} ${release()}`,
    uptime: Math.round(uptimeHote()),
    hostname: hostname(),
    platform: platform(),
  };
}

/** Consommation du processus du bot (forme `getPidUsage` du legacy). */
export function usageProcessusBot(etat: EtatBot) {
  return {
    profil: etat.profil,
    elapsed: etat.uptimeSecondes * 1000,
    timestamp: Date.parse(etat.mesureLe) || Date.now(),
    memory: {
      usedInMb: (etat.memoireOctets / MIO).toFixed(1),
      percentage: ((etat.memoireOctets / totalmem()) * 100).toFixed(1),
    },
  };
}

/** Le bot est « en ligne » quand sa session Discord est prête (étiquette connue). */
export function botEnLigne(etat: EtatBot): boolean {
  return etat.etiquette !== null;
}

export type OptionsHealth = { chargerRole?: ChargeurRole; appelBot?: AppelBot };

export function creerHealthController(options: OptionsHealth = {}) {
  const chargerRole = options.chargerRole ?? chargerRoleEnBase;
  const appelBot = options.appelBot ?? appelBotParDefaut;

  return (
    new Elysia({ prefix: "/health" })
      .use(dbPlugin)
      // Publique, comme dans le legacy.
      .get("/check", async ({ db }) => {
        const etat = await lireBot<EtatBot>(appelBot, "/etat");
        if (!etat.ok) return etat.reponse;
        const { lastStartup } = await lireDataStore(db);
        return {
          online: botEnLigne(etat.valeur),
          // Millisecondes, comme `client.uptime` dans le legacy.
          uptime: etat.valeur.uptimeSecondes * 1000,
          lastStartup,
        };
      })
      .get("/latency", async ({ db, headers }) => {
        const auth = await superAdminOuJetonDev(db, headers, chargerRole);
        if (auth.error) return auth.error;
        const etat = await lireBot<EtatBot>(appelBot, "/etat");
        if (!etat.ok) return etat.reponse;
        const debut = performance.now();
        await sql`SELECT 1`.execute(db);
        return { ping: etat.valeur.latenceMs, database: Math.round(performance.now() - debut) };
      })
      .get("/usage", async ({ db, headers }) => {
        const auth = await superAdminOuJetonDev(db, headers, chargerRole);
        if (auth.error) return auth.error;
        const etat = await lireBot<EtatBot>(appelBot, "/etat");
        if (!etat.ok) return etat.reponse;
        return usageProcessusBot(etat.valeur);
      })
      .get("/host", async ({ db, headers }) => {
        const auth = await superAdminOuJetonDev(db, headers, chargerRole);
        if (auth.error) return auth.error;
        return usageHote();
      })
      .get("/monitoring", async ({ db, headers }) => {
        const auth = await superAdminOuJetonDev(db, headers, chargerRole);
        if (auth.error) return auth.error;
        const etat = await lireBot<EtatBot>(appelBot, "/etat");
        if (!etat.ok) return etat.reponse;
        const [{ maintenance }, host] = await Promise.all([lireDataStore(db), usageHote()]);
        return {
          botStatus: { online: botEnLigne(etat.valeur), uptime: etat.valeur.uptimeSecondes * 1000, maintenance },
          host,
          pid: usageProcessusBot(etat.valeur),
          latency: { ping: etat.valeur.latenceMs },
        };
      })
      .get("/logs", async ({ db, headers }) => {
        const auth = await superAdminOuJetonDev(db, headers, chargerRole);
        if (auth.error) return auth.error;
        const journal = await lireBot<{ lignes: string[] }>(appelBot, "/journal");
        if (!journal.ok) return journal.reponse;
        return journal.valeur.lignes;
      })
  );
}

export const healthController = creerHealthController();
