import { metadonneesAchillea } from "@/app/achillea/metadonnees";
import ClansClient from "./clans-client";

/*
 * Page serveur : elle n'existe que pour porter `metadata`, que `"use client"`
 * interdit. L'interface, inchangée, vit dans `clans-client.tsx`.
 */
export const metadata = metadonneesAchillea({
	titre: "Clans compétitifs",
	description:
		"Les clans Achilléa d'Inazuma Eleven: Victory Road : recrutement ouvert, langues parlées, niveau et notoriété.",
	chemin: "/achillea/clans",
	indexable: true,
});

export default function ClansPage() {
	return <ClansClient />;
}
