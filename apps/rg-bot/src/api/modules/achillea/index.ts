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
import { adminDbController } from "./admin-db";
import { healthController } from "./health";
import { statsController } from "./stats";
import { databaseController } from "./database";
import { verificationAuditController } from "./audit-verify";
import { notificationsInternalController } from "./notifications/internal";
import { castsController } from "./casts";
import { imagesController } from "./images";
import { avatarResyncController } from "./users/avatar-resync";
import { proxyController } from "./proxy";
import { moderationSyncController } from "./moderation-sync";
import { clansAdminController } from "./clans-admin";
import { clanCycleController } from "./clans/cycle";
import { clanTeamsController } from "./clans/equipes";
import { interclanController } from "./interclans";
import { blacklistController } from "./blacklist";
import { guildSettingsController } from "./guilds/reglages";
import { resyncAvatarsController } from "./users/resync-avatars";

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
  // Avant `usersController` : `/users/resync-avatars` ne doit pas tomber sur `/users/:id`.
  .use(resyncAvatarsController)
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
  .use(adminDbController)
  .use(healthController)
  .use(statsController)
  .use(databaseController)
  .use(verificationAuditController)
  .use(notificationsInternalController)
  .use(castsController)
  .use(imagesController)
  .use(avatarResyncController)
  .use(proxyController)
  .use(moderationSyncController)
  .use(clansAdminController);
