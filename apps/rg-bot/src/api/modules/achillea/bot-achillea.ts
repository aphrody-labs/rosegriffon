/**
 * Lecture de l'état vivant du bot Discord Achilléa pour les sondes `/health`
 * et `/stats`, via le serveur d'administration loopback (`lib/achillea-discord.ts`).
 *
 * Quand le bot ne répond pas, les routes répondent 503 avec le motif : on ne
 * remplace jamais une mesure absente par un zéro inventé.
 */
import { status } from "elysia";
import { sql, type Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import type { EtatBot, GuildeBot } from "@rosegriffon/types/bot";
import { appelerBotAchillea, BotAchilleaInjoignable } from "../../../lib/achillea-discord";

/** Appel du bot, injectable pour les tests. */
export type AppelBot = <T>(chemin: string) => Promise<T>;

export const appelBotParDefaut: AppelBot = chemin => appelerBotAchillea(chemin);

function indisponible(motif: string) {
  return status(503, { message: `Bot Discord Achilléa indisponible : ${motif}` });
}

export type LectureBot<T> = { ok: true; valeur: T } | { ok: false; reponse: ReturnType<typeof indisponible> };

/** Lit une route du bot et traduit l'indisponibilité en 503 explicite. */
export async function lireBot<T>(appel: AppelBot, chemin: string): Promise<LectureBot<T>> {
  try {
    return { ok: true, valeur: await appel<T>(chemin) };
  } catch (cause) {
    const motif = cause instanceof BotAchilleaInjoignable || cause instanceof Error ? cause.message : String(cause);
    return {
      ok: false,
      reponse: indisponible(motif),
    };
  }
}

export type { EtatBot, GuildeBot };

/**
 * Valeurs du `DataStore` legacy (`achillea.data`, clé → JSON) : mode
 * maintenance et dernier démarrage. Une clé jamais écrite vaut sa valeur par
 * défaut du legacy (`maintenance: false`, `lastStartup: null`).
 */
export async function lireDataStore(db: Kysely<Database>) {
  const lignes = await sql<{ key: string; value: string | null }>`
    SELECT key, value FROM achillea.data WHERE key IN ('maintenance', 'lastStartup')
  `.execute(db);
  const valeur = (cle: string): unknown => {
    const brute = lignes.rows.find(ligne => ligne.key === cle)?.value;
    if (brute === undefined || brute === null) return null;
    try {
      return JSON.parse(brute);
    } catch {
      return brute;
    }
  };
  return { maintenance: valeur("maintenance") === true, lastStartup: valeur("lastStartup") };
}
