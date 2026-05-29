export const dynamic = "force-dynamic";

import { getSupabaseClient } from "@/lib/api/supabase";
import type { MetadataRoute } from "next";

const BASE_URL = "https://azalee.rosegriffon.fr";

const AURA_CATEGORIES = ["esprits-guerriers", "totems", "miximax", "eveil", "changement-mode"];

const AURA_TYPE_MAP: Record<string, string> = {
	"changement-mode": "ModeChange",
	"esprits-guerriers": "Keshin",
	eveil: "Awakening",
	miximax: "Miximax",
	totems: "Soul",
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const supabase = getSupabaseClient();

	// Fetch all IDs in parallel — using correct column names
	const [characters, skills, items, auras, tactics, articles, tags] = await Promise.all([
		supabase
			.from("inagle_characters")
			.select("slug, updated_at")
			.not("slug", "is", null)
			.order("updated_at", { ascending: false }),
		supabase
			.from("inagle_skills")
			.select("id, created_at")
			.order("created_at", { ascending: false }),
		supabase
			.from("inagle_items")
			.select("id, created_at")
			.order("created_at", { ascending: false }),
		supabase
			.from("inagle_keshins")
			.select("id, sub_type, created_at")
			.order("created_at", { ascending: false }),
		supabase
			.from("inagle_items")
			.select("id, created_at")
			.eq("category", "special_tactics")
			.order("created_at", { ascending: false }),
		supabase
			.from("articles")
			.select("slug, updated_at, published_at")
			.eq("status", "published")
			.eq("app", "azalee")
			.order("published_at", { ascending: false }),
		supabase
			.from("articles")
			.select("tags")
			.eq("status", "published")
			.eq("app", "azalee")
			.not("tags", "is", null),
	]);

	const entries: MetadataRoute.Sitemap = [];

	// Static pages
	const staticPages = [
		{ changeFrequency: "daily" as const, priority: 1.0, url: "/" },
		{ changeFrequency: "weekly" as const, priority: 0.9, url: "/chara" },
		{ changeFrequency: "weekly" as const, priority: 0.9, url: "/skill" },
		{ changeFrequency: "weekly" as const, priority: 0.8, url: "/item" },
		{ changeFrequency: "weekly" as const, priority: 0.8, url: "/aura" },
		{ changeFrequency: "weekly" as const, priority: 0.7, url: "/passive" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/search" },
		{ changeFrequency: "daily" as const, priority: 0.8, url: "/news" },
		{ changeFrequency: "weekly" as const, priority: 0.7, url: "/patch-notes" },
		{ changeFrequency: "weekly" as const, priority: 0.7, url: "/tactic" },
		{ changeFrequency: "monthly" as const, priority: 0.5, url: "/tools" },
		{
			changeFrequency: "monthly" as const,
			priority: 0.6,
			url: "/tools/compare",
		},
		{
			changeFrequency: "monthly" as const,
			priority: 0.5,
			url: "/tools/random-team",
		},
		{
			changeFrequency: "monthly" as const,
			priority: 0.6,
			url: "/tools/translator",
		},
		{ changeFrequency: "yearly" as const, priority: 0.3, url: "/contact" },
		{ changeFrequency: "yearly" as const, priority: 0.3, url: "/soutenir" },
		{ changeFrequency: "yearly" as const, priority: 0.2, url: "/charte" },
		{
			changeFrequency: "yearly" as const,
			priority: 0.1,
			url: "/legal/cgu",
		},
		{
			changeFrequency: "yearly" as const,
			priority: 0.1,
			url: "/legal/confidentialite",
		},
		{
			changeFrequency: "yearly" as const,
			priority: 0.1,
			url: "/legal/mentions-legales",
		},
	];

	// Aura category pages
	for (const cat of AURA_CATEGORIES) {
		staticPages.push({
			changeFrequency: "weekly" as const,
			priority: 0.7,
			url: `/aura/${cat}`,
		});
	}

	for (const page of staticPages) {
		entries.push({
			changeFrequency: page.changeFrequency,
			lastModified: new Date(),
			priority: page.priority,
			url: `${BASE_URL}${page.url}`,
		});
	}

	// Characters
	if (characters.data) {
		for (const c of characters.data) {
			entries.push({
				changeFrequency: "monthly",
				lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
				priority: 0.8,
				url: `${BASE_URL}/chara/${c.slug}`,
			});
		}
	}

	// Skills
	if (skills.data) {
		for (const s of skills.data) {
			entries.push({
				changeFrequency: "monthly",
				lastModified: s.created_at ? new Date(s.created_at) : new Date(),
				priority: 0.7,
				url: `${BASE_URL}/skill/${s.id}`,
			});
		}
	}

	// Items
	if (items.data) {
		for (const i of items.data) {
			entries.push({
				changeFrequency: "monthly",
				lastModified: i.created_at ? new Date(i.created_at) : new Date(),
				priority: 0.6,
				url: `${BASE_URL}/item/${i.id}`,
			});
		}
	}

	// Auras (keshins, souls, miximax, etc.)
	if (auras.data) {
		const typeToCategory: Record<string, string> = {};
		for (const [cat, type] of Object.entries(AURA_TYPE_MAP)) {
			typeToCategory[type] = cat;
		}

		for (const a of auras.data) {
			const category = typeToCategory[a.sub_type] || "esprits-guerriers";
			entries.push({
				changeFrequency: "monthly",
				lastModified: a.created_at ? new Date(a.created_at) : new Date(),
				priority: 0.6,
				url: `${BASE_URL}/aura/${category}/${a.id}`,
			});
		}
	}

	// Tactics
	if (tactics.data) {
		for (const t of tactics.data) {
			entries.push({
				changeFrequency: "monthly",
				lastModified: t.created_at ? new Date(t.created_at) : new Date(),
				priority: 0.6,
				url: `${BASE_URL}/tactic/${t.id}`,
			});
		}
	}

	// Articles / News
	if (articles.data) {
		for (const n of articles.data) {
			entries.push({
				changeFrequency: "monthly",
				lastModified: n.updated_at
					? new Date(n.updated_at)
					: n.published_at
						? new Date(n.published_at)
						: new Date(),
				priority: 0.7,
				url: `${BASE_URL}/news/${n.slug}`,
			});
		}
	}

	// Tags (from articles)
	if (tags.data) {
		const uniqueTags = new Set<string>();
		for (const a of tags.data) {
			if (Array.isArray(a.tags)) {
				for (const tag of a.tags) {
					uniqueTags.add(tag);
				}
			}
		}
		for (const tag of uniqueTags) {
			entries.push({
				changeFrequency: "weekly",
				lastModified: new Date(),
				priority: 0.5,
				url: `${BASE_URL}/news/tag/${encodeURIComponent(tag)}`,
			});
		}
	}

	return entries;
}
