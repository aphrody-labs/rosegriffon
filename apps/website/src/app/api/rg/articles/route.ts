import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Articles publiés — re-fetch toutes les 5 min (compromis fraîcheur/CDN hit).
export const revalidate = 300;

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const limitRaw = Number.parseInt(searchParams.get("limit") || "5", 10);
	const limit = Number.isFinite(limitRaw)
		? Math.max(1, Math.min(limitRaw, 50))
		: 5;
	const category = searchParams.get("category");

	const supabase = await createClient();

	let query = supabase
		.from("articles")
		.select(
			"id, title, slug, excerpt, featured_image_url, published_at, category, author_id",
		)
		.eq("status", "published")
		.eq("app", "website")
		.order("published_at", { ascending: false })
		.limit(limit);

	if (category) {
		query = query.eq("category", category);
	}

	const { data: articles, error } = await query;

	if (error) {
		return NextResponse.json(
			{ error: error.message, success: false },
			{ status: 500 },
		);
	}

	// Ajouter l'URL complète pour les images et les liens
	const baseUrl =
		process.env.NEXT_PUBLIC_SITE_URL || "https://www.rosegriffon.fr";

	const formattedArticles = articles.map((article) => ({
		...article,
		featured_image_full_url: article.featured_image_url
			? article.featured_image_url.startsWith("http")
				? article.featured_image_url
				: `${baseUrl}${article.featured_image_url}`
			: null,
		url: `${baseUrl}/chroniques/${article.slug}`,
	}));

	return NextResponse.json({
		count: formattedArticles.length,
		data: formattedArticles,
		success: true,
	});
}
