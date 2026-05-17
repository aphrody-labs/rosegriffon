"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchResult = {
  id: string;
  title: string;
  slug: string;
  type: "article" | "chronicle";
};

export async function searchContent(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  const supabase = await createClient();

  // Recherche dans les articles
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, slug")
    .ilike("title", `%${query}%`)
    .eq("status", "published")
    .eq("app", "website")
    .limit(3);

  const results: SearchResult[] = [];

  if (articles) {
    results.push(
      ...articles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        type: "article" as const,
      }))
    );
  }

  return results;
}
