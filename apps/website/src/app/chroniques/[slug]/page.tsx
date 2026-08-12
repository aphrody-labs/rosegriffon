import { Badge, Card, CardContent, StorageImage } from "@rosegriffon/ui";
import { ArrowLeft, Calendar, Eye } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleSchema, BreadcrumbSchema } from "@/components/shared/StructuredData";
import { CommentsSection } from "@/components/shared/CommentsSection";

import type { Metadata } from "next";

import type { Article } from "@/lib/api/articles";
import { getPgPool } from "@/lib/db/pg";
import { createClient } from "@/lib/supabase/server";

import { ShareButtons } from "./components/ShareButtons";

// ⚡ ISR - Revalidation toutes les 15 minutes
export const revalidate = 900;

// Lecture Postgres DIRECTE (bypass le Data API PostgREST — cf. lib/db/pg.ts).
type ArticleMetaRow = Pick<Article, "title" | "excerpt" | "featured_image_url">;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
	const { slug } = await params;

	let article: ArticleMetaRow | null = null;
	try {
		const pool = getPgPool();
		const { rows } = await pool.query<ArticleMetaRow>(
			"SELECT title, excerpt, featured_image_url FROM articles WHERE slug = $1 AND status = $2 AND app = $3 LIMIT 1",
			[slug, "published", "website"]
		);
		article = rows[0] ?? null;
	} catch (error) {
		console.error(`Error fetching metadata for article ${slug}:`, error);
	}

	if (!article) {
		return { title: "Article introuvable · Rose Griffon" };
	}

	const title = `${article.title} · Rose Griffon`;
	const description = article.excerpt || "Chronique de l'association Rose Griffon";
	const image = article.featured_image_url || "/opengraph-image.png";

	return {
		description,
		openGraph: {
			description,
			images: [{ url: image }],
			title,
			type: "article",
			url: `https://rosegriffon.fr/chroniques/${slug}`,
		},
		title,
		twitter: {
			card: "summary_large_image",
			description,
			images: [image],
			title,
		},
	};
}

export default async function ChroniquePage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;

	// 1. Essayer de trouver dans les articles — lecture Postgres DIRECTE
	// (bypass le Data API PostgREST — cf. lib/db/pg.ts).
	let articleData: Article | null = null;
	try {
		const pool = getPgPool();
		const { rows } = await pool.query<Article>(
			"SELECT * FROM articles WHERE slug = $1 AND status = $2 AND app = $3 LIMIT 1",
			[slug, "published", "website"]
		);
		articleData = rows[0] ?? null;
	} catch (error) {
		console.error(`Error fetching article ${slug}:`, error);
	}

	if (!articleData) {
		notFound();
	}

	const content = articleData;

	// Incrémenter vues — ÉCRITURE, hors scope de la migration Postgres directe :
	// reste sur le client Supabase (RPC, contourne le rate-limit RLS d'écriture).
	try {
		const supabase = await createClient();
		await supabase.rpc("increment_article_views", {
			article_id: content.id,
		});
	} catch (error) {
		console.error("Failed to increment views:", error);
	}

	const publishedDate = content.published_at || content.created_at || "";
	const viewCount = content.view_count || 0;
	const featuredImage = content.featured_image_url;

	return (
		<div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
			<BreadcrumbSchema
				items={[
					{ item: "/", name: "Accueil" },
					{ item: "/chroniques", name: "Chroniques" },
					{ item: `/chroniques/${slug}`, name: content.title },
				]}
			/>
			<ArticleSchema
				title={content.title}
				description={content.excerpt || ""}
				image={featuredImage ? [featuredImage] : []}
				datePublished={publishedDate}
				dateModified={content.updated_at ?? undefined}
				authorName="Rose Griffon"
				url={`https://rosegriffon.fr/chroniques/${slug}`}
			/>
			<div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
				<nav className="mb-8">
					<Link
						href="/chroniques"
						className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-[#a14b3f]"
					>
						<ArrowLeft className="size-4" />
						Retour aux chroniques
					</Link>
				</nav>

				<article>
					<header className="mb-8">
						{content.category && (
							<Badge variant="outline" className="mb-4">
								{content.category}
							</Badge>
						)}

						<h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-linear-to-r from-[#a14b3f] to-[#d16854]">
							{content.title}
						</h1>

						{content.excerpt && (
							<p className="text-xl text-gray-600 dark:text-gray-400 mb-6">{content.excerpt}</p>
						)}

						<div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
							<div className="flex items-center gap-2">
								<Calendar className="size-4" />
								{publishedDate ? new Date(publishedDate).toLocaleDateString("fr-FR") : "Non publié"}
							</div>
							<div className="flex items-center gap-2">
								<Eye className="size-4" />
								{viewCount} vues
							</div>
						</div>
					</header>

					{featuredImage && (
						<div className="mb-8 rounded-xl overflow-hidden shadow-2xl relative h-[300px] sm:h-[400px] lg:h-[450px] w-full group">
							<StorageImage
								src={featuredImage}
								alt={content.title}
								fill
								className="object-cover"
								sizes="(max-width: 768px) 100vw, (max-width: 1024px) 800px, 900px"
								priority
							/>
							{/* Overlay gradient pour meilleure lisibilité */}
							<div className="absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent" />
						</div>
					)}

					<Card className="border-none shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
						<CardContent className="p-6 sm:p-8 lg:p-10">
							<div
								className="prose prose-lg dark:prose-invert max-w-none"
								dangerouslySetInnerHTML={{
									__html: content.content,
								}}
							/>
						</CardContent>
					</Card>

					{/* Footer / Share */}
					<ShareButtons title={content.title} slug={slug} />
				</article>

				<CommentsSection targetId={content.id} targetType="article" className="mt-8" />
			</div>
		</div>
	);
}
