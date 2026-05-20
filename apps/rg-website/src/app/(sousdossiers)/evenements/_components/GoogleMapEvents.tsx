"use client";

import { useEffect, useRef } from "react";

import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { GOOGLE_MAPS_ID } from "@/lib/maps";

import type { EventData } from "../useEvents";

interface GoogleMapEventsProps {
  events: EventData[];
  isLoading: boolean;
}

export default function GoogleMapEvents({ events, isLoading }: GoogleMapEventsProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const { isLoaded, loader } = useGoogleMaps();

  useEffect(() => {
    if (!isLoaded || !mapRef.current) {return;}

    const initMap = async () => {
      try {
        const { Map } = await loader.importLibrary("maps");
        const { AdvancedMarkerElement } = (await loader.importLibrary(
          "marker"
        )) as google.maps.MarkerLibrary;

        const mapOptions = {
          center: { lat: 46.603354, lng: 1.888334 }, // Centre de la France
          mapId: GOOGLE_MAPS_ID, // Use the provided Map ID
          zoom: 5,
        };

        const map = new Map(mapRef.current as HTMLElement, mapOptions);
        const bounds = new google.maps.LatLngBounds();
        let hasValidMarkers = false;

        events.forEach((event) => {
          if (!event.position) {return;}

          const markerColor =
            event.type === "upcoming" ? "#22c55e" : (event.type === "today" ? "#3b82f6" : "#ef4444");

          let icon = "RG";
          switch (event.category) {
            case "Meet-up": {
              icon = "M";
              break;
            }
            case "Stand artiste RG": {
              icon = "A";
              break;
            }
            case "Stand associatif": {
              icon = "S";
              break;
            }
            case "Conventions": {
              icon = "C";
              break;
            }
          }

          const markerElement = document.createElement("div");
          markerElement.className = "marker-content";
          markerElement.innerHTML = `
            <div style="background-color: ${markerColor}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
              <span style="font-size: 14px;">${icon}</span>
            </div>
          `;

          const marker = new AdvancedMarkerElement({
            content: markerElement,
            map,
            position: event.position,
            title: event.name,
          });

          const infoContent = `
            <div style="padding: 12px; max-width: 250px; font-family: inherit;">
              <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 4px; color: #111827;">${event.name}</h3>
              <p style="font-size: 13px; color: #4B5563; margin-bottom: 4px;">
                <strong>Date:</strong> ${event.date}
              </p>
              <p style="font-size: 13px; color: #4B5563; margin-bottom: 8px;">
                <strong>Lieu:</strong> ${event.location}
              </p>
              <div style="display: inline-block; padding: 2px 8px; border-radius: 12px; background-color: #F3F4F6; font-size: 11px; font-weight: 600; color: #374151;">
                ${event.category}
              </div>
            </div>
          `;

          const infoWindow = new google.maps.InfoWindow({
            content: infoContent,
          });

          marker.addListener("click", () => {
            infoWindow.open({
              anchor: marker,
              map,
            });
          });

          bounds.extend(event.position);
          hasValidMarkers = true;
        });

        if (hasValidMarkers && events.length > 1) {
          map.fitBounds(bounds);
        }
      } catch (error) {
        console.error("Erreur lors de l'initialisation de la carte:", error);
      }
    };

    initMap();
  }, [events, isLoaded, loader]);

  const showLoading = isLoading || !isLoaded;

  return (
    <div className="relative w-full h-[400px] md:h-[500px] rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-inner bg-gray-50 dark:bg-gray-900">
      {showLoading && (
        <div className="absolute inset-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full size-10 border-b-2 border-blue-600" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {isLoading ? "Localisation des événements..." : "Chargement de la carte..."}
            </p>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
