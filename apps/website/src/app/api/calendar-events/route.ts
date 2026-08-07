import { getCalendarEvents } from "@/lib/api/events";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPgPool } from "@/lib/db/pg";
import { createLogger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import type { CalendarEvent } from "@/types/api";

// Configuration du cache - revalider toutes les 5 minutes
export const revalidate = 300;

const logger = createLogger("calendar-events");

interface EventRow {
	id: string;
	title: string;
	description: string | null;
	location: string | null;
	start_time: string;
	end_time: string;
	image_url: string | null;
	created_at: string;
	updated_at: string;
}

async function calendarEventsHandler() {
	try {
		logger.debug("Fetching calendar events via API route");

		// 1. Try fetching from Postgres direct (Source of Truth)
		let dbEvents: EventRow[] = [];
		try {
			const pool = getPgPool();
			const { rows } = await pool.query<EventRow>(
				"SELECT * FROM events ORDER BY start_time ASC"
			);
			dbEvents = rows;
		} catch (error) {
			logger.error("Error fetching events from Postgres", error);
			dbEvents = [];
		}

		if (dbEvents.length > 0) {
			logger.info(`${dbEvents.length} event(s) retrieved from Postgres (DB Source)`);

			const mappedEvents: CalendarEvent[] = dbEvents.map((e) => ({
				description: e.description,
				end: {
					dateTime: e.end_time, // Assumes ISO string stored in text column
					timeZone: "Europe/Paris",
				},
				id: e.id,
				location: e.location,
				start: {
					dateTime: e.start_time, // Assumes ISO string stored in text column
					timeZone: "Europe/Paris",
				},
				summary: e.title,
			}));

			return apiSuccess({ events: mappedEvents });
		}

		// 2. Fallback to Google Calendar if DB is empty
		logger.info("Postgres events empty or error, falling back to Google Calendar");
		const events = await getCalendarEvents();
		logger.info(`${events.length} event(s) retrieved from Google`);
		return apiSuccess({ events });
	} catch (error) {
		logger.error("Error in calendar events API route", error);
		return apiError(
			"Impossible de récupérer les événements du calendrier",
			500,
			"CALENDAR_FETCH_ERROR"
		);
	}
}

// Appliquer le rate limiting: 20 requêtes par minute
export const GET = withRateLimit(calendarEventsHandler, {
	limit: 20,
	windowMs: 60_000,
});
