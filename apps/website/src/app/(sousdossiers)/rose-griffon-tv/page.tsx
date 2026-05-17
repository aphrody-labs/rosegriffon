import { BreadcrumbSchema } from "@/components/shared/StructuredData";

import { RgtvPageClient } from "./_components/RgtvPageClient";
import { checkStreamerPermission } from "./actions";
import {
  getGoogleCalendarSchedulesByDay,
  isGoogleCalendarConfigured,
} from "./google-calendar-actions";
import { getSchedulesByDay } from "./stream-schedule-actions";

export const dynamic = "force-dynamic";

export default async function RoseGriffonTvPage() {
  let scheduleByDay;
  let scheduleError: unknown = null;
  let isStreamer = false;

  try {
    // Vérifier les permissions streamer
    isStreamer = await checkStreamerPermission();

    // Vérifier si Google Calendar est configuré
    const isGCalConfigured = await isGoogleCalendarConfigured();

    if (isGCalConfigured) {
      // Priorité: Google Calendar
      try {
        scheduleByDay = await getGoogleCalendarSchedulesByDay();
        // console.log("✅ Planning chargé depuis Google Calendar");
      } catch (gcalError) {
        console.warn("⚠️ Google Calendar échoué, fallback sur Supabase", gcalError);
        // Fallback sur Supabase
        scheduleByDay = await getSchedulesByDay();
      }
    } else {
      // Pas de Google Calendar configuré, utiliser Supabase
      scheduleByDay = await getSchedulesByDay();
      // console.log(
      //   "📊 Planning chargé depuis Supabase (Google Calendar non configuré)"
      // );
    }
  } catch (err) {
    scheduleError = err;
    scheduleByDay = {};
    console.error("❌ Erreur chargement planning:", err);
  }

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Accueil", item: "/" },
          { name: "Rose Griffon TV", item: "/rose-griffon-tv" },
        ]}
      />
      <RgtvPageClient
        scheduleByDay={scheduleByDay}
        scheduleError={scheduleError}
        isStreamer={isStreamer}
      />
    </>
  );
}
