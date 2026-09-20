import { metadonneesAchillea } from "@/app/achillea/metadonnees";
import RankedLeaderboardClient from "./ranked-leaderboard-client";

/*
 * Page serveur : elle n'existe que pour porter `metadata`, que `"use client"`
 * interdit. L'interface, inchangée, vit dans `ranked-leaderboard-client.tsx`.
 */
export const metadata = metadonneesAchillea({
	titre: "Classement ELO",
	description:
		"Le classement des joueurs classés Achilléa en 1v1 et 2v2, recalculé à chaque match.",
	chemin: "/achillea/ranked/leaderboard",
	indexable: true,
});

export default function RankedLeaderboardPage() {
	return <RankedLeaderboardClient />;
}
