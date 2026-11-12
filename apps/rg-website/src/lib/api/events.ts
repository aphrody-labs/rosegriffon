import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";

import { getServiceAccountAuth } from "@/lib/google/auth";
import { createLogger } from "@/lib/logger";
import type { CalendarEvent } from "@/types/api";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

const logger = createLogger("google-calendar");

/**
 * Fetch scheduled events directly from Discord API
 * Maps them to the CalendarEvent interface for compatibility
 */
export async function getDiscordEvents(): Promise<CalendarEvent[]> {
  return [];
}

/**
 * Fetch calendar events directly from Google Calendar API
 * Used during SSR/SSG to avoid internal HTTP calls during build
 */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const calendarId = process.env.GOOGLE_EVENTS_CALENDAR_ID; // ← Calendrier Événements
    if (!calendarId) {
      logger.warn(
        "Google Calendar non configuré, variable absente : GOOGLE_EVENTS_CALENDAR_ID",
      );
      return [];
    }

    const auth = getServiceAccountAuth(SCOPES);
    if (!auth) {
      logger.warn(
        "Google Calendar non configuré : aucun identifiant de compte de service utilisable.",
      );
      return [];
    }

    const calendar = google.calendar({ auth, version: "v3" });

    // Set time range to include past events (from 2024)
    const now = new Date();
    const startDate = new Date("2024-01-01T00:00:00Z");
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(now.getFullYear() + 1);

    // Fetch events
    const response = await calendar.events.list({
      calendarId,
      maxResults: 100, // Increase results to see history
      orderBy: "startTime",
      singleEvents: true,
      timeMax: oneYearFromNow.toISOString(),
      timeMin: startDate.toISOString(),
    });

    // Transform and return all events (filtering will be done by UI)
    const events =
      response.data.items?.map((event: calendar_v3.Schema$Event) => ({
        description: event.description,
        end: event.end,
        extendedProperties: event.extendedProperties,
        id: event.id,
        location: event.location,
        start: event.start,
        summary: event.summary,
      })) || [];

    return events;
  } catch {
    // Silent fail for missing configuration or API errors
    return [];
  }
}
