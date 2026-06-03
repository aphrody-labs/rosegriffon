import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_ROOT } from "../core/paths.js";

interface ConfigVariable {
	type: string;
	value: string;
}

interface ConfigNode {
	name: string;
	variables: ConfigVariable[];
	children?: ConfigNode[];
}

interface AuraConfigData {
	entries: ConfigNode[];
}

/**
 * Hyper Technique Types (7 types total):
 * 1. Keshin (Fighting Spirit) - wko*, wkk*, wkd*, wkt*
 * 2. Keshin Armed - (subset of Keshin with armed prefix)
 * 3. Miximax - (transformation)
 * 4. Soul/Totem - wks*
 * 5. Link Transform - link_*
 * 6. Awakening - awakening_*
 * 7. Mode Change - mode_change_*
 */
export type AuraSubType = "Keshin" | "Soul" | "Awakening" | "ModeChange" | "Miximax" | "Aura";

// Matches api.ts AuraSkill interface
export interface AuraSkill {
	auraId: string;
	auraIdStr: string;
	element: number;
	name_FR?: string;
	name_EN?: string;
	name_JA?: string;
	desc_FR?: string;
	desc_JA?: string;
	image?: string;
	subType?: AuraSubType;
	assetCode?: string;
	/** Owner character param ID (from change_aura_skill_config) */
	ownerCharaParamId?: string;
	/** Raw config values extracted from aura_skill_config */
	config?: {
		/** vars[4] : durée ou valeur de buff 1 */
		val4?: number;
		/** vars[5] : durée ou valeur de buff 2 */
		val5?: number;
		/** vars[6] : hash de skill lié (super technique 1) */
		skillId1?: string;
		/** vars[7] : hash de skill lié (super technique 2) */
		skillId2?: string;
		/** vars[9] : valeur inconnue (constant ~8) */
		val9?: number;
		/** vars[11] : valeur inconnue (0 ou 1) */
		val11?: number;
		/** vars[12] : hash de buff passif */
		buffId?: string;
		/** vars[16] : index/rang */
		rank?: number;
	};
	_source: string;
	_file: string;
}

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf-8"));
}

/**
 * Convert signed 32-bit int to hex string (uppercase, 8 chars padded)
 */
function toHex(value: number): string {
	if (value < 0) {
		return `0x${(value >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
	}
	return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
}

/**
 * Determine subType from asset code and text heuristics
 * ...
 */
function determineSubType(assetCode: string, nameFR?: string, descFR?: string): AuraSubType {
	// ... implementation unchanged ...
	const assetLower = (assetCode || "").toLowerCase();
	const nameLower = (nameFR || "").toLowerCase();
	const descLower = (descFR || "").toLowerCase();

	// 1. STRICT ASSET CODE IDENTIFICATION (Priority 1)
	// These are engine-level markers and are 100% reliable.
	if (assetLower.startsWith("wks")) {
		// Refinement: Some Keshins use wks code (e.g. Arthur wks00240).
		// Real Souls almost always have "Totem" or "Soul" in their name.
		if (nameLower.includes("totem") || nameLower.includes("soul")) {
			return "Soul";
		}
		// If it lacks "Totem"/"Soul", treat as Keshin (fallback)
		return "Keshin";
	}
	if (assetLower.startsWith("awakening")) return "Awakening";
	if (assetLower.startsWith("mode_change")) return "ModeChange";

	// Miximax detection
	if (assetLower.startsWith("wm") || assetLower.includes("mixi")) return "Miximax";

	if (
		assetLower.startsWith("wko") ||
		assetLower.startsWith("wkk") ||
		assetLower.startsWith("wkd") ||
		assetLower.startsWith("wkt") ||
		assetLower.startsWith("was") // Keshin Assets
	) {
		return "Keshin";
	}

	// 2. EXPLICIT CATEGORY MARKERS (Priority 2)
	// Handle cases where asset code might be generic but name is explicit
	if (nameLower.startsWith("totem") || nameLower.startsWith("soul")) {
		return "Soul";
	}
	if (nameLower.startsWith("éveil") || nameLower.startsWith("awakening")) {
		return "Awakening";
	}
	if (nameLower.startsWith("mode")) {
		return "ModeChange";
	}
	if (nameLower.includes("miximax") || descLower.includes("miximax")) {
		return "Miximax";
	}

	// 3. TEXT-BASED HEURISTICS (Priority 3)
	// Only use these if the above failed
	if (
		nameLower.includes("esprit") ||
		nameLower.includes("keshin") ||
		descLower.includes("keshin") ||
		descLower.includes("porte un keshin")
	) {
		return "Keshin";
	}

	// 4. DEFAULT
	return "Aura";
}

/**
 * Get French label for subType
 */
export function getSubTypeLabel(subType: AuraSubType): string {
	// ... implementation unchanged ...
	switch (subType) {
		case "Keshin":
			return "Esprit Guerrier";
		case "Soul":
			return "Totem";
		case "Awakening":
			return "Éveil";
		case "ModeChange":
			return "Mode";
		case "Miximax":
			return "Miximax";
		default:
			return "Aura";
	}
}

/**
 * Get element ID from variable at position 8 (0-indexed)
 ...
 */
function getElement(variables: ConfigVariable[]): number {
	// ... unchanged ...
	if (variables.length > 8 && variables[8].type === "Int") {
		const val = Number.parseInt(variables[8].value, 10);
		if (val >= 0 && val <= 4) {
			return val;
		}
	}
	return 0;
}

/**
 * Derive icon_code from miximax asset_code (wmm00210_h2 → c05028210)
 */
function deriveIconCodeInternal(assetCode: string): string | null {
	if (!assetCode.startsWith("wmm")) return null;
	const numStr = assetCode.replace(/^wmm/, "").replace(/_.*$/, "");
	const num = parseInt(numStr, 10);
	if (Number.isNaN(num)) return null;
	if (numStr.length > 5) return `c${numStr}`;
	if (num <= 999) return `c05028${String(num).padStart(3, "0")}`;
	return null;
}

/**
 * Build image path based on asset code and subtype.
 * Keshins : 200_icon/10_icon_chr/aura_fs/k{6d}_l_{5d}_l00.webp
 * Souls   : 200_icon/10_icon_chr/aura_soul/a{6d}_l_{5d}_l00.webp
 * Miximax : 220_img/telop_waza/fr/aura_mixi_{iconCode}.webp (fallback car mapping ca/cn non déterministe)
 * Aura    : 220_img/telop_waza/fr/aura_power_{assetCode}.webp
 * ModeChange : non supporté (pas d'icône standardisée)
 */
function buildImagePath(assetCode: string, subType: AuraSubType): string | undefined {
	if (!assetCode) return undefined;

	switch (subType) {
		case "Keshin": {
			if (assetCode.toLowerCase().startsWith("was")) return undefined; // armed — pas d'icône directe
			const match = assetCode.match(/(\d+)$/);
			if (!match) return undefined;
			const num = parseInt(match[1], 10);
			const num6 = num.toString().padStart(6, "0");
			const num5 = num.toString().padStart(5, "0");
			return `200_icon/10_icon_chr/aura_fs/k${num6}_l_${num5}_l00.webp`;
		}
		case "Soul": {
			const match = assetCode.match(/(\d+)$/);
			if (!match) return undefined;
			const num = parseInt(match[1], 10);
			const num6 = num.toString().padStart(6, "0");
			const num5 = num.toString().padStart(5, "0");
			return `200_icon/10_icon_chr/aura_soul/a${num6}_l_${num5}_l00.webp`;
		}
		case "Aura": {
			return `220_img/telop_waza/fr/aura_power_${assetCode}.webp`;
		}
		case "Miximax": {
			const iconCode = deriveIconCodeInternal(assetCode);
			if (!iconCode) return undefined;
			return `220_img/telop_waza/fr/aura_mixi_${iconCode}.webp`;
		}
		default:
			return undefined;
	}
}

/**
 * Parse AURA_CMD_INFO node to extract aura skill data
 */
function parseAuraCmdInfo(
	node: ConfigNode,
	skillTextMap: Map<string, string>,
	skillTextMapEN?: Map<string, string>,
	skillTextMapJA?: Map<string, string>
): AuraSkill | null {
	const vars = node.variables;
	if (vars.length < 4) return null;

	// Extract basic data
	const auraIdInt = Number.parseInt(vars[0].value, 10);
	const auraIdHex = toHex(auraIdInt);
	const assetCode = vars[1]?.value || "";
	const nameIdInt = Number.parseInt(vars[2]?.value || "0", 10);
	const descIdInt = Number.parseInt(vars[3]?.value || "0", 10);

	// Resolve names
	const nameIdHex = toHex(nameIdInt);
	const name = skillTextMap.get(nameIdHex) || skillTextMap.get(nameIdInt.toString());
	const nameEN = skillTextMapEN?.get(nameIdHex) || skillTextMapEN?.get(nameIdInt.toString());
	const nameJA = skillTextMapJA?.get(nameIdHex) || skillTextMapJA?.get(nameIdInt.toString());

	// Resolve descriptions
	const descIdHex = toHex(descIdInt);
	const desc = skillTextMap.get(descIdHex) || skillTextMap.get(descIdInt.toString());
	const descJA = skillTextMapJA?.get(descIdHex) || skillTextMapJA?.get(descIdInt.toString());

	// Determine subType from asset code AND text heuristics
	const subType = determineSubType(assetCode, name, desc);

	// Get element
	const element = getElement(vars);

	// Build image path
	const imagePath = buildImagePath(assetCode, subType);

	// Extract additional config variables
	const getInt = (i: number) =>
		vars[i]?.type === "Int" ? Number.parseInt(vars[i].value, 10) : undefined;
	const getHash = (i: number): string | undefined => {
		const v = getInt(i);
		if (v === undefined || v === 0) return undefined;
		const h = toHex(v);
		return h === "0x00000000" ? undefined : h;
	};

	const config: AuraSkill["config"] = {};
	const v4 = getInt(4);
	if (v4 !== undefined && v4 !== 0) config.val4 = v4;
	const v5 = getInt(5);
	if (v5 !== undefined && v5 !== 0) config.val5 = v5;
	const s1 = getHash(6);
	if (s1) config.skillId1 = s1;
	const s2 = getHash(7);
	if (s2) config.skillId2 = s2;
	const v9 = getInt(9);
	if (v9 !== undefined && v9 !== 0) config.val9 = v9;
	const v11 = getInt(11);
	if (v11 !== undefined && v11 !== 0) config.val11 = v11;
	const buf = getHash(12);
	if (buf) config.buffId = buf;
	const v16 = getInt(16);
	if (v16 !== undefined && v16 !== 0) config.rank = v16;

	return {
		auraId: auraIdHex,
		auraIdStr: `${subType.toLowerCase()}_${auraIdHex}`,
		element,
		name_FR: name || `${getSubTypeLabel(subType)} (${assetCode})`,
		name_EN: nameEN,
		name_JA: nameJA,
		desc_FR: desc || getSubTypeLabel(subType),
		desc_JA: descJA,
		image: imagePath,
		assetCode,
		subType,
		config: Object.keys(config).length > 0 ? config : undefined,
		_source: "AURA_CMD_INFO",
		_file: "aura_skill_config",
	};
}

/**
 * Load all aura skills from aura_skill_config cfg.bin.json file
 */
export function loadAuraSkills(
	_skillInfoPath: string, // Unused, kept for API compatibility
	_auraInfoPath: string, // Unused, kept for API compatibility
	textMap: Map<string, string>,
	textMapEN?: Map<string, string>,
	textMapJA?: Map<string, string>
): AuraSkill[] {
	const results: AuraSkill[] = [];

	// Find the aura_skill_config file
	const auraConfigPath = join(
		DATA_ROOT,
		"common/gamedata/skill/aura_skill_config_1.04.09.00.cfg.bin.json"
	);

	if (!existsSync(auraConfigPath)) {
		return results;
	}

	try {
		const config = readJson<AuraConfigData>(auraConfigPath);

		// Traverse entries to find AURA_CMD_INFO_LIST_BEG_0 and its children
		function traverse(nodes: ConfigNode[]) {
			for (const node of nodes) {
				if (node.name === "AURA_CMD_INFO_LIST_BEG_0" && node.children) {
					// Process all AURA_CMD_INFO_* children (skip REF_ nodes)
					for (const child of node.children) {
						if (child.name.startsWith("AURA_CMD_INFO_") && !child.name.includes("REF_")) {
							const aura = parseAuraCmdInfo(child, textMap, textMapEN, textMapJA);
							if (aura) {
								results.push(aura);
							}
						}
					}
				}

				// Recurse into children
				if (node.children) {
					traverse(node.children);
				}
			}
		}

		traverse(config.entries);
	} catch (e) {
		console.error("[loadAuraSkills] Failed to parse aura_skill_config:", e);
	}

	// Enrich with owner character from change_aura_skill_config
	const changeAuraPath = join(
		DATA_ROOT,
		"common/gamedata/skill/change_aura_skill_config_1.01.73.00.cfg.bin.json"
	);
	if (existsSync(changeAuraPath)) {
		try {
			const changeConfig = readJson<{
				lists: Array<{ name: string; values: Array<{ id: string; charaParamId: string }> }>;
			}>(changeAuraPath);
			const ownerMap = new Map<string, string>();
			for (const list of changeConfig.lists || []) {
				if (list.name === "m_ChangeAuraSkillDataList") {
					for (const val of list.values) {
						if (val.charaParamId && val.charaParamId !== "0x00000000") {
							ownerMap.set(val.id, val.charaParamId);
						}
					}
				}
			}
			for (const aura of results) {
				const owner = ownerMap.get(aura.auraId);
				if (owner) aura.ownerCharaParamId = owner;
			}
		} catch {
			// silently fail — owner enrichment is optional
		}
	}

	return results;
}

/**
 * Build a Set of all aura command hex IDs (e.g. "0xBFB0BB04").
 * Used to distinguish aura IDs from skill IDs in chara_param slots.
 */
export function buildAuraHashSet(): Set<string> {
	const auraConfigPath = join(
		DATA_ROOT,
		"common/gamedata/skill/aura_skill_config_1.04.09.00.cfg.bin.json"
	);

	const hashes = new Set<string>();
	if (!existsSync(auraConfigPath)) return hashes;

	try {
		const config = readJson<AuraConfigData>(auraConfigPath);

		function traverse(nodes: ConfigNode[]) {
			for (const node of nodes) {
				if (node.name === "AURA_CMD_INFO_LIST_BEG_0" && node.children) {
					for (const child of node.children) {
						if (child.name.startsWith("AURA_CMD_INFO_") && !child.name.includes("REF_")) {
							const vars = child.variables;
							if (vars.length >= 1) {
								const signed = Number.parseInt(vars[0].value, 10);
								hashes.add(toHex(signed));
							}
						}
					}
				}
				if (node.children) traverse(node.children);
			}
		}

		traverse(config.entries);
	} catch {
		// silently fail — caller will get empty set
	}

	return hashes;
}
