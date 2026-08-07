"use server";

import { getPgPool } from "@/lib/db/pg";

export interface SearchResult {
	id: string;
	title: string;
	slug: string;
	type: "article" | "chronicle";
}

interface SearchTitleRow {
	id: string;
	title: string;
	slug: string;
}

export async function searchContent(query: string): Promise<SearchResult[]> {
	if (!query || query.length < 2) {
		return [];
	}

	// Recherche dans les articles — lecture Postgres DIRECTE (bypass le Data API
	// PostgREST — cf. lib/db/pg.ts).
	let articles: SearchTitleRow[] = [];
	try {
		const pool = getPgPool();
		const { rows } = await pool.query<SearchTitleRow>(
			`SELECT id, title, slug
			 FROM articles
			 WHERE title ILIKE $1 AND status = $2 AND app = $3
			 LIMIT 3`,
			[`%${query}%`, "published", "website"]
		);
		articles = rows;
	} catch (error) {
		console.error("Error searching article titles:", error);
	}

	const results: SearchResult[] = [];

	if (articles) {
		results.push(
			...articles.map((a) => ({
				id: a.id,
				slug: a.slug,
				title: a.title,
				type: "article" as const,
			}))
		);
	}

	return results;
}
