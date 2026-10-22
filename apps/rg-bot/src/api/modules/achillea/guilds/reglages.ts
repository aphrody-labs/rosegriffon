import { Elysia } from "elysia";
import { dbPlugin } from "../../../plugins/db";

/** `/guilds/:id/settings` — réglages du bot sur un serveur (salon d'annonce, ranked, clan lié). */
export const guildSettingsController = new Elysia({ prefix: "/guilds" }).use(dbPlugin);
