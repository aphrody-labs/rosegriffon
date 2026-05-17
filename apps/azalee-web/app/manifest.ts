import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Azalée",
    short_name: "Azalée",
    description: "L'information la plus précise sur Inazuma Eleven: Victory Road.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#19120D",
    theme_color: "#FFB700",
    icons: [
      {
        src: "/icon.webp",
        sizes: "192x192",
        type: "image/webp",
      },
      {
        src: "/icon.webp",
        sizes: "512x512",
        type: "image/webp",
      },
      {
        src: "/icon.webp",
        sizes: "512x512",
        type: "image/webp",
        purpose: "maskable",
      },
    ],
    orientation: "portrait",
    display_override: ["window-controls-overlay"],
    categories: ["entertainment", "sports", "games"],
    lang: "fr",
    dir: "ltr",
    prefer_related_applications: false,
  };
}
