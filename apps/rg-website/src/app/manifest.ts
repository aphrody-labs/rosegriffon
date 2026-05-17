import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rose Griffon - Association Inazuma Eleven France",
    short_name: "Rose Griffon",
    description:
      "Site officiel de l'association Rose Griffon, rassemblant la communauté Inazuma Eleven en France.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#a14b3f",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/RG_Logo_V2.5.webp",
        sizes: "192x192",
        type: "image/webp",
      },
      {
        src: "/RG_Logo_V2.5.webp",
        sizes: "512x512",
        type: "image/webp",
        purpose: "maskable",
      },
    ],
    categories: ["gaming", "social", "entertainment"],
    lang: "fr-FR",
  };
}
