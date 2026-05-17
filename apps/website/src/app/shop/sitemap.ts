import type { MetadataRoute } from "next";

import { PRODUCTS } from "@/lib/shop/products";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = "https://rosegriffon.fr";
	const now = new Date();
	return [
		{
			url: `${baseUrl}/shop`,
			lastModified: now,
			changeFrequency: "weekly",
			priority: 0.9,
		},
		{
			url: `${baseUrl}/shop/panier`,
			lastModified: now,
			changeFrequency: "never",
			priority: 0.3,
		},
		...PRODUCTS.map((p) => ({
			url: `${baseUrl}/shop/${p.slug}`,
			lastModified: now,
			changeFrequency: "monthly" as const,
			priority: p.stockHint === "limited" ? 0.95 : 0.7,
		})),
	];
}
