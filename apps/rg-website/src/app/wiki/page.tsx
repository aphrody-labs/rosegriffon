import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { AnimatedSection } from "@/components/home/AnimatedSection";
import { LandingHero } from "@/components/home/LandingHero";
import { LatestNewsSection } from "@/components/home/LatestNewsSection";
import { NetworkSection } from "@/components/home/NetworkSection";
import { WikiCarousel } from "@/components/home/WikiCarousel";
import type { WikiSectionStats } from "@/components/home/WikiCarousel";
import { getPgPool } from "@/lib/db/pg";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	alternates: { canonical: "https://rosegriffon.fr/wiki" },
	description:
		"Base de données complète Inazuma Eleven: Victory Road. Joueurs, techniques, objets, esprits guerriers et actualités décryptées.",
	openGraph: {
		title: "Azalée - Encyclopédie Inazuma Eleven: Victory Road | Rose Griffon",
		description:
			"L'information la plus précise autour d'Inazuma Eleven: Victory Road. Stats, fiches, techniques et actualités en français.",
		url: "https://rosegriffon.fr/wiki",
		siteName: "Azalée Rose Griffon",
		locale: "fr_FR",
		type: "website",
		images: [
			{
				url: "https://azalee.rosegriffon.fr/opengraph-image.png",
				width: 1200,
				height: 630,
				alt: "Azalée Wiki Inazuma Eleven",
			},
		],
	},
	title: "Azalée — Encyclopédie Inazuma Eleven: Victory Road",
	twitter: {
		card: "summary_large_image",
		creator: "@Azalee_IE",
		description: "L'information la plus précise autour d'Inazuma Eleven: Victory Road.",
		site: "@Azalee_IE",
		title: "Azalée — Encyclopédie Inazuma Eleven",
	},
};

export const revalidate = 60;

export default async function WikiHomePage() {
	const supabase = await createClient();
	const pool = getPgPool();

	const [
		{ rows: pinnedArticles },
		{ rows: latestArticles },
		{ rows: latestTweets },
		{ count: charactersCount },
		{ count: skillsCount },
		{ count: itemsCount },
		{ count: keshinsCount },
		{ count: soulsCount },
		{ count: passivesCount },
	] = await Promise.all([
		pool.query(
			`SELECT * FROM articles
			 WHERE status = $1 AND app = $2
			 ORDER BY published_at DESC
			 LIMIT 1`,
			["published", "azalee"]
		),
		pool.query(
			`SELECT * FROM articles
			 WHERE status = $1 AND app = $2
			 ORDER BY published_at DESC
			 LIMIT 3 OFFSET 1`,
			["published", "azalee"]
		),
		pool.query(
			`SELECT id, text, translation, created_at, author_username, author_name, media
			 FROM tweets
			 WHERE author_username = $1
			 ORDER BY created_at DESC
			 LIMIT 6`,
			["Azalee_IE"]
		),
		supabase.from("inagle_characters").select("id", { count: "exact", head: true }),
		supabase.from("inagle_skills").select("id", { count: "exact", head: true }),
		supabase.from("inagle_items").select("id", { count: "exact", head: true }),
		supabase.from("inagle_keshins_clean").select("id", { count: "exact", head: true }),
		supabase.from("inagle_souls_clean").select("id", { count: "exact", head: true }),
		supabase.from("inagle_passives").select("id", { count: "exact", head: true }),
	]);

	const pinned = (pinnedArticles || []) as any[];
	const latest = (latestArticles || []) as any[];
	const standardNews = [...pinned, ...latest].slice(0, 3);
	const recentTweets = (latestTweets || []) as any[];

	const wikiStats: WikiSectionStats = {
		characters: charactersCount ?? 0,
		items: itemsCount ?? 0,
		keshins: keshinsCount ?? 0,
		passives: passivesCount ?? 0,
		skills: skillsCount ?? 0,
		souls: soulsCount ?? 0,
	};

	return (
		<div className="animate-in fade-in duration-700">
			{/*
			 * Hero interactif de l'encyclopédie Azalée.
			 *
			 * LA GOUTTIÈRE QUI MANQUAIT
			 * `LandingHero` est un composant partagé avec `apps/azalee`, où le
			 * `Shell` d'`@rosegriffon/app-shell` enveloppe les pages dans
			 * `px-4 md:px-8 lg:px-12` : son `-mx-4 md:-mx-8 lg:-mx-12` annule
			 * exactement cette gouttière pour obtenir un plein cadre. Ici, la zone
			 * de contenu (`#main-content` dans `client-layout.tsx`) n'a aucune
			 * gouttière horizontale, et ces marges négatives débordaient donc sous
			 * le rail de navigation, où `overflow-x: hidden` les rognait. Mesuré en
			 * production sur `rosegriffon.fr/wiki` à 780 px de large : zone de
			 * contenu à `left: 160px` (605 px), `<section>` du hero à `left: 128px`
			 * (669 px, soit 32 px hors cadre de chaque côté) et `h1` à `left: 125px`
			 * — les 35 premiers pixels de chaque ligne du titre étaient coupés
			 * (« L'information la plus précise autour d'Inazuma Eleven. »).
			 *
			 * Rétablir la gouttière attendue recale le hero sur la largeur exacte de
			 * la zone de contenu (bord du rail à droite de l'écran) à toutes les
			 * tailles, sans toucher au composant partagé ni à son `overflow-hidden`,
			 * qui borne le fond en Ken Burns.
			 */}
			<div className="px-4 md:px-8 lg:px-12">
				<LandingHero stats={wikiStats} />
			</div>

			{/* Contenu principal */}
			<div
				id="home-content"
				className="space-y-6 md:space-y-12 pb-20 mt-8 md:mt-16 max-w-[1800px] mx-auto scroll-mt-24 px-4 sm:px-6 lg:px-8"
			>
				{/* Dernières actualités Azalée */}
				<AnimatedSection direction="up">
					<section className="md:px-4 lg:px-8">
						<Suspense
							fallback={<div className="h-96 animate-pulse bg-muted rounded-3xl" />}
						>
							<LatestNewsSection articles={standardNews} tweets={recentTweets} />
						</Suspense>
					</section>
				</AnimatedSection>

				{/* Séparateur élégant */}
				<div className="flex items-center gap-4 px-8 md:hidden" aria-hidden="true">
					<div className="flex-1 h-px bg-outline-variant/20" />
					<Image src="/logo.webp" alt="" width={20} height={20} className="size-5 opacity-30" />
					<div className="flex-1 h-px bg-outline-variant/20" />
				</div>

				{/* Carousel des catégories de l'encyclopédie */}
				<AnimatedSection direction="scale" delay={0.1}>
					<WikiCarousel stats={wikiStats} />
				</AnimatedSection>

				{/* Réseau Rose Griffon */}
				<AnimatedSection direction="up" delay={0.05}>
					<NetworkSection />
				</AnimatedSection>
			</div>
		</div>
	);
}
