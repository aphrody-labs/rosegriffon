import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Newspaper, Search } from "@/lib/icons-config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>;
}) {
  const { q } = await searchParams;
  const query = q || "";

  const supabase = await createClient();
  let articles = null;

  if (query) {
    // Recherche dans les articles
    const articlesResult = await supabase
      .from("articles")
      .select("id, title, slug, excerpt, created_at")
      .or(`title.ilike.%${query}%,content.ilike.%${query}%,excerpt.ilike.%${query}%`)
      .eq("status", "published")
      .eq("app", "website")
      .limit(10);
    articles = articlesResult.data;
  }

  const hasResults = (articles?.length || 0) > 0;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Recherche</h1>
        <form action="/search" method="get" className="flex gap-2 max-w-xl">
          <Input
            name="q"
            defaultValue={query}
            placeholder="Rechercher un article, une chronique..."
            className="flex-1"
          />
          <Button type="submit">
            <Search className="size-4 mr-2" />
            Rechercher
          </Button>
        </form>
      </div>

      {query && (
        <div className="space-y-8">
          <h2 className="text-xl text-muted-foreground">
            Résultats pour <span className="font-semibold">"{query}"</span>
          </h2>

          {!hasResults && (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <Search className="size-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun résultat trouvé</p>
              <p className="text-muted-foreground">
                Essayez avec d'autres mots-clés ou vérifiez l'orthographe.
              </p>
            </div>
          )}

          {articles && articles.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-2xl font-semibold flex items-center gap-2">
                <Newspaper className="size-6" /> Articles
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {articles.map((article) => (
                  <Link key={article.id} href={`/chroniques/${article.slug}`}>
                    <Card className="h-full hover:bg-muted/50 transition-colors">
                      <CardHeader>
                        <CardTitle className="line-clamp-2">{article.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {article.excerpt}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
