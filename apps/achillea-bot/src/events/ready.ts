import { ActivityType } from "discord.js";
import { Client } from "@aphrody/discordx";

import { generalConfig } from "@/configs";
import { Discord, Injectable, Once, Schedule } from "@/decorators";
import { Data } from "@/entities";
// Imports VALEUR obligatoires : ces classes sont injectées dans le constructeur → `import type`
// efface le runtime et casse `design:paramtypes` (ReadyEvent jamais instancié, readyHandler mort).
import { Database, Logger, Scheduler, Store } from "@/services";
import { resolveDependency, syncAllGuilds } from "@/utils/functions";

import { Matchmaker } from "../services/Matchmaker";
import { RankedQueueService } from "../services/RankedQueueService";

@Discord()
@Injectable()
export default class ReadyEvent {
	constructor(
		private db: Database,
		private logger: Logger,
		private scheduler: Scheduler,
		private store: Store,
		private matchmaker: Matchmaker,
		private queueService: RankedQueueService
	) {
		console.info("[ready] ReadyEvent instance built (DI ok)");
	}

	private activityIndex = 0;

	@Once("ready")
	async readyHandler([client]: [Client]) {
		console.info("[ready] @Once(ready) fired");
		// make sure all guilds are cached
		await client.guilds.fetch();

		// synchronize applications commands with Discord
		await client.initApplicationCommands();
		const cmds = await client.application!.commands.fetch();
		console.info(
			"Global commands registered:",
			cmds.map((cmd) => cmd.name)
		);

		// change activity
		await this.changeActivity();

		// update last startup time in the database
		await this.db.get(Data).set("lastStartup", Date.now());

		// start scheduled jobs
		this.scheduler.startAllJobs();

		// log startup
		await this.logger.logStartingConsole();

		// synchronize guilds between discord and the database
		await syncAllGuilds(client);

		// the bot is fully ready
		this.store.update("ready", (e) => ({ ...e, bot: true }));

		// start matchmaking
		/*		console.info('Restoring queues...')
		await this.queueService.restoreQueuesOnStartup(client)
		setInterval(() => this.queueService.watchdogCheckAllRanked(), 300_000) // 5 min
		await this.matchmaker.initMatchmaking() */
	}

	@Schedule("*/15 * * * * *") // each 15 seconds
	async changeActivity() {
		const ActivityTypeEnumString = [
			"PLAYING",
			"STREAMING",
			"LISTENING",
			"WATCHING",
			"CUSTOM",
			"COMPETING",
		]; // DO NOT CHANGE THE ORDER

		const client = await resolveDependency(Client);
		const activity = generalConfig.activities[this.activityIndex];

		if (activity.type === "STREAMING") {
			// streaming activity
			client.user?.setStatus("online");
			client.user?.setActivity(activity.text, {
				url: "https://www.twitch.tv/discord",
				type: ActivityType.Streaming,
			});
		} else {
			// other activities
			client.user?.setActivity(activity.text, {
				type: ActivityTypeEnumString.indexOf(activity.type),
			});
		}

		this.activityIndex++;
		if (this.activityIndex === generalConfig.activities.length) this.activityIndex = 0;
	}
}
