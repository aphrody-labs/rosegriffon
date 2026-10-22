/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Mémoire clé/valeur des tâches Achilléa : la table `achillea.data` de l'ancien bot.
 *
 * Les clés sont CELLES de l'ancien bot (`leaderboardMessageId`,
 * `rankedQueueMessageId`, `rankedTierSnapshot`) : le message de classement déjà
 * publié par lui est retrouvé et édité au lieu d'en poster un second, et le
 * relevé des paliers reprend là où il s'était arrêté.
 *
 * La valeur est du JSON sérialisé, comme dans l'ancien `DataStore`.
 * `20261022_achillea_data_valeur_texte.sql` élargit la colonne (varchar(255)
 * à l'origine) : le relevé des paliers d'une centaine de joueurs la dépassait,
 * et l'ancien bot perdait alors silencieusement toutes les annonces de promotion.
 */
import { sql } from "./db.js";

export interface MemoireAchillea {
  lire(cle: string): Promise<string | null>;
  ecrire(cle: string, valeur: string): Promise<void>;
}

export const memoireAchillea: MemoireAchillea = {
  async lire(cle) {
    const lignes = await sql<Array<{ value: string }>>`SELECT value FROM achillea.data WHERE key = ${cle} LIMIT 1`;
    return lignes[0]?.value ?? null;
  },
  async ecrire(cle, valeur) {
    await sql.begin(async tx => {
      await tx`SET LOCAL ROLE service_role`;
      await tx`
        INSERT INTO achillea.data (key, created_at, updated_at, value)
        VALUES (${cle}, now(), now(), ${valeur})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
    });
  },
};

/** Lit une valeur JSON ; `null` si absente ou illisible (jamais d'exception sur une donnée corrompue). */
export async function lireJson<T>(memoire: MemoireAchillea, cle: string): Promise<T | null> {
  const brut = await memoire.lire(cle);
  if (brut === null || brut === "") return null;
  try {
    return JSON.parse(brut) as T;
  } catch {
    return null;
  }
}

export function ecrireJson(memoire: MemoireAchillea, cle: string, valeur: unknown): Promise<void> {
  return memoire.ecrire(cle, JSON.stringify(valeur));
}
