import { Injectable, Schedule } from "@/decorators";
import { Season } from "@/entities";
import { SeasonState } from "@/utils/enums";
import { resolveDependency } from "@/utils/functions";

import { Database } from "../services/Database";

@Injectable()
export class SeasonRollover {
	/**
	 * Runs daily at midnight UTC.
	 * - Opens Upcoming seasons whose startsAt <= now
	 * - Closes Active seasons whose endsAt <= now
	 */
	@Schedule("0 0 * * *", "season-rollover")
	async rolloverSeasons() {
		const db = await resolveDependency(Database);
		const em = db.em.fork();

		const now = new Date();

		// Activate upcoming seasons
		const toActivate = await em.find(Season, {
			state: SeasonState.Upcoming,
			startsAt: { $lte: now },
		});

		for (const season of toActivate) {
			season.state = SeasonState.Active;
		}

		// Close active seasons
		const toClose = await em.find(Season, {
			state: SeasonState.Active,
			endsAt: { $lte: now },
		});

		for (const season of toClose) {
			season.state = SeasonState.Closed;
		}

		if (toActivate.length > 0 || toClose.length > 0) {
			await em.flush();
		}
	}
}
