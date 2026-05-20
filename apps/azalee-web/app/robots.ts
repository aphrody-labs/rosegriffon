import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = "https://azalee.rosegriffon.fr";

	return {
		rules: [
			{
				allow: "/",
				disallow: ["/dashboard/", "/api/", "/auth/", "/login", "/settings"],
				userAgent: "*",
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
