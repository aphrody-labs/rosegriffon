import { Elysia } from "elysia";
import { dbPlugin } from "../../../plugins/db";

/** `/blacklist` — liste noire. */
export const blacklistController = new Elysia({ prefix: "/blacklist" }).use(dbPlugin);
