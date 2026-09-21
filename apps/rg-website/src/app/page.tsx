import type { Metadata } from "next";
import dynamicImport from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { AchilleaBanner } from "@/components/home/AchilleaBanner";
import {
	AzaleeLiveHub,
	type ArticleItem,
	type TweetItem,
	type WikiSectionStats,
} from "@/components/home/AzaleeLiveHub";
import type {
	AzaleePreviewData,
	PreviewCharacter,
	PreviewItem,
	PreviewSkill,
	PreviewTeam,
} from "@/app/api/public/azalee/preview/route";
import type {
	AchilleaPreviewData,
	PreviewClan,
	PreviewTournament,
} from "@/app/api/public/achillea/preview/route";
import { NextEventBanner } from "@/components/home/NextEventBanner";
import { RechercheUnifiee } from "@/components/home/recherche-unifiee";
import { FeaturedTweets } from "@/components/shared/FeaturedTweets";
import FusionBlock from "@/components/shared/FusionBlock";
import { MotionSection } from "@/components/shared/MotionSection";
import { RealtimeSettingsListener } from "@/components/shared/RealtimeSettingsListener";
import { OrganizationSchema, WebsiteSchema } from "@/components/shared/StructuredData";
import { lireChiffresEsport, lireClassement } from "@/lib/achillea/classement";
import { getCalendarEvents } from "@/lib/api/events";
import { getPublicSetting } from "@/lib/api/settings";
import { getPgPoolOrNull } from "@/lib/db/pg";
import { INVITATION_DISCORD, SERVEURS_DISCORD } from "@/lib/discord";
import { createClient } from "@/lib/supabase/server";

const ProjectsSection = dynamicImport(() => import("@/components/shared/ProjectsSection"), {
	loading: () => <div className="h-96 animate-pulse rounded-3xl bg-muted" />,
});

const DiscordSection = dynamicImport(() => import("@/components/shared/DiscordSection"), {
	loading: () => <div className="h-64 animate-pulse rounded-3xl bg-muted sm:h-72" />,
});

// ISR : HTML mis en cache, régénéré toutes les 60 s en arrière-plan.
export const revalidate = 60;

export const metadata: Metadata = {
	alternates: { canonical: "https://rosegriffon.fr" },
	description:
		"Rose Griffon — Association et hub communautaire Inazuma Eleven en France : base de données et wiki Victory Road, ladder et tournois e-sport, actualités et communauté.",
	keywords: [
		"Rose Griffon",
		"Inazuma Eleven",
		"Inazuma Eleven Victory Road",
		"Wiki Inazuma Eleven",
		"Azalée",
		"Achilléa",
		"wiki Victory Road",
		"techniques Inazuma Eleven",
		"joueurs Inazuma Eleven",
		"compétitif",
		"tournois Inazuma",
		"ladder ELO",
		"communauté Discord",
	],
	openGraph: {
		description:
			"Association française Inazuma Eleven : wiki Victory Road, scène compétitive, événements et communauté depuis 2019.",
		images: [
			{
				alt: "Rose Griffon - Association Inazuma Eleven",
				height: 630,
				url: "/opengraph-image.png",
				width: 1200,
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
			"Association française Inazuma Eleven : wiki Victory Road, compétition, streaming et communauté passionnée",
		site: "@rose_griffon",
		title: "Rose Griffon - Association Inazuma Eleven France",
	},
};

/**
 * Charge l'ensemble des données nécessaires à la page d'accueil unifiée :
 * paramètres publics, actualités, données du wiki, scène compétitive Achilléa
 * et effectifs de la communauté.
 */
async function chargerDonneesAccueil() {
	const supabase = await createClient();
	const pool = getPgPoolOrNull();
	const safePoolQuery = <T = any,>(
		sql: string,
		params?: unknown[],
		fallback: T[] = []
	): Promise<{ rows: T[] }> =>
		pool
			? pool
					.query(sql, params)
					.then((res) => ({ rows: res.rows as T[] }))
					.catch((err) => {
						console.error(`Erreur requête Postgres accueil (${sql.slice(0, 40)}...):`, err);
						return { rows: fallback };
					})
			: Promise.resolve({ rows: fallback });

	const [
		introTitle,
		introText,
		introImage,
		azaleeTitle,
		azaleeTag,
		azaleeDescription,
		azaleeImage,
		azaleeLogo,
		azaleeTwitter,
		azaleeInstagram,
		achilleaDescription,
		achilleaImage,
		achilleaLink,
		achilleaDiscord,
		communityTitle,
		communitySubtitle,
		communityDescription,
		events,
		classement,
		chiffresEsport,
		{ rows: effectifs },
		{ rows: articles },
		{ rows: tweets },
		{ rows: persosJouablesRows },
		{ count: nbTechniques },
		{ count: nbObjets },
		{ count: nbKeshins },
		{ count: nbAmes },
		{ count: nbPassifs },
		{ rows: previewChars },
		{ rows: previewSkills },
		{ rows: previewItems },
		{ rows: previewTeams },
		{ rows: previewClans },
		{ rows: previewTournaments },
	] = await Promise.all([
		getPublicSetting("home_intro_title", "Qu'est-ce que Rose Griffon ?"),
		getPublicSetting(
			"home_intro_text",
			"Rose Griffon est une association française régie par la loi de 1901, ayant pour vocation de rassembler les principaux acteurs de la communauté Inazuma Eleven ainsi que l'ensemble des passionnés sous une même bannière. Elle s'engage à valoriser à la fois la scène artistique liée à cette licence et son univers compétitif."
		),
		getPublicSetting("home_intro_image", "/RG_screens_twitch_ethan.webp"),
		getPublicSetting("home_azalee_title", "AZALÉE"),
		getPublicSetting("home_azalee_tag", "Wiki & Actualités"),
		getPublicSetting(
			"home_azalee_description",
			"Le pilier médiatique et le wiki de Rose Griffon. Le wiki Azalée couvre tout Inazuma Eleven: Victory Road — personnages, techniques, esprits guerriers — avec traductions exclusives, interviews et analyses."
		),
		getPublicSetting("home_azalee_image", "https://azalee.rosegriffon.fr/opengraph-image.png"),
		getPublicSetting("home_azalee_logo", "/RG_Azalee-logo.webp"),
		getPublicSetting("home_azalee_twitter", "https://x.com/Azalee_IE"),
		getPublicSetting("home_azalee_instagram", "https://www.instagram.com/azaleefr/"),
		getPublicSetting(
			"home_achillea_description",
			"Le carrefour de l'esport Inazuma Eleven ! Gestion de clans, tournois, matchs classés, ranking communautaire et bot Rose Griffon."
		),
		getPublicSetting("home_achillea_image", "https://achillea.rosegriffon.fr/opengraph-image"),
		getPublicSetting("home_achillea_link", "/achillea"),
		getPublicSetting(
			"home_achillea_discord",
			"https://discord.gg/achillea-competitif-inazuma-eleven-fr-1055585286320554055"
		),
		getPublicSetting("home_community_title", "Rejoignez la communauté"),
		getPublicSetting(
			"home_community_subtitle",
			"Rose Griffon est partout ! Discutez sur Discord et suivez notre actualité sur les réseaux."
		),
		getPublicSetting("home_community_description", "Le cœur de la communauté"),
		getCalendarEvents(),
		lireClassement(2, 5),
		lireChiffresEsport(),
		safePoolQuery<{ membres: string }>(
			`SELECT count(*) AS membres FROM discord_appartenances WHERE left_at IS NULL AND is_bot = false`,
			undefined,
			[{ membres: "0" }]
		),
		safePoolQuery<ArticleItem>(
			`SELECT a.id, a.slug, a.title, a.excerpt, a.featured_image_url, a.featured_image_alt, a.published_at, a.created_at, a.category,
			        CASE WHEN p.id IS NOT NULL THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url) ELSE NULL END AS author
			 FROM articles a
			 LEFT JOIN profiles p ON p.id = a.author_id
			 WHERE a.status = 'published' AND a.app = ANY($1::text[])
			 ORDER BY a.published_at DESC NULLS LAST
			 LIMIT 4`,
			[["azalee", "website"]]
		),
		safePoolQuery<TweetItem>(
			`SELECT id, text, translation, created_at, author_username, author_name, media
			 FROM tweets
			 WHERE author_username = 'Azalee_IE'
			 ORDER BY created_at DESC
			 LIMIT 6`
		),
		// Ne compter que les joueurs JOUABLES UNIQUES (is_primary, sans doublons _5000, sans miximax/animaux, avec fiche ou zukan)
		safePoolQuery<{ count: string }>(
			`SELECT count(*) AS count FROM inagle_characters 
			 WHERE is_primary = true 
			   AND internal_code NOT LIKE '%_5000' 
			   AND internal_code NOT LIKE 'c05028%' 
			   AND name_en NOT LIKE '%×%' 
			   AND internal_code NOT LIKE 'an%' 
			   AND name_en IS NOT NULL 
			   AND name_en != '' 
			   AND (sheet_data IS NOT NULL OR is_controllable = true OR zukan_order IS NOT NULL)`,
			undefined,
			[{ count: "0" }]
		),
		supabase.from("inagle_skills").select("id", { count: "exact", head: true }),
		supabase.from("inagle_items").select("id", { count: "exact", head: true }),
		supabase.from("inagle_keshins_clean").select("id", { count: "exact", head: true }),
		supabase.from("inagle_souls_clean").select("id", { count: "exact", head: true }),
		supabase.from("inagle_passives").select("id", { count: "exact", head: true }),
		safePoolQuery<PreviewCharacter>(
			`SELECT id, slug, base_slug, name_fr, name_en, name_ja, element, position, rarity, internal_code 
			 FROM inagle_characters 
			 WHERE is_primary = true 
			   AND internal_code IN ('c01000010', 'c05024710', 'c01010970', 'c01000020')
			 ORDER BY CASE internal_code 
			   WHEN 'c01000010' THEN 1
			   WHEN 'c05024710' THEN 2
			   WHEN 'c01010970' THEN 3
			   WHEN 'c01000020' THEN 4
			   ELSE 5 END`
		),
		safePoolQuery<PreviewSkill>(
			`SELECT id, name_fr, name_en, name_ja, category, element, power_max, tension_cost, image_url
			 FROM inagle_skills 
			 WHERE id IN ('whs02160_or', 'whk00010', 'whd01400', 'who01352')
			 ORDER BY CASE id 
			   WHEN 'whs02160_or' THEN 1
			   WHEN 'whk00010' THEN 2
			   WHEN 'who01352' THEN 3
			   WHEN 'whd01400' THEN 4
			   ELSE 5 END`
		),
		safePoolQuery<PreviewItem>(
			`SELECT id, name_fr, name_en, category, rarity, internal_code, stat_boost_1, stat_boost_2
			 FROM inagle_items 
			 WHERE internal_code IN ('eq_sh010101', 'eq_sh010201', 'eq_sh021201', 'eq_sh080101')
			 ORDER BY CASE internal_code 
			   WHEN 'eq_sh010101' THEN 1
			   WHEN 'eq_sh010201' THEN 2
			   WHEN 'eq_sh021201' THEN 3
			   WHEN 'eq_sh080101' THEN 4
			   ELSE 5 END`
		),
		safePoolQuery<PreviewTeam>(
			`SELECT id, name_fr, name_en, name_ja, emblem_url
			 FROM inagle_teams 
			 WHERE name_fr IN ('Raimon', 'Royal Academy', 'Nouvelle Royal Ac.', 'Inazuma KFT')
			 ORDER BY CASE name_fr 
			   WHEN 'Raimon' THEN 1
			   WHEN 'Royal Academy' THEN 2
			   WHEN 'Nouvelle Royal Ac.' THEN 3
			   WHEN 'Inazuma KFT' THEN 4
			   ELSE 5 END`
		),
		safePoolQuery<PreviewClan>(
			`SELECT id, name, "shortenedName", "clanAvatarUrl", "clanBiography", "membersCount", "isRecruiting"
			 FROM achillea.clan_list_view 
			 WHERE "isDisbanded" = false AND "isHidden" = false
			 ORDER BY "membersCount" DESC, id ASC 
			 LIMIT 4`
		),
		safePoolQuery<PreviewTournament>(
			`SELECT id, name, starts_at, tournament_type, status, internal_state, participants_number, logo
			 FROM achillea.event 
			 WHERE status != 'Canceled' AND internal_state != 'Pending'
			 ORDER BY created_at DESC 
			 LIMIT 4`
		),
	]);

	const maintenant = Date.now();
	const prochain =
		events
			.map((evenement) => ({
				...evenement,
				debut: evenement.start?.dateTime || evenement.start?.date,
				fin: evenement.end?.dateTime || evenement.end?.date,
			}))
			.filter((evenement) => {
				const cible = evenement.fin ?? evenement.debut;
				return cible ? new Date(cible).getTime() >= maintenant : false;
			})
			.sort((a, b) => new Date(a.debut || 0).getTime() - new Date(b.debut || 0).getTime())[0] ??
		null;

	const wikiStats: WikiSectionStats = {
		characters: Number(persosJouablesRows[0]?.count ?? 0),
		items: nbObjets ?? 0,
		keshins: nbKeshins ?? 0,
		passives: nbPassifs ?? 0,
		skills: nbTechniques ?? 0,
		souls: nbAmes ?? 0,
	};

	const azaleePreview: AzaleePreviewData = {
		characters: previewChars ?? [],
		items: previewItems ?? [],
		skills: previewSkills ?? [],
		teams: previewTeams ?? [],
	};

	const achilleaPreview: AchilleaPreviewData = {
		clans: previewClans ?? [],
		leaderboard: classement ?? [],
		stats: chiffresEsport,
		tournaments: previewTournaments ?? [],
	};

	return {
		achilleaDescription,
		achilleaDiscord,
		achilleaImage,
		achilleaLink,
		articles: articles ?? [],
		azaleeDescription,
		azaleeImage,
		azaleeInstagram,
		azaleeLogo,
		azaleeTag,
		azaleeTitle,
		azaleeTwitter,
		chiffresEsport,
		classement,
		communityDescription,
		communitySubtitle,
		communityTitle,
		introImage,
		introText,
		introTitle,
		membres: Number(effectifs[0]?.membres ?? 0),
		prochain,
		tweets: tweets ?? [],
		wikiStats,
		azaleePreview,
		achilleaPreview,
	};
}

export default async function Home() {
	const data = await chargerDonneesAccueil();

	return (
		<>
			<OrganizationSchema />
			<WebsiteSchema />
			<RealtimeSettingsListener />

			<div className="flex flex-col min-h-screen">
				<div className="flex flex-col gap-8 md:gap-12 lg:gap-16 pb-12 md:pb-16 lg:pb-20 pt-2 md:pt-4">
					{/* 1. Prochain Événement si programmé */}
					{data.prochain && (
						<MotionSection className="w-full">
							<NextEventBanner event={data.prochain} />
						</MotionSection>
					)}

					{/* 2. Hero Rose Griffon — Bannière principale avec texte introductif RG */}
					<MotionSection
						className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 w-full"
						aria-labelledby="about-heading"
					>
						<FusionBlock isImageLeft image={data.introImage} isPriority>
							<div className="space-y-4 sm:space-y-5 flex flex-col justify-center h-full py-2">
								<div className="flex items-center gap-2">
									<div className="relative size-8 shrink-0">
										<Image
											src="/RG_Logo_V2.5.webp"
											alt="Rose Griffon"
											fill
											sizes="32px"
											className="object-contain"
										/>
									</div>
									<span className="text-xs font-black uppercase tracking-wider text-primary">
										Association Inazuma Eleven France
									</span>
								</div>

								<h1
									id="about-heading"
									className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight text-foreground font-expressive-title"
								>
									{data.introTitle}
								</h1>

								<p className="text-sm sm:text-base md:text-lg leading-relaxed text-muted-foreground font-medium">
									{data.introText}
								</p>

								{/* Raccourcis et boutons d'action unifiés */}
								<div className="flex flex-wrap gap-2.5 pt-2">
									<a
										href={INVITATION_DISCORD}
										target="_blank"
										rel="noopener noreferrer"
										className="rounded-full bg-primary hover:bg-primary/90 px-5 py-2.5 text-sm font-bold text-on-primary shadow-sm hover:shadow transition-all"
									>
										Rejoindre le Discord
									</a>
									<Link
										href="/wiki"
										className="rounded-full border border-outline hover:bg-surface-container px-5 py-2.5 text-sm font-bold text-on-surface transition-all"
									>
										Wiki Azalée
									</Link>
									<Link
										href="/achillea"
										className="rounded-full border border-outline hover:bg-surface-container px-5 py-2.5 text-sm font-bold text-on-surface transition-all"
									>
										E-Sport Achilléa
									</Link>
									<Link
										href="/projets"
										className="rounded-full bg-surface-container-high hover:bg-surface-container-highest px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-all"
									>
										Nos projets
									</Link>
								</div>

								{/* Barre de recherche transversale intégrée au hero */}
								<div className="pt-2 w-full">
									<RechercheUnifiee />
								</div>
							</div>
						</FusionBlock>
					</MotionSection>

					{/* 3. Chiffres clés de l'écosystème global */}
					<MotionSection className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 w-full">
						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
							<Link
								href="/wiki/chara"
								className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 hover:border-primary/40 hover:bg-surface-container transition-all text-center group"
							>
								<span className="text-2xl lg:text-3xl font-black text-foreground group-hover:text-primary transition-colors">
									{data.wikiStats.characters.toLocaleString("fr-FR")}
								</span>
								<span className="text-xs text-muted-foreground font-medium mt-1">
									Joueurs jouables uniques
								</span>
							</Link>
							<Link
								href="/wiki/skill"
								className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 hover:border-primary/40 hover:bg-surface-container transition-all text-center group"
							>
								<span className="text-2xl lg:text-3xl font-black text-foreground group-hover:text-primary transition-colors">
									{data.wikiStats.skills.toLocaleString("fr-FR")}
								</span>
								<span className="text-xs text-muted-foreground font-medium mt-1">Techniques</span>
							</Link>
							<Link
								href="/wiki/item"
								className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 hover:border-primary/40 hover:bg-surface-container transition-all text-center group"
							>
								<span className="text-2xl lg:text-3xl font-black text-foreground group-hover:text-primary transition-colors">
									{data.wikiStats.items.toLocaleString("fr-FR")}
								</span>
								<span className="text-xs text-muted-foreground font-medium mt-1">Objets &amp; Stades</span>
							</Link>
							<Link
								href="/achillea/ranked/leaderboard"
								className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 hover:border-primary/40 hover:bg-surface-container transition-all text-center group"
							>
								<span className="text-2xl lg:text-3xl font-black text-foreground group-hover:text-primary transition-colors">
									{data.chiffresEsport.joueurs.toLocaleString("fr-FR")}
								</span>
								<span className="text-xs text-muted-foreground font-medium mt-1">
									Joueurs classés
								</span>
							</Link>
							<Link
								href="/achillea/clans"
								className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 hover:border-primary/40 hover:bg-surface-container transition-all text-center group"
							>
								<span className="text-2xl lg:text-3xl font-black text-foreground group-hover:text-primary transition-colors">
									{data.chiffresEsport.clans.toLocaleString("fr-FR")}
								</span>
								<span className="text-xs text-muted-foreground font-medium mt-1">Clans actifs</span>
							</Link>
							<Link
								href="/community"
								className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 hover:border-primary/40 hover:bg-surface-container transition-all text-center group"
							>
								<span className="text-2xl lg:text-3xl font-black text-foreground group-hover:text-primary transition-colors">
									{data.membres.toLocaleString("fr-FR")}
								</span>
								<span className="text-xs text-muted-foreground font-medium mt-1">Membres Discord</span>
							</Link>
						</div>
					</MotionSection>

					{/* 4. Azalée — Le Wiki & Hub Live Victory Road (Base de données, Catégories & Actualités unifiées) */}
					<MotionSection
						className="w-full content-deferred"
						aria-labelledby="azalee-hub-title"
					>
						<AzaleeLiveHub
							stats={data.wikiStats}
							articles={data.articles}
							tweets={data.tweets}
							previewData={data.azaleePreview}
							twitterLink={data.azaleeTwitter}
							instagramLink={data.azaleeInstagram}
						/>
					</MotionSection>

					{/* 5. Achilléa : Hub E-Sport avec Live Previews & Compétition en direct */}
					<MotionSection
						className="w-full content-deferred"
						aria-labelledby="achillea-hub-title"
					>
						<AchilleaBanner
							description={data.achilleaDescription}
							image={data.achilleaImage}
							link={data.achilleaLink}
							discordLink={data.achilleaDiscord}
							classement={data.classement}
							chiffresEsport={data.chiffresEsport}
							previewData={data.achilleaPreview}
						/>
					</MotionSection>

					{/* 6. Communauté Discord en direct (Widgets RG & Achilléa) & Réseaux */}
					<MotionSection
						className="w-full space-y-8 content-deferred"
						aria-labelledby="community-heading"
					>
						<div className="grid gap-4 lg:grid-cols-2 max-w-7xl mx-auto px-4 md:px-6 lg:px-8 w-full">
							{SERVEURS_DISCORD.map((serveur) => (
								<DiscordSection key={serveur.cle} serveur={serveur} compact />
							))}
						</div>

						{/* Tweets marquants */}
						<FeaturedTweets />
					</MotionSection>

					{/* 7. Nos projets créatifs et communautaires */}
					<MotionSection
						id="projets-section"
						className="content-deferred"
						aria-labelledby="projects-heading"
					>
						<ProjectsSection />
					</MotionSection>
				</div>
			</div>
		</>
	);
}
