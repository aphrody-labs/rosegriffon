/**
 * @file star-sign.ts
 * @description Parser for character star sign (rarity) data
 *
 * Rarity data comes from the Players Universe config file
 * (m_starSignCharaInfoList inside players_universe_config).
 * BASARA characters are injected from basaraBuildInfo.json.
 *
 * Rarity distribution (v1.03.59):
 *   Code 0 (Normal): 4408 characters
 *   Code 2 (R):       150 characters
 *   Code 5 (UR):       34 characters
 *   Code 6 (LR):       36 characters
 *   Code 7 (Legend):    38 characters
 *   Code 20 (BASARA):   64 characters (from basaraBuildInfo)
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FILES, PATHS } from "../core/paths.js";
import { loadBasaraConfig } from "./basara-config.js";

export interface StarSignCharaInfo {
  charaParamId: string;
  charaRarity: number;
  charaRateDefault: number;
  charaRateBoostA: number;
  charaRateBoostB: number;
  charaRateBoostC: number;
  charaRateBoostD: number;
  isRemarkable: boolean;
  enableCond: string;
}

let starSignCache: Map<string, StarSignCharaInfo> | null = null;

/**
 * Load BASARA character IDs from basaraBuildInfo.json or config
 */
function loadBasaraCharaIds(): Set<string> {
  const ids = new Set<string>();
  const filePath = join(PATHS.allGamedata, "basaraBuildInfo.json");

  if (existsSync(filePath)) {
    try {
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      for (const entry of data.data || []) {
        ids.add(entry.charaParamId);
      }
      return ids;
    } catch (e) {
      console.warn("Failed to load basaraBuildInfo.json", e);
    }
  }

  // Fallback to raw config
  const config = loadBasaraConfig();
  if (config) {
    for (const info of config.buildInfos) {
      ids.add(info.charaId);
    }
  }

  return ids;
}

/**
 * Load star sign character info from Players Universe config.
 *
 * Primary source: players_universe_config (m_starSignCharaInfoList)
 * Fallback: legacy starSignCharaInfo.json (all-gamedata)
 */
export function loadStarSignCharaInfo(): StarSignCharaInfo[] {
  // Primary: read from players_universe_config
  const puPath = join(PATHS.playersUniverse, FILES.playersUniverseConfig);
  if (existsSync(puPath)) {
    try {
      const data = JSON.parse(readFileSync(puPath, "utf-8"));
      if (data.lists) {
        const list = data.lists.find((l: { name: string }) => l.name === "m_starSignCharaInfoList");
        if (list?.values?.length > 0) {
          return list.values as StarSignCharaInfo[];
        }
      }
    } catch (e) {
      console.warn("[star-sign] Failed to read players_universe_config:", e);
    }
  }

  // Fallback: legacy extracted JSON
  const legacyPath = join(PATHS.allGamedata, "starSignCharaInfo.json");
  if (existsSync(legacyPath)) {
    try {
      const data = JSON.parse(readFileSync(legacyPath, "utf-8"));
      return data.data || [];
    } catch (e) {
      console.warn("[star-sign] Failed to read legacy starSignCharaInfo.json:", e);
    }
  }

  console.warn("[star-sign] No rarity data found — all characters will default to Normal");
  return [];
}

/**
 * Build a map of charaParamId -> StarSignCharaInfo
 * Includes both starSign entries and BASARA characters
 */
export function buildStarSignMap(): Map<string, StarSignCharaInfo> {
  if (starSignCache) return starSignCache;

  const entries = loadStarSignCharaInfo();
  starSignCache = new Map();

  for (const entry of entries) {
    starSignCache.set(entry.charaParamId, entry);
  }

  // Add BASARA characters with rarity 20
  const basaraIds = loadBasaraCharaIds();
  for (const id of basaraIds) {
    if (!starSignCache.has(id)) {
      starSignCache.set(id, {
        charaParamId: id,
        charaRarity: 20,
        charaRateDefault: 0,
        charaRateBoostA: 0,
        charaRateBoostB: 0,
        charaRateBoostC: 0,
        charaRateBoostD: 0,
        isRemarkable: true,
        enableCond: "",
      });
    }
  }

  const nonNormal = [...starSignCache.values()].filter((e) => e.charaRarity !== 0).length;
  console.log(`[star-sign] Loaded ${starSignCache.size} entries (${nonNormal} non-Normal)`);

  return starSignCache;
}

/**
 * Get rarity for a charaParamId
 */
export function getRarity(charaParamId: string): number {
  const map = buildStarSignMap();
  const entry = map.get(charaParamId);
  return entry?.charaRarity ?? 0;
}

/**
 * Check if a character is remarkable (special/featured)
 */
export function isRemarkable(charaParamId: string): boolean {
  const map = buildStarSignMap();
  const entry = map.get(charaParamId);
  return entry?.isRemarkable ?? false;
}

/**
 * Map rarity code to display name (French)
 *
 * In-game rarity progression (system_text NOUN_INFO 76-82):
 *   0 = Normal       (EN: COMMON)
 *   1 = En progression (EN: GROWING)
 *   2 = Expérimenté  (EN: ADVANCED)
 *   3 = Émérite      (EN: TOP)
 *   4 = Légendaire   (EN: LEGENDARY)
 *   5 = Héros        (EN: HERO)
 *   6 = Basara       (EN: FABLED)
 *
 * StarSign gacha codes → base rarity:
 *   0 → Normal        — 90% drop rate
 *   2 → Expérimenté   — 9.5% drop rate
 *   5/6/7 → Légendaire — 0.5% drop rate
 *  20 → BASARA (from basaraBuildInfo)
 *
 * NOTE: "Héros" is NOT set by starSign rarity code.
 * It's applied by the match-heroes enrichment script for
 * characters with hero upgrade paths (Fire/Black/Pink).
 */
export function rarityCodeToName(code: number): string {
  switch (code) {
    case 0:
    case 1:
      return "Normal";
    case 2:
      return "Expérimenté";
    case 3:
      return "Émérite";
    case 4:
      return "Normal";
    case 5:
    case 6:
    case 7:
      return "Légendaire";
    case 10:
      return "Héros";
    case 20:
      return "BASARA";
    default:
      return `Rank${code}`;
  }
}

/**
 * Map rarity code to growth table rank (for stats calculation)
 * The growth table uses ranks 0-5 for charaRank
 * starSignCharaInfo uses: 0=N, 2=R, 5=UR, 6=LR, 7=Legend
 */
export function rarityToGrowthRank(code: number): number {
  // Growth table ranks: 0, 1, 2, 3, 4, 5
  // starSign codes: 0=N, 2=R, 5=UR, 6=LR, 7=Legend, 20=BASARA
  switch (code) {
    case 0:
      return 0; // N -> rank 0
    case 2:
      return 2; // R -> rank 2
    case 3:
      return 3; // SR -> rank 3
    case 4:
      return 4; // SSR -> rank 4
    case 5:
      return 5; // UR -> rank 5
    case 6:
      return 5; // LR -> use UR stats
    case 7:
      return 5; // Legend -> use UR stats
    case 20:
      return 5; // BASARA -> use UR stats
    default:
      return code <= 5 ? code : 5;
  }
}
