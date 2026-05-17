import { Calendar, Clock, Info, Map, MapPin } from "lucide-react";
import Link from "next/link";
import { memo } from "react";

import { cn } from "@/lib/utils";

import type { EventCategory, EventData } from "../useEvents";

interface EventsListProps {
  events: EventData[];
  isLoading: boolean;
}

const CATEGORY_COLORS: Record<
  EventCategory | string,
  { bg: string; text: string; border: string }
> = {
  Conventions: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
  },
  "Meet-up": {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  "Stand artiste RG": {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-700 dark:text-pink-300",
    border: "border-pink-200 dark:border-pink-800",
  },
  "Stand associatif": {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
};

const DEFAULT_COLOR = {
  bg: "bg-gray-100 dark:bg-gray-800",
  text: "text-gray-700 dark:text-gray-300",
  border: "border-gray-200 dark:border-gray-700",
};

function EventsList({ events, isLoading }: EventsListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gaelle-blue mr-2" />
        <p className="text-muted-foreground animate-pulse font-medium">
          Recherche des événements...
        </p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-12 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <Info className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400 font-bold text-lg">
          Aucun événement trouvé pour le moment.
        </p>
        <p className="text-sm text-gray-500 mt-1 italic">
          Pensez à vérifier les événements Discord ou à réinitialiser vos filtres.
        </p>
      </div>
    );
  }

  const sortedEvents = [...events].sort((a, b) => {
    if (a.type === "today" && b.type !== "today") return -1;
    if (a.type !== "today" && b.type === "today") return 1;
    const aTime = new Date(a.startDate).getTime();
    const bTime = new Date(b.startDate).getTime();
    return Number.isNaN(aTime) || Number.isNaN(bTime) ? 0 : aTime - bTime;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sortedEvents.map((event, index) => {
        const colors = CATEGORY_COLORS[event.category] || DEFAULT_COLOR;

        return (
          <div
            key={index}
            className={cn(
              "group relative flex flex-col bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border transition-all duration-500 hover:shadow-2xl hover:-translate-y-2",
              colors.border,
              event.type === "today" && "ring-4 ring-offset-4 ring-blue-500 shadow-blue-500/20"
            )}
          >
            {/* Status Strip */}
            <div
              className={cn(
                "h-2 w-full",
                event.type === "today"
                  ? "bg-blue-500"
                  : event.type === "upcoming"
                    ? "bg-green-500"
                    : "bg-gray-400"
              )}
            />

            <div className="p-6 flex-1 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    colors.bg,
                    colors.text
                  )}
                >
                  {event.category}
                </span>
                {event.type === "today" && (
                  <span className="animate-pulse px-3 py-1 bg-blue-500 text-white text-[10px] font-black rounded-full uppercase tracking-widest">
                    AUJOURD'HUI
                  </span>
                )}
              </div>

              <h3 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight group-hover:text-gaelle-blue transition-colors font-brad-bun-r tracking-tight">
                {event.name}
              </h3>

              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300 font-medium">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                    <Calendar className="h-4 w-4 shrink-0 text-gaelle-blue" />
                  </div>
                  <span>
                    {event.startDateFormatted.split(" ")[0]}
                    {event.endDateFormatted !== event.startDateFormatted &&
                      ` - ${event.endDateFormatted.split(" ")[0]}`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                    <Clock className="h-4 w-4 shrink-0 text-gaelle-blue" />
                  </div>
                  <span>{event.startDateFormatted.split(" ").slice(1).join(" ")}</span>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 mt-0.5">
                      <MapPin className="h-4 w-4 shrink-0 text-gaelle-blue" />
                    </div>
                    <span className="line-clamp-2 leading-relaxed">{event.location}</span>
                  </div>

                  {event.name.toLowerCase().includes("epitanime") && (
                    <Link
                      href="/epita-map"
                      className="ml-10 inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      <Map className="h-3 w-3" />
                      Voir le plan du campus
                    </Link>
                  )}
                </div>
              </div>

              {event.description && (
                <div className="mt-auto pt-5 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-4 italic leading-relaxed">
                    {event.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(EventsList);
