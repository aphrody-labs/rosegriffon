import type { Metadata } from "next";
import Link from "next/link";

import { Compteur, TitreTuile, Tuile } from "@/components/home/tuiles";
import { OrganizationSchema, WebsiteSchema } from "@/components/shared/StructuredData";
import { RealtimeSettingsListener } from "@/components/shared/RealtimeSettingsListener";
import { getCalendarEvents } from "@/lib/api/events";
import { INVITATION_DISCORD } from "@/lib/discord";
import { getPublicSetting } from "@/lib/api/settings";
import { getPgPool } from "@/lib/db/pg";
import { createClient } from "@/lib/supabase/server";

// ISR : HTML mis en cache, régénéré toutes les 60 s en arrière-plan.
export const revalidate = 60;

export const metadata: Metadata = {
	alternates: { canonical: "https://rosegriffon.fr" },
	description:
		"Association française Inazuma Eleven : wiki Victory Road, compétition, événements et communauté depuis 2019.",
	keywords: [
		"Rose Griffon",
		"Inazuma Eleven",
		"association",
		"France",
		"wiki",
		"événements",
		"communauté",
	],
	openGraph: {
		description:
			"Association française Inazuma Eleven : wiki Victory Road, compétition, événements et communauté depuis 2019.",
		images: [{ alt: "Rose Griffon", height: 630, url: "/opengraph-image.png", width: 1200 }],
		locale: "fr_FR",
		siteName: "Rose Griffon",
		title: "Rose Griffon - Association Inazuma Eleven France",
		type: "website",
		url: "https://rosegriffon.fr",
	},
	title: "Rose Griffon - Association Inazuma Eleven France",
	twitter: {
		card: "summary_large_image",
		creator: "@rose_griffon",
		description: "Association française Inazuma Eleven : wiki, compétition, événements",
		site: "@rose_griffon",
		title: "Rose Griffon - Association Inazuma Eleven France",
	},
};

interface EntreeArticle {
	slug: string;
	title: string;
	published_at: string | null;
	app: string;
}

/**
 * Accueil : un tableau de bord, pas une brochure.
 *
 * TOUT TIENT DANS LA HAUTEUR DE LA FENÊTRE sur un écran large (`lg:h-[…]`,
 * `lg:overflow-hidden`) : l'accueil est l'index de l'écosystème, pas un récit à
 * dérouler. Chaque tuile est une destination réelle, aucune n'est décorative.
 * Sous `lg`, la grille redevient une colonne — imposer une fenêtre fixe sur un
 * téléphone tronquerait le contenu au lieu de le condenser.
 *
 * Le pied de page est masqué sur cette route (cf. `client-layout.tsx`) : la
 * ligne de liens légaux en bas de grille le remplace.
 */
async function chargerAccueil() {
	const supabase = await createClient();
	const pool = getPgPool();

	const [
		{ rows: actualites },
		{ count: nbPersonnages },
		{ count: nbTechniques },
		{ count: nbObjets },
	] = await Promise.all([
		pool.query<EntreeArticle>(
			`SELECT slug, title, published_at, app FROM articles
			 WHERE status = $1 AND app = ANY($2::text[])
			 ORDER BY published_at DESC NULLS LAST
			 LIMIT 4`,
			["published", ["azalee", "website"]]
		),
		supabase.from("inagle_characters").select("id", { count: "exact", head: true }),
		supabase.from("inagle_skills").select("id", { count: "exact", head: true }),
		supabase.from("inagle_items").select("id", { count: "exact", head: true }),
	]);

	return {
		actualites,
		stats: {
			characters: nbPersonnages ?? 0,
			items: nbObjets ?? 0,
			skills: nbTechniques ?? 0,
		},
	};
}

/** Prochain événement à venir ou en cours, `null` s'il n'y en a pas. */
function prochainEvenement(evenements: Awaited<ReturnType<typeof getCalendarEvents>>) {
	const maintenant = Date.now();
	return (
		evenements
			.map((e) => ({
				debut: e.start?.dateTime || e.start?.date,
				fin: e.end?.dateTime || e.end?.date,
				resume: e.summary,
			}))
			.filter((e) => {
				const cible = e.fin ?? e.debut;
				return cible ? new Date(cible).getTime() >= maintenant : false;
			})
			.sort(
				(a, b) => new Date(a.debut || 0).getTime() - new Date(b.debut || 0).getTime()
			)[0] ?? null
	);
}

const LIENS_LEGAUX = [
	{ href: "/a-propos", libelle: "L'association" },
	{ href: "/charte-engagements", libelle: "Charte" },
	{ href: "/legal/mentions-legales", libelle: "Mentions légales" },
	{ href: "/legal/confidentialite", libelle: "Confidentialité" },
];

const RACCOURCIS = [
	{ href: "/news", libelle: "Actus" },
	{ href: "/news?format=chronique", libelle: "Chroniques" },
	{ href: "/evenements", libelle: "Événements" },
	{ href: "/shop", libelle: "Boutique" },
	{ href: "/community", libelle: "Communauté" },
	{ href: "/sondages", libelle: "Sondages" },
	{ href: "/rose-griffon-tv", libelle: "RG TV" },
	{ href: "/projets", libelle: "Projets" },
];

export default async function Home() {
	const [introTitre, introTexte, discordInvitation, achilleaLien, evenements, donnees] =
		await Promise.all([
			getPublicSetting("home_intro_title", "L'écosystème Inazuma Eleven francophone"),
			getPublicSetting(
				"home_intro_text",
				"Association loi 1901 depuis 2019 : le wiki de Victory Road, la scène compétitive, les événements et la communauté, au même endroit."
			),
			getPublicSetting("home_community_discord", INVITATION_DISCORD),
			getPublicSetting("home_achillea_link", "/achillea"),
			getCalendarEvents(),
			chargerAccueil(),
		]);

	const evenement = prochainEvenement(evenements);

	return (
		<>
			<OrganizationSchema />
			<WebsiteSchema />
			<RealtimeSettingsListener />

			{/*
			 * La fenêtre fixe demande DEUX conditions, pas une : assez large (`lg`)
			 * ET assez haute (`min-height: 44rem`). Un écran large mais court —
			 * 1366×650, un portable posé sur une station d'accueil — n'a pas la
			 * place, et `overflow-hidden` y couperait le contenu au lieu de le
			 * condenser. Sous l'un ou l'autre seuil, la grille redevient une
			 * colonne qui défile.
			 */}
			<div className="tableau-de-bord-accueil mx-auto grid w-full max-w-7xl grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-12 lg:px-6">
				{/* Identité */}
				<Tuile className="justify-between lg:col-span-7 lg:row-span-1" label="Rose Griffon">
					<div className="flex min-h-0 flex-col gap-3">
						<h1 className="text-fluid-2xl font-bold leading-tight text-on-surface">
							{introTitre}
						</h1>
						<p className="line-clamp-4 text-sm leading-relaxed text-on-surface-variant">
							{introTexte}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<a
							href={discordInvitation}
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
						>
							Rejoindre le Discord
						</a>
						<Link
							href="/wiki"
							className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold text-on-surface"
						>
							Ouvrir le wiki
						</Link>
					</div>
				</Tuile>

				{/* Prochain événement */}
				<Tuile
					className="justify-between lg:col-span-5"
					href="/evenements"
					label="Prochain événement"
				>
					<TitreTuile>Prochain événement</TitreTuile>
					{evenement ? (
						<div className="flex min-h-0 flex-col gap-1">
							<p className="line-clamp-2 text-lg font-semibold text-on-surface">
								{evenement.resume ?? "Événement"}
							</p>
							<p className="text-sm text-on-surface-variant">
								{new Intl.DateTimeFormat("fr-FR", {
									dateStyle: "full",
									timeStyle: evenement.debut?.includes("T") ? "short" : undefined,
								}).format(new Date(evenement.debut ?? Date.now()))}
							</p>
						</div>
					) : (
						<p className="text-sm text-on-surface-variant">
							Aucun événement programmé pour l&apos;instant.
						</p>
					)}
					<span className="text-sm font-medium text-primary">Voir le calendrier</span>
				</Tuile>

				{/* Azalée */}
				<Tuile className="lg:col-span-4" href="/wiki" label="Wiki Azalée">
					<TitreTuile>Azalée — wiki Victory Road</TitreTuile>
					<div className="grid grid-cols-3 gap-2">
						<Compteur valeur={donnees.stats.characters} libelle="Joueurs" />
						<Compteur valeur={donnees.stats.skills} libelle="Techniques" />
						<Compteur valeur={donnees.stats.items} libelle="Objets" />
					</div>
					<p className="line-clamp-2 text-sm text-on-surface-variant">
						Fiches, techniques, totems, quêtes et traductions d&apos;Inazuma Eleven: Victory Road.
					</p>
				</Tuile>

				{/* Achilléa */}
				<Tuile className="lg:col-span-3" href={achilleaLien} label="Achilléa">
					<TitreTuile>Achilléa — compétition</TitreTuile>
					<p className="line-clamp-4 text-sm text-on-surface-variant">
						Clans, mode classé, tournois et classement communautaire de la scène française.
					</p>
					<span className="mt-auto text-sm font-medium text-primary">Voir l&apos;e-sport</span>
				</Tuile>

				{/* Actualités */}
				<Tuile className="lg:col-span-5" label="Dernières actualités">
					<TitreTuile>Dernières publications</TitreTuile>
					<ul className="flex min-h-0 flex-col divide-y divide-outline-variant/10">
						{donnees.actualites.map((article) => (
							<li key={`${article.app}-${article.slug}`} className="min-w-0 py-1.5">
								<Link
									href={article.app === "azalee" ? `/news/${article.slug}` : `/news/${article.slug}`}
									className="flex items-baseline justify-between gap-3 hover:text-primary"
								>
									<span className="truncate text-sm text-on-surface">{article.title}</span>
									<span className="shrink-0 text-[11px] text-on-surface-variant/60">
										{article.published_at
											? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(
													new Date(article.published_at)
												)
											: ""}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</Tuile>

				{/* Raccourcis + légal */}
				<nav
					aria-label="Raccourcis"
					className="flex flex-wrap items-center gap-2 lg:col-span-12"
				>
					{RACCOURCIS.map((entree) => (
						<Link
							key={entree.href}
							href={entree.href}
							className="rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface"
						>
							{entree.libelle}
						</Link>
					))}
					<span className="ml-auto flex flex-wrap gap-3 text-[11px] text-on-surface-variant/60">
						{LIENS_LEGAUX.map((entree) => (
							<Link key={entree.href} href={entree.href} className="hover:text-on-surface">
								{entree.libelle}
							</Link>
						))}
					</span>
				</nav>
			</div>
		</>
	);
}
