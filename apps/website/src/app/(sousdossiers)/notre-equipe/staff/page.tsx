import type { Metadata } from "next";
import { Suspense } from "react";

import TeamsSection from "../_components/teams";
import { TeamSectionSkeleton } from "./team-skeleton";

export const metadata: Metadata = {
	description:
		"Découvrez les talents qui donnent vie à l'univers de Rose Griffon. Notre équipe passionnée de créateurs, artistes et producteurs.",
	title: "Notre Équipe - Staff | Rose Griffon",
	alternates: { canonical: "https://rosegriffon.fr/notre-equipe/staff" },
	openGraph: {
		title: "Notre Équipe - Staff | Rose Griffon",
		description:
			"Découvrez les talents qui donnent vie à l'univers de Rose Griffon : créateurs, artistes, dessinateurs et producteurs.",
		url: "https://rosegriffon.fr/notre-equipe/staff",
		type: "website",
		images: [
			{
				url: "/opengraph-image.png",
				width: 1200,
				height: 630,
				alt: "Rose Griffon - Association Inazuma Eleven",
			},
		],
	},
};

// Rendu dynamique : les membres sont fetchés côté serveur À LA REQUÊTE (env
// runtime garanti). Évite de figer une page vide si le fetch Supabase échoue au
// moment du build/prerender (cohérent avec /association et /partenaires).
export const dynamic = "force-dynamic";

export default function StaffPage() {
	return (
		<div className="min-h-screen">
			{/* Background gradient */}
			<div className="absolute inset-0 bg-linear-to-b from-gaelle-blue/5 via-transparent to-gaelle-blue-light/5 pointer-events-none" />

			<div className="relative container mx-auto py-12 lg:py-20 px-4 lg:px-8">
				<Suspense fallback={<TeamSectionSkeleton />}>
					<TeamsSection />
				</Suspense>
			</div>
		</div>
	);
}
