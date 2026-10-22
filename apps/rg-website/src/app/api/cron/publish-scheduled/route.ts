import { NextResponse } from "next/server";

import { revalidateNews } from "@/app/actions/articles";
import { getPgPool } from "@/lib/db/pg";

/**
 * Cron : publie les articles Azalée programmés dont la date est passée.
 *
 * Reprend `apps/azalee-web/app/api/cron/publish-scheduled`, absorbé ici avec
 * le reste d'Azalée (`azalee.rosegriffon.fr` n'est plus qu'une redirection :
 * la tâche `api:publish-scheduled` de rg-cron recevait un 404 et plus aucun
 * article programmé ne sortait). Même authentification que les autres routes
 * cron : `Authorization: Bearer <CRON_SECRET>`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_SCOPE = "azalee";

interface ArticlePublie {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
}

async function publier(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    // Un seul UPDATE … RETURNING : deux déclenchements simultanés ne publient pas deux fois.
    const { rows } = await getPgPool().query<ArticlePublie>(
      `UPDATE articles
          SET status = 'published', published_at = now(), scheduled_at = NULL
        WHERE status = 'scheduled' AND app = $1 AND scheduled_at <= now()
        RETURNING id, title, slug, excerpt, featured_image_url`,
      [APP_SCOPE],
    );
    if (rows.length === 0) return NextResponse.json({ published: 0 });

    await revalidateNews();
    for (const article of rows) await revalidateNews(article.slug);

    const jeton = process.env.DISCORD_BOT_TOKEN;
    const salon = process.env.DISCORD_NEWS_CHANNEL_ID;
    if (jeton && salon) {
      for (const article of rows) {
        // Le partage Discord n'est pas critique : un échec ne défait pas la publication.
        await fetch(`https://discord.com/api/v10/channels/${salon}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${jeton}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [
              {
                title: article.title,
                description: article.excerpt ?? "",
                url: `https://rosegriffon.fr/news/${article.slug}`,
                color: 0xf2a93b,
                image: article.featured_image_url ? { url: article.featured_image_url } : undefined,
                footer: { text: "Azalée — Rose Griffon" },
              },
            ],
          }),
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({ published: rows.length, articles: rows.map(({ id, title }) => ({ id, title })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur interne" }, { status: 500 });
  }
}

export const POST = publier;
export const GET = publier;
