import { NextResponse } from "next/server";
import { sanitizeNewsSearchQuery } from "@/lib/news-search";
import { createClient } from "@/lib/supabase/server";

const VALID_CATEGORIES = new Set([
	"announcement",
	"event",
	"critique",
	"community",
]);

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
	const limit = 12;
	const rawCategory = searchParams.get("category");
	const category =
		rawCategory && VALID_CATEGORIES.has(rawCategory) ? rawCategory : null;
	const q = sanitizeNewsSearchQuery(searchParams.get("q"));

	const supabase = await createClient();
	const from = (page - 1) * limit;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let query = (supabase as any)
		.from("articles")
		.select(
			"id, title, slug, excerpt, created_at, published_at, featured_image_url, category, author_id",
		)
		.eq("status", "published")
		.eq("app", "azalee")
		.order("published_at", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false })
		.range(from, from + limit - 1);

	if (category) {
		query = query.eq("category", category);
	}
	if (q) {
		query = query.textSearch("search_vector", q, { config: "french" });
	}

	const { data, error } = await query;

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	const items = (data || []).map(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(a: any) => ({
			id: a.id,
			type: "article",
			title: a.title,
			slug: a.slug,
			excerpt: a.excerpt,
			date: a.published_at || a.created_at,
			image: a.featured_image_url,
			category: a.category,
			author_id: a.author_id,
		}),
	);

	return NextResponse.json({ items, hasMore: items.length === limit });
}
