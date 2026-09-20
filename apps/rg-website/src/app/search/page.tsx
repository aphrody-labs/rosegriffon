import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@rosegriffon/ui";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Newspaper, Search, Swords, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";

import { searchGlobal, type EnhancedSearchResult } from "@/app/actions/search";
import { getPgPool } from "@/lib/db/pg";

export const metadata: Metadata = {
	alternates: { canonical: "https://rosegriffon.fr/search" },
	description: "Recherche unifiée dans tout le réseau Rose Griffon : Association, Encyclopédie Wiki et E-Sport Achilléa.",
	robots: { follow: true, index: false },
	title: "Recherche unifiée | Rose Griffon",
};

export const dynamic = "force-dynamic";

interface SearchArticleRow {
	id: string;
	title: string;
	slug: string;
	excerpt: string | null;
	created_at: string | null;
}

interface EsportTopic {
	title: string;
	description: string;
	url: string;
	icon: "clans" | "ranked" | "tournaments" | "league";
}

const ESPORT_TOPICS: { keywords: string[]; topic: EsportTopic }[] = [
	{
		keywords: ["clan", "clans", "guilde", "équipe", "team"],
		topic: {
			title: "Annuaire des Clans E-Sport",
			description: "Rejoignez ou créez un clan compétitif Inazuma Eleven sur Achilléa.",
			url: "/achillea/clans",
			icon: "clans",
		},
	},
	{
		keywords: ["ranked", "classement", "elo", "ladder", "palier", "tiers", "compétition", "match"],
		topic: {
			title: "Mode Classé & Classements ELO",
			description: "Consultez les classements ELO 1v1 & 2v2 et suivez votre progression compétitive.",
			url: "/achillea/ranked",
			icon: "ranked",
		},
	},
	{
		keywords: ["tournoi", "tournois", "tournament", "championnat", "circuit"],
		topic: {
			title: "Tournois & Circuit Officiel",
			description: "Participez aux tournois officiels et communautaires ou créez votre propre tournoi.",
			url: "/achillea/tournaments",
			icon: "tournaments",
		},
	},
	{
		keywords: ["league", "ligue", "astral", "saison"],
		topic: {
			title: "Astral League",
			description: "La ligue majeure d'Achilléa réunissant les meilleurs compétiteurs du circuit.",
			url: "/achillea/leagues/astral",
			icon: "league",
		},
	},
];

export default async function SearchPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string; tab?: string }>;
}) {
	const params = await searchParams;
	const query = params.q?.trim() || "";
	const activeTab = params.tab || "all";

	let articles: SearchArticleRow[] = [];
	let wikiResults: EnhancedSearchResult[] = [];
	let esportMatches: EsportTopic[] = [];

	if (query) {
		const [articlesRes, wikiRes] = await Promise.allSettled([
			// 1. Articles Association
			(async () => {
				try {
					const pool = getPgPool();
					const like = `%${query}%`;
					const { rows } = await pool.query<SearchArticleRow>(
						`SELECT id, title, slug, excerpt, created_at
						 FROM articles
						 WHERE (title ILIKE $1 OR content ILIKE $1 OR excerpt ILIKE $1)
						 AND status = $2
						 LIMIT 10`,
						[like, "published"]
					);
					return rows;
				} catch (error) {
					console.error("Error searching articles:", error);
					return [];
				}
			})(),
			// 2. Wiki Azalée (smart search)
			searchGlobal(query),
		]);

		if (articlesRes.status === "fulfilled") {
			articles = articlesRes.value;
		}
		if (wikiRes.status === "fulfilled") {
			wikiResults = wikiRes.value;
		}

		// 3. E-Sport Achilléa topics matching
		const qLower = query.toLowerCase();
		esportMatches = ESPORT_TOPICS.filter((entry) =>
			entry.keywords.some((k) => qLower.includes(k) || k.includes(qLower))
		).map((e) => e.topic);
	}

	const totalCount = articles.length + wikiResults.length + esportMatches.length;
	const hasResults = totalCount > 0;

	return (
		<div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
			{/* En-tête & Formulaire */}
			<div className="space-y-4">
				<div className="space-y-1">
					<h1 className="text-3xl font-black tracking-tight font-expressive-title">
						Recherche Unifiée
					</h1>
					<p className="text-sm text-on-surface-variant">
						Explorez les articles de l'Association, l'Encyclopédie Wiki et l'E-Sport Achilléa.
					</p>
				</div>

				<form action="/search" method="get" className="flex gap-2 max-w-2xl">
					<div className="relative flex-1">
						<Input
							name="q"
							defaultValue={query}
							placeholder="Rechercher (Mark Evans, clan, tournoi, article)..."
							className="h-12 pl-10 pr-4 text-base rounded-xl bg-surface-container-high border-outline-variant/20"
							autoFocus
						/>
						<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant/70" />
					</div>
					<Button type="submit" className="h-12 px-6 rounded-xl font-bold">
						Rechercher
					</Button>
				</form>
			</div>

			{query && (
				<div className="space-y-6">
					{/* Onglets de filtrage */}
					<div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-outline-variant/15">
						<Link
							href={`/search?q=${encodeURIComponent(query)}&tab=all`}
							className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors select-none ${
								activeTab === "all"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-on-surface-variant hover:bg-surface-container-high"
							}`}
						>
							Tous ({totalCount})
						</Link>
						<Link
							href={`/search?q=${encodeURIComponent(query)}&tab=association`}
							className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors select-none ${
								activeTab === "association"
									? "bg-rose-griffon text-white shadow-xs"
									: "text-on-surface-variant hover:bg-surface-container-high"
							}`}
						>
							Association ({articles.length})
						</Link>
						<Link
							href={`/search?q=${encodeURIComponent(query)}&tab=wiki`}
							className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors select-none ${
								activeTab === "wiki"
									? "bg-secondary text-secondary-foreground shadow-xs"
									: "text-on-surface-variant hover:bg-surface-container-high"
							}`}
						>
							Wiki ({wikiResults.length})
						</Link>
						<Link
							href={`/search?q=${encodeURIComponent(query)}&tab=esport`}
							className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors select-none ${
								activeTab === "esport"
									? "bg-achillea-violet text-white dark:bg-achillea-lime dark:text-black shadow-xs"
									: "text-on-surface-variant hover:bg-surface-container-high"
							}`}
						>
							E-Sport ({esportMatches.length})
						</Link>
					</div>

					{!hasResults && (
						<div className="text-center py-16 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-3">
							<Search className="size-12 mx-auto text-on-surface-variant/40" />
							<p className="text-lg font-bold text-on-surface">Aucun résultat trouvé pour "{query}"</p>
							<p className="text-sm text-on-surface-variant max-w-md mx-auto">
								Vérifiez l'orthographe ou essayez un mot-clé plus court (nom de joueur, technique, article ou tournoi).
							</p>
						</div>
					)}

					{/* SECTION 1 : WIKI AZALÉE */}
					{(activeTab === "all" || activeTab === "wiki") && wikiResults.length > 0 && (
						<section className="space-y-3">
							<div className="flex items-center justify-between">
								<h2 className="text-lg font-black flex items-center gap-2 text-secondary">
									<BookOpen className="size-5" />
									Encyclopédie Wiki
									<span className="text-xs font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
										{wikiResults.length}
									</span>
								</h2>
								<Link href="/wiki" className="text-xs font-bold text-secondary hover:underline">
									Explorer le wiki →
								</Link>
							</div>

							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{wikiResults.map((item) => {
									const wikiHref = item.url.startsWith("/wiki")
										? item.url
										: item.url.startsWith("/")
											? `/wiki${item.url}`
											: `/wiki/${item.url}`;

									return (
										<Link key={item.id} href={wikiHref} className="group">
											<Card className="h-full bg-surface-container-low hover:bg-surface-container border-outline-variant/15 transition-all duration-200 group-hover:border-secondary/30">
												<CardHeader className="p-3 pb-2 flex-row items-center gap-3">
													{item.imageUrl ? (
														<div className="relative size-10 rounded-lg overflow-hidden bg-surface-container-high shrink-0 border border-outline-variant/10">
															<Image
																src={item.imageUrl}
																alt={item.title}
																fill
																sizes="40px"
																className="object-cover"
																unoptimized
															/>
														</div>
													) : (
														<div className="size-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0 text-secondary">
															<BookOpen className="size-5" />
														</div>
													)}
													<div className="min-w-0 flex-1">
														<CardTitle className="text-sm font-bold truncate group-hover:text-secondary transition-colors">
															{item.title}
														</CardTitle>
														<p className="text-xs text-on-surface-variant/80 truncate">
															{item.subtitle}
															{item.element && ` • ${item.element}`}
															{item.position && ` • ${item.position}`}
														</p>
													</div>
												</CardHeader>
											</Card>
										</Link>
									);
								})}
							</div>
						</section>
					)}

					{/* SECTION 2 : ARTICLES ASSOCIATION */}
					{(activeTab === "all" || activeTab === "association") && articles.length > 0 && (
						<section className="space-y-3">
							<div className="flex items-center justify-between">
								<h2 className="text-lg font-black flex items-center gap-2 text-rose-griffon">
									<Newspaper className="size-5" />
									Association & Articles
									<span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-griffon/10 text-rose-griffon border border-rose-griffon/20">
										{articles.length}
									</span>
								</h2>
								<Link href="/chroniques" className="text-xs font-bold text-rose-griffon hover:underline">
									Toutes les actualités →
								</Link>
							</div>

							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{articles.map((article) => (
									<Link key={article.id} href={`/chroniques/${article.slug}`} className="group">
										<Card className="h-full bg-surface-container-low hover:bg-surface-container border-outline-variant/15 transition-all duration-200 group-hover:border-rose-griffon/30">
											<CardHeader className="p-4 pb-2">
												<CardTitle className="text-sm font-bold line-clamp-2 group-hover:text-rose-griffon transition-colors">
													{article.title}
												</CardTitle>
											</CardHeader>
											{article.excerpt && (
												<CardContent className="p-4 pt-0">
													<p className="text-xs text-on-surface-variant line-clamp-2">
														{article.excerpt}
													</p>
												</CardContent>
											)}
										</Card>
									</Link>
								))}
							</div>
						</section>
					)}

					{/* SECTION 3 : E-SPORT ACHILLÉA */}
					{(activeTab === "all" || activeTab === "esport") && esportMatches.length > 0 && (
						<section className="space-y-3">
							<div className="flex items-center justify-between">
								<h2 className="text-lg font-black flex items-center gap-2 text-achillea-violet dark:text-achillea-lime">
									<Swords className="size-5" />
									E-Sport Achilléa
									<span className="text-xs font-bold px-2 py-0.5 rounded-full bg-achillea-violet/10 text-achillea-violet dark:bg-achillea-lime/10 dark:text-achillea-lime border border-achillea-violet/20">
										{esportMatches.length}
									</span>
								</h2>
								<Link href="/achillea" className="text-xs font-bold text-achillea-violet dark:text-achillea-lime hover:underline">
									Espace E-Sport →
								</Link>
							</div>

							<div className="grid gap-3 sm:grid-cols-2">
								{esportMatches.map((topic) => {
									const IconComp =
										topic.icon === "clans"
											? Users
											: topic.icon === "ranked"
												? Swords
												: topic.icon === "tournaments"
													? Trophy
													: BookOpen;

									return (
										<Link key={topic.url} href={topic.url} className="group">
											<Card className="h-full bg-surface-container-low hover:bg-surface-container border-outline-variant/15 transition-all duration-200 group-hover:border-achillea-violet/40">
												<CardHeader className="p-4 flex-row items-center gap-3">
													<div className="size-10 rounded-xl bg-achillea-violet/10 dark:bg-achillea-lime/10 text-achillea-violet dark:text-achillea-lime flex items-center justify-center shrink-0">
														<IconComp className="size-5" />
													</div>
													<div className="min-w-0 flex-1">
														<CardTitle className="text-sm font-bold truncate group-hover:text-achillea-violet dark:group-hover:text-achillea-lime transition-colors">
															{topic.title}
														</CardTitle>
														<p className="text-xs text-on-surface-variant truncate">
															{topic.description}
														</p>
													</div>
												</CardHeader>
											</Card>
										</Link>
									);
								})}
							</div>
						</section>
					)}
				</div>
			)}
		</div>
	);
}
