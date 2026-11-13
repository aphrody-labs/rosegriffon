"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";

import { EPITA_COORDS, EPITA_PLACE_ID } from "@/lib/maps";

/** Carte de l'EPITA sur tuiles OpenStreetMap (Leaflet), sans clé ni facturation. */
export default function GoogleMapEpita() {
  const mapRef = useRef<HTMLDivElement>(null);

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
      const at: [number, number] = [EPITA_COORDS.lat, EPITA_COORDS.lng];
      map = L.map(el, { scrollWheelZoom: false }).setView(at, 18);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      const icon = L.divIcon({
        className: "",
        html: '<div style="background:#1d4ed8;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #1e3a8a"></div>',
        iconAnchor: [14, 28],
        iconSize: [28, 28],
      });
      L.marker(at, { icon, title: "EPITA Kremlin-Bicêtre" })
        .addTo(map)
        .on("click", () => {
          window.open(
            `https://www.google.com/maps/search/?api=1&query=EPITA&query_place_id=${EPITA_PLACE_ID}`,
            "_blank",
            "noopener",
          );
        });
    });

    return () => {
      disposed = true;
      map?.remove();
    };
  }, []);

  return (
    <section
      ref={mapRef}
      className="w-full h-[500px] rounded-xl shadow-lg border border-gray-200 overflow-hidden"
      aria-label="Carte de localisation de l'EPITA"
    />
  );
}
