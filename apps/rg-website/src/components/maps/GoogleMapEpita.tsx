"use client";

import { useEffect, useRef } from "react";

import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { EPITA_COORDS, EPITA_PLACE_ID, GOOGLE_MAPS_ID } from "@/lib/maps";

export default function GoogleMapEpita() {
  const mapRef = useRef<HTMLDivElement>(null);
  const { isLoaded, error, loader } = useGoogleMaps();

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const initMap = async () => {
      try {
        const { Map } = await loader.importLibrary("maps");
        const { AdvancedMarkerElement, PinElement } = (await loader.importLibrary(
          "marker"
        )) as google.maps.MarkerLibrary;

        const map = new Map(mapRef.current as HTMLElement, {
          center: EPITA_COORDS,
          zoom: 18, // Zoom élevé pour voir les bâtiments
          mapId: GOOGLE_MAPS_ID,
          disableDefaultUI: false,
          gestureHandling: "cooperative", // Meilleure UX sur mobile
        });

        // Personnalisation du pin pour correspondre à l'identité visuelle (optionnel)
        const pin = new PinElement({
          background: "#1d4ed8", // blue-700
          borderColor: "#1e3a8a", // blue-900
          glyphColor: "white",
        });

        // Création du marqueur avancé
        const marker = new AdvancedMarkerElement({
          map,
          position: EPITA_COORDS,
          title: "EPITA Kremlin-Bicêtre",
          content: pin.element,
        });

        // Ajout d'un événement au clic pour ouvrir Google Maps avec le Place ID spécifique
        marker.addListener("click", () => {
          const url = `https://www.google.com/maps/search/?api=1&query=EPITA&query_place_id=${EPITA_PLACE_ID}`;
          window.open(url, "_blank");
        });
      } catch (e) {
        console.error("Erreur lors du chargement de Google Maps:", e);
      }
    };

    initMap();
  }, [isLoaded, loader]);

  if (error) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-gray-50 rounded-xl border border-red-200">
        <p className="text-red-600 font-medium px-4 text-center">
          Impossible de charger la carte. Vérifiez votre connexion ou la clé API.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full h-[500px] rounded-xl shadow-lg border border-gray-200 overflow-hidden"
      aria-label="Carte de localisation de l'EPITA"
    />
  );
}
