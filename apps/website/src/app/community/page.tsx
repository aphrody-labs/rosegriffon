import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Skeleton } from "@rosegriffon/ui";

import DiscordSection from "@/components/shared/DiscordSection";

import { parseSearchParams } from "@/lib/validations";
import { cn } from "@/lib/utils";

import AssoMembersSection from "./_components/asso";
import BoardMembersSection from "./_components/board";
import { MembersDirectory } from "./_components/members";
import PartenairesSection from "./_components/PartenairesSection";
import TeamsSection from "./_components/teams";

/**
 * La communauté Rose Griffon — page UNIQUE.
 *
 * POURQUOI LA FUSION
 * `/notre-equipe` (bureau, association, équipes, partenaires) et `/community`
 * (annuaire du Discord) répondaient à la même question — « qui est Rose
 * Griffon ? » — depuis deux entrées de menu, deux hero sections et deux jeux de
 * métadonnées. Elles vivent désormais sous une seule URL, en deux onglets
 * rendus côté serveur (`?vue=`) : pas de JavaScript pour changer d'onglet, et
 * chaque vue reste partageable et indexable.
 *
 * `/notre-equipe` et ses anciennes sous-pages redirigent en 308 (next.config).
 */
export const metadata: Metadata = {
	alternates: { canonical: "https://rosegriffon.fr/community" },
	description:
		"Le bureau, les équipes, les partenaires et les membres du Discord qui font vivre Rose Griffon.",
	openGraph: {
		description:
			"Le bureau, les équipes, les partenaires et les membres du Discord qui font vivre Rose Griffon.",
		images: [
			{
				alt: "Rose Griffon - Association Inazuma Eleven",
				height: 630,
				url: "/opengraph-image.png",
				width: 1200,
			},
		],
		title: "Communauté | Rose Griffon",
		type: "website",
		url: "https://rosegriffon.fr/community",
	},
	title: "Communauté | Rose Griffon",
};

// Les membres sont lus À LA REQUÊTE : figer la page au build servirait une
// liste vide le jour où la lecture échoue au prerender.
export const dynamic = "force-dynamic";

const VUES = [
	{ cle: "equipe", libelle: "L'équipe" },
	{ cle: "membres", libelle: "Les membres" },
] as const;

function SquelettedeSection() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-8 w-56" />
			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				{Array.from({ length: 8 }, (_, index) => (
					<Skeleton className="h-40 rounded-2xl" key={index} />
				))}
			</div>
		</div>
	);
}

export default async function CommunityPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const params = await searchParams;
	const query = typeof params.q === "string" ? params.q : "";
	const { page: currentPage } = parseSearchParams(params);
	const vue = params.vue === "membres" || query ? "membres" : "equipe";

	return (
		<div className="container mx-auto flex flex-col gap-8 px-4 py-10 lg:px-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="space-y-1">
					<h1 className="text-fluid-2xl font-bold text-foreground">Communauté</h1>
					<p className="max-w-2xl text-sm text-muted-foreground">
						Le bureau, les équipes et les partenaires de l&apos;association, et les coachs du
						Discord.
					</p>
				</div>

				<nav aria-label="Vues de la page" className="flex gap-1 rounded-full bg-surface-container p-1">
					{VUES.map((entree) => (
						<Link
							key={entree.cle}
							href={entree.cle === "equipe" ? "/community" : "/community?vue=membres"}
							aria-current={vue === entree.cle ? "page" : undefined}
							className={cn(
								"rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
								vue === entree.cle
									? "bg-primary text-on-primary"
									: "text-on-surface-variant hover:text-on-surface"
							)}
						>
							{entree.libelle}
						</Link>
					))}
				</nav>
			</header>

			{vue === "membres" ? (
				<div className="flex flex-col gap-8">
					{/* Le bloc Discord vivait sur l'accueil, où il arrivait après quatre
					    écrans de défilement. Il est ici à sa place : au-dessus des gens
					    qu'il permet de rejoindre. */}
					<DiscordSection
						titre="Rejoignez la communauté"
						sousTitre="Discutez, jouez et suivez l'actualité avec les autres coachs."
						accroche="Le cœur de la communauté"
					/>
					<Suspense fallback={<SquelettedeSection />}>
						<MembersDirectory query={query} currentPage={currentPage} />
					</Suspense>
				</div>
			) : (
				<div className="flex flex-col gap-12">
					{/* Chaque section garde son `Suspense` : une source lente ne retient
					    pas les autres. */}
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
			)}
		</div>
	);
}
