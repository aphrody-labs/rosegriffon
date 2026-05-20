import { createClient } from "@/lib/supabase/server";

const BASE_URL = "https://azalee.rosegriffon.fr";

function escapeXml(str: string): string {
	return str
		.replaceAll('&', "&amp;")
		.replaceAll('<', "&lt;")
		.replaceAll('>', "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll('\'', "&apos;");
}

export async function GET() {
	const supabase = await createClient();

	const { data: articles } = await supabase
		.from("articles")
		.select(
			"id, title, slug, excerpt, published_at, created_at, category, featured_image_url, author_id",
		)
		.eq("status", "published")
		.eq("app", "azalee")
		.order("published_at", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false })
		.limit(50);

	// Récupérer les profils auteurs en bloc (pas de FK déclarée → join manuel).
	const authorIds = [...new Set((articles || []).map((a: any) => a.author_id).filter((id): id is string => Boolean(id)))];

	let authorMap = new Map<string, { full_name: string | null }>();
	if (authorIds.length > 0) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data: profiles } = await (supabase as any)
			.from("profiles")
			.select("id, full_name")
			.in("id", authorIds);
		authorMap = new Map(
			(profiles || []).map(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(p: any) => [
					p.id as string,
					{ full_name: p.full_name as string | null },
				],
			),
		);
	}

	const items = (articles || [])
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		.map((a: any) => {
			const dateSrc = a.published_at || a.created_at;
			const pubDate = dateSrc ? new Date(dateSrc).toUTCString() : "";
			const imageTag = a.featured_image_url
				? `<enclosure url="${escapeXml(a.featured_image_url)}" type="image/webp" length="0"/>`
				: "";
			const author = authorMap.get(a.author_id)?.full_name || "Azalée";

			return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${BASE_URL}/news/${escapeXml(a.slug)}</link>
      <guid isPermaLink="true">${BASE_URL}/news/${escapeXml(a.slug)}</guid>
      <description>${escapeXml(a.excerpt || "")}</description>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(author)}</dc:creator>
      <category>${escapeXml(a.category || "")}</category>
      ${imageTag}
    </item>`;
		})
		.join("\n");

	const lastBuildDate = (() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const first = articles?.[0] as any;
		const src = first?.published_at || first?.created_at;
		return src ? new Date(src).toUTCString() : new Date().toUTCString();
	})();

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
>
  <channel>
    <title>Azalée — Rose Griffon</title>
    <link>${BASE_URL}/news</link>
    <description>Actualités Inazuma Eleven: Victory Road</description>
    <language>fr</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${BASE_URL}/news/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${BASE_URL}/icon.webp</url>
      <title>Azalée</title>
      <link>${BASE_URL}</link>
    </image>
${items}
  </channel>
</rss>`;

	return new Response(rss, {
		headers: {
			"Cache-Control": "s-maxage=3600, stale-while-revalidate=600",
			"Content-Type": "application/rss+xml; charset=utf-8",
		},
	});
}
