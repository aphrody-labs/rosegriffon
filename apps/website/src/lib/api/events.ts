import { type calendar_v3, google } from "googleapis";

import type { CalendarEvent } from "@/types/api";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

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
    // Check if environment variables are available
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const calendarId = process.env.GOOGLE_EVENTS_CALENDAR_ID; // ← Calendrier Événements

    if (!clientEmail || !privateKey || !calendarId) {
      // Missing configuration, return empty array
      return [];
    }

    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, "\n"),
      },
      scopes: SCOPES,
    });

    const calendar = google.calendar({ version: "v3", auth });

    // Set time range to include past events (from 2024)
    const now = new Date();
    const startDate = new Date("2024-01-01T00:00:00Z");
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(now.getFullYear() + 1);

    // Fetch events
    const response = await calendar.events.list({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: oneYearFromNow.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100, // Increase results to see history
    });

    // Transform and return all events (filtering will be done by UI)
    const events =
      response.data.items?.map((event: calendar_v3.Schema$Event) => ({
        id: event.id,
        summary: event.summary,
        location: event.location,
        description: event.description,
        start: event.start,
        end: event.end,
        extendedProperties: event.extendedProperties,
      })) || [];

    return events;
  } catch (_error) {
    // Silent fail for missing configuration or API errors
    return [];
  }
}
