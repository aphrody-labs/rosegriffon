import { Elysia } from "elysia";
import { createAchilleaSql } from "@rosegriffon/db/achillea-sql";
import { createInagleSql } from "@rosegriffon/db/inagle-sql";
import type { Database } from "@rosegriffon/db/schema";
import type { Kysely } from "kysely";

export let db = createAchilleaSql<Database>() as Kysely<Database>;
export let inagleDb = createInagleSql<Database>();

export function setTestDb(mockDb: Kysely<Database>) {
  db = mockDb;
}

export const dbPlugin = new Elysia({ name: "db" }).derive({ as: "global" }, () => ({ db, inagleDb }));
