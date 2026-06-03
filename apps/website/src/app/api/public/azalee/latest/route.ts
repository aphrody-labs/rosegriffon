import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const limit = Number.parseInt(searchParams.get("limit") || "5", 10);
	const category = searchParams.get("category");

	const supabase = await createClient();

	let query = supabase
		.from("articles")
		.select(
			"id, title, slug, excerpt, content, featured_image_url, published_at, category, author_id"
		)
		.eq("status", "published")
		.eq("app", "azalee")
		.order("published_at", { ascending: false })
		.limit(Math.min(limit, 20)); // Max 20 pour éviter l'abus

	if (category) {
		query = query.eq("category", category);
	}

	const { data: articles, error } = await query;

	if (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}

	// Pas de clé étrangère articles.author_id → profiles dans le schéma : on résout
	// les auteurs via une requête séparée (un embed PostgREST échouerait en 500).
	type ProfileRow = { id: string; avatar_url: string | null; username: string | null };
	const authorIds = [...new Set(articles.map((a) => a.author_id).filter(Boolean))] as string[];
	const profilesById = new Map<string, ProfileRow>();
	if (authorIds.length > 0) {
		const { data: profiles } = await supabase
			.from("profiles")
			.select("id, username, avatar_url")
			.in("id", authorIds);
		for (const p of (profiles ?? []) as ProfileRow[]) {
			profilesById.set(p.id, p);
		}
	}

	// Formatage pour simplifier la consommation
	const formattedArticles = articles.map((article) => {
		const profile = article.author_id ? profilesById.get(article.author_id) ?? null : null;
		return {
			author: {
				avatar: profile?.avatar_url,
				name: profile?.username || "Rose Griffon",
			},
			category: article.category,
			date: article.published_at,
			excerpt: article.excerpt,
			id: article.id,
			image: article.featured_image_url,
			slug: article.slug,
			title: article.title,
			url: `https://rosegriffon.fr/chroniques/${article.slug}`,
		};
	});

	return Response.json({
		articles: formattedArticles,
		count: formattedArticles.length,
	});
}
