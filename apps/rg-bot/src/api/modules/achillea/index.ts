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
import { notificationsInternalController } from "./notifications/internal";
import { castsController } from "./casts";
import { imagesController } from "./images";
import { avatarResyncController } from "./users/avatar-resync";
import { proxyController } from "./proxy";
import { moderationSyncController } from "./moderation-sync";

export const achilleaModule = new Elysia({ prefix: "/achillea" })
  .use(tournamentController)
  .use(clanController)
  .use(clanManagementController)
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
  .use(notificationsController)
  .use(notificationsInternalController)
  .use(castsController)
  .use(imagesController)
  .use(avatarResyncController)
  .use(proxyController)
  .use(moderationSyncController);
