import type { MetadataRoute } from "next";

import { PRODUCTS } from "@/lib/shop/products";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = "https://rosegriffon.fr";
	const now = new Date();
	return [
		{
			changeFrequency: "weekly",
			lastModified: now,
			priority: 0.9,
			url: `${baseUrl}/shop`,
		},
		{
			changeFrequency: "never",
			lastModified: now,
			priority: 0.3,
			url: `${baseUrl}/shop/panier`,
		},
		...PRODUCTS.map((p) => ({
			changeFrequency: "monthly" as const,
			lastModified: now,
			priority: p.stockHint === "limited" ? 0.95 : 0.7,
			url: `${baseUrl}/shop/${p.slug}`,
		})),
	];
}
