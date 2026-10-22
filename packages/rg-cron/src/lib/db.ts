/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SQL } from "bun";
import { createBunSql, createInagleBunSql } from "@rosegriffon/db/bun-sql";

/**
 * Message levé par le runtime quand le pool Bun.SQL confie une requête à une
 * connexion dont le socket natif est déjà mort.
 *
 * POURQUOI ON LE GUETTE
 * Sous Bun 1.4.5 (runtime de `rg-core`), une connexion fermée côté natif peut
 * rester dans `readyConnections` : chaque requête suivante lui est confiée,
 * `getConnectionForQuery()` rend un handle vide, et `handle.run()` lève ce
 * message. Le pool ne s'en remet jamais seul : le 22 octobre 2026, toutes les
 * tâches cron (sondages, Discord, campagnes, bail, historique) ont échoué en
 * 0 ms de 00:40 à 13:10 UTC, jusqu'au redémarrage du service. Rien de propre au
 * code d'une tâche : c'est le pool partagé qui est empoisonné.
 */
const MESSAGE_POOL_EMPOISONNE = /connection must be a (PostgresSQLConnection|MySQLConnection)/;

/** Vrai pour l'erreur (ou son message) d'un pool Bun.SQL qu'il faut recréer. */
export function estPoolEmpoisonne(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return MESSAGE_POOL_EMPOISONNE.test(message);
}

/** Délai laissé aux requêtes en vol de l'ancien pool avant sa fermeture (secondes). */
const DELAI_FERMETURE_S = 30;

export interface ClientParesseux {
  readonly sql: SQL;
  /** Oublie le pool courant : le prochain usage en crée un neuf. Rend vrai s'il y en avait un. */
  recreer(): boolean;
}

/**
 * Client créé au premier usage, pas à l'import, et recréable.
 *
 * Le registre est importé par l'API : une base Inagle absente de l'environnement
 * (`INAGLE_DATABASE_URL`) ne doit pas empêcher la fonction de démarrer, seulement
 * faire échouer les tâches qui la lisent.
 *
 * `recreer()` détache l'instance courante ; les appels déjà partis (une
 * transaction `begin()` en cours) gardent la leur, que l'on ferme avec un délai.
 */
export function clientParesseux(creer: () => SQL): ClientParesseux {
  let instance: SQL | null = null;
  const reel = (): SQL => (instance ??= creer());
  const sql = new Proxy(function () {} as unknown as SQL, {
    apply: (_cible, _this, args) => Reflect.apply(reel() as unknown as (...a: unknown[]) => unknown, undefined, args),
    get: (_cible, propriete) => {
      const cible = reel();
      const valeur = Reflect.get(cible, propriete);
      return typeof valeur === "function" ? valeur.bind(cible) : valeur;
    },
  });
  return {
    sql,
    recreer(): boolean {
      const ancien = instance;
      instance = null;
      if (!ancien) return false;
      try {
        // Un pool empoisonné peut lever ou rejeter en se fermant : sans importance.
        ancien.close({ timeout: DELAI_FERMETURE_S }).catch(() => undefined);
      } catch {
        // idem
      }
      return true;
    },
  };
}

const principal = clientParesseux(() => createBunSql());
const inagle = clientParesseux(() => createInagleBunSql());

export const sql = principal.sql;
export const inagleSql = inagle.sql;

/**
 * À appeler sur toute erreur de base vue par le cron. Si elle trahit un pool
 * empoisonné, les pools du module sont recréés : la requête suivante repart sur
 * des connexions neuves au lieu d'échouer jusqu'au redémarrage du service.
 * L'erreur ne dit pas de quel pool elle vient ; recréer un pool sain ne coûte
 * qu'une reconnexion. Rend vrai si une recréation a eu lieu.
 */
export function signalerErreurSql(err: unknown): boolean {
  if (!estPoolEmpoisonne(err)) return false;
  const recrees = [principal.recreer() && "principal", inagle.recreer() && "inagle"].filter(Boolean);
  console.warn(
    `[db] pool Bun.SQL empoisonné (connexion native fermée laissée dans le pool) : recréation ${recrees.join(", ") || "(aucun pool ouvert)"}.`,
  );
  return recrees.length > 0;
}
