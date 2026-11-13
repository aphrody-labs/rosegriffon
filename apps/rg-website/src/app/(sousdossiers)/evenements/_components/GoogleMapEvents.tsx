"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";

import type { EventData } from "../useEvents";

interface GoogleMapEventsProps {
  events: EventData[];
  isLoading: boolean;
}

const FRANCE: [number, number] = [46.603354, 1.888334];

const CATEGORY_ICON: Record<string, string> = {
  Conventions: "C",
  "Meet-up": "M",
  "Stand artiste RG": "A",
  "Stand associatif": "S",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Carte des événements sur tuiles OpenStreetMap (Leaflet) : pas de clé ni de facturation,
 * le géocodage passe déjà par Nominatim. Les champs d'événement sont échappés avant
 * d'entrer dans le HTML des marqueurs et des infobulles.
 */
export default function GoogleMapEvents({
  events,
  isLoading,
}: GoogleMapEventsProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) {
      return;
    }
    let disposed = false;
    let map: import("leaflet").Map | undefined;

    void import("leaflet").then((L) => {
      if (disposed) {
        return;
      }
      map = L.map(el, { scrollWheelZoom: false }).setView(FRANCE, 5);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const points: [number, number][] = [];
      for (const event of events) {
        if (!event.position) {
          continue;
        }
        const color =
          event.type === "upcoming"
            ? "var(--rg-succes)"
            : event.type === "today"
              ? "var(--rg-info)"
              : "var(--destructive)";
        const icon = L.divIcon({
          className: "",
          html: `<div style="background-color:${color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--rg-sur-marine);font-weight:bold;font-size:14px;border:2px solid var(--rg-sur-marine)">${CATEGORY_ICON[event.category] ?? "RG"}</div>`,
          iconAnchor: [16, 16],
          iconSize: [32, 32],
        });
        const at: [number, number] = [event.position.lat, event.position.lng];
        points.push(at);
        L.marker(at, { icon, title: event.name })
          .addTo(map)
          .bindPopup(
            `<div style="max-width:250px"><h3 style="font-size:16px;font-weight:700;margin:0 0 4px">${escapeHtml(event.name)}</h3>` +
              `<p style="font-size:13px;margin:0 0 4px"><strong>Date :</strong> ${escapeHtml(event.date)}</p>` +
              `<p style="font-size:13px;margin:0 0 8px"><strong>Lieu :</strong> ${escapeHtml(event.location)}</p>` +
              `<span style="font-size:11px;font-weight:600">${escapeHtml(event.category)}</span></div>`,
          );
      }
      if (points.length > 1) {
        map.fitBounds(points, { padding: [32, 32] });
      }
      setIsLoaded(true);
    });

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [events]);

  const showLoading = isLoading || !isLoaded;

  return (
    <div className="relative w-full h-[400px] md:h-[500px] rounded-2xl overflow-hidden border-2 border-border shadow-inner bg-muted/40">
      {showLoading && (
        <div className="absolute inset-0 z-[1000] bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full size-10 border-b-2 border-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              {isLoading
                ? "Localisation des événements..."
                : "Chargement de la carte..."}
            </p>
          </div>
        </div>
      )}
      <section
        ref={mapRef}
        className="w-full h-full"
        aria-label="Carte des événements"
      />
    </div>
  );
}
