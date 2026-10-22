import { Elysia } from "elysia";
import { dbPlugin } from "../../../plugins/db";

/** `/clans` — cycle de vie d'un clan (départ, dissolution, transfert, votes, historique). */
export const clanCycleController = new Elysia({ prefix: "/clans" }).use(dbPlugin);
