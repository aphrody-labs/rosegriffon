import { metadonneesAchillea } from "@/app/achillea/metadonnees";
import RankedHistoryClient from "./ranked-history-client";

/*
 * Page serveur : elle n'existe que pour porter `metadata`, que `"use client"`
 * interdit. L'interface, inchangée, vit dans `ranked-history-client.tsx`.
 */
export const metadata = metadonneesAchillea({
	titre: "Historique des matchs classés",
	description:
		"Résultats classés Achilléa, scores et variations de points match après match.",
	chemin: "/achillea/ranked/history",
	indexable: false,
});

export default async function RankedHistoryPage({ searchParams }: { searchParams: Promise<{ player?: string }> }) {
	const { player } = await searchParams;
	return <RankedHistoryClient playerId={player || undefined} />;
}
