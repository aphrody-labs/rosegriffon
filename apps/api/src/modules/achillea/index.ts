import { Elysia } from "elysia";
import { tournamentController } from "./tournaments";
import { clanController } from "./clans";
import { organizationController } from "./organizations";
import { leaderboardController } from "./leaderboard";
import { walletController } from "./wallet";
import { leagueController } from "./leagues";
import { usersController } from "./users";
import { licenseController } from "./licenses";
import { sanctionController } from "./sanctions";
import { adminController } from "./admin";
import { playerNotesController } from "./player-notes";

export const achilleaModule = new Elysia({ prefix: "/achillea" })
	.use(tournamentController)
	.use(clanController)
	.use(organizationController)
	.use(leaderboardController)
	.use(walletController)
	.use(leagueController)
	.use(usersController)
	.use(licenseController)
	.use(sanctionController)
	.use(adminController)
	.use(playerNotesController);
