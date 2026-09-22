import { Controller, Get, UseBefore } from "@tsed/common";
import { Client } from "@aphrody/discordx";

import { Data } from "@/entities";
import { Database, Logger, Stats } from "@/services";
import { BaseController } from "@/utils/classes";
import { isInMaintenance, resolveDependenciesSync } from "@/utils/functions";

import { DevAuthenticated } from "../middlewares/devAuthenticated";

@Controller("/health")
export class HealthController extends BaseController {
	private client: Client;
	private db: Database;
	private stats: Stats;
	private logger: Logger;

	constructor() {
		super();

		this.client = (globalThis as typeof globalThis & { __roseGriffonDiscordClient?: Client }).__roseGriffonDiscordClient ?? resolveDependenciesSync([Client])[0];
		[this.db, this.stats, this.logger] = resolveDependenciesSync([Database, Stats, Logger]);
	}

	@Get("/check")
	async healthcheck() {
		return {
			online: this.client.user?.presence.status !== "offline",
			uptime: this.client.uptime,
			lastStartup: await this.db.get(Data).get("lastStartup"),
		};
	}

	@Get("/latency")
	@UseBefore(DevAuthenticated)
	async latency() {
		return this.stats.getLatency();
	}

	@Get("/usage")
	@UseBefore(DevAuthenticated)
	async usage() {
		const body = await this.stats.getPidUsage();

		return body;
	}

	@Get("/host")
	@UseBefore(DevAuthenticated)
	async host() {
		const body = await this.stats.getHostUsage();

		return body;
	}

	@Get("/monitoring")
	@UseBefore(DevAuthenticated)
	async monitoring() {
		const body = {
			botStatus: {
				online: true,
				uptime: this.client.uptime,
				maintenance: await isInMaintenance(),
			},
			host: await this.stats.getHostUsage(),
			pid: await this.stats.getPidUsage(),
			latency: this.stats.getLatency(),
		};

		return body;
	}

	@Get("/logs")
	@UseBefore(DevAuthenticated)
	async logs() {
		const body = await this.logger.getLastLogs();

		return body;
	}
}
