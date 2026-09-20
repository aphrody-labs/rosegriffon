import { metadonneesAchillea } from "@/app/achillea/metadonnees";
import RankedHistoryClient from "./ranked-history-client";

/*
 * Page serveur : elle n'existe que pour porter `metadata`, que `"use client"`
 * interdit. L'interface, inchangée, vit dans `ranked-history-client.tsx`.
 */
export const metadata = metadonneesAchillea({
	titre: "Historique de mes matchs classés",
	description:
		"Vos parties classées Achilléa, le détail des gains et pertes d'ELO match après match.",
	chemin: "/achillea/ranked/history",
	indexable: false,
});

export default function RankedHistoryPage() {
	return <RankedHistoryClient />;
}
