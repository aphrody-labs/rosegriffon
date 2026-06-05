import { Button } from "@rose-griffon/ui";
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
import RgEmote from "@/components/shared/emotes/RgEmote";
import { FeaturedTweets } from "@/components/shared/FeaturedTweets";
import { LatestChroniqueSection } from "@/components/shared/LatestChroniqueSection";
import { MotionSection } from "@/components/shared/MotionSection";
import { RealtimeSettingsListener } from "@/components/shared/RealtimeSettingsListener";
import { OrganizationSchema, WebsiteSchema } from "@/components/shared/StructuredData";

import FusionBlock from "@/components/shared/FusionBlock";
import { getCalendarEvents } from "@/lib/api/events";
import { getPublicSetting } from "@/lib/api/settings";

// Lazy loading pour composants lourds (below-the-fold)
const ProjectsSection = dynamicImport(() => import("@/components/shared/ProjectsSection"), {
	loading: () => (
		<div className="h-96 animate-pulse bg-linear-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-3xl" />
	),
});

const DiscordBlock = dynamicImport(() => import("@/components/shared/DiscordBlock"), {
	loading: () => (
		<div className="h-64 sm:h-72 animate-pulse bg-linear-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-3xl" />
	),
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
				// Convention /opengraph-image (comme azalee + achillea) = capture HD plein écran
				// de la home (apps/website/src/app/opengraph-image.png).
				url: "/opengraph-image",
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
		getPublicSetting("home_azalee_image", "/azalee-bg.webp"),
		getPublicSetting("home_azalee_logo", "/RG_Azalee-logo.webp"),
		getPublicSetting("home_azalee_twitter", "https://x.com/Azalee_IE"),
		getPublicSetting("home_azalee_instagram", "https://www.instagram.com/azaleefr/"),
		// Achillea Defaults
		getPublicSetting(
			"home_achillea_description",
			"Le carrefour de l'esport Inazuma Eleven ! Gestion de clans, tournois, matchs classés, ranking communautaire et bot officiel."
		),
		getPublicSetting("home_achillea_image", "/achillea/bannière.webp"),
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
									className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold leading-tight text-gray-900 dark:text-white"
								>
									{introTitle}
								</h1>
								<p className="text-sm sm:text-base md:text-lg leading-relaxed text-gray-700 dark:text-gray-300">
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
						<div className="text-center space-y-2 max-w-7xl mx-auto px-4">
							<h2
								id="community-heading"
								className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-[#C83C51] via-[#921044] to-[#FECD50] dark:from-[#FECD50] dark:via-[#C83C51] dark:to-[#FECD50]"
							>
								{communityTitle}
							</h2>

							<p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
								{communitySubtitle}
							</p>
						</div>

						{/* Discord */}

						<div className="max-w-7xl mx-auto px-4 w-full">
							<DiscordBlock>
								<div className="space-y-3">
									<div className="flex items-center gap-3">
										<div className="p-2.5 rounded-xl bg-indigo-500/10">
											<RgEmote name="roy-salut" size={32} animated className="size-8" />
										</div>

										<div>
											<h3 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
												Discord
											</h3>

											<p className="text-xs font-medium text-muted-foreground">
												{communityDescription}
											</p>
										</div>
									</div>

									<p className="text-base text-muted-foreground leading-relaxed">
										Rejoignez notre serveur Discord pour discuter avec la communauté Rose Griffon,
										participer à nos événements et rester informés de toutes nos actualités en temps
										réel.
									</p>

									<div className="flex flex-wrap gap-2">
										{["💬 Discussion", "🎮 Gaming", "🎉 Événements"].map((tag) => (
											<span
												key={tag}
												className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 text-xs font-medium border border-indigo-100 dark:border-indigo-800"
											>
												{tag}
											</span>
										))}
									</div>

									<div className="pt-1">
										<Button
											asChild
											className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold w-full sm:w-auto h-10"
											size="default"
										>
											<a
												href="https://discord.gg/8X8eQfBMkt"
												target="_blank"
												rel="noopener noreferrer"
											>
												<svg className="size-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
													<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
												</svg>
												Rejoindre le serveur
											</a>
										</Button>
									</div>
								</div>
							</DiscordBlock>
						</div>

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
