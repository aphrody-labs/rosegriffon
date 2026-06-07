import { Badge, Button, Input } from "@rose-griffon/ui";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
	Calendar,
	ChevronLeft,
	ChevronRight,
	Eye,
	Heart,
	Lock,
	Newspaper,
	Search,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BreadcrumbSchema } from "@/components/shared/StructuredData";

import { getArticles } from "@/lib/api/articles";
import { getPatreonFeedForViewer } from "@/lib/patreon/feed";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Labels des catégories
const categoryLabels: Record<string, string> = {
	achilleateam: "Équipe Achilléa",
	actualites: "Actualités",
	azaleeteam: "Équipe Azalée",
	collabteam: "Partenaires",
	communaute: "Communauté",
	coulisses: "Coulisses",
	dessinateurteam: "Équipe Dessinateur",
	loreteam: "Équipe Lore",
	mediationteam: "Médiation",
	productionteam: "Équipe Production",
	projets: "Projets",
	socialteam: "Équipe Réseaux",
	technique: "Technique",
};

// Génération des métadonnées SEO dynamiques
export async function generateMetadata({
	searchParams,
}: {
	searchParams: Promise<{ q?: string; page?: string; category?: string }>;
}): Promise<Metadata> {
	const params = await searchParams;
	const query = params.q || "";
	const page = Number(params.page) || 1;
	const category = params.category || "";

	let title = "Chroniques du Bouquet | Rose Griffon";
	let description =
		"Actualités, annonces et journal de bord de l'association Rose Griffon : événements, streaming et communauté Inazuma Eleven.";

	if (category && categoryLabels[category]) {
		title = `${categoryLabels[category]} - Chroniques | Rose Griffon`;
		description = `Découvrez toutes les chroniques de type "${categoryLabels[category]}" de l'association Rose Griffon : actualités et journal de bord.`;
	}

	if (query) {
		title = `Recherche "${query}" - Chroniques | Rose Griffon`;
		description = `Résultats de recherche pour "${query}" dans les chroniques Rose Griffon.`;
	}

	if (page > 1 && !query) {
		const categoryPart = category && categoryLabels[category] ? ` ${categoryLabels[category]}` : "";
		title = `Chroniques${categoryPart} - Page ${page} | Rose Griffon`;
		description = `Page ${page} de nos chroniques${categoryPart.toLowerCase()}.`;
	}

	const urlParams = new URLSearchParams();
	if (query) {
		urlParams.set("q", query);
	}
	if (category) {
		urlParams.set("category", category);
	}
	if (page > 1) {
		urlParams.set("page", page.toString());
	}
	const urlSuffix = urlParams.toString() ? `?${urlParams.toString()}` : "";

	return {
		alternates: {
			canonical: `https://rosegriffon.fr/chroniques${urlSuffix}`,
		},
		description,
		openGraph: {
			description,
			locale: "fr_FR",
			siteName: "Rose Griffon",
			title,
			type: "website",
			url: `https://rosegriffon.fr/chroniques${urlSuffix}`,
			images: [
				{
					url: "/opengraph-image",
					width: 1200,
					height: 630,
					alt: "Rose Griffon - Association Inazuma Eleven",
				},
			],
		},
		robots: {
			follow: true,
			index: !query,
		},
		title,
		twitter: {
			card: "summary_large_image",
			description,
			site: "@rose_griffon",
			title,
		},
	};
}

// Catégories disponibles
const categories = [
	{ label: "Tout", value: "" },
	{ label: "Actualités", value: "actualites" },
	{ label: "Projets", value: "projets" },
	{ label: "Coulisses", value: "coulisses" },
	{ label: "Communauté", value: "communaute" },
	{ label: "Technique", value: "technique" },
	{ label: "Équipe Lore", value: "loreteam" },
	{ label: "Équipe Dessinateur", value: "dessinateurteam" },
	{ label: "Équipe Production", value: "productionteam" },
	{ label: "Équipe Réseaux", value: "socialteam" },
	{ label: "Équipe Achilléa", value: "achilleateam" },
	{ label: "Équipe Azalée", value: "azaleeteam" },
	{ label: "Médiation", value: "mediationteam" },
	{ label: "Partenaires", value: "collabteam" },
];

export default async function ChroniquesListPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string; page?: string; category?: string }>;
}) {
	const params = await searchParams;
	const query = params.q || "";
	const page = Number(params.page) || 1;
	const selectedCategory = params.category || "";
	const isPatreonFilter = selectedCategory === "patreon";

	// Fetch Patreon access en server uniquement si nécessaire (filtre actif ou
	// Pour décider si on affiche le filtre dans la barre).
	const patreonFeed = await getPatreonFeedForViewer({
		limit: isPatreonFilter ? 24 : 1,
	});
	const showPatreonFilter = patreonFeed.access.linked;

	// Si filtre Patreon actif → on n'appelle pas getArticles (vide la grille).
	const { data: articles, meta } = isPatreonFilter
		? { data: [], meta: { total: 0, totalPages: 0 } }
		: await getArticles({
				category: selectedCategory || undefined,
				limit: 12,
				page,
				query,
				status: "published",
			});

	const patreonPosts = isPatreonFilter ? patreonFeed.posts : [];

	// Counts par catégorie pour masquer les filtres vides — bypass RLS pour stats agrégées
	const adminClient = createAdminClient();
	const { data: categoryRows } = adminClient
		? await adminClient.from("articles").select("category").eq("status", "published")
		: { data: null };
	const categoryCounts = new Map<string, number>();
	for (const row of categoryRows ?? []) {
		const key = row.category ?? "";
		categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
	}
	const totalPublished = categoryRows?.length ?? 0;
	const visibleCategories = categories.filter(
		(cat) => cat.value === "" || (categoryCounts.get(cat.value) ?? 0) > 0
	);

	// Génération des URLs de pagination
	const buildPageUrl = (pageNum: number) => {
		const urlParams = new URLSearchParams();
		if (query) {
			urlParams.set("q", query);
		}
		if (selectedCategory) {
			urlParams.set("category", selectedCategory);
		}
		if (pageNum > 1) {
			urlParams.set("page", pageNum.toString());
		}
		return `/chroniques${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;
	};

	return (
		<div className="min-h-screen bg-background">
			<BreadcrumbSchema
				items={[
					{ item: "/", name: "Accueil" },
					{ item: "/chroniques", name: "Chroniques" },
				]}
			/>

			{/* Hero Section */}
			<section
				className="relative overflow-hidden bg-linear-to-br from-[#a14b3f]/10 via-background to-[#344E8C]/10 animate-in fade-in slide-in-from-bottom-4 duration-500"
				style={{ animationDelay: "50ms" }}
			>
				{/* Blur blobs décoratifs */}
				<div className="absolute -left-32 -top-32 size-96 bg-[#a14b3f]/20 rounded-full blur-[128px] pointer-events-none" />
				<div className="absolute -right-32 -bottom-32 size-96 bg-[#344E8C]/20 rounded-full blur-[128px] pointer-events-none" />

				<div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16 lg:py-20">
					<div className="text-center space-y-6">
						{/* Badge */}
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/30">
							<Newspaper className="size-4 text-primary" aria-hidden="true" />
							<span className="text-sm font-semibold text-primary">Journal de bord</span>
						</div>

						{/* Titre */}
						<h1 className="text-4xl sm:text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-linear-to-r from-[#a14b3f] via-[#d16854] to-[#344E8C]">
							Chroniques du Bouquet
						</h1>

						{/* Description */}
						<p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
							Actualités, annonces et coulisses de l&apos;association Rose Griffon. Découvrez les
							dernières nouvelles de notre communauté Inazuma Eleven.
						</p>

						{/* Barre de recherche */}
						<form action="/chroniques" method="GET" className="max-w-xl mx-auto mt-8">
							<div className="relative">
								<label htmlFor="chroniques-search" className="sr-only">
									Rechercher une chronique
								</label>
								<Search
									className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
									aria-hidden="true"
								/>
								<Input
									id="chroniques-search"
									type="search"
									name="q"
									placeholder="Rechercher une chronique..."
									defaultValue={query}
									className="w-full h-12 pl-12 pr-4 rounded-full border-2 border-border/50 bg-background/80 backdrop-blur-sm focus:border-primary/50 text-base"
								/>
								{selectedCategory && (
									<input type="hidden" name="category" value={selectedCategory} />
								)}
							</div>
						</form>
					</div>
				</div>
			</section>

			{/* Filtres catégories — Patreon injecté en tête si user lié */}
			<section
				className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm border-b border-border animate-in fade-in slide-in-from-bottom-4 duration-500"
				style={{ animationDelay: "100ms" }}
			>
				<div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4">
					<div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 -mb-2">
						{showPatreonFilter && (
							<Link
								href="/chroniques?category=patreon"
								className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
									isPatreonFilter
										? "bg-[#FF424D] text-white shadow-lg shadow-[#FF424D]/25"
										: "bg-[#FF424D]/10 text-[#FF424D] hover:bg-[#FF424D]/20 border border-[#FF424D]/30"
								}`}
								aria-current={isPatreonFilter ? "page" : undefined}
							>
								<Heart className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
								Patreon
							</Link>
						)}
						{visibleCategories.map((cat) => {
							const isActive = !isPatreonFilter && selectedCategory === cat.value;
							const count =
								cat.value === "" ? totalPublished : (categoryCounts.get(cat.value) ?? 0);
							return (
								<Link
									key={cat.value}
									href={cat.value ? `/chroniques?category=${cat.value}` : "/chroniques"}
									aria-current={isActive ? "page" : undefined}
									className={`
                    shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                    ${
											isActive
												? "bg-linear-to-r from-[#a14b3f] to-[#344E8C] text-white shadow-lg shadow-[#a14b3f]/25"
												: "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
										}
                  `}
								>
									{cat.label}
									<span
										className={`text-xs ${isActive ? "text-white/85" : "text-muted-foreground/75"}`}
										aria-hidden="true"
									>
										{count}
									</span>
								</Link>
							);
						})}
					</div>
				</div>
			</section>

			{/* Contenu principal */}
			<section className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12">
				{/* Indicateur de recherche/filtre */}
				{(query || selectedCategory) && (
					<div
						className="mb-8 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500"
						style={{ animationDelay: "150ms" }}
					>
						<span className="text-muted-foreground">Résultats pour :</span>
						{query && (
							<Badge variant="secondary" className="text-sm">
								&quot;{query}&quot;
							</Badge>
						)}
						{isPatreonFilter ? (
							<Badge className="border-0 bg-[#FF424D]/15 text-sm font-medium text-[#FF424D]">
								<Heart className="mr-1 size-3 fill-current" aria-hidden="true" />
								Patreon
								{patreonFeed.access.isActiveMember ? " · membre actif" : " · publics"}
							</Badge>
						) : (
							selectedCategory &&
							categoryLabels[selectedCategory] && (
								<Badge
									variant="outline"
									className="text-sm border-primary text-primary font-medium"
								>
									{categoryLabels[selectedCategory]}
								</Badge>
							)
						)}
						<Link href="/chroniques" className="text-sm text-primary font-medium hover:underline">
							Effacer les filtres
						</Link>
					</div>
				)}

				{/* Grille Patreon — même format que les articles pour cohérence visuelle */}
				{isPatreonFilter ? (
					patreonPosts.length > 0 ? (
						<div
							className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
							style={{ animationDelay: "200ms" }}
						>
							{patreonPosts.map((post) => {
								const cover = post.cover?.signedUrl;
								return (
									<a
										key={post.id}
										href={post.url ?? "https://patreon.com/RoseGriffon"}
										target="_blank"
										rel="noopener noreferrer"
										className="group rounded-2xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#FF424D] focus-visible:ring-offset-2"
									>
										<article className="h-full flex flex-col overflow-hidden rounded-2xl bg-card border border-border/50 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
											<div className="relative aspect-video overflow-hidden bg-muted">
												{cover ? (
													<img
														src={cover}
														alt=""
														loading="lazy"
														className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
													/>
												) : (
													<div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
														<Heart className="size-12" aria-hidden="true" />
													</div>
												)}
												<div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
												<div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
													<Badge className="border-0 bg-[#FF424D]/95 text-xs font-semibold text-white backdrop-blur-sm">
														Patreon
													</Badge>
													{post.isPaid && (
														<Badge className="gap-1 border-0 bg-[#c9a958]/95 text-xs font-semibold text-[#0c1730] backdrop-blur-sm">
															<Lock className="size-3" aria-hidden="true" />
															Mécène
														</Badge>
													)}
												</div>
											</div>
											<div className="flex flex-col flex-1 p-4 sm:p-5 gap-2">
												<h2 className="text-base sm:text-lg font-bold text-foreground group-hover:text-[#FF424D] transition-colors line-clamp-2 leading-snug">
													{post.title ?? "Sans titre"}
												</h2>
												{post.excerpt && (
													<p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
														{post.excerpt}
													</p>
												)}
												<div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-3 border-t border-border/30">
													<div className="flex items-center gap-1.5">
														<Calendar className="w-3.5 h-3.5" aria-hidden="true" />
														{post.publishedAt ? (
															<time dateTime={post.publishedAt}>
																{format(new Date(post.publishedAt), "d MMM yyyy", { locale: fr })}
															</time>
														) : (
															<span>—</span>
														)}
													</div>
												</div>
											</div>
											<div className="h-0.5 bg-[#FF424D] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
										</article>
									</a>
								);
							})}
						</div>
					) : (
						<div className="text-center py-16">
							<div className="size-20 mx-auto mb-6 rounded-full bg-[#FF424D]/10 flex items-center justify-center">
								<Heart className="size-10 text-[#FF424D]" aria-hidden="true" />
							</div>
							<h2 className="text-2xl font-bold text-foreground mb-2">
								Aucun post Patreon visible
							</h2>
							<p className="text-muted-foreground mb-6">
								{patreonFeed.access.isActiveMember
									? "Les nouveaux posts archivés apparaîtront ici."
									: "Devenez mécène pour accéder à tous les posts."}
							</p>
							{!patreonFeed.access.isActiveMember && (
								<Button asChild className="bg-[#FF424D] text-white hover:bg-[#e63b46]">
									<Link href="/nous-soutenir#tiers">Voir les paliers</Link>
								</Button>
							)}
						</div>
					)
				) : articles && articles.length > 0 ? (
					<div
						className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
						style={{ animationDelay: "200ms" }}
					>
						{articles.map((article, index) => (
							<Link
								key={article.id}
								href={`/chroniques/${article.slug}`}
								className="group"
								style={{ animationDelay: `${200 + index * 50}ms` }}
							>
								<article className="h-full flex flex-col overflow-hidden rounded-2xl bg-card border border-border/50 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
									{/* Image — ratio 16:9 */}
									<div className="relative aspect-video overflow-hidden">
										<Image
											src={article.featured_image_url || "/images/placeholder-chronicle.svg"}
											alt={article.title}
											fill
											sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
											className="object-cover group-hover:scale-105 transition-transform duration-500"
										/>
										{/* Gradient overlay */}
										<div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />

										{/* Catégorie badge */}
										{article.category && (
											<div className="absolute top-3 left-3">
												<Badge className="bg-background/95 text-foreground hover:bg-background backdrop-blur-sm text-xs">
													{categoryLabels[article.category] || article.category}
												</Badge>
											</div>
										)}
									</div>

									{/* Contenu */}
									<div className="flex flex-col flex-1 p-4 sm:p-5 gap-2">
										{/* Titre */}
										<h2 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
											{article.title}
										</h2>

										{/* Extrait */}
										{article.excerpt && (
											<p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
												{article.excerpt}
											</p>
										)}

										{/* Meta — poussé en bas */}
										<div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-3 border-t border-border/30">
											<div className="flex items-center gap-1.5">
												<Calendar className="w-3.5 h-3.5" />
												<time dateTime={article.published_at || article.created_at || ""}>
													{format(
														new Date(article.published_at || article.created_at || ""),
														"d MMM yyyy",
														{ locale: fr }
													)}
												</time>
											</div>
											<div className="flex items-center gap-1.5">
												<Eye className="w-3.5 h-3.5" />
												<span>{article.view_count || 0} vues</span>
											</div>
										</div>
									</div>

									{/* Hover indicator */}
									<div className="h-0.5 bg-linear-to-r from-[#a14b3f] to-[#344E8C] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
								</article>
							</Link>
						))}
					</div>
				) : (
					/* État vide */
					<div
						className="text-center py-16 animate-in fade-in slide-in-from-bottom-4 duration-500"
						style={{ animationDelay: "200ms" }}
					>
						<div className="size-20 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
							<Newspaper className="size-10 text-muted-foreground/50" />
						</div>
						<h2 className="text-2xl font-bold text-foreground mb-2">Aucune chronique trouvée</h2>
						<p className="text-muted-foreground mb-6">
							{query
								? `Aucun résultat pour "${query}"`
								: "Il n'y a pas encore de chroniques publiées."}
						</p>
						{(query || selectedCategory) && (
							<Button asChild variant="outline">
								<Link href="/chroniques">Voir toutes les chroniques</Link>
							</Button>
						)}
					</div>
				)}

				{/* Pagination */}
				{meta && meta.totalPages > 1 && (
					<nav
						className="flex items-center justify-center gap-2 mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500"
						style={{ animationDelay: "300ms" }}
						aria-label="Pagination"
					>
						{/* Bouton précédent */}
						<Button
							variant="outline"
							size="icon"
							asChild={page > 1}
							disabled={page <= 1}
							className="rounded-full"
						>
							{page > 1 ? (
								<Link href={buildPageUrl(page - 1)} aria-label="Page précédente">
									<ChevronLeft className="size-4" />
								</Link>
							) : (
								<span>
									<ChevronLeft className="size-4" />
								</span>
							)}
						</Button>

						{/* Numéros de page */}
						<div className="flex items-center gap-1">
							{Array.from({ length: meta.totalPages }, (_, i) => i + 1)
								.filter((p) => {
									// Afficher: première, dernière, et 2 pages autour de la page courante
									if (p === 1 || p === meta.totalPages) {
										return true;
									}
									if (Math.abs(p - page) <= 1) {
										return true;
									}
									return false;
								})
								.map((p, idx, arr) => {
									// Ajouter des ellipsis
									const prevPage = arr[idx - 1];
									const showEllipsisBefore = idx > 0 && prevPage !== undefined && p - prevPage > 1;
									return (
										<span key={p} className="flex items-center">
											{showEllipsisBefore && (
												<span className="px-2 text-muted-foreground">...</span>
											)}
											<Button
												variant={p === page ? "default" : "outline"}
												size="icon"
												asChild={p !== page}
												className={`rounded-full size-10 ${
													p === page ? "bg-linear-to-r from-[#a14b3f] to-[#344E8C] border-0" : ""
												}`}
											>
												{p !== page ? (
													<Link href={buildPageUrl(p)} aria-label={`Page ${p}`}>
														{p}
													</Link>
												) : (
													<span aria-current="page">{p}</span>
												)}
											</Button>
										</span>
									);
								})}
						</div>

						{/* Bouton suivant */}
						<Button
							variant="outline"
							size="icon"
							asChild={page < meta.totalPages}
							disabled={page >= meta.totalPages}
							className="rounded-full"
						>
							{page < meta.totalPages ? (
								<Link href={buildPageUrl(page + 1)} aria-label="Page suivante">
									<ChevronRight className="size-4" />
								</Link>
							) : (
								<span>
									<ChevronRight className="size-4" />
								</span>
							)}
						</Button>
					</nav>
				)}

				{/* Info pagination */}
				{meta && meta.total > 0 && (
					<p
						className="text-center text-sm text-muted-foreground mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
						style={{ animationDelay: "350ms" }}
					>
						{meta.total} chronique{meta.total > 1 ? "s" : ""} au total
					</p>
				)}
			</section>
		</div>
	);
}
