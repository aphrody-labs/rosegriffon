import type { Metadata } from "next";
import type { ReactNode } from "react";

// Page client : voir `../../evenements/layout.tsx` pour la raison d'être de ce layout.
export const metadata: Metadata = {
	alternates: { canonical: "https://rosegriffon.fr/projets/emotes" },
	description:
		"Le projet Émotes de Rose Griffon : des illustrations Inazuma Eleven créées par la communauté, libres d'usage sur Discord et Twitch.",
	openGraph: {
		description:
			"Le projet Émotes de Rose Griffon : des illustrations Inazuma Eleven créées par la communauté, libres d'usage sur Discord et Twitch.",
		title: "Projet Émotes | Rose Griffon",
		type: "website",
		url: "https://rosegriffon.fr/projets/emotes",
	},
	title: "Projet Émotes | Rose Griffon",
};

export default function ProjetEmotesLayout({ children }: { children: ReactNode }) {
	return children;
}
