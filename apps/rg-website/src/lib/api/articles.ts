import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@rose-griffon/db";

export type Article = Tables<"articles">;

export interface GetArticlesOptions {
	page?: number;
	limit?: number;
	status?: string;
	category?: string;
	query?: string;
}

export interface ArticlesResponse {
	data: Article[];
	meta: {
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	};
}

export async function getArticles({
	page = 1,
	limit = 10,
	status,
	category,
	query,
}: GetArticlesOptions = {}): Promise<ArticlesResponse> {
	const supabase = await createClient();
	const from = (page - 1) * limit;
	const to = from + limit - 1;

	let queryBuilder = supabase
		.from("articles")
		.select("*", { count: "exact" })
		.eq("app", "website")
		.order("created_at", { ascending: false })
		.range(from, to);

	if (status && status !== "all") {
		queryBuilder = queryBuilder.eq("status", status);
	}

	if (category && category !== "all") {
		queryBuilder = queryBuilder.eq("category", category);
	}

	if (query) {
		queryBuilder = queryBuilder.or(
			`title.ilike.%${query}%,excerpt.ilike.%${query}%,category.ilike.%${query}%`
		);
	}

	const { data, count, error } = await queryBuilder;

	if (error) {
		console.error("Error fetching articles:", error);
		return {
			data: [],
			meta: { limit, page, total: 0, totalPages: 0 },
		};
	}

	const total = count || 0;

	return {
		data: data || [],
		meta: {
			limit,
			page,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("articles")
		.select("*")
		.eq("slug", slug)
		.eq("app", "website")
		.single();

	if (error) {
		console.error(`Error fetching article with slug ${slug}:`, error);
		return null;
	}

	return data;
}

export async function getArticleStats() {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("articles")
		.select("status, category")
		.eq("app", "website");

	if (error) {
		console.error("Error fetching article stats:", error);
		return { categories: [], draft: 0, published: 0, total: 0 };
	}

	const total = data.length;
	const published = data.filter((a) => a.status === "published").length;
	const draft = data.filter((a) => a.status === "draft").length;
	const categories = [...new Set(data.map((a) => a.category).filter(Boolean))] as string[];

	return {
		categories,
		draft,
		published,
		total,
	};
}
