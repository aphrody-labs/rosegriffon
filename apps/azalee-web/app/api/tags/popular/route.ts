import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Top N tags les + utilisés sur articles publiés (app=azalee).
// Agrège côté JS (volume articles azalee modeste — ~1k rows max).
// Format consommé par components/news/AdvancedFilters.tsx :
//   Array<{ tag: string; count: number }>
export const revalidate = 600; // 10 min — pas critique de l'avoir frais

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const limitRaw = Number.parseInt(searchParams.get("limit") || "15", 10);
	const limit = Number.isFinite(limitRaw)
		? Math.max(1, Math.min(limitRaw, 50))
		: 15;

	const supabase = await createClient();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data, error } = await (supabase as any)
		.from("articles")
		.select("tags")
		.eq("status", "published")
		.eq("app", "azalee")
		.not("tags", "is", null);

	if (error) {
		return NextResponse.json([], { status: 200 });
	}

	const counts = new Map<string, number>();
	for (const row of data ?? []) {
		const {tags} = (row as { tags?: string[] | null });
		if (!Array.isArray(tags)) {continue;}
		for (const raw of tags) {
			const tag = typeof raw === "string" ? raw.trim() : "";
			if (!tag) {continue;}
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}

	const result = [...counts.entries()]
		.map(([tag, count]) => ({ count, tag }))
		.toSorted((a, b) => b.count - a.count)
		.slice(0, limit);

	return NextResponse.json(result);
}
