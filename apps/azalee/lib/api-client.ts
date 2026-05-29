import type {
	BaseCharacter,
	CharacterVariant,
	MultiLevelStats,
	Skill,
} from "@rose-griffon/inagle";
import type {
	InagleCharacter,
	InagleDrop,
	InagleHissatsu,
	InagleItem,
	InagleKizunaItem,
	InagleTactic,
} from "@rose-griffon/inagle/types/database";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { resolveAssetUrl, resolveAuraTelopUrl } from "@/lib/images";

// Lazy getter for Supabase to prevent top-level execution during build
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
	if (_supabase) {return _supabase;}

	const url =
		typeof window === "undefined" &&
		process.env.SUPABASE_INTERNAL_URL &&
		process.env.SUPABASE_INTERNAL_URL.startsWith("http")
			? process.env.SUPABASE_INTERNAL_URL
			: (process.env.NEXT_PUBLIC_SUPABASE_URL &&
					process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("http")
				? process.env.NEXT_PUBLIC_SUPABASE_URL
				: "https://isbkaeltubqittywibeh.supabase.co");

	const key =
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
		!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.startsWith("{")
			? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
			: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYmthZWx0dWJxaXR0eXdpYmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNjk0MzAsImV4cCI6MjA2MTY0NTQzMH0.N4l07k3V_X5I8iW0n_D6K9-O4v5l7l6s6MYGpJIXRW_rB8zc45k7chqi8Ljl_CLiLc=";

	_supabase = createClient(url, key);
	return _supabase;
}

const CACHE_TTL = 3600 * 24;

// --- Mappers for Compatibility ---

function mapToBaseCharacter(row: any): BaseCharacter {
	// Cast to any because the generated types might be outdated
	const char = row;

	// Stats: prioritize individual columns, fallback to stats JSONB
	const jsonStats = (char.stats as any)?.lv99 || {};
	const stats: MultiLevelStats = {
		lv99: {
			agility: char.stat_agilite || jsonStats.agility || 0,
			control: char.stat_controle || jsonStats.control || 0,
			intelligence: char.stat_intelligence || jsonStats.intelligence || 0,
			kick: char.stat_frappe || jsonStats.kick || 0,
			physical: char.stat_physique || jsonStats.physical || 0,
			pressure: char.stat_pression || jsonStats.pressure || 0,
			technique: char.stat_technique || jsonStats.technique || 0,
		},
	};

	// Extract zukan hash
	let zukanHash = char.zukan_hash;
	if (!zukanHash && char.image_url) {
		const match = char.image_url.match(/\/([^/]+)\.png$/);
		if (match) {
			zukanHash = match[1];
		}
	}

	const skills = Array.isArray(char.skills) ? char.skills : [];

	const variant: CharacterVariant = {
		charaParamId: char.id,
		element: char.element || "Void",
		elementRaw: 0,
		growthPattern: 0,
		position: char.position || "MF",
		positionRaw: 0,
		rarity: char.rarity_label || "Normal",
		rarityCode: char.rarity || 1,
		skills: skills,
		stats,
		zukanHash,
	};

	return {
		bestRarity: char.rarity_label || "Normal",
		bestRarityCode: char.rarity || 1,
		charaId: char.internal_code || char.id,
		gender: char.gender === "F" ? 1 : 0,
		internalCode: char.internal_code || char.id,
		isBasara: false, // simplified, real logic in data
		names: {
			en: char.name_en || undefined,
			fr: char.name_fr || undefined,
			ja: char.name_ja || undefined,
		},
		slug: char.slug || undefined,
		teamId: char.team_id,
		teamName: undefined, // could be fetched if needed
		variants: [variant],
		zukanHash: zukanHash,
	};
}

// --- Generic Fetcher ---
async function fetchTable<T>(table: string): Promise<T[]> {
	const { data, error } = await getSupabase().from(table).select("*");
	if (error) {return [];}
	return (data || []) as T[];
}

// --- API Methods ---

const getRawCharacters = unstable_cache(
	async (): Promise<InagleCharacter[]> => {
		let allData: InagleCharacter[] = [];
		let from = 0;
		const batchSize = 1000;
		let finished = false;

		while (!finished) {
			const { data, error } = await getSupabase()
				.from("inagle_characters")
				.select("*")
				.range(from, from + batchSize - 1);
			if (error || !data || data.length === 0) {
				finished = true;
			} else {
				allData = allData.concat(data as InagleCharacter[]);
				if (data.length < batchSize) {finished = true;}
				else {from += batchSize;}
			}
		}
		return allData;
	},
	["all-raw-characters"],
	{ revalidate: CACHE_TTL, tags: ["characters"] },
);

const getCharacters = async (): Promise<BaseCharacter[]> => {
	const raw = await getRawCharacters();
	return raw.map(mapToBaseCharacter);
};

const getItems = unstable_cache(
	async (): Promise<InagleItem[]> => fetchTable<InagleItem>("inagle_items"),
	["all-items"],
	{ revalidate: CACHE_TTL, tags: ["items"] },
);

// Map raw aura DB row → EnrichedAuraSkill format
const ELEMENT_NAMES: Record<number, { en: string; ja: string; fr: string }> = {
	0: { en: "Void", fr: "Néant", ja: "なし" },
	1: { en: "Wind", fr: "Vent", ja: "風" },
	2: { en: "Forest", fr: "Forêt", ja: "林" },
	3: { en: "Fire", fr: "Feu", ja: "火" },
	4: { en: "Mountain", fr: "Montagne", ja: "山" },
};

function mapAuraRow(row: any): any {
	const elementInfo =
		ELEMENT_NAMES[row.element_id as number] || ELEMENT_NAMES[0];
	const sd = row.sheet_data || {};
	return {
		_file: "inagle_auras",
		_source: "supabase",
		assetCode: row.asset_code || sd.assetCode,
		auraId: row.id,
		auraIdStr: row.id,
		desc_FR: row.description_fr || sd.desc_FR,
		desc_JA: row.description_ja || sd.desc_JA,
		displayName:
			row.name_fr ||
			row.name_en ||
			sd.displayName ||
			sd.name_FR ||
			sd.name_EN ||
			"Inconnu",
		element: row.element_id,
		elementName: elementInfo,
		image:
			resolveAuraTelopUrl(row.asset_code) ||
			resolveAssetUrl(row.image_url) ||
			sd.image ||
			row.image_url,
		name_EN: row.name_en || sd.name_EN,
		name_FR: row.name_fr || sd.name_FR,
		name_JA: row.name_ja || sd.name_JA,
		sheetData: normalizeAuraSheetData(row.sheet_data),
		subType: row.sub_type || sd.subType || "Aura",
	};
}

/**
 * Normalise le sheetData des auras pour unifier deux formats :
 * - Format direct : { passiveEffect, hissatsu, buff, matchedName } (89 keshins)
 * - Format imbriqué : { _file, ..., sheetData: { passiveEffect, hissatsu, ... } } (89 keshins)
 * Fusionne le nested sheetData au top-level pour que AuraDetail puisse lire uniformément.
 */
function normalizeAuraSheetData(sd: any): any {
	if (!sd) {return null;}
	const nested = sd.sheetData;
	if (!nested || nested === "null") {return sd;}
	// Merge: nested community data takes priority, then top-level
	return {
		...sd,
		buff: sd.buff || nested.buff,
		hissatsu: sd.hissatsu || nested.hissatsu,
		matchedName: sd.matchedName || nested.matchedName,
		passiveEffect: sd.passiveEffect || nested.passiveEffect,
	};
}

// Use clean deduplicated views (no bare hex duplicates, no unknown entries)
const AURA_TABLES = [
	"inagle_keshins_clean",
	"inagle_souls_clean",
	"inagle_miximax_clean",
	"inagle_awakenings_clean",
	"inagle_mode_changes_clean",
	"inagle_auras",
];

const getAuras = unstable_cache(
	async (): Promise<any[]> => {
		const results = await Promise.all(
			AURA_TABLES.map((t) => fetchTable<any>(t)),
		);
		const allRows = results.flat();

		// Collect skill_ids to fetch video URLs in one batch
		const skillIds = [
			...new Set(allRows.map((r) => r.skill_id).filter(Boolean)),
		] as string[];
		const skillVideoMap = new Map<
			string,
			{ video_url: string | null; internal_code: string | null }
		>();
		if (skillIds.length > 0) {
			const { data: skills } = (await getSupabase()
				.from("inagle_skills")
				.select("id, video_url, internal_code")
				.in("id", skillIds)) as {
				data: Array<{
					id: string;
					video_url: string | null;
					internal_code: string | null;
				}> | null;
			};
			if (skills) {
				for (const s of skills) {
					skillVideoMap.set(s.id, {
						internal_code: s.internal_code,
						video_url: s.video_url,
					});
				}
			}
		}

		return allRows.map((row) => {
			const mapped = mapAuraRow(row);
			if (row.skill_id) {
				const skillInfo = skillVideoMap.get(row.skill_id);
				mapped.skillId = row.skill_id;
				mapped.skillVideoUrl = skillInfo?.video_url || null;
				mapped.skillInternalCode = skillInfo?.internal_code || null;
			}
			return mapped;
		});
	},
	["all-auras"],
	{ revalidate: CACHE_TTL, tags: ["auras"] },
);

const getHissatsu = unstable_cache(
	async (): Promise<InagleHissatsu[]> => fetchTable<InagleHissatsu>("inagle_hissatsu"),
	["all-hissatsu"],
	{ revalidate: CACHE_TTL, tags: ["hissatsu"] },
);

const getSkills = async (): Promise<Skill[]> => {
	const hissatsu = await getHissatsu();
	return hissatsu.map(
		(h) =>
			({
				categoryName: { en: h.type || undefined, fr: h.type || undefined },
				displayName: h.name || "Inconnu",
				element: 0,
				elementName: { en: h.element || undefined, fr: h.element || undefined },
				name_EN: h.name || "Inconnu",
				name_FR: h.name || "Inconnu",
				name_JA: h.name_jp || undefined,
				names: {
					en: h.name || undefined,
					fr: h.name || undefined,
					ja: h.name_jp || undefined,
				},
				power: h.power,
				skillId: h.id?.toString() || "0",
				tpCost: h.tension,
				type: 1,
			}) as any,
	);
};

// Map raw inagle_passives rows → EnrichedPassiveSkill format
function mapPassiveRow(row: any): any {
	// The `data` jsonb column contains the full enriched object
	if (row.data?.passiveId) {
		return {
			...row.data,
			// Ensure rarity from effect_value if not in data
			rarity:
				row.data.rarity ?? (row.effect_value ? Number(row.effect_value) : 0),
		};
	}
	// Fallback: map flat columns
	const scopeMap: Record<string, string> = {
		Adversaire: "enemy",
		Inconnu: "unknown",
		Joueur: "player",
		enemy: "enemy",
		player: "player",
		team: "team",
		unknown: "unknown",
		Équipe: "team",
	};
	const boostTypeMap: Record<string, string> = {
		Affrontement: "confrontation",
		Arrêt: "catch",
		Attaque: "attack",
		Brèche: "breach",
		Dribble: "dribble",
		Défense: "defense",
		Inconnu: "unknown",
		Mixte: "mixed",
		Récupération: "recovery",
		Spécial: "special",
		Tension: "tension",
		Tir: "shoot",
		Vitesse: "speed",
		attack: "attack",
		block: "block",
		breach: "breach",
		catch: "catch",
		confrontation: "confrontation",
		defense: "defense",
		dribble: "dribble",
		mixed: "mixed",
		recovery: "recovery",
		shoot: "shoot",
		special: "special",
		speed: "speed",
		tension: "tension",
		unknown: "unknown",
	};
	const scope = scopeMap[row.category] || "unknown";
	const boostType = boostTypeMap[row.boost_type] || "unknown";
	return {
		_file: "inagle_passives",
		_source: "supabase",
		boostType,
		boostTypeName: {
			en: boostType.charAt(0).toUpperCase() + boostType.slice(1),
			fr: row.boost_type || "Inconnu",
		},
		desc_FR: row.description_fr,
		displayName: row.name_fr || "Inconnu",
		effectValue: row.effect_value ? Number(row.effect_value) : undefined,
		name_FR: row.name_fr,
		name_JA: row.name_ja,
		passiveId: row.id,
		rarity: row.effect_value ? Number(row.effect_value) : 0,
		scope,
		scopeName: {
			en: scope.charAt(0).toUpperCase() + scope.slice(1),
			fr: row.category || "Inconnu",
		},
	};
}

export const apiClient = {
	inagle: {
		getCharacters,
		getAllCharacters: getCharacters,
		getRawCharacters,
		getItems,
		getAuras,
		getSkills,
		getTeams: () => fetchTable<any>("inagle_teams"),
		getFormations: () => fetchTable<any>("inagle_formations"),
		getPassives: async () => {
			const rows = await fetchTable<any>("inagle_passives");
			return rows.map(mapPassiveRow);
		},
		getTactics: () => fetchTable<InagleTactic>("inagle_tactics"),
		getDrops: () => fetchTable<InagleDrop>("inagle_drops"),
		getKizunaItems: () => fetchTable<InagleKizunaItem>("inagle_kizuna_items"),

		// Search
		search: async (query: string, limit: number = 20) => {
			const chars = await getCharacters();
			const q = query.toLowerCase();
			return chars
				.filter(
					(c) =>
						c.names.fr?.toLowerCase().includes(q) ||
						c.names.ja?.toLowerCase().includes(q),
				)
				.slice(0, limit);
		},
		searchGlobal: async (query: string, limit: number = 20) => {
			const chars = await getCharacters();
			const items = await getItems();
			const q = query.toLowerCase();
			const charResults = chars
				.filter((c) => c.names.fr?.toLowerCase().includes(q))
				.slice(0, limit)
				.map((c) => ({
					id: c.charaId,
					image: undefined,
					name: c.names.fr,
					slug: c.slug,
					type: "character",
				}));
			const itemResults = items
				.filter((i) => i.name.toLowerCase().includes(q))
				.slice(0, limit)
				.map((i) => ({
					id: i.name,
					image: undefined,
					name: i.name,
					type: "item",
				}));
			return [...charResults, ...itemResults].slice(0, limit);
		},
	},
	shop: {
		getProducts: () => fetchTable<any>("merch_products"),
	},
};
