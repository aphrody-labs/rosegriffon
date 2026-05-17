import {
	getPopularArticles,
	getPopularTags,
	getTrendingArticles,
} from "@/app/actions/articles";
import { getCommentCounts } from "@/app/actions/comments";
import { getReactionCounts } from "@/app/actions/reactions";
import { getContinueReading } from "@/app/actions/reading-history";
import { sanitizeNewsSearchQuery } from "@/lib/news-search";
import { createClient } from "@/lib/supabase/server";
import { parseSearchParams } from "@/lib/validations";
import { type FeedItem, NewsFeedClient } from "./news-client";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "Actualités | Azalée",
	description: "Toutes les informations sur Inazuma Eleven: Victory Road.",
};

const ITEMS_PER_PAGE = 12;

const VALID_CATEGORIES = new Set([
	"announcement",
	"event",
	"critique",
	"community",
	"Tweet",
]);

export default async function NewsFeedPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const searchParamsValue = await searchParams;
	const { page: currentPage } = parseSearchParams(searchParamsValue);
	const supabase = await createClient();
	const rawCategory = searchParamsValue.category as string | undefined;
	const categoryFilter =
		rawCategory && VALID_CATEGORIES.has(rawCategory) ? rawCategory : undefined;
	const rawQuery = (searchParamsValue.q as string | undefined) || "";
	const searchQuery = sanitizeNewsSearchQuery(rawQuery);

	let featuredArticles: FeedItem[] = [];
	const featuredIds = new Set<string>();

	// Featured (page 1, no filter, no search) — on prend le plus récent par
	// `published_at` pour rester cohérent avec le tri du feed (cf. ci-dessous).
	if (currentPage === 1 && !categoryFilter && !searchQuery) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data: featured } = await (supabase as any)
			.from("articles")
			.select(
				"id, title, slug, excerpt, created_at, published_at, featured_image_url, category, author_id",
			)
			.eq("status", "published")
			.eq("app", "azalee")
			.order("published_at", { ascending: false, nullsFirst: false })
			.order("created_at", { ascending: false })
			.limit(1);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const featuredArr = (featured as any[]) || [];
		if (featuredArr.length > 0) {
			featuredArticles = featuredArr.map((a) => ({
				id: a.id,
				type: "article",
				title: a.title,
				slug: a.slug,
				excerpt: a.excerpt,
				date: a.published_at || a.created_at,
				image: a.featured_image_url,
				category: a.category,
				author_id: a.author_id,
			}));
			featuredArr.forEach((f) => featuredIds.add(f.id));
		}
	}

	// Pagination DB-side : chaque source a sa propre pagination, on les
	// affiche dans des sections distinctes côté client. Plus de merge JS
	// approximatif sur des fenêtres tronquées.
	const isTweetOnly = categoryFilter === "Tweet";
	const includeArticles = !isTweetOnly;
	const includeTweets = !categoryFilter || isTweetOnly;
	// La recherche full-text ne s'applique qu'aux articles.
	const tweetsAllowed = includeTweets && !searchQuery;

	const articleRangeStart = (currentPage - 1) * ITEMS_PER_PAGE;
	const articleRangeEnd = articleRangeStart + ITEMS_PER_PAGE - 1;

	// On utilise PostgREST `.or` pour trier par `coalesce(published_at, created_at)`
	// côté DB ? Pas exposé directement — on trie par `published_at desc nulls last`
	// puis `created_at desc` qui matche l'ordre attendu côté client.
	const articlesPromise = includeArticles
		? (async () => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				let query = (supabase as any)
					.from("articles")
					.select(
						"id, title, slug, excerpt, created_at, published_at, featured_image_url, category, author_id",
						{ count: "exact" },
					)
					.eq("status", "published")
					.eq("app", "azalee")
					.order("published_at", { ascending: false, nullsFirst: false })
					.order("created_at", { ascending: false });

				if (searchQuery) {
					query = query.textSearch("search_vector", searchQuery, {
						config: "french",
					});
				}
				if (categoryFilter && categoryFilter !== "Tweet") {
					query = query.eq("category", categoryFilter);
				}
				if (featuredIds.size > 0) {
					for (const id of featuredIds) {
						query = query.neq("id", id);
					}
				}
				query = query.range(articleRangeStart, articleRangeEnd);

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const { data, count, error } = (await query) as any;
				if (error) {
					console.error("Error fetching articles:", error);
					return { items: [] as FeedItem[], total: 0 };
				}
				const items: FeedItem[] = (data || []).map(
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
				return { items, total: count || 0 };
			})()
		: Promise.resolve({ items: [] as FeedItem[], total: 0 });

	const tweetsPromise = tweetsAllowed
		? (async () => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const { data, count, error } = (await (supabase as any)
					.from("tweets")
					.select(
						"id, text, created_at, author_username, media, quoted_tweets, raw_tweets",
						{ count: "exact" },
					)
					.order("created_at", { ascending: false })
					.range(articleRangeStart, articleRangeEnd)) as any;
				if (error) {
					console.error("Error fetching tweets:", error);
					return { items: [] as FeedItem[], total: 0 };
				}
				const items: FeedItem[] = (data || []).map(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(t: any) => ({
						id: t.id,
						type: "tweet",
						title: "",
						slug: t.id,
						excerpt: t.text,
						date: t.created_at,
						image: t.media && t.media.length > 0 ? t.media[0].url : null,
						category: "Tweet",
						author_id: t.author_username,
						media: t.media || [],
						quotedTweets: t.quoted_tweets || [],
						threadTweets: t.raw_tweets || [],
					}),
				);
				return { items, total: count || 0 };
			})()
		: Promise.resolve({ items: [] as FeedItem[], total: 0 });

	const [articlesRes, tweetsRes] = await Promise.all([
		articlesPromise,
		tweetsPromise,
	]);

	const feedItems: FeedItem[] = [...articlesRes.items, ...tweetsRes.items];
	// Tri stable global pour l'affichage (chaque section sera ré-extraite côté client).
	feedItems.sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);

	// Le total pour la pagination correspond à la source dominante : si on filtre
	// "Tweet" → total tweets, sinon → total articles (les tweets sont une bande
	// secondaire). Ça rend la pagination prévisible et cohérente avec le tri.
	const totalItems = isTweetOnly
		? tweetsRes.total
		: articlesRes.total + (tweetsAllowed ? tweetsRes.total : 0);

	const articleIds = [
		...feedItems.filter((i) => i.type === "article").map((i) => i.id),
		...featuredArticles.map((i) => i.id),
	];

	const [
		popularTags,
		reactionCounts,
		popularArticles,
		trendingArticles,
		commentCounts,
		continueReadingArticles,
	] = await Promise.all([
		currentPage === 1 && !searchQuery
			? getPopularTags(20)
			: Promise.resolve([]),
		articleIds.length > 0 ? getReactionCounts(articleIds) : Promise.resolve({}),
		currentPage === 1 && !searchQuery
			? getPopularArticles(5)
			: Promise.resolve([]),
		currentPage === 1 && !searchQuery
			? getTrendingArticles(5)
			: Promise.resolve([]),
		articleIds.length > 0 ? getCommentCounts(articleIds) : Promise.resolve({}),
		currentPage === 1 && !searchQuery
			? getContinueReading(4)
			: Promise.resolve([]),
	]);

	return (
		<NewsFeedClient
			feedItems={feedItems}
			totalItems={totalItems}
			currentPage={currentPage}
			categoryFilter={categoryFilter}
			featuredArticles={featuredArticles}
			searchQuery={rawQuery}
			popularTags={popularTags}
			reactionCounts={reactionCounts}
			popularArticles={popularArticles}
			trendingArticles={trendingArticles}
			commentCounts={commentCounts}
			continueReadingArticles={continueReadingArticles}
		/>
	);
}
