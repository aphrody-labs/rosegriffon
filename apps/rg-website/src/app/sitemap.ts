import type { MetadataRoute } from "next";

import { getPgPool } from "@/lib/db/pg";
import { ROUTES_SITEMAP } from "@/lib/site-routes";
import { SITE_URL } from "@/lib/site-url";

// Le plan de site doit refléter les chroniques publiées, qui changent sans
// redéploiement : régénéré au plus toutes les heures (ISR). Même si le build
// le produisait sans chronique, la première visite après une heure le refait ;
// le servir à la demande faisait une invocation par passage de robot.
export const revalidate = 3600;


type ChroniqueRow = { slug: string; updated_at: string | null; published_at: string | null };

/**
 * TOUS les articles publiés, les deux corpus confondus.
 *
 * Le plan de site n'annonçait que les chroniques (`app = 'website'`) : les
 * actualités d'Azalée, pourtant servies sous `/news/<slug>`, n'y figuraient
 * pas. Depuis la fusion du fil, une seule requête les couvre.
 *
 * Lecture Postgres directe (cf. `lib/db/pg.ts`) : le plan de site ne doit pas
 * dépendre de la disponibilité du Data API. Une erreur n'annule pas le plan —
 * on préfère un plan sans les articles à pas de plan du tout.
 */
async function articlesPublies(baseUrl: string): Promise<MetadataRoute.Sitemap> {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query<ChroniqueRow>(
      "SELECT slug, updated_at, published_at FROM articles WHERE status = $1 AND app = ANY($2::text[]) ORDER BY published_at DESC NULLS LAST",
      ["published", ["azalee", "website"]],
    );
    return rows
      .filter(row => row.slug)
      .map(row => ({
        url: `${baseUrl}/news/${row.slug}`,
        lastModified: new Date(row.updated_at || row.published_at || Date.now()),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }));
  } catch (error) {
    console.error("sitemap: lecture des articles impossible", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Host canonique (apex, sans www) : doit correspondre au `metadataBase`
  // (https://rosegriffon.fr) du layout. next.config redirige www → apex en 301,
  // donc émettre des URLs www imposerait un saut de redirection aux crawlers et
  // brouillerait le signal canonique. `SITE_URL` (lib/site-url.ts) applique la
  // même normalisation ; ce fichier, `app/robots.ts` et `app/wiki/sitemap.ts`
  // la recopiaient chacun séparément.
  const baseUrl = SITE_URL;
  const lastModified = new Date();
  return [
    ...ROUTES_SITEMAP.map(({ path, priority, changeFrequency }) => ({
      url: `${baseUrl}${path}`,
      lastModified,
      changeFrequency,
      priority,
    })),
    ...(await articlesPublies(baseUrl)),
  ];
}
