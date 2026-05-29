import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		background_color: "#ffffff",
		categories: ["gaming", "social", "entertainment"],
		description:
			"Site officiel de l'association Rose Griffon, rassemblant la communauté Inazuma Eleven en France.",
		display: "standalone",
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
		lang: "fr-FR",
		name: "Rose Griffon - Association Inazuma Eleven France",
		orientation: "portrait-primary",
		short_name: "Rose Griffon",
		start_url: "/",
		theme_color: "#a14b3f",
	};
}
