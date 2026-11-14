/** Unique PostgreSQL SQL connections for the bot runtime. */
import {
  createBunSql,
  createInagleBunSql,
  createLazyBunSql,
} from "@rosegriffon/db/bun-sql";

export const sql = createBunSql();

/** Base Inagle (données du jeu), ouverte au premier usage via le proxy paresseux partagé. */
export const inagleSql = createLazyBunSql(() => createInagleBunSql()).sql;
