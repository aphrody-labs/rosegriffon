import type { Metadata } from "next";
import dynamicImport from "next/dynamic";
import Image from "next/image";
import Link from "next/link";

import { AchilleaBanner } from "@/components/home/AchilleaBanner";
import { AzaleeLiveHub, type ArticlePreview, type WikiSectionStats } from "@/components/home/AzaleeLiveHub";
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

const ProjectsSection = dynamicImport(() => import("@/components/shared/ProjectsSection"));
const DiscordSection = dynamicImport(() => import("@/components/shared/DiscordSection"));

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
 * et données de prévisualisation des deux univers.
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
		events,
		{ rows: articles },
		classement,
		chiffresEsport,
		{ rows: effectifs },
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
			"Rose Griffon est une association française régie par la loi de 1901, ayant pour vocation de rassembler les principaux acteurs de la communauté Inazuma Eleven ainsi que l'ensemble des passionnés sous une même bannière. Elle valorise la scène artistique comme son univers compétitif."
		),
		getPublicSetting("home_intro_image", "/RG_screens_twitch_ethan.webp"),
		getCalendarEvents(),
		safePoolQuery<ArticlePreview>(
			`SELECT id, slug, title, featured_image_url, published_at
			 FROM articles
			 WHERE status = 'published' AND app = ANY($1::text[])
			 ORDER BY published_at DESC NULLS LAST
			 LIMIT 2`,
			[["azalee", "website"]]
		),
		lireClassement(2, 5),
		lireChiffresEsport(),
		safePoolQuery<{ membres: string }>(
			"SELECT count(*) AS membres FROM discord_appartenances WHERE left_at IS NULL AND is_bot = false",
			undefined,
			[{ membres: "0" }]
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
			.toSorted((a, b) => new Date(a.debut || 0).getTime() - new Date(b.debut || 0).getTime())[0] ??
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
		chiffresEsport,
		classement,
		prochain,
		wikiStats,
		azaleePreview,
		achilleaPreview,
		articles: articles ?? [],
		introImage,
		introText,
		introTitle,
		membres: Number(effectifs[0]?.membres ?? 0),
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
				<div className="flex flex-col gap-7 pb-12 pt-2 min-[600px]:gap-8 min-[840px]:pb-16 min-[840px]:pt-4">
					{/* 1. Prochain Événement si programmé */}
					{data.prochain && (
						<MotionSection className="w-full">
							<NextEventBanner event={data.prochain} />
						</MotionSection>
					)}

					{/* Présentation de l'association + recherche fédérée. */}
					<MotionSection className="mx-auto w-full max-w-7xl px-4 min-[600px]:px-0" aria-labelledby="about-heading">
						<FusionBlock isImageLeft image={data.introImage} isPriority>
							<div className="flex h-full flex-col justify-center space-y-4 py-1">
								<div className="flex items-center gap-2">
									<div className="relative size-8 shrink-0"><Image src="/RG_Logo_V2.5.webp" alt="Rose Griffon" fill sizes="32px" className="object-contain" /></div>
									<span className="text-xs font-black uppercase tracking-wider text-primary">Association Inazuma Eleven France</span>
								</div>
								<h1 id="about-heading" className="font-expressive-title text-2xl font-black leading-tight text-foreground sm:text-3xl md:text-4xl">{data.introTitle}</h1>
								<p className="text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">{data.introText}</p>
								<div className="flex flex-wrap gap-2 pt-1">
									<a href={INVITATION_DISCORD} target="_blank" rel="noopener noreferrer" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90">Discord</a>
									<Link href="/wiki" className="rounded-full border border-outline px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container">Wiki Azalée</Link>
									<Link href="/achillea" className="rounded-full border border-outline px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container">E-Sport</Link>
								</div>
								<RechercheUnifiee />
							</div>
						</FusionBlock>
					</MotionSection>

					{/* Les repères du wiki, de l'arène et de la communauté restent visibles sans devenir une seconde hero. */}
					<MotionSection className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-2 px-4 sm:grid-cols-3 min-[600px]:px-0 lg:grid-cols-6">
						{[
							["/wiki/chara", data.wikiStats.characters, "Joueurs"],
							["/wiki/skill", data.wikiStats.skills, "Techniques"],
							["/wiki/item", data.wikiStats.items, "Objets"],
							["/achillea/ranked/leaderboard", data.chiffresEsport.joueurs, "Joueurs classés"],
							["/achillea/clans", data.chiffresEsport.clans, "Clans actifs"],
							["/community", data.membres, "Membres Discord"],
						].map(([href, count, label]) => (
							<Link key={String(href)} href={String(href)} className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-3 text-center transition-colors hover:border-primary/40 hover:bg-surface-container">
								<span className="block text-xl font-black text-foreground">{Number(count).toLocaleString("fr-FR")}</span>
								<span className="text-xs font-medium text-muted-foreground">{label}</span>
							</Link>
						))}
					</MotionSection>

					{/* Les deux pôles principaux sont présentés comme les projets RG qu'ils sont. */}
					<MotionSection id="projets-section" className="w-full content-deferred" aria-labelledby="projects-heading">
						<div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 min-[600px]:px-0">
							<p className="text-xs font-black uppercase tracking-wider text-primary">Rose Griffon</p>
							<h2 id="projects-heading" className="font-expressive-title text-2xl font-black text-foreground sm:text-3xl">Nos projets</h2>
							<p className="text-sm text-muted-foreground">Azalée pour le wiki et l&apos;actualité, Achilléa pour la compétition.</p>
						</div>
					</MotionSection>

					<MotionSection className="w-full content-deferred" aria-labelledby="azalee-hub-title">
						<AzaleeLiveHub stats={data.wikiStats} articles={data.articles} previewData={data.azaleePreview} />
					</MotionSection>

					{/* Achilléa — compétition */}
					<MotionSection className="w-full content-deferred" aria-labelledby="achillea-hub-title">
						<AchilleaBanner
							classement={data.classement}
							chiffresEsport={data.chiffresEsport}
							previewData={data.achilleaPreview}
						/>
					</MotionSection>

					<MotionSection className="content-deferred" aria-labelledby="other-projects-heading">
						<ProjectsSection />
					</MotionSection>

					<MotionSection className="mx-auto grid w-full max-w-7xl gap-4 px-4 min-[600px]:px-0 lg:grid-cols-2" aria-label="Serveurs Discord">
						{SERVEURS_DISCORD.map((serveur) => <DiscordSection key={serveur.cle} serveur={serveur} compact />)}
					</MotionSection>
				</div>
			</div>
		</>
	);
}
