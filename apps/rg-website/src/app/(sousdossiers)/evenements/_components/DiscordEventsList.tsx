"use client";

import { Calendar, MapPin, Users } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";

import {
  type DiscordScheduledEvent,
  getEventStatusColor,
  getEventStatusLabel,
} from "../useDiscordEvents";

interface DiscordEventsListProps {
  events: DiscordScheduledEvent[];
  isLoading: boolean;
}

function DiscordEventsList({ events, isLoading }: DiscordEventsListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-2" />
        <p>Chargement des événements Discord...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Aucun événement Discord programmé pour le moment.
        </p>
      </div>
    );
  }

  // Trier les événements par date de début
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = new Date(a.scheduledStartTime);
    const dateB = new Date(b.scheduledStartTime);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sortedEvents.map((event) => (
        <DiscordEventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

function DiscordEventCard({ event }: { event: DiscordScheduledEvent }) {
  const statusLabel = getEventStatusLabel(event.status);
  const statusColor = getEventStatusColor(event.status);

  // Formater les dates
  const startDate = new Date(event.scheduledStartTime);
  const endDate = event.scheduledEndTime ? new Date(event.scheduledEndTime) : null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-purple-500/60">
      {/* Badge de statut */}
      <div className="absolute top-4 right-4">
        <Badge
          variant={statusColor === "green" ? "default" : "secondary"}
          className={`
            ${statusColor === "blue" ? "bg-blue-500 text-white" : ""}
            ${statusColor === "green" ? "bg-green-500 text-white" : ""}
            ${statusColor === "gray" ? "bg-gray-500 text-white" : ""}
            ${statusColor === "red" ? "bg-red-500 text-white" : ""}
          `}
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Image de l'événement si disponible */}
      {event.image && (
        <div className="relative w-full h-32 mb-4 rounded-lg overflow-hidden">
          <Image
            src={`https://cdn.discordapp.com/guild-events/${event.id}/${event.image}.png`}
            alt={event.name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      {/* Titre */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 pr-24">{event.name}</h3>

      {/* Description */}
      {event.description && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
          {event.description}
        </p>
      )}

      {/* Informations */}
      <div className="space-y-2 text-sm">
        {/* Date de début */}
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Calendar className="h-4 w-4 text-purple-600" />
          <span className="font-medium">Début:</span>
          <span>{formatDate(startDate)}</span>
        </div>

        {/* Date de fin si disponible */}
        {endDate && (
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Calendar className="h-4 w-4 text-purple-600" />
            <span className="font-medium">Fin:</span>
            <span>{formatDate(endDate)}</span>
          </div>
        )}

        {/* Localisation pour les événements externes */}
        {event.entityMetadata?.location && (
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <MapPin className="h-4 w-4 text-purple-600" />
            <span className="font-medium">Lieu:</span>
            <span>{event.entityMetadata.location}</span>
          </div>
        )}

        {/* Nombre de participants */}
        {event.userCount > 0 && (
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Users className="h-4 w-4 text-purple-600" />
            <span className="font-medium">Participants:</span>
            <span>{event.userCount}</span>
          </div>
        )}
      </div>

      {/* Créateur */}
      {event.creator && (
        <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2">
            {event.creator.avatar && (
              <div className="relative w-6 h-6 rounded-full overflow-hidden">
                <Image
                  src={`https://cdn.discordapp.com/avatars/${event.creator.id}/${event.creator.avatar}.png`}
                  alt={event.creator.username}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Créé par {event.creator.username}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiscordEventsList;
