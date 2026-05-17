import { getCalendarEvents } from "@/lib/api/events";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createLogger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/types/api";

// Configuration du cache - revalider toutes les 5 minutes
export const revalidate = 300;

const logger = createLogger("calendar-events");

async function calendarEventsHandler() {
  try {
    logger.debug("Fetching calendar events via API route");

    // 1. Try fetching from Supabase (Source of Truth)
    const supabase = await createClient();
    const { data: dbEvents, error } = await supabase
      .from("events")
      .select("*")
      .order("start_time", { ascending: true });

    if (!error && dbEvents && dbEvents.length > 0) {
      logger.info(`${dbEvents.length} event(s) retrieved from Supabase (DB Source)`);

      const mappedEvents: CalendarEvent[] = dbEvents.map((e) => ({
        id: e.id,
        summary: e.title,
        description: e.description,
        location: e.location,
        start: {
          dateTime: e.start_time, // Assumes ISO string stored in text column
          timeZone: "Europe/Paris",
        },
        end: {
          dateTime: e.end_time, // Assumes ISO string stored in text column
          timeZone: "Europe/Paris",
        },
      }));

      return apiSuccess({ events: mappedEvents });
    }

    // 2. Fallback to Google Calendar if DB is empty
    logger.info("Supabase events empty or error, falling back to Google Calendar");
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
  windowMs: 60000,
});
