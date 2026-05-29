import type { BaseCharacter, Item, Skill, Team } from "@rose-griffon/inagle";
import { ElementNames } from "@rose-griffon/inagle/core/types";
import { CATEGORY_NAMES as CategoryNames } from "@rose-griffon/inagle/skills/types";
import type { Database } from "@rose-griffon/db";
import {
	getAuraImageUrl,
	getMiximaxIconUrl,
	resolveAssetUrl,
	resolveAuraTelopUrl,
} from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import { SHOP_FR, TACTIC_FR, tacticSlug } from "@/lib/translations";

// Use generated types
type DbItem = Database["public"]["Tables"]["inagle_items"]["Row"];
type DbSkill = Database["public"]["Tables"]["inagle_skills"]["Row"];
type DbAura =
	| Database["public"]["Tables"]["inagle_auras"]["Row"]
	| Database["public"]["Tables"]["inagle_keshins"]["Row"]
	| Database["public"]["Tables"]["inagle_souls"]["Row"]
	| Database["public"]["Tables"]["inagle_awakenings"]["Row"]
	| Database["public"]["Tables"]["inagle_miximax"]["Row"]
	| Database["public"]["Tables"]["inagle_mode_changes"]["Row"];

interface ListParams {
	page?: number;
	limit?: number;
	q?: string;
	element?: string;
	position?: string;
	rarity?: string;
	category?: string;
	team?: string;
	series?: string;
	gender?: string;
	playstyle?: string;
	has_video?: string;
	show_aura?: string;
	overdrive?: string;
	sort?: string;
	power_min?: string;
	power_max?: string;
	status?: string;
	role?: string;
}

interface ListResult<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
}

// Helpers — returns all matching element IDs (Void maps to both 0 and 5)
function getElementIds(name: string): number[] {
	if (!name) {
		return [];
	}
	const n = name.toLowerCase();
	const ids: number[] = [];
	for (const [id, val] of Object.entries(ElementNames)) {
		const v = val as any;
		if (v.en?.toLowerCase() === n || v.fr?.toLowerCase() === n) {
			ids.push(Number(id));
		}
	}
	return ids;
}

function getCategoryId(name: string): number | undefined {
	if (!name) {
		return undefined;
	}
	const n = name.toLowerCase();
	for (const [id, val] of Object.entries(CategoryNames)) {
		const v = val as any;
		if (v.en?.toLowerCase() === n || v.fr?.toLowerCase() === n) {
			return Number(id);
		}
	}
	return undefined;
}

/** Sanitize user input for PostgREST filter interpolation to prevent filter injection */
function sanitizeFilter(input: string): string {
	return input.replaceAll(/[%_,().*\\]/g, "");
}

/**
 * Héros with unique internal codes → base (untransformed) character codes.
 * Used to display the base face icon instead of the Héros-transformed one.
 * Only needed for Héros whose code differs from any Normal entry.
 */
const HERO_BASE_CODES: Record<string, string> = {
	c03030100: "c03032210", // Hector Helio → Hector
	c05024640: "c11200500", // Hurley Kane → Hurley
	c05024690: "c03030040", // Xavier Schiller → Xavier
	c05026600: "c03030010", // Austin Hobbes → Austin
	c06037430: "c02023810", // Darren LaChance → Darren
	c06037440: "c03030020", // Archer Hawkins → Archer
	c06039070: "c04000100", // Victor Blade → Victor
	c07020120: "c01000300", // Jude Sharp → Jude
	c07040120: "c01000030", // Jack Wallside → Jack
	c07050010: "c01000100", // Axel Blaze → Axel
	c07070010: "c01000210", // Joseph King → Joseph
	c07070110: "c02023700", // Caleb Stonewall → Caleb
	c07070120: "c01000020", // Nathan Swift → Nathan
	c07080010: "c05026590", // Byron Love → Byron Love (GO)
	c07090010: "c02023290", // Shawn Froste → Shawn
	c07110020: "c01000010", // Mark Evans → Mark
	c07120060: "c01010910", // Erik Eagle → Erik
	c11010230: "c11010070", // Cade Shelby → Cade
	c11250060: "c03033690", // Bash Lancer → Bash
	c11600030: "c05028160", // Zanark Avalonic → Zanark
};

function normalizeAuraSheetData(sd: any): any {
	if (!sd) {
		return null;
	}
	const nested = sd.sheetData;
	const base = nested && nested !== "null" ? { ...sd, ...nested } : sd;
	return {
		...base,
		// "passive" (DB field) → "passiveEffect" (component field)
		passiveEffect: base.passiveEffect || base.passive,
		hissatsu: base.hissatsu,
		buff: base.buff,
		matchedName: base.matchedName,
	};
}

export const wikiService = {
	/** Get all distinct constellations for a character (by name — heroes appear in multiple constellations via different chara_ids) */
	async _getHeroConstellations(row: any): Promise<Array<{ name: string; index: number }>> {
		const name = row?.name_en;
		if (!name) return [];
		const supabase = await createClient();
		const { data } = await supabase
			.from("inagle_characters")
			.select("constellation, constellation_index")
			.eq("name_en", name)
			.not("constellation", "is", null);
		if (!data) return [];
		// Deduplicate by constellation name
		const seen = new Set<string>();
		const results: Array<{ name: string; index: number }> = [];
		for (const r of data as any[]) {
			if (!seen.has(r.constellation)) {
				seen.add(r.constellation);
				results.push({
					name: r.constellation,
					index: r.constellation_index ?? 0,
				});
			}
		}
		return results;
	},

	/** If character has no constellation (e.g. BASARA/Hero), inherit from counterpart via chara_id or name */
	async _inheritConstellation(base: BaseCharacter, row: any): Promise<void> {
		if ((base as any).constellation) return;
		const supabase = await createClient();

		// Try 1: inherit from sibling with same chara_id
		if (row?.chara_id) {
			const { data: sibling } = await supabase
				.from("inagle_characters")
				.select("constellation, constellation_index")
				.eq("chara_id", row.chara_id)
				.not("constellation", "is", null)
				.limit(1)
				.maybeSingle();
			if (sibling?.constellation) {
				(base as any).constellation = {
					index: sibling.constellation_index ?? 0,
					names: { fr: sibling.constellation },
				};
				return;
			}
		}

		// Try 2: inherit from name-matched variant (hero forms have different chara_id)
		const name = row?.name_en;
		if (name) {
			const { data: nameMatch } = await supabase
				.from("inagle_characters")
				.select("constellation, constellation_index")
				.eq("name_en", name)
				.not("constellation", "is", null)
				.limit(1)
				.maybeSingle();
			if (nameMatch?.constellation) {
				(base as any).constellation = {
					index: nameMatch.constellation_index ?? 0,
					names: { fr: nameMatch.constellation },
				};
			}
		}
	},

	/** Find an aura/keshin/soul/miximax by name (partial match) — used for hero hyper techniques */
	async findAuraByName(name: string): Promise<{
		id: string;
		name_en: string;
		name_fr: string;
		sub_type?: string;
		categorySlug?: string;
	} | null> {
		const supabase = await createClient();
		// Clean the search name (remove common prefixes)
		const cleanName = name
			.replace(/^Mix 'n' Match: /i, "")
			.replace(/^Miximax Trans\.: /i, "")
			.replace(/ Totem$/i, "")
			.trim();
		// Search across aura-related tables — map table to URL category slug
		const tables = [
			{ table: "inagle_keshins", slug: "esprits-guerriers" },
			{ table: "inagle_souls", slug: "totems" },
			{ table: "inagle_miximax", slug: "miximax" },
			{ table: "inagle_auras", slug: "autres" },
		] as const;
		const safeCleanName = sanitizeFilter(cleanName);
		const searchPromises = tables.map(({ table }) =>
			(supabase as any)
				.from(table)
				.select("id, name_en, name_fr, sub_type")
				.or(`name_en.ilike.%${safeCleanName}%,name_fr.ilike.%${safeCleanName}%`)
				.limit(1)
		);
		const results = await Promise.all(searchPromises);
		for (let i = 0; i < tables.length; i++) {
			const data = results[i].data;
			if (data && data.length > 0) {
				return { ...data[0], categorySlug: tables[i].slug };
			}
		}
		// Exact match: use parameterized .eq() to avoid filter injection
		const { data: exact } = await supabase
			.from("inagle_auras")
			.select("id, name_en, name_fr, sub_type")
			.or(`name_en.eq.${sanitizeFilter(name)},name_fr.eq.${sanitizeFilter(name)}`)
			.limit(1);
		if (exact && exact.length > 0) return { ...exact[0], categorySlug: "autres" } as any;
		return null;
	},

	/** Get all distinct base_slugs for generateStaticParams */
	async getAllBaseSlugParams(): Promise<Array<{ id: string }>> {
		const supabase = await createClient();
		const { data } = await supabase
			.from("inagle_characters")
			.select("base_slug")
			.not("base_slug", "is", null);
		if (!data) return [];
		// Deduplicate
		const seen = new Set<string>();
		const params: Array<{ id: string }> = [];
		for (const row of data) {
			if (row.base_slug && !seen.has(row.base_slug)) {
				seen.add(row.base_slug);
				params.push({ id: row.base_slug });
			}
		}
		return params;
	},

	async getAllTeams(): Promise<Array<{ id: string; name: string }>> {
		const supabase = await createClient();
		const { data } = await supabase
			.from("inagle_teams")
			.select("id, name_fr, name_ja")
			.order("name_fr");
		return (data || []).map((t: any) => ({
			id: t.id,
			name: t.name_fr,
			name_ja: t.name_ja,
		}));
	},

	async getCharacterAuras(
		charaId: string,
		charaParamId: string
	): Promise<Array<{
		id: string;
		name: string;
		type: string;
		categorySlug: string;
		imageUrl: string | null;
		assetCode: string | null;
		subType: string;
		element?: { en?: string; ja?: string; fr?: string };
	}>> {
		const supabase = await createClient();
		const results: any[] = [];
		const tables = [
			{ table: "inagle_keshins", slug: "esprits-guerriers", subType: "Keshin" },
			{ table: "inagle_souls", slug: "totems", subType: "Soul" },
			{ table: "inagle_miximax", slug: "miximax", subType: "Miximax" },
		] as const;

		const cleanCharaId = sanitizeFilter(charaId);
		const cleanParamId = sanitizeFilter(charaParamId);

		const searchPromises = tables.map(async ({ table, slug, subType }) => {
			const { data } = await supabase
				.from(table as any)
				.select("id, name_fr, name_en, name_ja, image_url, asset_code, element_id, data, owner_chara_id")
				.or(`owner_chara_id.eq.${cleanCharaId},owner_chara_id.eq.${cleanParamId},data->>ownerCharaParamId.eq.${cleanCharaId},data->>ownerCharaParamId.eq.${cleanParamId}`);

			if (data) {
				for (const a of data as any[]) {
					results.push({
						id: a.id,
						name: a.name_fr || a.name_en || a.name_ja || "Inconnu",
						type: subType.toLowerCase(),
						categorySlug: slug,
						imageUrl: a.image_url,
						assetCode: a.asset_code,
						subType,
						element: ElementNames[a.element_id as keyof typeof ElementNames] || undefined,
					});
				}
			}
		});

		await Promise.all(searchPromises);
		return results;
	},

	async getAura(id: string, typeSlug: string): Promise<any | undefined> {
		const supabase = await createClient();

		// Map slug to the actual table (not view) for detail lookups
		const tableMap: Record<string, string> = {
			"esprits-guerriers": "inagle_keshins",
			totems: "inagle_souls",
			miximax: "inagle_miximax",
			eveil: "inagle_awakenings",
			"changement-mode": "inagle_mode_changes",
			autres: "inagle_auras",
		};

		const table = tableMap[typeSlug];
		if (!table) return undefined;

		// For "éveil", also search in inagle_auras (generic auras used as awakenings)
		const tablesToSearch = typeSlug === "eveil" ? [table, "inagle_auras"] : [table];

		// Try match by ID or asset_code across all candidate tables in parallel
		const searchPromises = tablesToSearch.map((t) =>
			(supabase as any).from(t).select("*").or(`id.eq.${id},asset_code.eq.${id}`).maybeSingle()
		);
		const searchResults = await Promise.all(searchPromises);
		const row = searchResults.find((res) => res.data)?.data || null;

		if (!row) return undefined;

		const a = row as any;
		const elementInfo = ElementNames[a.element_id as keyof typeof ElementNames] || ElementNames[0];
		const sd = normalizeAuraSheetData(a.sheet_data) || {};

		// Fetch linked skill video and owner in parallel
		let skillVideoUrl: string | null = null;
		let skillInternalCode: string | null = null;
		let skillNameFR: string | null = null;
		let ownerName: string | undefined;
		let ownerSlug: string | undefined;

		const rawSd = (a.sheet_data || {}) as any;
		const config = rawSd.config || {};
		const possibleSkillIds = [config.skillId1, config.skillId2].filter(
			(sid: string) => sid && sid !== "0x00000000"
		);

		const parallelPromises: Array<PromiseLike<any>> = [];

		// Push skill queries
		if (a.skill_id) {
			parallelPromises.push(
				supabase
					.from("inagle_skills")
					.select("video_url, internal_code, name_fr, name_en")
					.eq("id", a.skill_id)
					.maybeSingle()
					.then(({ data }) => ({ type: "skill", data }))
			);
		}
		for (const sid of possibleSkillIds) {
			parallelPromises.push(
				supabase
					.from("inagle_skills")
					.select("video_url, internal_code, name_fr, name_en")
					.or(`data->>skillID.eq.${sid},sheet_data->>skillID.eq.${sid}`)
					.limit(1)
					.maybeSingle()
					.then(({ data }) => ({ type: "skill", data }))
			);
		}

		// Push owner query
		const ownerCharaId = a.owner_chara_id || (a.data as any)?.ownerCharaParamId;
		if (ownerCharaId) {
			parallelPromises.push(
				supabase
					.from("inagle_characters")
					.select("name_fr, name_en, slug, base_slug")
					.eq("id", ownerCharaId)
					.maybeSingle()
					.then(({ data }) => ({ type: "owner", data }))
			);
		}

		if (parallelPromises.length > 0) {
			const results = await Promise.all(parallelPromises);

			// Process skill results
			const skillResults = results.filter((r) => r.type === "skill" && r.data).map((r) => r.data);
			const foundSkill = skillResults.find((s) => s && (s.name_fr || s.name_en));
			const fallbackSkill = skillResults.find((s) => s);
			const targetSkill = foundSkill || fallbackSkill;
			if (targetSkill) {
				skillVideoUrl = targetSkill.video_url;
				skillInternalCode = targetSkill.internal_code;
				skillNameFR = targetSkill.name_fr || targetSkill.name_en || null;
			}

			// Process owner result
			const ownerResult = results.find((r) => r.type === "owner" && r.data)?.data;
			if (ownerResult) {
				ownerName = ownerResult.name_fr || ownerResult.name_en || undefined;
				ownerSlug = ownerResult.base_slug || ownerResult.slug || ownerCharaId || undefined;
			}
		}

		return {
			auraId: a.id,
			auraIdStr: a.id,
			displayName:
				a.name_fr || a.name_en || sd.displayName || sd.name_FR || sd.name_EN || "Inconnu",
			name_FR: a.name_fr || sd.name_FR,
			name_EN: a.name_en || sd.name_EN,
			name_JA: a.name_ja || sd.name_JA,
			desc_FR: a.description_fr || sd.desc_FR,
			desc_JA: a.description_ja || sd.desc_JA,
			element: a.element_id,
			elementName: elementInfo,
			// Image principale = icone carree 256x256 (aura_fs / aura_soul / image_url DB).
			// La telop 1728x352 est un bandeau horizontal, exposee separement via telopUrl
			// pour un affichage adapte (aspect 4.9:1) — pas adaptee au container carre.
			image: (() => {
				const ac = a.asset_code || sd.assetCode || null;
				const subType = a.sub_type || sd.subType;
				return (
					getAuraImageUrl(ac, subType) ||
					resolveAssetUrl(a.image_url) ||
					getMiximaxIconUrl(a.icon_code) ||
					resolveAuraTelopUrl(ac) ||
					sd.image ||
					null
				);
			})(),
			// Bandeau telop (1728x352) — affichage banner sous l'image principale.
			telopUrl: resolveAuraTelopUrl(a.asset_code || sd.assetCode || null),
			assetCode: a.asset_code || sd.assetCode,
			subType: a.sub_type || sd.subType || "Aura",
			sheetData: sd,
			skillId: a.skill_id || null,
			skillVideoUrl,
			skillInternalCode,
			skillNameFR,
			ownerCharaParamId: ownerCharaId || undefined,
			ownerName,
			ownerSlug,
		};
	},

	async getAurasList(params: ListParams & { typeSlug: string }): Promise<ListResult<any>> {
		const supabase = await createClient();
		const page = params.page || 1;
		const limit = params.limit || 50;
		const from = (page - 1) * limit;
		const to = from + limit - 1;

		// Use clean deduplicated views (no bare hex duplicates, no unknown entries)
		const viewMap: Record<string, string> = {
			"esprits-guerriers": "inagle_keshins_clean",
			totems: "inagle_souls_clean",
			miximax: "inagle_miximax_clean",
			eveil: "inagle_awakenings_clean",
			"changement-mode": "inagle_mode_changes_clean",
			autres: "inagle_auras",
		};

		const view = viewMap[params.typeSlug];
		if (!view) return { data: [], total: 0, page, limit };

		// For "éveil", combine awakenings + generic auras (which contain the real awakening entries)
		if (params.typeSlug === "eveil") {
			const buildQuery = (table: string) => {
				let q = (supabase as any).from(table).select("*");
				if (params.q) {
					const sq = sanitizeFilter(params.q);
					q = q.or(
						`name_fr.ilike.%${sq}%,name_en.ilike.%${sq}%,sheet_data->>name_FR.ilike.%${sq}%,sheet_data->>name_EN.ilike.%${sq}%`
					);
				}
				if (params.element) {
					const elIds = getElementIds(params.element);
					if (elIds.length === 1) q = q.eq("element_id", elIds[0]);
					else if (elIds.length > 1) q = q.in("element_id", elIds);
				}
				return q.order("name_fr", { nullsFirst: false });
			};

			const [{ data: awakenings }, { data: auras }] = await Promise.all([
				buildQuery("inagle_awakenings_clean").limit(2000),
				buildQuery("inagle_auras").limit(2000),
			]);

			const combined = [...(awakenings || []), ...(auras || [])];
			combined.sort((a: any, b: any) => (a.name_fr || "").localeCompare(b.name_fr || "", "fr"));
			const total = combined.length;
			const paged = combined.slice(from, to + 1);

			const results = (paged as unknown as DbAura[]).map((a) => {
				const elementInfo =
					ElementNames[a.element_id as keyof typeof ElementNames] || ElementNames[0];
				const sd = (a.sheet_data || {}) as any;
				const assetCode = (a as any).asset_code || sd.assetCode || null;
				return {
					id: a.id,
					auraId: a.id,
					name: a.name_fr || a.name_en || sd.displayName || sd.name_FR || sd.name_EN || "Inconnu",
					passive: a.description_fr || sd.desc_FR,
					hissatsu_name: sd?.hissatsu?.name || sd?.sheetData?.hissatsu?.name,
					element: elementInfo.en,
					image_url:
						getAuraImageUrl(assetCode, (a as any).sub_type || sd.subType) ||
						getMiximaxIconUrl((a as any).icon_code) ||
						resolveAssetUrl(a.image_url) ||
						resolveAuraTelopUrl(assetCode) ||
						sd.image,
					type: (a as any).sub_type || sd.subType,
					sheetData: normalizeAuraSheetData(a.sheet_data),
					assetCode,
				};
			});

			return { data: results, total, page, limit };
		}

		let query = (supabase as any).from(view).select("*", { count: "exact" });

		// Filter out Keshin Armed (wa*) and Link Transformations (wkt*) from Keshin list to avoid duplicates
		if (view === "inagle_keshins_clean") {
			query = query.not("asset_code", "ilike", "wa%").not("asset_code", "ilike", "wkt%");
		}

		if (params.q) {
			const sq = sanitizeFilter(params.q);
			// Search in both DB columns and sheet_data names (some auras only have names in sheet_data)
			query = query.or(
				`name_fr.ilike.%${sq}%,name_en.ilike.%${sq}%,sheet_data->>name_FR.ilike.%${sq}%,sheet_data->>name_EN.ilike.%${sq}%`
			);
		}
		if (params.element) {
			const elIds = getElementIds(params.element);
			if (elIds.length === 1) query = query.eq("element_id", elIds[0]);
			else if (elIds.length > 1) query = query.in("element_id", elIds);
		}

		// Miximax: prioritize entries with icon (image) first
		if (params.typeSlug === "miximax") {
			query = query.order("icon_code", { ascending: false, nullsFirst: false });
		}
		const { data, count, error } = await query
			.range(from, to)
			.order("name_fr", { nullsFirst: false });

		if (error) {
			console.error("Error fetching auras:", error);
			return { data: [], total: 0, page, limit };
		}

		const results = (data as unknown as DbAura[]).map((a) => {
			const elementInfo =
				ElementNames[a.element_id as keyof typeof ElementNames] || ElementNames[0];
			const sd = (a.sheet_data || {}) as any;
			// asset_code n'est pas présent dans toutes les views (ex: inagle_souls_clean)
			// — fallback vers sheet_data.assetCode
			const assetCode = (a as any).asset_code || sd.assetCode || null;
			return {
				id: a.id, // auraId
				auraId: a.id,
				name: a.name_fr || a.name_en || sd.displayName || sd.name_FR || sd.name_EN || "Inconnu",
				passive: a.description_fr || sd.desc_FR,
				hissatsu_name: sd?.hissatsu?.name || sd?.sheetData?.hissatsu?.name,
				element: elementInfo.en,
				image_url:
					getAuraImageUrl(assetCode, (a as any).sub_type || sd.subType) ||
					getMiximaxIconUrl((a as any).icon_code) ||
					// image_url DB = chemin icône relatif (200_icon/) — priorité sur sd.image (telop)
					resolveAssetUrl(a.image_url) ||
					resolveAuraTelopUrl(assetCode) ||
					sd.image,
				type: (a as any).sub_type || sd.subType,
				sheetData: normalizeAuraSheetData(a.sheet_data),
				assetCode,
			};
		});

		return {
			data: results,
			total: count || 0,
			page,
			limit,
		};
	},

	async getCharacter(id: string): Promise<BaseCharacter | undefined> {
		const supabase = await createClient();
		const { data: row } = await supabase
			.from("inagle_characters")
			.select("*")
			.eq("id", id)
			.maybeSingle();
		const base = this.mapDbCharacterToBase(row);
		if (base) {
			await this._inheritConstellation(base, row);
			if ((row as any)?.rarity_label === "Héros") {
				(base as any).heroConstellations = await this._getHeroConstellations(row);
			}
		}
		return base;
	},

	/** Fetch character by base_slug (name_en + internal_code) — returns best variant as BaseCharacter */
	async getCharacterByBaseSlug(baseSlug: string): Promise<BaseCharacter | undefined> {
		const supabase = await createClient();
		// Fetch all variants sharing this base_slug, ordered by rarity DESC
		const { data: rows } = await supabase
			.from("inagle_characters")
			.select("*")
			.eq("base_slug", baseSlug)
			.order("rarity", { ascending: false });
		if (!rows || rows.length === 0) return undefined;
		// Use the highest-rarity variant as the "main" row for BaseCharacter
		const mainRow = rows[0];
		const base = this.mapDbCharacterToBase(mainRow);
		if (base) {
			await this._inheritConstellation(base, mainRow);
			if (mainRow?.rarity_label === "Héros") {
				(base as any).heroConstellations = await this._getHeroConstellations(mainRow);
			}
		}
		return base;
	},

	async getCharacterBySlug(slug: string): Promise<BaseCharacter | undefined> {
		const supabase = await createClient();
		const { data: row } = await supabase
			.from("inagle_characters")
			.select("*")
			.eq("slug", slug)
			.maybeSingle();
		const base = this.mapDbCharacterToBase(row);
		if (base) {
			await this._inheritConstellation(base, row);
			if ((row as any)?.rarity_label === "Héros") {
				(base as any).heroConstellations = await this._getHeroConstellations(row);
			}
		}
		return base;
	},

	/** Get all distinct forms/variants of a character (same chara_id, different pos/elem/rarity) */
	async getCharacterForms(
		charaId: string,
		sheetId?: string
	): Promise<
		Array<{
			id: string;
			slug: string;
			position: string;
			element: string;
			rarity: string;
			rarityCode: number;
			zukanHash?: string;
			internalCode?: string;
			heroType?: string;
		}>
	> {
		const supabase = await createClient();
		let query = supabase
			.from("inagle_characters")
			.select(
				"id, slug, position, element, rarity_label, rarity, zukan_hash, internal_code, stat_frappe, hero_type"
			);
		if (sheetId) {
			query = query.eq("sheet_data->>sheetId", sheetId);
		} else {
			query = query.eq("chara_id", charaId);
		}
		const { data } = await query
			.order("rarity", { ascending: false })
			.order("position")
			.order("element");
		if (!data) return [];
		// Sort within groups: prefer versions with zukan_hash, then highest stat_frappe
		// This ensures dedup picks the most enriched version as canonical
		const sorted = (data as any[]).sort((a: any, b: any) => {
			// Primary: rarity DESC
			const rDiff = (Number(b.rarity) || 0) - (Number(a.rarity) || 0);
			if (rDiff !== 0) return rDiff;
			// Secondary: has zukan_hash first
			const aHash = a.zukan_hash ? 1 : 0;
			const bHash = b.zukan_hash ? 1 : 0;
			if (bHash !== aHash) return bHash - aHash;
			// Tertiary: highest stat_frappe (proxy for enrichment quality)
			return (Number(b.stat_frappe) || 0) - (Number(a.stat_frappe) || 0);
		});
		// Deduplicate by position+element+rarity+heroType combo (keep first = most enriched)
		const seen = new Set<string>();
		const results: Array<{
			id: string;
			slug: string;
			position: string;
			element: string;
			rarity: string;
			rarityCode: number;
			zukanHash?: string;
			internalCode?: string;
			heroType?: string;
		}> = [];
		for (const r of sorted) {
			const pos = r.position || "MF";
			const elem = r.element || "Void";
			const rar = r.rarity_label || "Normal";
			const heroType = r.hero_type || "";
			const key = `${pos}|${elem}|${rar}|${heroType}`;
			if (seen.has(key)) continue;
			seen.add(key);
			results.push({
				id: r.id,
				slug: r.slug || r.id,
				position: pos,
				element: elem,
				rarity: rar,
				rarityCode: Number(r.rarity) || 1,
				zukanHash: r.zukan_hash || undefined,
				internalCode: r.internal_code || undefined,
				heroType: r.hero_type || undefined,
			});
		}
		return results;
	},

	async getCharactersList(params: ListParams): Promise<ListResult<BaseCharacter>> {
		if (params.position === "COACH" || params.role === "Coordinator" || params.role === "Coach") {
			return this.getCoordinatorsList(params);
		}

		const supabase = await createClient();
		const page = params.page || 1;
		const limit = params.limit || 50;
		const from = (page - 1) * limit;
		const to = from + limit - 1;

		let query = supabase.from("inagle_characters").select("*", { count: "exact" });

		if (params.q) {
			query = query.or(
				`name_fr.ilike.%${sanitizeFilter(params.q)}%,name_en.ilike.%${sanitizeFilter(params.q)}%`
			);
		}
		if (params.element) {
			// Filter by exact text code ("Fire", "Wind"). DB columns are in French.
			const elementMap: Record<string, string> = {
				Fire: "Feu",
				Wind: "Vent",
				Forest: "Forêt",
				Mountain: "Montagne",
			};
			const dbElement = elementMap[params.element] || params.element;
			query = query.eq("element", dbElement);
		}
		if (params.position) {
			// Filter by exact text code ("GK", "FW"). DB columns are in French.
			const positionMap: Record<string, string> = {
				GK: "Gardien",
				DF: "Défenseur",
				MF: "Milieu",
				FW: "Attaquant",
			};
			const dbPosition = positionMap[params.position] || params.position;
			query = query.eq("position", dbPosition);
		}
		if (params.rarity) {
			query = query.eq("rarity_label", params.rarity);
		}
		// Exclude Héros and BASARA unless explicitly requested via rarity filter
		if (params.rarity !== "Héros") {
			query = query.neq("rarity_label", "Héros");
		}
		if (params.rarity !== "BASARA") {
			query = query.neq("rarity_label", "BASARA");
		}
		// Exclude _5000 variant entries (duplicates of normal characters)
		query = query.not("internal_code", "like", "%_5000");
		// Exclude MixiMax forms (c05028*) and fusions (× in name)
		query = query.not("internal_code", "like", "c05028%");
		query = query.not("name_en", "like", "%×%");
		// Exclude animal/NPC entries (an* prefix) and nameless entries
		query = query.not("internal_code", "like", "an%");
		query = query.not("name_en", "is", null);
		query = query.neq("name_en", "");
		if (params.team) {
			// Use parameterized .eq() for team_id and separate JSONB containment
			// (avoid string-interpolating values with quotes into the filter)
			const safeTeam = sanitizeFilter(params.team);
			query = query.or(`team_id.eq.${safeTeam},teams.cs.${JSON.stringify([{ id: safeTeam }])}`);
		}
		if (params.gender) {
			// FilterChips: "1" = male, "2" = female; DB column: "M" / "F"
			const genderMap: Record<string, string> = { "1": "M", "2": "F" };
			const dbGender = genderMap[params.gender];
			if (dbGender) query = query.eq("gender", dbGender);
		}
		if (params.playstyle) {
			// "Freedom" (Orion) = "Breach" (Victory Road) — meme style de jeu
			if (params.playstyle === "Breach") {
				query = query.in("sheet_data->>playstyle", ["Breach", "Freedom"]);
			} else {
				query = query.eq("sheet_data->>playstyle", params.playstyle);
			}
		}
		if (params.status !== "all") {
			query = query.or("sheet_data.not.is.null,is_controllable.eq.true");
		}
		if (params.status === "jouable") {
			query = query.eq("is_controllable", true);
		}
		if (params.series) {
			// Series column is authoritative (from cfg.bin seriesId + zukan game)
			// No prefix-based fallback needed — DB series are correct
			query = query.eq("series", params.series);
		}
		// Default sort: zukan_order ASC (official zukan.inazuma.jp order), fallback internal_code
		const { data, count, error } = await query
			.order("zukan_order", { ascending: true, nullsFirst: false })
			.order("internal_code", { ascending: true, nullsFirst: false })
			.range(from, to);

		if (error) {
			// PGRST103 = offset hors range (page demandée > total pages) → silencieux
			if ((error as { code?: string }).code === "PGRST103") {
				return { data: [], total: 0, page, limit };
			}
			console.error("Error fetching characters:", error);
			return { data: [], total: 0, page, limit };
		}

		// Map to BaseCharacter — chaque variante est une carte distincte (pas de groupement)
		const mapped = (data as any[]).map((char) => this.mapDbCharacterToBase(char)!).filter(Boolean);

		// Regrouper les variantes de rareté d'un même personnage (Normal + Héros = 1 carte)
		const deduped = this.groupVariants(mapped);

		// Note: `count` est le nombre de ROWS post-filtres (≈ nombre de cartes
		// avant groupement). Le ratio de déduplication est ~5-15% (variantes
		// Normal+Expert d'un même perso → 1 carte). L'ancienne formule
		// `count - (mapped.length - deduped.length)` se basait sur le delta de
		// la page courante seulement → sous-estimait de ~80% le vrai total.
		// `count` direct sur-estime légèrement (~10%) mais c'est très proche
		// du vrai nombre de personnages affichés et la pagination est correcte.
		return {
			data: deduped,
			total: count || 0,
			page,
			limit,
		};
	},

	async getCoordinatorPools(): Promise<{ coaches: any[]; managers: any[] }> {
		const supabase = await createClient();
		const { data } = await supabase
			.from("inagle_coordinators")
			.select("*")
			.in("role", ["Coach", "Manager", "Coordinator"]);
		const rows = data || [];
		// DB "Manager" + "Coach" = coachs in-game, DB "Coordinator" = manageuses
		return {
			coaches: rows.filter((r: any) => r.role === "Manager" || r.role === "Coach"),
			managers: rows.filter((r: any) => r.role === "Coordinator"),
		};
	},

	async getCoordinatorsList(params: ListParams): Promise<ListResult<BaseCharacter>> {
		const supabase = await createClient();
		const page = params.page || 1;
		const limit = params.limit || 50;
		const from = (page - 1) * limit;
		const to = from + limit - 1;

		let query = supabase.from("inagle_coordinators").select("*", { count: "exact" });

		if (params.q) {
			const q = sanitizeFilter(params.q);
			query = query.or(`name_localised.ilike.%${q}%,name_romaji.ilike.%${q}%`);
		}

		if (params.role === "Coordinator") {
			query = query.eq("role", "Coordinator");
		} else if (params.role === "Coach") {
			query = query.or("role.eq.Coach,role.eq.Manager");
		}

		// Element filter for Coordinators (stored as Kanji)
		if (params.element) {
			const elementMap: Record<string, string> = {
				Wind: "風",
				Wood: "林", // Assuming Wood/Forest
				Forest: "林",
				Fire: "火",
				Earth: "山", // Assuming Earth/Mountain
				Mountain: "山",
				Void: "無",
			};
			const kanji = elementMap[params.element];
			if (kanji) query = query.eq("element", kanji);
		}

		const { data, count, error } = await query.range(from, to).order("name_localised");

		if (error) {
			console.error("Error fetching coordinators:", error);
			return { data: [], total: 0, page, limit };
		}

		// Zukan hash mapping for coordinators/coaches (matched from zukan.inazuma.jp by name)
		const COORD_ZUKAN: Record<number, string> = {
			1: "k/c/b/cb88nfolkwe",
			2: "k/z/p/zpndk6oxjls",
			3: "k/x/i/xikbkjcdmjs",
			4: "k/t/2/t2vvykaoccs",
			5: "k/n/z/nz2ghxvgpic",
			6: "k/q/u/quvzfkeq5ns",
			7: "k/o/3/o32tnwlthge",
			8: "k/k/h/kh5u-b7dslk",
			9: "k/v/v/vvi1tkdn_4m",
			10: "k/h/f/hf3tipefyhk",
			11: "k/k/5/k5er_or9jem",
			12: "k/o/y/oyxxlfats7e",
			13: "k/6/x/6xd84b32hzk",
			14: "k/b/x/bxrne-6vwfk",
			15: "k/e/u/euxp3_h_s_c",
			16: "k/o/z/ozsfcxwjxve",
			17: "k/u/g/ugqtm_smug0",
			18: "k/d/d/dddirygeelc",
			19: "k/h/c/hcb0r88rb-s",
			20: "k/k/f/kfck9hlg5js",
			21: "k/y/a/yaeyhvxpmwc",
			22: "k/s/y/sy5iwvawaj0",
			23: "k/u/t/ut_eshg5f8e",
			24: "k/n/l/nl_glun8epm",
			25: "k/c/m/cmtsbm0og6u",
			26: "k/t/k/tkcz2zs0rj8",
			27: "k/h/j/hjc80umli2k",
			28: "k/o/m/om1n5jmhidm",
			29: "k/7/8/78eqog2k9du",
			30: "k/y/5/y5zbdtcoxo8",
			31: "k/9/i/9ixx-wa6jqu",
			32: "k/8/w/8wocttgsuu0",
			33: "k/n/y/ny_j-sgwdnc",
			34: "k/p/5/p54_qlu6ghc",
			35: "k/e/-/e-qruphieye",
			36: "k/v/w/vwbkdwhyzbs",
			37: "k/b/8/b8ksybiqu-e",
			38: "k/e/8/e8o-flnjyhm",
			39: "k/1/u/1u_foarz1sk",
			40: "k/v/7/v7cq7herayu",
			41: "k/v/v/vvrzhm1aiie",
			42: "k/k/t/kttlw44rtb8",
			43: "k/s/n/snbzvhuzhmm",
			44: "k/m/i/mi4sg8b7ug8",
			45: "k/u/g/ugcf748fkgm",
			46: "k/9/g/9gjnrd9b51u",
			47: "k/o/p/op_woljxra8",
			48: "k/f/u/futkwhaljtk",
			49: "k/c/f/cft3awvkb0e",
			50: "k/g/-/g-obvenkgrc",
			51: "k/b/w/bwxwy2_pw90",
			52: "k/8/w/8w28mu4bix0",
			53: "k/c/f/cfvj1znj93e",
			54: "k/t/3/t3koymrzqes",
			55: "k/v/w/vwj02v5fvcs",
			56: "k/e/-/e-svbqfl4xe",
			57: "k/-/r/-rxgi3qtnr0",
			58: "k/p/5/p5ablimxgic",
			59: "k/7/t/7t_zufp1hd0",
			60: "k/k/7/k7o456ppquc",
		};

		const results = (data || []).map((c: any) => {
			// Map Kanji element to EN
			const revMap: Record<string, string> = {
				風: "Wind",
				林: "Forest",
				火: "Fire",
				山: "Mountain",
				無: "Void",
			};
			const elEn = revMap[c.element] || "Void";
			const zukanHash = COORD_ZUKAN[c.id] || undefined;
			const imageUrl = zukanHash ? `https://dxi4wb638ujep.cloudfront.net/1/${zukanHash}.png` : null;

			return {
				charaId: `coord_${c.id}`,
				internalCode: `COORD_${c.id}`,
				names: { fr: c.name_localised, en: c.name_localised, ja: c.name_kanji },
				gender: c.gender === "女" ? 1 : 0,
				variants: [
					{
						charaParamId: `coord_${c.id}`,
						position: "COACH",
						positionRaw: 0,
						element: elEn,
						rarity: c.role || "Coach",
						rarityCode: 1,
						stats: { lv99: {} },
						skills: [],
						image: imageUrl,
						zukanHash,
					},
				],
				bestRarity: c.role || "Coach",
				bestRarityCode: 1,
				isBasara: false,
				image: imageUrl,
				descriptions: {
					fr: `Rôle: ${c.role}\nEffet: ${c.stat} +${c.buff}\nCondition: ${c.requirements}`,
				},
				sheetData: {
					passive_no: c.passive_no,
					buff: c.buff,
					stat: c.stat,
					requirements: c.requirements,
				},
				wikiSections: [],
				slug: `coord-${c.id}`,
				series: c.game || "Inazuma Eleven",
				teamId: null,
				teamName: "Coach/Manager",
				zukanHash,
			} as any;
		});

		return {
			data: results,
			total: count || 0,
			page,
			limit,
		};
	},

	async getItem(id: string): Promise<Item | undefined> {
		// ... existing getItem ...
		const supabase = await createClient();
		// Try exact match on ID first (hex), then name if needed
		const { data: row } = await supabase
			.from("inagle_items")
			.select("*")
			.eq("id", id)
			.maybeSingle();

		if (row) {
			const item = row as unknown as DbItem;
			const sd = (item.sheet_data || {}) as any;
			const community = sd.sheetData || {};
			const descFr = item.description_fr || sd.descriptions?.fr || null;
			const descJa = item.description_ja || sd.descriptions?.ja || null;
			return {
				itemId: item.id,
				internalCode: item.internal_code || sd.internalCode,
				names: {
					fr: item.name_fr,
					en: item.name_en,
					ja: item.name_ja || sd.names?.ja,
				},
				descriptions: { fr: descFr, ja: descJa },
				name_FR: item.name_fr,
				description: descFr,
				description_JA: descJa,
				category: item.category,
				rarity: item.rarity,
				image: resolveAssetUrl(item.image_url) || item.image_url,
				imageUrl: resolveAssetUrl(item.image_url) || item.image_url,
				// Shops: top-level column (populated by update-item-prices.ts), fallback to sheet_data
				shops: (row as any).shops || sd.shops || null,
				// Note: top-level 'price' column contains catalog sort IDs (not real GP prices) — do not use
				price: sd.price || null,
				stats: community.stats || null,
				location: community.location || null,
				attributes: sd.attributes || null,
				exchangeRecipes: sd.exchangeRecipes || null,
				sheetData: community,
			} as any;
		}
		return undefined;
	},

	async getItemsList(params: ListParams): Promise<ListResult<Item>> {
		if (params.category === "special_tactics") {
			return this.getTacticsList(params);
		}

		const supabase = await createClient();
		const page = params.page || 1;
		const limit = params.limit || 50;
		const from = (page - 1) * limit;
		const to = from + limit - 1;

		let query = supabase.from("inagle_items").select("*", { count: "exact" });

		if (params.q) {
			query = query.or(
				`name_fr.ilike.%${sanitizeFilter(params.q)}%,name_en.ilike.%${sanitizeFilter(params.q)}%`
			);
		}
		if (params.category) {
			query = query.eq("category", params.category);
		}

		const { data, count, error } = await query.range(from, to).order("id");

		if (error) {
			console.error("Error fetching items:", error);
			return { data: [], total: 0, page, limit };
		}

		const results = (data as unknown as DbItem[]).map((item) => {
			const sd = (item.sheet_data || {}) as any;
			const community = sd.sheetData || {};
			return {
				itemId: item.id,
				internalCode: item.internal_code,
				names: { fr: item.name_fr, en: item.name_en, ja: item.name_ja },
				name_FR: item.name_fr,
				category: item.category,
				rarity: item.rarity,
				image: resolveAssetUrl(item.image_url) || item.image_url,
				// Note: top-level 'price' column contains catalog sort IDs (not real GP prices) — do not use
				price: sd.price || null,
				location: community.location || null,
				stats: community.stats || null,
				shops: (item as any).shops || sd.shops || null,
			} as any;
		});

		return {
			data: results,
			total: count || 0,
			page,
			limit,
		};
	},

	async getOverrideSkillsForSkill(skillId: string): Promise<any[]> {
		const supabase = await createClient();

		// Two cases:
		// A) This skill IS the override result → query by id
		// B) This skill appears in conditions → must scan JSONB (no index), fetch all and filter in JS
		const [{ data: directMatch }, { data: allOverrides }] = await Promise.all([
			supabase.from("inagle_override_skills").select("*").eq("id", skillId),
			supabase.from("inagle_override_skills").select("*"),
		]);

		if (!allOverrides) return directMatch || [];

		// Deduplicate: merge direct match with condition matches
		const seen = new Set<string>();
		const combined = [
			...(directMatch || []),
			...allOverrides.filter((override: any) => {
				if (override.id === skillId) return false; // already in directMatch
				const conditions = override.conditions as any[];
				if (!conditions) return false;
				return conditions.some((c: any) =>
					c.required_skills?.some((rs: any) => rs.skill_id === skillId)
				);
			}),
		].filter((row: any) => {
			if (seen.has(row.id)) return false;
			seen.add(row.id);
			return true;
		});

		return combined.map((row: any) => ({
			id: row.id,
			name_fr: row.name_fr,
			name_en: row.name_en,
			name_ja: row.name_ja,
			element_id: row.element_id,
			category_id: row.category_id,
			power_min: row.power_min,
			power_max: row.power_max,
			conditions: row.conditions,
		}));
	},

	async getRandomTeamPools(playstyles?: string[]): Promise<{
		gk: BaseCharacter[];
		df: BaseCharacter[];
		mf: BaseCharacter[];
		fw: BaseCharacter[];
	}> {
		const supabase = await createClient();
		const fetchPool = async (position: string, limit: number) => {
			let query = supabase
				.from("inagle_characters")
				.select("*")
				.eq("position", position)
				.not("stat_frappe", "is", null)
				.not("zukan_hash", "is", null);
			if (playstyles && playstyles.length > 0) {
				const filter = playstyles.map((p) => `sheet_data->>playstyle.eq.${p}`).join(",");
				query = query.or(filter);
			}
			const { data } = await query.limit(limit);
			return ((data as any[]) || []).map((c: any) => this.mapDbCharacterToBase(c)!).filter(Boolean);
		};
		const [gk, df, mf, fw] = await Promise.all([
			fetchPool("GK", 200),
			fetchPool("DF", 400),
			fetchPool("MF", 400),
			fetchPool("FW", 400),
		]);
		return { gk, df, mf, fw };
	},

	async getSkill(id: string): Promise<Skill | undefined> {
		const supabase = await createClient();
		const safeId = sanitizeFilter(id);

		let row: any = null;

		if (id.startsWith("0x")) {
			const { data } = await supabase
				.from("inagle_skills")
				.select("*")
				.or(`id.eq.${safeId},sheet_data->>skillID.eq.${safeId}`)
				.limit(1)
				.maybeSingle();
			row = data;
		} else {
			const { data } = await supabase
				.from("inagle_skills")
				.select("*")
				.or(`internal_code.eq.${safeId},name_en.eq.${safeId},name_fr.eq.${safeId}`)
				.limit(1)
				.maybeSingle();
			row = data;
		}

		if (row) {
			const h = row as unknown as DbSkill;
			const elementInfo =
				ElementNames[h.element_id as keyof typeof ElementNames] || ElementNames[0];
			const categoryInfo =
				CategoryNames[h.category_id as keyof typeof CategoryNames] || CategoryNames[0];
			const sd = (h.sheet_data || {}) as any;

			return {
				// Spread all inagle fields from sheet_data (foulRate, tags, shops, etc.)
				...sd,
				// Override with DB column values (authoritative)
				skillId: h.id,
				internalCode: h.internal_code,
				names: { en: h.name_en, fr: h.name_fr, ja: h.name_ja },
				descriptions: { fr: h.description_fr, ja: h.description_ja },
				displayName: h.name_fr || h.name_en || "Inconnu",
				name_FR: h.name_fr,
				name_EN: h.name_en,
				name_JA: h.name_ja,
				desc_FR: h.description_fr || sd.desc_FR,
				desc_EN: sd.desc_EN,
				power_min: h.power_min,
				power_max: h.power_max,
				consumeTp: h.tension_cost,
				elementName: elementInfo,
				categoryName: categoryInfo,
				image: resolveAssetUrl(h.image_url) || h.image_url,
				videoUrl: h.video_url || null,
				// Community sheet data (from match-skills enrichment or nested sheetData)
				sheetData:
					sd.sheetData ||
					({
						matchedName: sd.matchedName,
						shop: sd.shop,
						type: sd.type,
						subType: sd.subType,
						power: sd.power,
						tension: sd.tension,
						duration: sd.duration,
					} as any),
			} as any;
		}
		return undefined;
	},

	async getSkillsList(params: ListParams): Promise<ListResult<Skill>> {
		const supabase = await createClient();
		const page = params.page || 1;
		const limit = params.limit || 50;
		const from = (page - 1) * limit;
		const to = from + limit - 1;

		// Only real hissatsu skills (wh*/rh*), exclude _or element variants
		let query = supabase
			.from("inagle_skills")
			.select("*", { count: "exact" })
			.or("internal_code.like.wh%,internal_code.like.rh%")
			.not("id", "like", "%_or");

		if (params.q) {
			query = query.or(
				`name_fr.ilike.%${sanitizeFilter(params.q)}%,name_en.ilike.%${sanitizeFilter(params.q)}%`
			);
		}
		if (params.element) {
			const elIds = getElementIds(params.element);
			if (elIds.length === 1) query = query.eq("element_id", elIds[0]);
			else if (elIds.length > 1) query = query.in("element_id", elIds);
		}
		if (params.category) {
			const catId = getCategoryId(params.category);
			if (catId !== undefined) query = query.eq("category_id", catId);
		}
		if (params.has_video) {
			query = query.not("video_url", "is", null);
		}
		if (params.power_min) {
			query = query.gte("power_max", parseInt(params.power_min, 10));
		}
		if (params.power_max) {
			query = query.lte("power_max", parseInt(params.power_max, 10));
		}
		if (!params.show_aura) {
			query = query.eq("is_hyper", false);
		}

		// Overdrive filter: only show required skills for overdrive combinations
		// inagle_override_skills uses hex IDs; inagle_skills stores the hex ID in sheet_data->>'skillID'
		if (params.overdrive) {
			const { data: overrides } = await supabase
				.from("inagle_override_skills")
				.select("conditions");
			const hexIds = new Set<string>();
			for (const o of overrides || []) {
				for (const c of (o.conditions as any[]) || []) {
					for (const rs of c.required_skills || []) {
						if (rs.skill_id) hexIds.add(rs.skill_id);
					}
				}
			}
			if (hexIds.size > 0) {
				query = query.in("sheet_data->>skillID", Array.from(hexIds));
			} else {
				query = query.eq("id", "__no_match__");
			}
		}

		// Sorting: explicit user sort takes priority; default = videos first then tension desc
		if (params.sort === "power") {
			query = query.order("power_max", { ascending: false, nullsFirst: false });
		} else if (params.sort === "tension_asc") {
			query = query.order("tension_cost", {
				ascending: true,
				nullsFirst: false,
			});
		} else {
			// Default: videos first, then highest tension
			query = query
				.order("video_url", { ascending: true, nullsFirst: false })
				.order("tension_cost", { ascending: false, nullsFirst: false });
		}

		const { data, count, error } = await query.range(from, to);

		if (error) {
			console.error("Error fetching skills:", error);
			return { data: [], total: 0, page, limit };
		}

		const results = (data as unknown as DbSkill[]).map((h) => {
			const elementInfo =
				ElementNames[h.element_id as keyof typeof ElementNames] || ElementNames[0];
			const categoryInfo =
				CategoryNames[h.category_id as keyof typeof CategoryNames] || CategoryNames[0];

			return {
				skillId: h.id,
				skillID: h.id,
				skillIDStr: h.internal_code || h.id,
				internalCode: h.internal_code,
				category: h.category_id,
				names: { en: h.name_en, fr: h.name_fr, ja: h.name_ja },
				displayName: h.name_fr || h.name_en || "Inconnu",
				name_FR: h.name_fr,
				power_min: h.power_min,
				power_max: h.power_max,
				consumeTp: h.tension_cost,
				elementName: elementInfo,
				categoryName: categoryInfo,
				image: resolveAssetUrl(h.image_url) || h.image_url,
				videoUrl: h.video_url || null,
				posterUrl: h.poster_url || null,
				shop: (() => {
					const s = (h.sheet_data as any)?.shop;
					return s ? SHOP_FR[s] || s : null;
				})(),
				sheetData: h.sheet_data,
			} as any;
		});

		return {
			data: results,
			total: count || 0,
			page,
			limit,
		};
	},

	async getTactic(slug: string): Promise<any | null> {
		const supabase = await createClient();
		// Fast path: query by internal_code directly (avoids full table scan)
		const safeSlug = sanitizeFilter(slug);
		const { data: direct } = await supabase
			.from("inagle_tactics")
			.select("*")
			.eq("internal_code", safeSlug)
			.maybeSingle();
		if (direct) {
			const match = direct;
			return {
				slug: tacticSlug(match.name),
				name: match.name,
				name_fr: match.name_fr || TACTIC_FR[match.name] || match.name,
				name_ja: match.name_ja,
				description_fr: match.description_fr,
				description_en: match.description_en,
				description_ja: match.description_ja,
				effect1: match.effect1,
				effect2: match.effect2,
				effect3: match.effect3,
				duration: match.duration,
				cooldown: match.cooldown,
				shop: match.shop,
				image: resolveAssetUrl((match as any).image_url) || null,
				imageUrl: resolveAssetUrl((match as any).image_url) || null,
			};
		}
		// Fallback: slug is derived from name — must fetch all to compute slug match
		const { data, error } = await supabase.from("inagle_tactics").select("*");
		if (error || !data) return null;
		const match = (data as any[]).find((t: any) => tacticSlug(t.name) === slug);
		if (!match) return null;
		return {
			slug: tacticSlug(match.name),
			name: match.name,
			name_fr: match.name_fr || TACTIC_FR[match.name] || match.name,
			name_ja: match.name_ja,
			description_fr: match.description_fr,
			description_en: match.description_en,
			description_ja: match.description_ja,
			effect1: match.effect1,
			effect2: match.effect2,
			effect3: match.effect3,
			duration: match.duration,
			cooldown: match.cooldown,
			shop: match.shop,
			image: resolveAssetUrl(match.image_url) || null,
			imageUrl: resolveAssetUrl(match.image_url) || null,
		};
	},

	async getTacticsList(params: ListParams): Promise<ListResult<Item>> {
		const supabase = await createClient();
		const page = params.page || 1;
		const limit = params.limit || 50;
		const from = (page - 1) * limit;
		const to = from + limit - 1;

		let query = supabase.from("inagle_tactics").select("*", { count: "exact" });

		if (params.q) {
			const q = sanitizeFilter(params.q);
			query = query.or(`name.ilike.%${q}%,name_fr.ilike.%${q}%`);
		}

		const { data, count, error } = await query.range(from, to).order("name");

		if (error) {
			console.error("Error fetching tactics:", error);
			return { data: [], total: 0, page, limit };
		}

		const results = (data || []).map(
			(t: any) =>
				({
					itemId: t.internal_code || tacticSlug(t.name),
					internalCode: t.internal_code || "TACTIC",
					names: {
						en: t.name,
						fr: t.name_fr || TACTIC_FR[t.name] || t.name,
						ja: t.name_ja || t.name,
					},
					name_FR: t.name_fr || TACTIC_FR[t.name] || t.name,
					description: t.description_fr,
					description_JA: t.description_ja,
					category: "special_tactics",
					rarity: 3,
					image: resolveAssetUrl(t.image_url) || null,
					price: null,
					location: t.shop,
					stats: {
						effect1: t.effect1,
						effect2: t.effect2,
						effect3: t.effect3,
						duration: t.duration,
						cooldown: t.cooldown,
					},
					shops: t.shop ? [t.shop] : [],
				}) as any
		);

		return {
			data: results,
			total: count || 0,
			page,
			limit,
		};
	},

	async getTeam(_id: string): Promise<Team | undefined> {
		return undefined;
	},

	/** Merge BaseCharacters with same charaId into one entry with multiple variants */
	groupVariants(characters: BaseCharacter[]): BaseCharacter[] {
		const grouped = new Map<string, BaseCharacter>();
		for (const char of characters) {
			const key = char.charaId;
			const existing = grouped.get(key);
			if (existing) {
				existing.variants.push(...char.variants);

				const existingHasSheet = !!existing.sheetData;
				const newHasSheet = !!char.sheetData;

				const charBestRarityCode = char.bestRarityCode;
				const existingBestRarityCode = existing.bestRarityCode;

				if (
					(newHasSheet && !existingHasSheet) ||
					(newHasSheet === existingHasSheet && charBestRarityCode > existingBestRarityCode)
				) {
					existing.bestRarity = char.bestRarity;
					existing.bestRarityCode = char.bestRarityCode;
					existing.image = char.image || existing.image;
					existing.slug = char.slug || existing.slug;
					existing.zukanHash = char.zukanHash || existing.zukanHash;
					existing.sheetData = char.sheetData;
					if (char.wikiSections && char.wikiSections.length > 0) {
						existing.wikiSections = char.wikiSections;
					}
					(existing as unknown as Record<string, unknown>).baseSlug =
						(char as unknown as Record<string, unknown>).baseSlug ||
						(existing as unknown as Record<string, unknown>).baseSlug;
				} else {
					existing.sheetData = existing.sheetData || char.sheetData;
					existing.zukanHash = existing.zukanHash || char.zukanHash;
					(existing as unknown as Record<string, unknown>).baseSlug =
						(existing as unknown as Record<string, unknown>).baseSlug ||
						(char as unknown as Record<string, unknown>).baseSlug;
					if (
						(!existing.wikiSections || existing.wikiSections.length === 0) &&
						char.wikiSections &&
						char.wikiSections.length > 0
					) {
						existing.wikiSections = char.wikiSections;
					}
				}

				existing.isBasara = existing.isBasara || char.isBasara;
				existing.constellation = existing.constellation || char.constellation;
			} else {
				grouped.set(key, char);
			}
		}

		// Deduplicate variants inside each character to avoid duplicates in variants list and clean nulls
		for (const char of grouped.values()) {
			const seenVariants = new Set<string>();
			const dedupedVariants: typeof char.variants = [];
			for (const v of char.variants) {
				const vKey = `${v.position}|${v.element}|${v.rarity}`;
				if (!seenVariants.has(vKey)) {
					seenVariants.add(vKey);
					dedupedVariants.push(v);
				} else {
					const idx = dedupedVariants.findIndex(
						(x) => `${x.position}|${x.element}|${x.rarity}` === vKey
					);
					if (
						idx !== -1 &&
						!(dedupedVariants[idx] as unknown as { sheetData?: unknown }).sheetData &&
						(v as unknown as { sheetData?: unknown }).sheetData
					) {
						dedupedVariants[idx] = v;
					}
				}
			}
			char.variants = dedupedVariants;
		}

		return Array.from(grouped.values());
	},

	mapDbCharacterToBase(row: any): BaseCharacter | undefined {
		if (!row) return undefined;
		const char = row;

		// Stats: use individual columns (stat_frappe etc.), fallback to stats JSONB
		const jsonStats = (char.stats as any)?.lv99 || {};
		const statsLv99 = {
			kick: char.stat_frappe || jsonStats.kick || 0,
			control: char.stat_controle || jsonStats.control || 0,
			technique: char.stat_technique || jsonStats.technique || 0,
			pressure: char.stat_pression || jsonStats.pressure || 0,
			physical: char.stat_physique || jsonStats.physical || 0,
			agility: char.stat_agilite || jsonStats.agility || 0,
			intelligence: char.stat_intelligence || jsonStats.intelligence || 0,
		};

		// Skills: fix reversed mapping (learnLevel=hex skillId, skillId=learnLevel)
		const rawSkills = Array.isArray(char.skills) ? char.skills : [];
		const skills = rawSkills.map((s: any) => {
			const learnLevelRaw = s.learnLevel;
			const skillIdRaw = s.skillId;
			// Detect reversed mapping: if skillId is a small number (< 100 decimal from hex)
			// and learnLevel is a large number, they're swapped
			const skillIdNum = typeof skillIdRaw === "string" ? parseInt(skillIdRaw, 16) : skillIdRaw;
			const learnNum =
				typeof learnLevelRaw === "number" ? learnLevelRaw : parseInt(learnLevelRaw, 10);
			if (skillIdNum < 1000 && Math.abs(learnNum) > 1000000) {
				// Swapped: learnLevel is actually the skill hash, skillId is the learn level
				const hexSkillId = `0x${(learnNum >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
				return { skillId: hexSkillId, learnLevel: skillIdNum };
			}
			return s;
		});

		// Resolve image URL
		const imageUrl = char.image_url ? resolveAssetUrl(char.image_url) : null;

		// Rarity: use rarity_label (authoritative) to derive numeric code
		const rarityLabelMap: Record<string, number> = {
			Normal: 0,
			"En progression": 1,
			Expérimenté: 2,
			Émérite: 3,
			Légendaire: 5,
			Héros: 10,
			BASARA: 20,
		};
		const rarityCode = rarityLabelMap[char.rarity_label] ?? 0;
		const zukanHash = char.zukan_hash || undefined;

		// For Héros with unique codes, use base character code for face icon fallback
		const originalCode = char.internal_code || char.id;
		const isHero = char.rarity_label === "Héros";
		const faceCode = isHero ? HERO_BASE_CODES[originalCode] || originalCode : originalCode;

		// Stats lv1: from lv1 columns or stats JSONB
		const jsonStatsLv1 = (char.stats as any)?.lv1 || {};
		const hasLv1 = char.stat_lv1_frappe || jsonStatsLv1.kick;
		const statsLv1 = hasLv1
			? {
					kick: char.stat_lv1_frappe || jsonStatsLv1.kick || 0,
					control: char.stat_lv1_controle || jsonStatsLv1.control || 0,
					technique: char.stat_lv1_technique || jsonStatsLv1.technique || 0,
					pressure: char.stat_lv1_pression || jsonStatsLv1.pressure || 0,
					physical: char.stat_lv1_physique || jsonStatsLv1.physical || 0,
					agility: char.stat_lv1_agilite || jsonStatsLv1.agility || 0,
					intelligence: char.stat_lv1_intelligence || jsonStatsLv1.intelligence || 0,
				}
			: undefined;

		const variant = {
			charaParamId: char.id,
			position: char.position || "MF",
			subPosition: undefined as string | undefined,
			positionRaw: 0,
			element: char.element || "Void",
			elementRaw: 0,
			rarity: char.rarity_label || "Normal",
			rarityCode,
			stats: { lv99: statsLv99, lv1: statsLv1 },
			skills: skills,
			image: imageUrl,
			sheetData: char.sheet_data,
			slug: char.slug,
			zukanHash,
		};

		const isBasara = char.rarity_label === "BASARA";

		const base: BaseCharacter = {
			charaId: char.chara_id || char.internal_code || char.id,
			internalCode: faceCode,
			names: { fr: char.name_fr, en: char.name_en, ja: char.name_ja },
			gender: char.gender === "F" ? 1 : 0,
			variants: [variant as any],
			bestRarity: char.rarity_label || "Normal",
			bestRarityCode: rarityCode,
			isBasara,
			image: imageUrl,
			descriptions: {
				fr: char.description_fr,
				en: char.description_en,
				ja: char.description_ja,
			},
			sheetData: char.sheet_data,
			wikiSections: (char as any).wiki_sections || [],
			slug: char.slug,
			baseSlug: char.base_slug,
			series: char.series || undefined,
			teamId: char.team_id,
			teamName: char.teams?.[0]?.names?.fr || char.teams?.[0]?.names?.en || "",
			zukanHash,
			gameAppearances: char.game_appearances || undefined,
			controlType: char.control_type || undefined,
			isControllable: char.is_controllable || undefined,
			constellation: char.constellation
				? {
						index: char.constellation_index ?? 0,
						names: { fr: char.constellation },
					}
				: undefined,
		} as any;

		return base;
	},
};
