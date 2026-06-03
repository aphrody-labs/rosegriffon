/**
 * @file constellation.ts
 * @description Parser for Players Universe (Constellation) data
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "../core/paths.js";

// ============================================================================
// Types
// ============================================================================

/** Raw star info from starInfo.json */
export interface StarInfo {
	starNameHash: string;
	starLocatorNameHash: string;
	starTextureNameHash: string;
	starAfterTextureNameHash: string;
	rareStarTextureNameHash: string;
	starSignLayerNameHash: string;
	starLayerNameHash: string;
	numTextureNameHash: string;
	starKeyInfoList: [number, number];
}

/** Raw rarity rate info */
export interface StarSignRarityRateInfo {
	rarityType: number;
	rarityRateDefault: number;
	rarityRateBoostA: number;
	rarityRateBoostB: number;
	rarityRateBoostC: number;
	rarityRateBoostD: number;
	starSignCharaInfoList: [number, number]; // [offset, count]
}

/** Constellation with localized names */
export interface Constellation {
	/** Index (0-29) */
	index: number;
	/** Hash ID for lookup */
	hashId: string;
	/** Localized names */
	names: {
		fr?: string;
		en?: string;
		ja?: string;
	};
	/** Character param IDs in this constellation */
	characterIds: string[];
	/** Character count */
	characterCount: number;
	/** Texture/visual references */
	textures: {
		star: string;
		starAfter: string;
		rareStar: string;
		layer: string;
	};
}

/** Mapping from charaParamId to constellation index */
export interface ConstellationMapping {
	/** charaParamId -> constellation index */
	byCharacterId: Map<string, number>;
	/** constellation index -> constellation data */
	constellations: Constellation[];
}

// ============================================================================
// Text Parsing
// ============================================================================

/** Parse players_universe_text for constellation names */
function parseConstellationNames(locale: "fr" | "en" | "ja"): Map<number, string> {
	const filePath = join(PATHS.textRoot, locale, "players_universe_text.cfg.bin.json");
	const names = new Map<number, string>();

	if (!existsSync(filePath)) {
		return names;
	}

	try {
		const data = JSON.parse(readFileSync(filePath, "utf-8"));

		for (const entry of data.entries || []) {
			if (entry.name.startsWith("NOUN_INFO_BEGIN")) {
				for (const child of entry.children || []) {
					if (child.name.startsWith("NOUN_INFO_")) {
						const vars = child.variables || [];
						// First variable is hash (signed int as string)
						const hashStr = vars[0]?.value;
						// 6th variable (index 5) is the text
						const text = vars[5]?.value;

						if (hashStr !== undefined && text) {
							// Parse as signed int, then convert to unsigned for matching
							const hashSigned = Number.parseInt(hashStr, 10);
							const hash = hashSigned < 0 ? hashSigned >>> 0 : hashSigned;
							names.set(hash, text);
						}
					}
				}
			}
		}
	} catch (e) {
		console.error(`[Constellation] Failed to parse ${filePath}:`, e);
	}

	return names;
}

/** Convert hex hash string to unsigned number */
function hashToNumber(hash: string): number {
	return Number.parseInt(hash, 16) >>> 0;
}

// ============================================================================
// Data Loading
// ============================================================================

let constellationCache: ConstellationMapping | null = null;

/** Star sign info from starSignInfo.json */
export interface StarSignInfoEntry {
	starSignIdCrc: string;
	starSignNameId: string;
	starSignInfoTextId: string;
	starSignNo: number;
	keyItemId: string;
	keyItemNum: number;
	dropCharacterNum: number;
	starKeyNameHash: string;
	clearFlagIndex: number;
	enableCond: string;
}

/** Load star sign info (30 constellations with name hashes) */
function loadStarSignInfo(): StarSignInfoEntry[] {
	const filePath = join(PATHS.allGamedata, "starSignInfo.json");

	if (!existsSync(filePath)) {
		return [];
	}

	const data = JSON.parse(readFileSync(filePath, "utf-8"));
	return data.data || [];
}

/** Load star info (30 constellations) */
function loadStarInfo(): StarInfo[] {
	const filePath = join(PATHS.allGamedata, "starInfo.json");

	if (!existsSync(filePath)) {
		return [];
	}

	const data = JSON.parse(readFileSync(filePath, "utf-8"));
	return data.data || [];
}

/** Load rarity rate info (90 entries) */
function loadRarityRateInfo(): StarSignRarityRateInfo[] {
	const filePath = join(PATHS.allGamedata, "starSignRarityRateInfo.json");

	if (!existsSync(filePath)) {
		return [];
	}

	const data = JSON.parse(readFileSync(filePath, "utf-8"));
	return data.data || [];
}

/** Load character info (4439 entries) */
function loadCharaInfo(): Array<{ charaParamId: string }> {
	const filePath = join(PATHS.allGamedata, "starSignCharaInfo.json");

	if (!existsSync(filePath)) {
		return [];
	}

	const data = JSON.parse(readFileSync(filePath, "utf-8"));
	return data.data || [];
}

// ============================================================================
// Main Builder
// ============================================================================

/**
 * Build complete constellation mapping
 * Maps each character to their constellation
 */
export function buildConstellationMapping(): ConstellationMapping {
	if (constellationCache) return constellationCache;

	// Load raw data
	const starSignInfoList = loadStarSignInfo();
	const starInfoList = loadStarInfo();
	const rarityRateList = loadRarityRateInfo();
	const charaInfoList = loadCharaInfo();

	// Load localized names
	const namesFR = parseConstellationNames("fr");
	const namesEN = parseConstellationNames("en");
	const namesJA = parseConstellationNames("ja");

	// Build map from starKeyNameHash -> starSignInfo (for linking with starInfo)
	const keyHashToSignInfo = new Map<string, StarSignInfoEntry>();
	for (const signInfo of starSignInfoList) {
		keyHashToSignInfo.set(signInfo.starKeyNameHash, signInfo);
	}

	// Build constellations
	const constellations: Constellation[] = [];
	const byCharacterId = new Map<string, number>();

	for (let i = 0; i < starInfoList.length; i++) {
		const star = starInfoList[i];
		const signInfo = keyHashToSignInfo.get(star.starNameHash);

		// Get name hash from starSignInfo.starSignNameId
		const nameHash = signInfo ? hashToNumber(signInfo.starSignNameId) : 0;

		// Each constellation has 3 rarity entries (indices i*3, i*3+1, i*3+2)
		const rarityEntries = [
			rarityRateList[i * 3],
			rarityRateList[i * 3 + 1],
			rarityRateList[i * 3 + 2],
		].filter(Boolean);

		// Collect all character IDs for this constellation
		const characterIds: string[] = [];

		for (const entry of rarityEntries) {
			const [offset, count] = entry.starSignCharaInfoList;
			for (let j = 0; j < count; j++) {
				const charaEntry = charaInfoList[offset + j];
				if (charaEntry) {
					characterIds.push(charaEntry.charaParamId);
					byCharacterId.set(charaEntry.charaParamId, i);
				}
			}
		}

		const constellation: Constellation = {
			index: i,
			hashId: star.starNameHash,
			names: {
				fr: namesFR.get(nameHash),
				en: namesEN.get(nameHash),
				ja: namesJA.get(nameHash),
			},
			characterIds,
			characterCount: characterIds.length,
			textures: {
				star: star.starTextureNameHash,
				starAfter: star.starAfterTextureNameHash,
				rareStar: star.rareStarTextureNameHash,
				layer: star.starLayerNameHash,
			},
		};

		constellations.push(constellation);
	}

	constellationCache = { constellations, byCharacterId };
	return constellationCache;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get all constellations
 */
export function getAllConstellations(): Constellation[] {
	return buildConstellationMapping().constellations;
}

/**
 * Get constellation for a character by param ID
 */
export function getConstellationForCharacter(charaParamId: string): Constellation | undefined {
	const mapping = buildConstellationMapping();
	const index = mapping.byCharacterId.get(charaParamId);
	if (index === undefined) return undefined;
	return mapping.constellations[index];
}

/**
 * Get constellation by index (0-29)
 */
export function getConstellationByIndex(index: number): Constellation | undefined {
	return buildConstellationMapping().constellations[index];
}

/**
 * Get constellation by name (searches FR, EN, JA)
 */
export function getConstellationByName(name: string): Constellation | undefined {
	const q = name.toLowerCase();
	return buildConstellationMapping().constellations.find(
		(c) =>
			c.names.fr?.toLowerCase().includes(q) ||
			c.names.en?.toLowerCase().includes(q) ||
			c.names.ja?.includes(name)
	);
}

/**
 * Get all character IDs in a constellation
 */
export function getCharacterIdsInConstellation(constellationIndex: number): string[] {
	const constellation = getConstellationByIndex(constellationIndex);
	return constellation?.characterIds || [];
}

/** Clear cache (for testing) */
export function clearConstellationCache(): void {
	constellationCache = null;
}
