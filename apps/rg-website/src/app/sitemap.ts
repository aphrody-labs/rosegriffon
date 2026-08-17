import type { MetadataRoute } from "next";

import { getPgPool } from "@/lib/db/pg";

// Le plan de site doit refléter les chroniques publiées, qui changent sans
// redéploiement. Généré à la demande par le service, pas au build : figé au
// build, il repartait sans aucune chronique (la base n'est pas jointe depuis
// l'étape de build) et le service n'avait plus aucune occasion de le corriger.
export const dynamic = "force-dynamic";

// Routes publiques réelles (hors auth/dashboard/admin/profil). Les chemins doivent exister
// — un sitemap qui pointe vers des 404 dégrade le crawl. Priorités/fréquences indicatives.
//
// `/notre-equipe` n'y figure pas : la route ne rend rien, elle redirige vers
// `/notre-equipe/association` (déjà listée). Annoncer une redirection dans un
// plan de site fait dépenser du crawl pour rien.
const ROUTES: Array<{
	path: string;
	priority: number;
	changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
	{ path: "/", priority: 1, changeFrequency: "weekly" },
	{ path: "/notre-equipe/association", priority: 0.6, changeFrequency: "monthly" },
	{ path: "/notre-equipe/staff", priority: 0.6, changeFrequency: "monthly" },
	{ path: "/notre-equipe/partenaires", priority: 0.6, changeFrequency: "monthly" },
	{ path: "/a-propos", priority: 0.7, changeFrequency: "monthly" },
	{ path: "/a-propos/rejoindre-rg", priority: 0.7, changeFrequency: "monthly" },
	{ path: "/a-propos/contact", priority: 0.5, changeFrequency: "yearly" },
	{ path: "/projets", priority: 0.8, changeFrequency: "weekly" },
	{ path: "/projets/nostalgie", priority: 0.7, changeFrequency: "monthly" },
	{ path: "/projets/emotes", priority: 0.6, changeFrequency: "monthly" },
	{ path: "/projets/muraux", priority: 0.6, changeFrequency: "monthly" },
	{ path: "/projets/outils/pfp", priority: 0.6, changeFrequency: "monthly" },
	{ path: "/evenements", priority: 0.8, changeFrequency: "weekly" },
	{ path: "/chroniques", priority: 0.8, changeFrequency: "weekly" },
	{ path: "/community", priority: 0.6, changeFrequency: "weekly" },
	{ path: "/sondages", priority: 0.6, changeFrequency: "weekly" },
	{ path: "/iergday", priority: 0.7, changeFrequency: "daily" },
	// Ces quatre pages publiques manquaient : aucune n'était annoncée nulle part.
	{ path: "/rose-griffon-tv", priority: 0.7, changeFrequency: "daily" },
	{ path: "/emotes-showcase", priority: 0.6, changeFrequency: "monthly" },
	{ path: "/epita-map", priority: 0.4, changeFrequency: "yearly" },
	{ path: "/design-system", priority: 0.3, changeFrequency: "monthly" },
	{ path: "/nous-soutenir", priority: 0.7, changeFrequency: "monthly" },
	{ path: "/charte-engagements", priority: 0.4, changeFrequency: "yearly" },
	{ path: "/cellule-de-mediation", priority: 0.3, changeFrequency: "yearly" },
	{ path: "/legal/cgu", priority: 0.3, changeFrequency: "yearly" },
	{ path: "/legal/confidentialite", priority: 0.3, changeFrequency: "yearly" },
];

type ChroniqueRow = { slug: string; updated_at: string | null; published_at: string | null };

/**
 * Chroniques publiées. Lecture Postgres directe (cf. `lib/db/pg.ts`) : le plan de
 * site ne doit pas dépendre de la disponibilité du Data API. Une erreur n'annule
 * pas le plan de site — on préfère un plan sans les articles à pas de plan du tout.
 */
async function chroniques(baseUrl: string): Promise<MetadataRoute.Sitemap> {
	try {
		const pool = getPgPool();
		const { rows } = await pool.query<ChroniqueRow>(
			"SELECT slug, updated_at, published_at FROM articles WHERE status = $1 AND app = $2 ORDER BY published_at DESC NULLS LAST",
			["published", "website"]
		);
		return rows
			.filter((row) => row.slug)
			.map((row) => ({
				url: `${baseUrl}/chroniques/${row.slug}`,
				lastModified: new Date(row.updated_at || row.published_at || Date.now()),
				changeFrequency: "monthly" as const,
				priority: 0.7,
			}));
	} catch (error) {
		console.error("sitemap: lecture des chroniques impossible", error);
		return [];
	}
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	// Host canonique (apex, sans www) : doit correspondre au `metadataBase`
	// (https://rosegriffon.fr) du layout. next.config redirige www → apex en 301,
	// donc émettre des URLs www imposerait un saut de redirection aux crawlers et
	// brouillerait le signal canonique. On normalise vers l'apex.
	const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://rosegriffon.fr").replace(
		"://www.",
		"://",
	);
	const lastModified = new Date();
	return [
		...ROUTES.map(({ path, priority, changeFrequency }) => ({
			url: `${baseUrl}${path}`,
			lastModified,
			changeFrequency,
			priority,
		})),
		...(await chroniques(baseUrl)),
	];
}
