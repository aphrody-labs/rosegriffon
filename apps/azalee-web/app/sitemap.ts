export const dynamic = "force-dynamic";

import { getSupabaseClient } from "@/lib/api/supabase";
import type { MetadataRoute } from "next";
import { getCoachesList } from "@/lib/wiki/coaches";
import { getCapsuleList } from "@/lib/wiki/gacha";
import { getAllQuests } from "@/lib/wiki/quests";
import { getShopsList } from "@/lib/wiki/shops";
import { getStadiumsList } from "@/lib/wiki/stadiums";
import { getAllTeamIds } from "@/lib/wiki/teams";
import { getAllTrophies } from "@/lib/wiki/trophies";
import { wikiService } from "@/lib/wiki-service";

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
		// Sections du wiki absentes jusqu'ici du plan de site alors que leurs
		// pages existent et répondent 200 : elles n'étaient découvrables que par
		// le maillage interne.
		{ changeFrequency: "weekly" as const, priority: 0.7, url: "/equipe" },
		{ changeFrequency: "weekly" as const, priority: 0.7, url: "/quete" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/boutique" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/entraineur" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/stade" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/succes" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/capsule" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/drops" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/invocation" },
		// `/keshin` a fusionné dans `/modeles` (redirection permanente) : ne pas l'annoncer, un
		// sitemap ne doit lister que des URLs canoniques.
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/modeles/keshin" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/modeles/chara" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/modeles/waza" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/modeles/item" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/modeles/armd" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/gallery" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/textures" },
		{ changeFrequency: "weekly" as const, priority: 0.6, url: "/sons" },
		{ changeFrequency: "monthly" as const, priority: 0.5, url: "/modeles" },
		// Sections existantes qui n'étaient annoncées nulle part : la sixième
		// collection média, la table d'expérience et la démonstration technique.
		{ changeFrequency: "monthly" as const, priority: 0.5, url: "/mode" },
		{ changeFrequency: "monthly" as const, priority: 0.6, url: "/niveau" },
		{ changeFrequency: "monthly" as const, priority: 0.4, url: "/demo" },
		{ changeFrequency: "monthly" as const, priority: 0.5, url: "/videos" },
		{ changeFrequency: "monthly" as const, priority: 0.5, url: "/cross" },
		{ changeFrequency: "monthly" as const, priority: 0.4, url: "/save" },
		{ changeFrequency: "monthly" as const, priority: 0.4, url: "/cpk" },
		{ changeFrequency: "monthly" as const, priority: 0.5, url: "/tools" },
		{ changeFrequency: "monthly" as const, priority: 0.5, url: "/tools/my-team" },
		{ changeFrequency: "monthly" as const, priority: 0.5, url: "/tools/stats" },
		{ changeFrequency: "monthly" as const, priority: 0.4, url: "/tools/niers" },
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

	// Fiches des sections servies par la bibliothèque `@rosegriffon/azalee` :
	// équipes, entraîneurs, stades, quêtes, succès, lots de capsule, boutiques et
	// passifs. Leurs pages de liste étaient annoncées, mais aucune de leurs
	// ~4 000 fiches ne l'était — elles n'existaient, pour un robot, que par le
	// maillage interne. Chaque source est isolée : une section indisponible ne
	// doit pas vider le plan de site des autres.
	const familles: { chemin: string; priorite: number; ids: () => Promise<string[]> }[] = [
		{ chemin: "/equipe", priorite: 0.6, ids: () => getAllTeamIds() },
		{
			chemin: "/entraineur",
			priorite: 0.5,
			ids: async () => (await getCoachesList()).map((c) => String(c.id)),
		},
		{
			chemin: "/stade",
			priorite: 0.5,
			ids: async () => (await getStadiumsList()).data.map((s) => s.id),
		},
		{ chemin: "/quete", priorite: 0.6, ids: async () => (await getAllQuests()).map((q) => q.id) },
		{
			chemin: "/succes",
			priorite: 0.5,
			ids: async () => (await getAllTrophies()).map((t) => t.id),
		},
		{
			chemin: "/capsule",
			priorite: 0.4,
			// `getCapsuleList` plafonne la page à 200 lignes : on la parcourt.
			ids: async () => {
				const ids: string[] = [];
				for (let page = 1; ; page += 1) {
					const { data, total } = await getCapsuleList({ limit: 200, page });
					ids.push(...data.map((p) => p.id));
					if (ids.length >= total || data.length === 0) break;
				}
				return ids;
			},
		},
		{
			chemin: "/boutique",
			priorite: 0.5,
			ids: async () => (await getShopsList()).map((s) => String(s.shopId)),
		},
		{
			chemin: "/passive",
			priorite: 0.5,
			ids: async () =>
				wikiService
					.getPassivesList({ limit: 5000, page: 1 })
					.data.map((p) => p.passive_id)
					.filter(Boolean),
		},
	];

	for (const famille of familles) {
		try {
			for (const id of await famille.ids()) {
				entries.push({
					changeFrequency: "monthly",
					lastModified: new Date(),
					priority: famille.priorite,
					url: `${BASE_URL}${famille.chemin}/${encodeURIComponent(id)}`,
				});
			}
		} catch (erreur) {
			console.error(`[sitemap] ${famille.chemin} indisponible :`, erreur);
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
