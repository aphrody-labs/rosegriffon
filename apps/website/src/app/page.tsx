import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FondAlternant, type FondUnivers } from "@/components/home/fond-alternant";
import { RechercheUnifiee } from "@/components/home/recherche-unifiee";
import { RealtimeSettingsListener } from "@/components/shared/RealtimeSettingsListener";
import { OrganizationSchema, WebsiteSchema } from "@/components/shared/StructuredData";
import { lireChiffresEsport, lireClassement } from "@/lib/achillea/classement";
import { getCalendarEvents } from "@/lib/api/events";
import { getPgPool } from "@/lib/db/pg";
import { INVITATION_DISCORD } from "@/lib/discord";
import { createClient } from "@/lib/supabase/server";

// ISR : HTML mis en cache, régénéré toutes les 60 s en arrière-plan.
export const revalidate = 60;

export const metadata: Metadata = {
	alternates: { canonical: "https://rosegriffon.fr" },
	description:
		"Association française Inazuma Eleven : wiki Victory Road, scène compétitive, événements et communauté depuis 2019.",
	keywords: ["Rose Griffon", "Inazuma Eleven", "Azalée", "Achilléa", "wiki", "compétitif"],
	openGraph: {
		description:
			"Association française Inazuma Eleven : wiki Victory Road, scène compétitive, événements et communauté depuis 2019.",
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
		description: "Wiki, compétition, événements et communauté Inazuma Eleven",
		site: "@rose_griffon",
		title: "Rose Griffon - Association Inazuma Eleven France",
	},
};

/**
 * Les trois univers, dans l'ordre d'apparition du fond.
 *
 * Ces images existaient déjà : elles servaient de fond aux trois accueils
 * séparés, avant qu'ils ne fusionnent ici.
 */
const FONDS: readonly FondUnivers[] = [
	{ src: "/fond.webp", univers: "rose-griffon" },
	{ src: "/azalee_fond.webp", univers: "azalee" },
	{ src: "/fond_achilea.webp", univers: "achillea" },
];

const RACCOURCIS = [
	{ href: "/community", libelle: "Communauté" },
	{ href: "/shop", libelle: "Boutique" },
	{ href: "/rose-griffon-tv", libelle: "RG TV" },
	{ href: "/projets", libelle: "Projets" },
	{ href: "/sondages", libelle: "Sondages" },
	{ href: "/a-propos", libelle: "L'association" },
] as const;

interface EntreeFil {
	slug: string;
	title: string;
	published_at: string | null;
	app: string;
}

/**
 * ACCUEIL UNIFIÉ — les trois anciens accueils en un écran.
 *
 * CE QU'IL REMPLACE
 * Trois pages d'accueil existaient : celle du portail (huit sections animées,
 * cinq écrans de défilement), celle du wiki Azalée et celle d'Achilléa. Chacune
 * répétait la même chose — un hero, une présentation, des compteurs, un pied de
 * page — pour un visiteur qui, lui, cherche UNE chose : un joueur, un clan, une
 * actualité, la date du prochain événement.
 *
 * CE QU'IL EST
 * Un point d'entrée qui tient dans la fenêtre, et qui agit plutôt qu'il ne
 * raconte : la recherche traverse les trois domaines et répond pendant la
 * frappe ; le fil mêle les deux corpus d'articles ; le classement e-sport est
 * lu dans la base, pas demandé à une API qui peut ne pas répondre ; les
 * compteurs sont des chiffres réels, pas des arguments. Le fond alterne entre
 * les trois identités visuelles, qui n'avaient plus de surface depuis la fusion.
 *
 * Presque pas de texte : ce qui est ici est cliquable.
 */
async function chargerAccueil() {
	const supabase = await createClient();
	const pool = getPgPool();

	const [
		{ rows: fil },
		{ count: nbPersonnages },
		{ count: nbTechniques },
		{ count: nbObjets },
		classement,
		chiffresEsport,
		evenements,
		{ rows: effectifs },
	] = await Promise.all([
		pool.query<EntreeFil>(
			`SELECT slug, title, published_at, app FROM articles
			  WHERE status = 'published' AND app = ANY($1::text[])
			  ORDER BY published_at DESC NULLS LAST
			  LIMIT 5`,
			[["azalee", "website"]]
		),
		supabase.from("inagle_characters").select("id", { count: "exact", head: true }),
		supabase.from("inagle_skills").select("id", { count: "exact", head: true }),
		supabase.from("inagle_items").select("id", { count: "exact", head: true }),
		lireClassement(2, 5),
		lireChiffresEsport(),
		getCalendarEvents(),
		pool.query<{ membres: string }>(
			`SELECT count(*) AS membres FROM discord_appartenances WHERE left_at IS NULL AND is_bot = false`
		),
	]);

	const maintenant = Date.now();
	const prochain =
		evenements
			.map((evenement) => ({
				debut: evenement.start?.dateTime || evenement.start?.date,
				fin: evenement.end?.dateTime || evenement.end?.date,
				resume: evenement.summary,
			}))
			.filter((evenement) => {
				const cible = evenement.fin ?? evenement.debut;
				return cible ? new Date(cible).getTime() >= maintenant : false;
			})
			.sort((a, b) => new Date(a.debut || 0).getTime() - new Date(b.debut || 0).getTime())[0] ??
		null;

	return {
		chiffresEsport,
		classement,
		fil: fil ?? [],
		membres: Number(effectifs[0]?.membres ?? 0),
		prochain,
		wiki: {
			objets: nbObjets ?? 0,
			personnages: nbPersonnages ?? 0,
			techniques: nbTechniques ?? 0,
		},
	};
}

/** Chiffre + libellé : la brique de données, et un lien vers ce qu'elle compte. */
function Chiffre({ valeur, libelle, href }: { valeur: number; libelle: string; href: string }) {
	return (
		<Link
			href={href}
			className="flex min-w-0 flex-col rounded-xl bg-white/5 px-3 py-2 transition-colors hover:bg-white/10"
		>
			<span className="text-lg font-bold tabular-nums text-white">
				{valeur.toLocaleString("fr-FR")}
			</span>
			<span className="truncate text-[11px] text-white/50">{libelle}</span>
		</Link>
	);
}

function Carte({
	children,
	className,
	titre,
	lien,
	libelleLien,
}: {
	children: React.ReactNode;
	className?: string;
	titre: string;
	lien: string;
	libelleLien: string;
}) {
	return (
		<section
			className={`flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-xs ${className ?? ""}`}
		>
			<div className="flex items-baseline justify-between gap-2">
				<h2 className="text-xs font-semibold uppercase tracking-wider text-white/60">{titre}</h2>
				<Link
					href={lien}
					className="shrink-0 text-[11px] font-medium text-white/50 hover:text-white"
				>
					{libelleLien}
				</Link>
			</div>
			{children}
		</section>
	);
}

export default async function Home() {
	const donnees = await chargerAccueil();

	return (
		<>
			<OrganizationSchema />
			<WebsiteSchema />
			<RealtimeSettingsListener />

			<div className="relative isolate">
				<FondAlternant fonds={FONDS} />

				<div className="accueil-unifie mx-auto grid w-full max-w-7xl grid-cols-1 gap-3 px-4 py-5 lg:grid-cols-12 lg:px-6">
					{/* Identité + recherche : la seule zone qui parle, et elle est courte. */}
					<section className="flex flex-col justify-center gap-4 lg:col-span-7">
						<div className="flex items-center gap-3">
							<Image
								src="/RG_Logo_V2.5_NB.webp"
								alt=""
								width={56}
								height={56}
								priority
								className="size-12 object-contain lg:size-14"
							/>
							<div>
								<h1 className="text-fluid-xl font-bold leading-tight text-white">Rose Griffon</h1>
								<p className="text-xs text-white/60">
									Wiki Victory Road · Compétition · Communauté Inazuma Eleven
								</p>
							</div>
						</div>

						<RechercheUnifiee />

						<div className="grid grid-cols-3 gap-2">
							<Chiffre
								valeur={donnees.wiki.personnages}
								libelle="joueurs au wiki"
								href="/wiki/chara"
							/>
							<Chiffre valeur={donnees.wiki.techniques} libelle="techniques" href="/wiki/skill" />
							<Chiffre valeur={donnees.wiki.objets} libelle="objets" href="/wiki/item" />
							<Chiffre
								valeur={donnees.chiffresEsport.joueurs}
								libelle="joueurs classés"
								href="/achillea/ranked/leaderboard"
							/>
							<Chiffre valeur={donnees.chiffresEsport.clans} libelle="clans" href="/achillea/clans" />
							<Chiffre valeur={donnees.membres} libelle="membres Discord" href="/community" />
						</div>

						<div className="flex flex-wrap gap-2">
							<a
								href={INVITATION_DISCORD}
								target="_blank"
								rel="noopener noreferrer"
								className="rounded-full bg-discord px-4 py-2 text-sm font-semibold text-rg-sur-marine"
							>
								Discord
							</a>
							<Link
								href="/wiki"
								className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white"
							>
								Wiki
							</Link>
							<Link
								href="/achillea"
								className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white"
							>
								E-sport
							</Link>
						</div>
					</section>

					<Carte
						titre="Prochain événement"
						lien="/evenements"
						libelleLien="Calendrier"
						className="lg:col-span-5"
					>
						{donnees.prochain ? (
							<div className="flex min-h-0 flex-col gap-1">
								<p className="line-clamp-2 text-base font-semibold text-white">
									{donnees.prochain.resume ?? "Événement"}
								</p>
								<p className="text-sm text-white/60">
									{new Intl.DateTimeFormat("fr-FR", {
										dateStyle: "full",
										timeStyle: donnees.prochain.debut?.includes("T") ? "short" : undefined,
									}).format(new Date(donnees.prochain.debut ?? Date.now()))}
								</p>
							</div>
						) : (
							<p className="text-sm text-white/50">Rien de programmé pour l&apos;instant.</p>
						)}
					</Carte>

					<Carte titre="Actualité" lien="/news" libelleLien="Tout le fil" className="lg:col-span-7">
						<ul className="flex min-h-0 flex-col divide-y divide-white/5">
							{donnees.fil.map((article) => (
								<li key={article.slug} className="min-w-0 py-1.5">
									<Link
										href={`/news/${article.slug}`}
										className="flex items-baseline justify-between gap-3 hover:text-white"
									>
										<span className="truncate text-sm text-white/85">{article.title}</span>
										<span className="shrink-0 text-[10px] uppercase tracking-wide text-white/35">
											{article.app === "azalee" ? "Azalée" : "Chronique"}
										</span>
									</Link>
								</li>
							))}
							{donnees.fil.length === 0 && (
								<li className="py-2 text-sm text-white/50">Aucune publication pour le moment.</li>
							)}
						</ul>
					</Carte>

					<Carte
						titre="Classement 1c1"
						lien="/achillea/ranked/leaderboard"
						libelleLien="Classement complet"
						className="lg:col-span-5"
					>
						<ol className="flex min-h-0 flex-col divide-y divide-white/5">
							{donnees.classement.map((ligne) => (
								<li
									key={ligne.userId}
									className="flex items-center gap-2 py-1.5 text-sm text-white/85"
								>
									<span className="w-4 shrink-0 text-right text-xs tabular-nums text-white/40">
										{ligne.rang}
									</span>
									<span className="truncate">{ligne.nom}</span>
									<span className="ml-auto shrink-0 text-xs tabular-nums text-white/60">
										{ligne.elo}
									</span>
									{ligne.palier && (
										<span className="shrink-0 text-[10px] uppercase tracking-wide text-white/35">
											{ligne.palier}
										</span>
									)}
								</li>
							))}
							{donnees.classement.length === 0 && (
								<li className="py-2 text-sm text-white/50">Aucune partie classée encore jouée.</li>
							)}
						</ol>
					</Carte>

					{/* Raccourcis + légal : le pied de page est masqué sur cette route. */}
					<nav aria-label="Raccourcis" className="flex flex-wrap items-center gap-2 lg:col-span-12">
						{RACCOURCIS.map((entree) => (
							<Link
								key={entree.href}
								href={entree.href}
								className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/40 hover:text-white"
							>
								{entree.libelle}
							</Link>
						))}
						<span className="ml-auto flex flex-wrap gap-3 text-[11px] text-white/35">
							<Link href="/legal/mentions-legales" className="hover:text-white">
								Mentions légales
							</Link>
							<Link href="/legal/confidentialite" className="hover:text-white">
								Confidentialité
							</Link>
						</span>
					</nav>
				</div>
			</div>
		</>
	);
}
