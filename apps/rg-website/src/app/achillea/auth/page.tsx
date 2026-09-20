import { Suspense } from "react";
import { metadonneesAchillea } from "@/app/achillea/metadonnees";
import AuthClient from "./auth-client";

/*
 * Page serveur : elle n'existe que pour porter `metadata`, que `"use client"`
 * interdit. L'interface, inchangée, vit dans `auth-client.tsx`.
 */
export const metadata = metadonneesAchillea({
	titre: "Connexion Discord",
	description:
		"Connexion au domaine compétitif Achilléa via Discord.",
	chemin: "/achillea/auth",
	indexable: false,
});

export default function AuthPage() {
	return (
		// `useSearchParams` impose une frontière Suspense dès que la page est
		// rendue depuis un composant serveur : sans elle, le build échoue.
		<Suspense fallback={null}>
			<AuthClient />
		</Suspense>
	);
}
