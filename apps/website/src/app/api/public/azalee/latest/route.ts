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
      "id, title, slug, excerpt, content, featured_image_url, published_at, category, author_id, profiles(username, avatar_url)"
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

  // Formatage pour simplifier la consommation
  const formattedArticles = articles.map((article) => ({
    author: {
      avatar: (Array.isArray(article.profiles) ? (article.profiles[0] as any)?.avatar_url : (article.profiles as any)?.avatar_url),
      name: (Array.isArray(article.profiles) ? (article.profiles[0] as any)?.username : (article.profiles as any)?.username) || "Rose Griffon",
    },
    category: article.category,
    date: article.published_at,
    excerpt: article.excerpt,
    id: article.id,
    image: article.featured_image_url,
    slug: article.slug,
    title: article.title,
    url: `https://rosegriffon.fr/chroniques/${article.slug}`,
  }));

  return Response.json({
    articles: formattedArticles,
    count: formattedArticles.length,
  });
}
