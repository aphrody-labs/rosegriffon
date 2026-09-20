import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@rosegriffon/ui";

import AssoMembersSection from "./_components/asso";
import BoardMembersSection from "./_components/board";
import TeamsSection from "./_components/teams";
import PartenairesSection from "./partenaires/PartenairesSection";

/**
 * Qui fait Rose Griffon — page UNIQUE.
 *
 * POURQUOI LA FUSION
 * Trois pages décrivaient la même chose découpée : `/notre-equipe/association`
 * (bureau + membres de l'association), `/notre-equipe/staff` (créateurs) et
 * `/notre-equipe/partenaires`. Trois entrées de menu, trois métadonnées, trois
 * squelettes — et pour le visiteur, trois clics pour répondre à une seule
 * question. `/notre-equipe` était d'ailleurs une simple redirection vers
 * `/association` : la page d'accueil du sujet n'existait pas.
 *
 * Les trois sections vivent maintenant l'une sous l'autre. Chacune garde son
 * `Suspense` : une source lente ou en panne ne retient pas les deux autres, ce
 * qui était l'intérêt du découpage et qu'on conserve sans le payer en
 * navigation.
 *
 * Les anciennes URL redirigent : elles sont indexées et partagées.
 */
export const metadata: Metadata = {
	alternates: { canonical: "https://rosegriffon.fr/notre-equipe" },
	description:
		"Le bureau, les membres de l'association, les créateurs et les partenaires qui font vivre Rose Griffon.",
	openGraph: {
		description:
			"Le bureau, les membres de l'association, les créateurs et les partenaires qui font vivre Rose Griffon.",
		images: [
			{
				alt: "Rose Griffon - Association Inazuma Eleven",
				height: 630,
				url: "/opengraph-image.png",
				width: 1200,
			},
		],
		title: "Notre équipe | Rose Griffon",
		type: "website",
		url: "https://rosegriffon.fr/notre-equipe",
	},
	title: "Notre équipe | Rose Griffon",
};

// Les membres sont lus côté serveur À LA REQUÊTE : figer la page au build
// servirait une liste vide le jour où la lecture échoue au prerender.
export const dynamic = "force-dynamic";

function SquelettedeSection() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-10 w-64" />
			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				{Array.from({ length: 8 }, (_, index) => (
					<Skeleton className="h-48 rounded-2xl" key={index} />
				))}
			</div>
		</div>
	);
}

export default function NotreEquipePage() {
	return (
		<div className="min-h-screen">
			<div className="container mx-auto space-y-16 px-4 py-12 lg:px-8 lg:py-20">
				<header className="space-y-3 text-center">
					<h1 className="text-fluid-3xl font-bold text-foreground">Notre équipe</h1>
					<p className="mx-auto max-w-2xl text-muted-foreground">
						Le bureau, les membres de l&apos;association, les créateurs et les partenaires qui font
						vivre Rose Griffon.
					</p>
				</header>

				<Suspense fallback={<SquelettedeSection />}>
					<BoardMembersSection />
				</Suspense>

				<Suspense fallback={<SquelettedeSection />}>
					<AssoMembersSection />
				</Suspense>

				<Suspense fallback={<SquelettedeSection />}>
					<TeamsSection />
				</Suspense>

				<Suspense fallback={<SquelettedeSection />}>
					<PartenairesSection />
				</Suspense>
			</div>
		</div>
	);
}
