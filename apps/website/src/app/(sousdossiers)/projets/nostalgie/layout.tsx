import type { Metadata } from "next";
import type { ReactNode } from "react";

// Page client : voir `../../evenements/layout.tsx` pour la raison d'être de ce layout.
export const metadata: Metadata = {
	alternates: { canonical: "https://rosegriffon.fr/projets/nostalgie" },
	description:
		"Le projet Nostalgie de Rose Griffon : retrouver et remettre en valeur la mémoire visuelle d'Inazuma Eleven en France.",
	openGraph: {
		description:
			"Le projet Nostalgie de Rose Griffon : retrouver et remettre en valeur la mémoire visuelle d'Inazuma Eleven en France.",
		title: "Projet Nostalgie | Rose Griffon",
		type: "website",
		url: "https://rosegriffon.fr/projets/nostalgie",
	},
	title: "Projet Nostalgie | Rose Griffon",
};

export default function ProjetNostalgieLayout({ children }: { children: ReactNode }) {
	return children;
}
