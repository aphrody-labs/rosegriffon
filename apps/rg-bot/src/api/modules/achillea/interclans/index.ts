import { Elysia } from "elysia";
import { dbPlugin } from "../../../plugins/db";

/** `/interclans` — défis entre clans. */
export const interclanController = new Elysia({ prefix: "/interclans" }).use(dbPlugin);
