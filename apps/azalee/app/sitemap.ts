export const dynamic = "force-dynamic";

import { getSupabaseClient } from "@/lib/api/supabase";
import type { MetadataRoute } from "next";

const BASE_URL = "https://azalee.rosegriffon.fr";

const AURA_CATEGORIES = [
	"esprits-guerriers",
	"totems",
	"miximax",
	"eveil",
	"changement-mode",
];

const AURA_TYPE_MAP: Record<string, string> = {
	"esprits-guerriers": "Keshin",
	totems: "Soul",
	miximax: "Miximax",
	eveil: "Awakening",
	"changement-mode": "ModeChange",
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const supabase = getSupabaseClient();

	// Fetch all IDs in parallel — using correct column names
	const [characters, skills, items, auras, tactics, articles, tags] =
		await Promise.all([
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
		{ url: "/", priority: 1.0, changeFrequency: "daily" as const },
		{ url: "/chara", priority: 0.9, changeFrequency: "weekly" as const },
		{ url: "/skill", priority: 0.9, changeFrequency: "weekly" as const },
		{ url: "/item", priority: 0.8, changeFrequency: "weekly" as const },
		{ url: "/aura", priority: 0.8, changeFrequency: "weekly" as const },
		{ url: "/passive", priority: 0.7, changeFrequency: "weekly" as const },
		{ url: "/search", priority: 0.6, changeFrequency: "weekly" as const },
		{ url: "/news", priority: 0.8, changeFrequency: "daily" as const },
		{ url: "/patch-notes", priority: 0.7, changeFrequency: "weekly" as const },
		{ url: "/tactic", priority: 0.7, changeFrequency: "weekly" as const },
		{ url: "/tools", priority: 0.5, changeFrequency: "monthly" as const },
		{
			url: "/tools/compare",
			priority: 0.6,
			changeFrequency: "monthly" as const,
		},
		{
			url: "/tools/random-team",
			priority: 0.5,
			changeFrequency: "monthly" as const,
		},
		{
			url: "/tools/translator",
			priority: 0.6,
			changeFrequency: "monthly" as const,
		},
		{ url: "/contact", priority: 0.3, changeFrequency: "yearly" as const },
		{ url: "/soutenir", priority: 0.3, changeFrequency: "yearly" as const },
		{ url: "/charte", priority: 0.2, changeFrequency: "yearly" as const },
		{
			url: "/legal/cgu",
			priority: 0.1,
			changeFrequency: "yearly" as const,
		},
		{
			url: "/legal/confidentialite",
			priority: 0.1,
			changeFrequency: "yearly" as const,
		},
		{
			url: "/legal/mentions-legales",
			priority: 0.1,
			changeFrequency: "yearly" as const,
		},
	];

	// Aura category pages
	for (const cat of AURA_CATEGORIES) {
		staticPages.push({
			url: `/aura/${cat}`,
			priority: 0.7,
			changeFrequency: "weekly" as const,
		});
	}

	for (const page of staticPages) {
		entries.push({
			url: `${BASE_URL}${page.url}`,
			lastModified: new Date(),
			changeFrequency: page.changeFrequency,
			priority: page.priority,
		});
	}

	// Characters
	if (characters.data) {
		for (const c of characters.data) {
			entries.push({
				url: `${BASE_URL}/chara/${c.slug}`,
				lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
				changeFrequency: "monthly",
				priority: 0.8,
			});
		}
	}

	// Skills
	if (skills.data) {
		for (const s of skills.data) {
			entries.push({
				url: `${BASE_URL}/skill/${s.id}`,
				lastModified: s.created_at ? new Date(s.created_at) : new Date(),
				changeFrequency: "monthly",
				priority: 0.7,
			});
		}
	}

	// Items
	if (items.data) {
		for (const i of items.data) {
			entries.push({
				url: `${BASE_URL}/item/${i.id}`,
				lastModified: i.created_at ? new Date(i.created_at) : new Date(),
				changeFrequency: "monthly",
				priority: 0.6,
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
				url: `${BASE_URL}/aura/${category}/${a.id}`,
				lastModified: a.created_at ? new Date(a.created_at) : new Date(),
				changeFrequency: "monthly",
				priority: 0.6,
			});
		}
	}

	// Tactics
	if (tactics.data) {
		for (const t of tactics.data) {
			entries.push({
				url: `${BASE_URL}/tactic/${t.id}`,
				lastModified: t.created_at ? new Date(t.created_at) : new Date(),
				changeFrequency: "monthly",
				priority: 0.6,
			});
		}
	}

	// Articles / News
	if (articles.data) {
		for (const n of articles.data) {
			entries.push({
				url: `${BASE_URL}/news/${n.slug}`,
				lastModified: n.updated_at
					? new Date(n.updated_at)
					: n.published_at
						? new Date(n.published_at)
						: new Date(),
				changeFrequency: "monthly",
				priority: 0.7,
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
				url: `${BASE_URL}/news/tag/${encodeURIComponent(tag)}`,
				lastModified: new Date(),
				changeFrequency: "weekly",
				priority: 0.5,
			});
		}
	}

	return entries;
}
