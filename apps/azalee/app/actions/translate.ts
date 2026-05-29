"use server";

import { isKana, toKatakana } from "wanakana";
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

/**
 * Search translations across all game entities.
 * Returns name_fr, name_en, name_ja for each match.
 */
export async function searchTranslations(
	query: string,
	entityType?: string
): Promise<TranslationResult[]> {
	if (!query || query.length < 2) {
		return [];
	}

	const supabase = await createClient();
	const sanitized = query.replaceAll(/[%_,().*\\]/g, "");
	const q = `%${sanitized}%`;

	// Build OR filter with optional katakana conversion
	let orFilter = `name_fr.ilike.${q},name_en.ilike.${q},name_ja.ilike.${q}`;
	const kataCandidate = toKatakana(sanitized.toLowerCase());
	const isValidKana =
		kataCandidate.length > 0 && [...kataCandidate].every((c) => isKana(c) || c === "ー");
	if (isValidKana && kataCandidate !== sanitized) {
		orFilter += `,name_ja.ilike.%${kataCandidate}%`;
	}

	const results: TranslationResult[] = [];

	// Build queries based on entityType filter
	const queries: Array<PromiseLike<void>> = [];

	const shouldQuery = (type: string) => !entityType || entityType === type;

	if (shouldQuery("character")) {
		queries.push(
			supabase
				.from("inagle_characters")
				.select("slug, name_fr, name_en, name_ja, name_roma")
				.or(orFilter)
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
				.or(orFilter)
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
				.or(orFilter)
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
				.or(orFilter)
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
				.or(orFilter)
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
				.or(orFilter)
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
				.or(orFilter)
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

	await Promise.all(queries);

	// Sort by relevance: exact match > prefix > contains
	const queryLower = sanitized.toLowerCase();
	results.sort((a, b) => {
		const scoreOf = (r: TranslationResult) => {
			for (const name of [r.name_fr, r.name_en, r.name_ja]) {
				if (!name) {
					continue;
				}
				const n = name.toLowerCase();
				if (n === queryLower) {
					return 3;
				}
				if (n.startsWith(queryLower)) {
					return 2;
				}
			}
			return 1;
		};
		return scoreOf(b) - scoreOf(a);
	});

	return results.slice(0, 30);
}
