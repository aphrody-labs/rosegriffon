import type { MetadataRoute } from "next";

// Routes publiques réelles (hors auth/dashboard/admin/profil). Les chemins doivent exister
// — un sitemap qui pointe vers des 404 dégrade le crawl. Priorités/fréquences indicatives.
const ROUTES: Array<{
	path: string;
	priority: number;
	changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
	{ path: "/", priority: 1, changeFrequency: "weekly" },
	{ path: "/notre-equipe", priority: 0.8, changeFrequency: "monthly" },
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
	{ path: "/nous-soutenir", priority: 0.7, changeFrequency: "monthly" },
	{ path: "/charte-engagements", priority: 0.4, changeFrequency: "yearly" },
	{ path: "/cellule-de-mediation", priority: 0.3, changeFrequency: "yearly" },
	{ path: "/legal/cgu", priority: 0.3, changeFrequency: "yearly" },
	{ path: "/legal/confidentialite", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
	// Host canonique (apex, sans www) : doit correspondre au `metadataBase`
	// (https://rosegriffon.fr) du layout. next.config redirige www → apex en 301,
	// donc émettre des URLs www imposerait un saut de redirection aux crawlers et
	// brouillerait le signal canonique. On normalise vers l'apex.
	const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://rosegriffon.fr").replace(
		"://www.",
		"://",
	);
	const lastModified = new Date();
	return ROUTES.map(({ path, priority, changeFrequency }) => ({
		url: `${baseUrl}${path}`,
		lastModified,
		changeFrequency,
		priority,
	}));
}
