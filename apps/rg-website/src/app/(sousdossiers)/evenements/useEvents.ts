"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { CalendarEvent } from "@/types/api";

// Types d'événements
export type EventType = "upcoming" | "past" | "today";
export type EventCategory = "Meet-up" | "Stand artiste RG" | "Stand associatif" | "Conventions";

// Interface pour les données d'événement
export interface EventData {
  name: string;
  location: string;
  date: string;
  startDate: Date;
  endDate: Date;
  startDateFormatted: string;
  endDateFormatted: string;
  description: string;
  type: EventType;
  category: EventCategory;
  position?: { lat: number; lng: number };
  needsGeocoding?: boolean;
}

// Fonction pour déterminer la catégorie d'un événement à partir de sa description
function getCategoryFromDescription(description: string): EventCategory {
  const lowerDesc = description.toLowerCase();

  if (lowerDesc.includes("meet-up") || lowerDesc.includes("meetup")) {
    return "Meet-up";
  } else if (lowerDesc.includes("stand artiste") || lowerDesc.includes("artiste rg")) {
    return "Stand artiste RG";
  } else if (lowerDesc.includes("stand associatif")) {
    return "Stand associatif";
  } else {
    return "Conventions";
  }
}

// Fonction pour géocoder une adresse avec Nominatim (OpenStreetMap)
async function geocodeWithNominatim(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&countrycodes=fr`,
      {
        headers: {
          "User-Agent": "RoseGriffon-Website/1.0",
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error(`Erreur lors du géocodage avec Nominatim: ${error}`);
    return null;
  }
}

// Fonction pour récupérer les événements depuis Google Calendar
async function fetchGoogleCalendarEvents(): Promise<EventData[]> {
  try {
    // Appel à l'API route qui gérera l'authentification et l'appel à Google Calendar API
    const response = await fetch("/api/calendar-events");

    if (!response.ok) {
      throw new Error("Erreur lors de la récupération des événements");
    }

    const data = await response.json();

    // La réponse est encapsulée dans { success: true, data: { events: [] } }
    const eventsData = data.data?.events || [];

    // Vérifier que les événements existent et sont un tableau
    if (!Array.isArray(eventsData)) {
      console.error("Format de réponse invalide:", data);
      return [];
    }

    // Transformer les données Google Calendar en format EventData
    return eventsData.map((event: CalendarEvent) => {
      // Déterminer le type d'événement basé sur la date
      const now = new Date();

      // Gestion des dates (format dateTime ou date)
      let eventStart: Date;
      let eventEnd: Date;

      if (event.start?.dateTime) {
        eventStart = new Date(event.start.dateTime);
      } else if (event.start?.date) {
        eventStart = new Date(event.start.date);
      } else {
        eventStart = new Date(); // Fallback au cas où
      }

      if (event.end?.dateTime) {
        eventEnd = new Date(event.end.dateTime);
      } else if (event.end?.date) {
        eventEnd = new Date(event.end.date);
      } else {
        eventEnd = new Date(); // Fallback au cas où
      }

      let type: EventType = "upcoming";
      if (eventEnd < now) {
        type = "past";
      } else if (eventStart <= now && eventEnd >= now) {
        type = "today";
      }

      // Formater la date pour l'affichage
      const dateOptions: Intl.DateTimeFormatOptions = {
        day: "numeric",
        month: "long",
        year: "numeric",
      };

      const timeOptions: Intl.DateTimeFormatOptions = {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      };

      // Gestion des erreurs de formatage de date
      let formattedDate: string;
      let startDateFormatted: string;
      let endDateFormatted: string;

      try {
        formattedDate = eventStart.toLocaleDateString("fr-FR", dateOptions);

        // Formater les dates de début et de fin avec l'heure si disponible
        if (event.start?.dateTime) {
          startDateFormatted = eventStart.toLocaleString("fr-FR", timeOptions);
        } else {
          startDateFormatted = eventStart.toLocaleDateString("fr-FR", dateOptions);
        }

        if (event.end?.dateTime) {
          endDateFormatted = eventEnd.toLocaleString("fr-FR", timeOptions);
        } else {
          endDateFormatted = eventEnd.toLocaleDateString("fr-FR", dateOptions);
        }

        // Vérifier si les dates sont valides
        if (formattedDate === "Invalid Date") {
          formattedDate = "Date non spécifiée";
          startDateFormatted = "Date non spécifiée";
          endDateFormatted = "Date non spécifiée";
        }
      } catch (error) {
        formattedDate = "Date non spécifiée";
        startDateFormatted = "Date non spécifiée";
        endDateFormatted = "Date non spécifiée";
        console.error("Erreur lors du formatage de la date:", error);
      }

      // Déterminer la catégorie à partir de la description
      const eventCategory = event.description
        ? getCategoryFromDescription(event.description)
        : "Conventions";

      // Extraire les coordonnées de la description (format: lat:48.8566,lng:2.3522)
      let lat = 46.603354; // Centre de la France par défaut
      let lng = 1.888334;
      let coordsFound = false;

      if (event.description) {
        const coordsMatch = event.description.match(/lat:([\d.-]+),lng:([\d.-]+)/);
        if (coordsMatch && coordsMatch.length >= 3 && coordsMatch[1] && coordsMatch[2]) {
          lat = parseFloat(coordsMatch[1]);
          lng = parseFloat(coordsMatch[2]);
          coordsFound = true;
        }
      }

      return {
        name: event.summary || "Événement sans titre",
        location: event.location || "Lieu non précisé",
        date: formattedDate,
        startDate: eventStart,
        endDate: eventEnd,
        startDateFormatted,
        endDateFormatted,
        description: event.description || "Pas de description disponible",
        type,
        category: eventCategory,
        position: { lat, lng },
        needsGeocoding: !coordsFound && !!event.location && event.location.trim() !== "",
      };
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des événements:", error);
    return [];
  }
}

/**
 * Hook pour récupérer les événements depuis Google Calendar
 *
 * @returns {Object} - { events: EventData[], isLoading: boolean }
 */
export function useEvents() {
  const [geocodedEvents, setGeocodedEvents] = useState<EventData[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const { data, isLoading, error } = useQuery<EventData[]>({
    queryKey: ["events"],
    queryFn: fetchGoogleCalendarEvents,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (data) {
      setGeocodedEvents(data);

      const toGeocode = data.filter((e) => e.needsGeocoding);
      if (toGeocode.length > 0) {
        const processGeocoding = async () => {
          setIsGeocoding(true);
          const updated = [...data];

          for (let i = 0; i < updated.length; i++) {
            const current = updated[i];
            if (!current) continue;
            if (current.needsGeocoding) {
              // Rate limit for Nominatim
              if (i > 0) await new Promise((r) => setTimeout(r, 1000));

              const coords = await geocodeWithNominatim(current.location);
              if (coords) {
                updated[i] = { ...current, position: coords, needsGeocoding: false };
              }
            }
          }

          setGeocodedEvents(updated);
          setIsGeocoding(false);
        };
        processGeocoding();
      }
    }
  }, [data]);

  if (error) {
    console.error("Failed to fetch events:", error);
  }

  return {
    events: geocodedEvents.length > 0 ? geocodedEvents : data || [],
    isLoading: isLoading || isGeocoding,
  };
}
