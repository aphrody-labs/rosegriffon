/** Unique PostgreSQL SQL connection for the bot runtime. */
import type { SQL } from "bun";
import { createBunSql, createInagleBunSql } from "@rosegriffon/db/bun-sql";

export const sql = createBunSql();

/**
 * Base Inagle (données du jeu), ouverte au premier usage.
 *
 * Créée à l'import, elle faisait échouer le CHARGEMENT de ce module — donc de
 * tout le bot — partout où `INAGLE_DATABASE_URL` manque, y compris pour des
 * profils (Achilléa) et des tests qui ne la lisent jamais. Même motif que
 * `packages/rg-cron/src/lib/db.ts`.
 */
let inagle: SQL | null = null;
const inagleReel = (): SQL => (inagle ??= createInagleBunSql());

export const inagleSql: SQL = new Proxy(function () {} as unknown as SQL, {
  apply: (_cible, _this, args) => Reflect.apply(inagleReel() as unknown as (...a: unknown[]) => unknown, undefined, args),
  get: (_cible, propriete) => {
    const valeur = Reflect.get(inagleReel(), propriete);
    return typeof valeur === "function" ? valeur.bind(inagleReel()) : valeur;
  },
});
