import { metadonneesAchillea } from "@/app/achillea/metadonnees";
import TournamentsClient from "./tournaments-client";

/*
 * Page serveur : elle n'existe que pour porter `metadata`, que `"use client"`
 * interdit. L'interface, inchangée, vit dans `tournaments-client.tsx`.
 */
export const metadata = metadonneesAchillea({
	titre: "Tournois",
	description:
		"Tous les tournois Achilléa : préinscriptions ouvertes, rencontres en cours et éditions terminées.",
	chemin: "/achillea/tournaments",
	indexable: true,
});

export default function TournamentsPage() {
	return <TournamentsClient />;
}
