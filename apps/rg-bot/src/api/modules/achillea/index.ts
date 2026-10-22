import { Elysia } from "elysia";
import { tournamentController } from "./tournaments";
import { clanController } from "./clans";
import { clanManagementController } from "./clans/management-routes";
import { miscController } from "./misc";
import { organizationController } from "./organizations";
import { leaderboardController } from "./leaderboard";
import { walletController } from "./wallet";
import { leagueController } from "./leagues";
import { usersController } from "./users";
import { licenseController } from "./licenses";
import { sanctionController } from "./sanctions";
import { adminController } from "./admin";
import { playerNotesController } from "./player-notes";
import { notificationsController } from "./notifications";
import { rankedController } from "./ranked";
import { guildsController } from "./guilds";
import { botController, opsController } from "./ops";
import { clanCycleController } from "./clans/cycle";
import { clanTeamsController } from "./clans/equipes";
import { interclanController } from "./interclans";
import { blacklistController } from "./blacklist";
import { guildSettingsController } from "./guilds/reglages";

export const achilleaModule = new Elysia({ prefix: "/achillea" })
  .use(tournamentController)
  .use(clanController)
  .use(clanManagementController)
  // Équipes AVANT le cycle de vie : `/clans/teams/...` ne doit jamais tomber sur un `/clans/:id`.
  .use(clanTeamsController)
  .use(clanCycleController)
  .use(interclanController)
  .use(blacklistController)
  .use(guildSettingsController)
  .use(miscController)
  .use(organizationController)
  .use(leaderboardController)
  .use(rankedController)
  .use(guildsController)
  .use(opsController)
  .use(botController)
  .use(walletController)
  .use(leagueController)
  .use(usersController)
  .use(licenseController)
  .use(sanctionController)
  .use(adminController)
  .use(playerNotesController)
  .use(notificationsController);
