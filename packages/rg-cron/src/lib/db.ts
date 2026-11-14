/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type ClientParesseux,
  createBunSql,
  createInagleBunSql,
  createLazyBunSql,
  estPoolEmpoisonne,
} from "@rosegriffon/db/bun-sql";

export { type ClientParesseux, estPoolEmpoisonne };
export const clientParesseux = createLazyBunSql;

const principal = createLazyBunSql(() => createBunSql());
const inagle = createLazyBunSql(() => createInagleBunSql());

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
  const recrees = [
    principal.recreer() && "principal",
    inagle.recreer() && "inagle",
  ].filter(Boolean);
  console.warn(
    `[db] pool Bun.SQL empoisonné (connexion native fermée laissée dans le pool) : recréation ${recrees.join(", ") || "(aucun pool ouvert)"}.`,
  );
  return recrees.length > 0;
}
