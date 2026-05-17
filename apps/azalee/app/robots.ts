import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = "https://azalee.rosegriffon.fr";

	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/dashboard/", "/api/", "/auth/", "/login", "/settings"],
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
