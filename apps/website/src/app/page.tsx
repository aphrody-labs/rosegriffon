import type { Metadata } from "next";
import dynamicImport from "next/dynamic";
import { Suspense } from "react";

// ISR : HTML cached, regen toutes les 60s en arrière-plan.
// Le user-menu et autres parties auth-aware vivent dans `client-layout.tsx`
// (use client, hydraté côté client) — la home ne dépend que de settings + events
// Et `RealtimeSettingsListener` propage les updates settings via Supabase Realtime.
export const revalidate = 60;

import { AchilleaBanner } from "@/components/home/AchilleaBanner";
import { AzaleeBanner } from "@/components/home/AzaleeBanner";
import { NextEventBanner } from "@/components/home/NextEventBanner";
import { RgtvBanner } from "@/components/home/RgtvBanner";
import { FeaturedTweets } from "@/components/shared/FeaturedTweets";
import { LatestChroniqueSection } from "@/components/shared/LatestChroniqueSection";
import { MotionSection } from "@/components/shared/MotionSection";
import { RealtimeSettingsListener } from "@/components/shared/RealtimeSettingsListener";
import { OrganizationSchema, WebsiteSchema } from "@/components/shared/StructuredData";

import FusionBlock from "@/components/shared/FusionBlock";
import { getCalendarEvents } from "@/lib/api/events";
import { getPublicSetting } from "@/lib/api/settings";

// Lazy loading pour composants lourds (below-the-fold).
// Les squelettes utilisent `bg-muted` : un dégradé `gray-*` resterait clair sur
// le thème Azalée sombre.
const ProjectsSection = dynamicImport(() => import("@/components/shared/ProjectsSection"), {
	loading: () => <div className="h-96 animate-pulse rounded-3xl bg-muted" />,
});

const DiscordSection = dynamicImport(() => import("@/components/shared/DiscordSection"), {
	loading: () => <div className="h-64 animate-pulse rounded-3xl bg-muted sm:h-72" />,
});

export const metadata: Metadata = {
	alternates: {
		canonical: "https://rosegriffon.fr",
	},
	description:
		"Association française Inazuma Eleven : événements, streaming et communauté passionnée depuis 2019. Rejoignez la communauté !",
	keywords: [
		"Rose Griffon",
		"Inazuma Eleven",
		"association",
		"France",
		"streaming",
		"événements",
		"communauté",
		"RGTV",
	],
	openGraph: {
		description:
			"Association française Inazuma Eleven : événements, streaming et communauté passionnée depuis 2019",
		images: [
			{
				// Fichier statique app/opengraph-image.png = capture HD plein écran de la home.
				// Servi uniquement à /opengraph-image.png (sans extension = 404, cf. azalee idem).
				url: "/opengraph-image.png",
				width: 1200,
				height: 630,
				alt: "Rose Griffon - Association Inazuma Eleven",
			},
		],
		locale: "fr_FR",
		siteName: "Rose Griffon",
		title: "Rose Griffon - Association Inazuma Eleven France",
		type: "website",
		url: "https://rosegriffon.fr",
	},
	robots: {
		follow: true,
		googleBot: {
			follow: true,
			index: true,
			"max-image-preview": "large",
			"max-snippet": -1,
			"max-video-preview": -1,
		},
		index: true,
	},
	title: "Rose Griffon - Association Inazuma Eleven France",
	twitter: {
		card: "summary_large_image",
		creator: "@rose_griffon",
		description:
			"Association française Inazuma Eleven : événements, streaming et communauté passionnée",
		site: "@rose_griffon",
		title: "Rose Griffon - Association Inazuma Eleven France",
	},
};

export default async function Home() {
	// Fetch Settings
	const [
		// Intro
		introTitle,
		introText,
		introImage,
		// RGTV
		rgtvTitle,
		rgtvSubtitle,
		rgtvDescription,
		rgtvImage,
		rgtvButtonText,
		rgtvLink,
		// Azalee
		azaleeTitle,
		azaleeTag,
		azaleeDescription,
		azaleeImage,
		azaleeLogo,
		azaleeTwitter,
		azaleeInstagram,
		// Achillea
		achilleaDescription,
		achilleaImage,
		achilleaLink,
		achilleaDiscord,
		// Community
		communityTitle,
		communitySubtitle,
		communityDescription,
		// Events
		events,
	] = await Promise.all([
		// Intro Defaults
		getPublicSetting("home_intro_title", "Qu'est-ce que Rose Griffon ?"),
		getPublicSetting(
			"home_intro_text",
			"Rose Griffon est une association française régie par la loi de 1901, ayant pour vocation de rassembler les principaux acteurs de la communauté Inazuma Eleven ainsi que l'ensemble des passionnés sous une même bannière. Elle s'engage à valoriser à la fois la scène artistique liée à cette licence et son univers compétitif."
		),
		getPublicSetting("home_intro_image", "/RG_screens_twitch_ethan.webp"),
		// RGTV Defaults
		getPublicSetting("home_rgtv_title", "RG TV"),
		getPublicSetting("home_rgtv_subtitle", "WebTV Officielle"),
		getPublicSetting(
			"home_rgtv_description",
			"Votre rendez-vous quotidien Inazuma Eleven ! Retrouvez nos streamers sur Twitch et YouTube pour des sessions de jeu, des tournois commentés et de la bonne humeur."
		),
		getPublicSetting("home_rgtv_image", "/rgtv/affiche.webp"),
		getPublicSetting("home_rgtv_button_text", "ACCÉDER À LA WEBTV"),
		getPublicSetting("home_rgtv_link", "/rose-griffon-tv"),
		// Azalee Defaults
		getPublicSetting("home_azalee_title", "AZALÉE"),
		getPublicSetting("home_azalee_tag", "Actualités"),
		getPublicSetting(
			"home_azalee_description",
			"Le pilier médiatique de Rose Griffon. Ne ratez aucune info sur Victory Road : traductions exclusives, interviews, analyses et couverture complète de l'actualité de la licence."
		),
		getPublicSetting("home_azalee_image", "https://azalee.rosegriffon.fr/opengraph-image.png"),
		getPublicSetting("home_azalee_logo", "/RG_Azalee-logo.webp"),
		getPublicSetting("home_azalee_twitter", "https://x.com/Azalee_IE"),
		getPublicSetting("home_azalee_instagram", "https://www.instagram.com/azaleefr/"),
		// Achillea Defaults
		getPublicSetting(
			"home_achillea_description",
			"Le carrefour de l'esport Inazuma Eleven ! Gestion de clans, tournois, matchs classés, ranking communautaire et bot officiel."
		),
		getPublicSetting("home_achillea_image", "https://achillea.rosegriffon.fr/opengraph-image"),
		getPublicSetting("home_achillea_link", "https://achillea.rosegriffon.fr/"),
		getPublicSetting(
			"home_achillea_discord",
			"https://discord.gg/achillea-competitif-inazuma-eleven-fr-1055585286320554055"
		),
		// Community Defaults
		getPublicSetting("home_community_title", "Rejoignez la communauté"),
		getPublicSetting(
			"home_community_subtitle",
			"Rose Griffon est partout ! Discutez sur Discord et suivez notre actualité sur les réseaux."
		),
		getPublicSetting("home_community_description", "Le cœur de la communauté"),
		// Events
		getCalendarEvents(),
	]);

	// Logique pour trouver le prochain événement
	const now = new Date();
	// Filtrer les événements futurs ou en cours
	const upcomingEvents = events.filter((e) => {
		// Utiliser la date de fin pour inclure les événements en cours
		const endDate = e.end?.dateTime || e.end?.date;
		const startDate = e.start?.dateTime || e.start?.date;

		// Si pas de date de fin, utiliser la date de début
		const targetDate = endDate ? new Date(endDate) : startDate ? new Date(startDate) : null;

		return targetDate && targetDate >= now;
	});

	// Trier par date de début la plus proche
	upcomingEvents.sort((a, b) => {
		const aStart = new Date(a.start?.dateTime || a.start?.date || 0).getTime();
		const bStart = new Date(b.start?.dateTime || b.start?.date || 0).getTime();
		return aStart - bStart;
	});

	const nextEvent = upcomingEvents[0];

	return (
		<>
			<OrganizationSchema />
			<WebsiteSchema />
			<RealtimeSettingsListener />
			<div className="flex flex-col min-h-screen">
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-lg focus:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-primary"
				>
					Aller au contenu principal
				</a>

				<div
					id="main-content"
					className="flex flex-col gap-4 md:gap-6 lg:gap-8 pb-12 md:pb-16 lg:pb-20 pt-2 md:pt-4 will-change-scroll"
				>
					<MotionSection
						className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 w-full"
						aria-labelledby="about-heading"
					>
						{/* Affichage du prochain événement s'il existe */}
						{nextEvent && <NextEventBanner event={nextEvent} />}

						<FusionBlock isImageLeft image={introImage} isPriority>
							<div className="space-y-2 sm:space-y-3 lg:space-y-4 flex flex-col justify-center h-full">
								<h1
									id="about-heading"
									className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold leading-tight text-foreground"
								>
									{introTitle}
								</h1>
								<p className="text-sm sm:text-base md:text-lg leading-relaxed text-muted-foreground">
									{introText}
								</p>
							</div>
						</FusionBlock>
					</MotionSection>

					{/* RGTV masqué de la homepage (réactivable en remettant true). */}
					{false && (
						<MotionSection
							className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 w-full"
							aria-labelledby="rgtv-heading"
						>
							<RgtvBanner
								title={rgtvTitle}
								subtitle={rgtvSubtitle}
								description={rgtvDescription}
								image={rgtvImage}
								buttonText={rgtvButtonText}
								link={rgtvLink}
							/>
						</MotionSection>
					)}

					<MotionSection
						className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 w-full"
						aria-labelledby="azalee-heading"
					>
						<AzaleeBanner
							title={azaleeTitle}
							tag={azaleeTag}
							description={azaleeDescription}
							image={azaleeImage}
							logo={azaleeLogo}
							twitterLink={azaleeTwitter}
							instagramLink={azaleeInstagram}
						/>
					</MotionSection>

					<MotionSection
						className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 w-full"
						aria-labelledby="achillea-heading"
					>
						<AchilleaBanner
							description={achilleaDescription}
							image={achilleaImage}
							link={achilleaLink}
							discordLink={achilleaDiscord}
						/>
					</MotionSection>

					<Suspense fallback={null}>
						<LatestChroniqueSection />
					</Suspense>

					<MotionSection id="projets-section" aria-labelledby="projects-heading">
						<ProjectsSection />
					</MotionSection>

					{/* Section Réseaux Sociaux & Communauté */}

					<MotionSection
						className="w-full space-y-4 md:space-y-8 lg:space-y-10"
						aria-labelledby="community-heading"
					>
						{/* Implémentation unique du bloc Discord : titre, widget et CTA. */}
						<DiscordSection
							titre={communityTitle}
							sousTitre={communitySubtitle}
							accroche={communityDescription}
						/>

						{/* Tweets à la une */}

						<div className="w-full">
							<FeaturedTweets />
						</div>
					</MotionSection>

					{/* Section Dernière Chronique */}
				</div>
			</div>
		</>
	);
}
