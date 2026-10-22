import { Elysia } from "elysia";
import { dbPlugin } from "../../../plugins/db";

/** `/clans/teams` — équipes internes d'un clan. */
export const clanTeamsController = new Elysia({ prefix: "/clans/teams" }).use(dbPlugin);
