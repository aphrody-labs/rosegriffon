"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { isKana, toKatakana, toHiragana } from "wanakana";
import { japaneseToRomaji } from "@/lib/japanese-romaji";
import { createClient } from "@/lib/supabase/server";
import { TACTIC_FR } from "@/lib/translations";

export interface TranslationResult {
	id: string;
	type: string;
	typeLabel: string;
	name_fr: string | null;
	name_en: string | null;
	name_ja: string | null;
	name_roma: string | null;
	url: string;
}

const ENTITY_TYPE_CONFIG: Record<string, { label: string; urlPrefix: string }> = {
	character: { label: "Personnage", urlPrefix: "/chara" },
	item: { label: "Objet", urlPrefix: "/item" },
	keshin: { label: "Esprit Guerrier", urlPrefix: "/aura/esprits-guerriers" },
	skill: { label: "Technique", urlPrefix: "/skill" },
	soul: { label: "Totem", urlPrefix: "/aura/totems" },
	tactic: { label: "Tactique", urlPrefix: "/tactic" },
	team: { label: "Équipe", urlPrefix: "/team" },
};

let glossaryCache: any = null;

async function loadGlossary() {
	if (glossaryCache) return glossaryCache;
	const possiblePaths = [
		path.join(process.cwd(), "data", "glossary.json"),
		path.join(process.cwd(), "..", "..", "data", "glossary.json"),
		"/home/ubuntu/rg/data/glossary.json",
	];
	for (const p of possiblePaths) {
		try {
			const content = await fs.readFile(p, "utf-8");
			glossaryCache = JSON.parse(content);
			return glossaryCache;
		} catch {
			// Ignore error and try next path
		}
	}
	return null;
}

interface GlossaryItem {
	ja?: string;
	en?: string;
	fr?: string;
	code?: string;
	category?: string;
	element?: string;
	subType?: string;
	boostType?: string;
}

/**
 * Searches in local glossary cache.
 */
async function searchGlossary(query: string, entityType?: string): Promise<TranslationResult[]> {
	const glossary = await loadGlossary();
	if (!glossary) return [];

	const sanitized = query.replaceAll(/[%_,().*\\]/g, "").trim().toLowerCase();
	if (!sanitized) return [];

	const hiraCandidate = toHiragana(sanitized).toLowerCase();
	const kataCandidate = toKatakana(sanitized).toLowerCase();

	const isValidHira = hiraCandidate.length > 0 && [...hiraCandidate].every((c) => isKana(c) || c === "ー");
	const isValidKata = kataCandidate.length > 0 && [...kataCandidate].every((c) => isKana(c) || c === "ー");

	const results: TranslationResult[] = [];

	const searchCategory = (catName: string, type: string, typeLabel: string, urlPrefix: string) => {
		if (entityType && entityType !== type) return;
		const list = glossary[catName] || [];
		for (const entry of list as GlossaryItem[]) {
			let matched = false;
			const enLower = (entry.en || "").toLowerCase();
			const frLower = (entry.fr || "").toLowerCase();
			const jaLower = (entry.ja || "").toLowerCase();

			if (enLower.includes(sanitized) || frLower.includes(sanitized) || jaLower.includes(sanitized)) {
				matched = true;
			} else if (isValidHira && jaLower.includes(hiraCandidate)) {
				matched = true;
			} else if (isValidKata && jaLower.includes(kataCandidate)) {
				matched = true;
			} else if (entry.ja) {
				const roma = japaneseToRomaji(entry.ja);
				if (roma && roma.toLowerCase().includes(sanitized)) {
					matched = true;
				}
			}

			if (matched) {
				const id = entry.code || entry.en || entry.ja || Math.random().toString();
				let finalType = type;
				let finalTypeLabel = typeLabel;
				let finalUrl = `${urlPrefix}/${id}`;

				if (type === "aura") {
					const isSoul = entry.subType === "soul" || (entry.subType && entry.subType.toLowerCase().includes("soul"));
					finalType = isSoul ? "soul" : "keshin";
					finalTypeLabel = isSoul ? "Totem" : "Esprit Guerrier";
					finalUrl = isSoul ? `/aura/totems/${id}` : `/aura/esprits-guerriers/${id}`;
				}

				results.push({
					id,
					type: finalType,
					typeLabel: finalTypeLabel,
					name_fr: entry.fr || entry.en || null,
					name_en: entry.en || null,
					name_ja: entry.ja || null,
					name_roma: entry.ja ? japaneseToRomaji(entry.ja) : null,
					url: finalUrl,
				});
			}
		}
	};

	searchCategory("characters", "character", "Personnage", "/chara");
	searchCategory("techniques", "skill", "Technique", "/skill");
	searchCategory("auras", "aura", "Aura", "/aura");
	searchCategory("passives", "skill", "Technique", "/skill");
	searchCategory("teams", "team", "Équipe", "/team");
	searchCategory("items", "item", "Objet", "/item");
	searchCategory("terms", "term", "Terme", "#");

	return results;
}

/**
 * Searches in Supabase database tables.
 */
async function searchSupabase(query: string, entityType?: string): Promise<TranslationResult[]> {
	const supabase = await createClient();
	const sanitized = query.replaceAll(/[%_,().*\\]/g, "").trim();
	if (!sanitized) return [];

	const q = `%${sanitized}%`;

	// Build base OR filter
	const orFilters = [
		`name_fr.ilike.${q}`,
		`name_en.ilike.${q}`,
		`name_ja.ilike.${q}`
	];

	// Romaji-Katakana/Hiragana conversion checks
	const hiraCandidate = toHiragana(sanitized.toLowerCase());
	const kataCandidate = toKatakana(sanitized.toLowerCase());

	const isValidHira = hiraCandidate.length > 0 && [...hiraCandidate].every((c) => isKana(c) || c === "ー");
	const isValidKata = kataCandidate.length > 0 && [...kataCandidate].every((c) => isKana(c) || c === "ー");

	if (isValidHira && hiraCandidate !== sanitized.toLowerCase()) {
		orFilters.push(`name_ja.ilike.%${hiraCandidate}%`);
	}
	if (isValidKata && kataCandidate !== sanitized.toLowerCase()) {
		orFilters.push(`name_ja.ilike.%${kataCandidate}%`);
	}

	const orFilterString = orFilters.join(",");
	const charOrFilterString = [...orFilters, `name_roma.ilike.${q}`].join(",");

	const results: TranslationResult[] = [];
	const queries: Array<PromiseLike<void>> = [];

	const shouldQuery = (type: string) => !entityType || entityType === type;

	if (shouldQuery("character")) {
		queries.push(
			supabase
				.from("inagle_characters")
				.select("slug, name_fr, name_en, name_ja, name_roma")
				.or(charOrFilterString)
				.not("internal_code", "like", "%_5000")
				.order("name_fr", { ascending: true, nullsFirst: false })
				.limit(entityType ? 30 : 8)
				.then(({ data }: any) => {
					if (data) {
						for (const c of data) {
							results.push({
								id: c.slug || c.id,
								name_en: c.name_en,
								name_fr: c.name_fr,
								name_ja: c.name_ja,
								name_roma: c.name_roma || japaneseToRomaji(c.name_ja),
								type: "character",
								typeLabel: ENTITY_TYPE_CONFIG.character.label,
								url: `/chara/${c.slug}`,
							});
						}
					}
				})
		);
	}

	if (shouldQuery("skill")) {
		queries.push(
			supabase
				.from("inagle_skills")
				.select("id, name_fr, name_en, name_ja")
				.or(orFilterString)
				.order("name_fr", { ascending: true, nullsFirst: false })
				.limit(entityType ? 30 : 8)
				.then(({ data }: any) => {
					if (data) {
						for (const s of data) {
							results.push({
								id: s.id,
								name_en: s.name_en,
								name_fr: s.name_fr,
								name_ja: s.name_ja,
								name_roma: japaneseToRomaji(s.name_ja),
								type: "skill",
								typeLabel: ENTITY_TYPE_CONFIG.skill.label,
								url: `/skill/${s.id}`,
							});
						}
					}
				})
		);
	}

	if (shouldQuery("item")) {
		queries.push(
			supabase
				.from("inagle_items")
				.select("id, name_fr, name_en, name_ja, category")
				.or(orFilterString)
				.neq("category", "special_tactics")
				.order("name_fr", { ascending: true, nullsFirst: false })
				.limit(entityType ? 30 : 6)
				.then(({ data }: any) => {
					if (data) {
						for (const i of data) {
							results.push({
								id: i.id,
								name_en: i.name_en,
								name_fr: i.name_fr,
								name_ja: i.name_ja,
								name_roma: japaneseToRomaji(i.name_ja),
								type: "item",
								typeLabel: ENTITY_TYPE_CONFIG.item.label,
								url: `/item/${i.id}`,
							});
						}
					}
				})
		);
	}

	if (shouldQuery("tactic")) {
		queries.push(
			supabase
				.from("inagle_items")
				.select("id, name_fr, name_en, name_ja")
				.or(orFilterString)
				.eq("category", "special_tactics")
				.order("name_fr", { ascending: true, nullsFirst: false })
				.limit(entityType ? 30 : 6)
				.then(({ data }: any) => {
					if (data) {
						for (const t of data) {
							results.push({
								id: t.id,
								name_en: t.name_en,
								name_fr: TACTIC_FR[t.name_en] || t.name_fr,
								name_ja: t.name_ja,
								name_roma: japaneseToRomaji(t.name_ja),
								type: "tactic",
								typeLabel: ENTITY_TYPE_CONFIG.tactic.label,
								url: `/tactic/${t.id}`,
							});
						}
					}
				})
		);
	}

	if (shouldQuery("team")) {
		queries.push(
			supabase
				.from("inagle_teams")
				.select("id, name_fr, name_en, name_ja")
				.or(orFilterString)
				.order("name_fr", { ascending: true, nullsFirst: false })
				.limit(entityType ? 30 : 6)
				.then(({ data }: any) => {
					if (data) {
						for (const t of data) {
							results.push({
								id: t.id,
								name_en: t.name_en,
								name_fr: t.name_fr,
								name_ja: t.name_ja,
								name_roma: japaneseToRomaji(t.name_ja),
								type: "team",
								typeLabel: ENTITY_TYPE_CONFIG.team.label,
								url: `/team/${t.id}`,
							});
						}
					}
				})
		);
	}

	if (shouldQuery("keshin")) {
		queries.push(
			supabase
				.from("inagle_keshins_clean")
				.select("id, name_fr, name_en, name_ja")
				.or(orFilterString)
				.order("name_fr", { ascending: true, nullsFirst: false })
				.limit(entityType ? 30 : 5)
				.then(({ data }: any) => {
					if (data) {
						for (const k of data) {
							results.push({
								id: k.id,
								name_en: k.name_en,
								name_fr: k.name_fr,
								name_ja: k.name_ja,
								name_roma: japaneseToRomaji(k.name_ja),
								type: "keshin",
								typeLabel: ENTITY_TYPE_CONFIG.keshin.label,
								url: `/aura/esprits-guerriers/${k.id}`,
							});
						}
					}
				})
		);
	}

	if (shouldQuery("soul")) {
		queries.push(
			supabase
				.from("inagle_souls_clean")
				.select("id, name_fr, name_en, name_ja")
				.or(orFilterString)
				.order("name_fr", { ascending: true, nullsFirst: false })
				.limit(entityType ? 30 : 5)
				.then(({ data }: any) => {
					if (data) {
						for (const s of data) {
							results.push({
								id: s.id,
								name_en: s.name_en,
								name_fr: s.name_fr,
								name_ja: s.name_ja,
								name_roma: japaneseToRomaji(s.name_ja),
								type: "soul",
								typeLabel: ENTITY_TYPE_CONFIG.soul.label,
								url: `/aura/totems/${s.id}`,
							});
						}
					}
				})
		);
	}

	try {
		await Promise.all(queries);
	} catch {
		// Suppress database connection errors to allow glossary fallback
	}

	return results;
}

/**
 * Unified translations search exploiting database queries, romaji-katakana translation, and local glossary caches.
 */
export async function searchTranslations(
	query: string,
	entityType?: string
): Promise<TranslationResult[]> {
	if (!query || query.length < 2) {
		return [];
	}

	const [dbResults, glossaryResults] = await Promise.all([
		searchSupabase(query, entityType),
		searchGlossary(query, entityType),
	]);

	// Merge and de-duplicate
	const seen = new Set<string>();
	const merged: TranslationResult[] = [];

	// Database results take priority because they have accurate DB slugs & URLs
	for (const r of dbResults) {
		const key = `${r.type}-${r.id}`.toLowerCase();
		if (!seen.has(key)) {
			seen.add(key);
			merged.push(r);
		}
	}

	// Backfill with glossary results
	for (const r of glossaryResults) {
		const key = `${r.type}-${r.id}`.toLowerCase();
		const nameKey = `${r.type}-${r.name_fr || r.name_en}`.toLowerCase();
		if (!seen.has(key) && !seen.has(nameKey)) {
			seen.add(key);
			seen.add(nameKey);
			merged.push(r);
		}
	}

	// Sort by relevance: exact match > prefix > contains
	const queryLower = query.replaceAll(/[%_,().*\\]/g, "").trim().toLowerCase();
	merged.sort((a, b) => {
		const scoreOf = (r: TranslationResult) => {
			for (const name of [r.name_fr, r.name_en, r.name_ja, r.name_roma]) {
				if (!name) continue;
				const n = name.toLowerCase();
				if (n === queryLower) return 3;
				if (n.startsWith(queryLower)) return 2;
			}
			return 1;
		};
		return scoreOf(b) - scoreOf(a);
	});

	return merged.slice(0, 30);
}
