import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@rose-griffon/ui";
import Link from "next/link";

import { Newspaper, Search } from "@/lib/icons-config";
import { getPgPool } from "@/lib/db/pg";

export const dynamic = "force-dynamic";

interface SearchArticleRow {
	id: string;
	title: string;
	slug: string;
	excerpt: string | null;
	created_at: string | null;
}

export default async function SearchPage({
	searchParams,
}: {
	searchParams: Promise<{ q: string }>;
}) {
	const { q } = await searchParams;
	const query = q || "";

	let articles: SearchArticleRow[] | null = null;

	if (query) {
		// Recherche dans les articles — lecture Postgres DIRECTE (bypass le Data
		// API PostgREST — cf. lib/db/pg.ts).
		try {
			const pool = getPgPool();
			const like = `%${query}%`;
			const { rows } = await pool.query<SearchArticleRow>(
				`SELECT id, title, slug, excerpt, created_at
				 FROM articles
				 WHERE (title ILIKE $1 OR content ILIKE $1 OR excerpt ILIKE $1)
				 AND status = $2
				 AND app = $3
				 LIMIT 10`,
				[like, "published", "website"]
			);
			articles = rows;
		} catch (error) {
			console.error("Error searching articles:", error);
		}
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
