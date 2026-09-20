import { metadonneesAchillea } from "@/app/achillea/metadonnees";
import RankedTiersClient from "./ranked-tiers-client";

/*
 * Page serveur : elle n'existe que pour porter `metadata`, que `"use client"`
 * interdit. L'interface, inchangée, vit dans `ranked-tiers-client.tsx`.
 */
export const metadata = metadonneesAchillea({
	titre: "Paliers de classement",
	description:
		"Les onze paliers Achilléa, de Fer à Légendaire : seuils d'ELO et répartition réelle des joueurs.",
	chemin: "/achillea/ranked/tiers",
	indexable: true,
});

export default function RankedTiersPage() {
	return <RankedTiersClient />;
}
