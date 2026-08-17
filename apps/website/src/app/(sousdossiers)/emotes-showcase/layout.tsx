import type { Metadata } from "next";
import type { ReactNode } from "react";

// Page client : voir `../evenements/layout.tsx` pour la raison d'être de ce layout.
export const metadata: Metadata = {
	alternates: { canonical: "https://rosegriffon.fr/emotes-showcase" },
	description:
		"La galerie des émotes Rose Griffon : toutes les illustrations Inazuma Eleven dessinées pour la communauté.",
	openGraph: {
		description:
			"La galerie des émotes Rose Griffon : toutes les illustrations Inazuma Eleven dessinées pour la communauté.",
		title: "Galerie des émotes | Rose Griffon",
		type: "website",
		url: "https://rosegriffon.fr/emotes-showcase",
	},
	title: "Galerie des émotes | Rose Griffon",
};

export default function EmotesShowcaseLayout({ children }: { children: ReactNode }) {
	return children;
}
