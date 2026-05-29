/**
 * cross-reference.ts — Cross-reference Lua, nie.c, and inagle parser data
 *
 * Reads:
 * - lua-global-index.json (from parse-lua-all.ts)
 * - nie-c-index.json (from parse-nie-c.ts)
 * - crc32-dictionary.json (from lua-pipeline.ts)
 * - inagle parser constants (inline)
 *
 * Produces:
 * - cross-refs.json: unified cross-reference database
 * - game-constants.json: resolved game constants (series, elements, etc.)
 * - engine-commands.json: documented engine bridge commands
 * - constellation-refs.json: StarSign/constellation references
 * - REPORT.md: human-readable analysis report
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA_DIR = resolve(import.meta.dirname, "../../../data");
const ANALYSIS_DIR = resolve(DATA_DIR, "lua_scripts/analysis");

// --- inagle known constants ---

const _INAGLE_SERIES: Record<number, { type: number; name: string; prefix: string }> = {
  1: { type: 1, name: "Inazuma Eleven", prefix: "c01" },
  2: { type: 2, name: "Inazuma Eleven 2", prefix: "c02" },
  3: { type: 3, name: "Inazuma Eleven 3", prefix: "c03" },
  4: { type: 4, name: "Inazuma Eleven GO", prefix: "c04" },
  5: { type: 5, name: "Chrono Stone", prefix: "c05" },
  6: { type: 6, name: "Galaxy", prefix: "c06" },
  7: { type: 7, name: "Ares", prefix: "c07" },
  8: { type: 8, name: "Orion", prefix: "c08" },
  9: { type: 9, name: "Victory Road", prefix: "c09" },
};

const _INAGLE_ELEMENTS: Record<number, string> = {
  0: "Néant",
  1: "Vent",
  2: "Forêt",
  3: "Feu",
  4: "Montagne",
};
const _INAGLE_POSITIONS: Record<number, string> = {
  0: "Coach",
  1: "GK",
  2: "FW",
  3: "MF",
  4: "DF",
};
const _INAGLE_RARITIES: Record<number, string> = {
  0: "Normal",
  1: "Growing",
  2: "Expérimenté",
  3: "Émérite",
  5: "SR",
  6: "LR",
  7: "Légendaire",
  10: "Héros",
  20: "BASARA",
};

const _INAGLE_SKILL_CATEGORIES: Record<number, string> = {
  0: "Aucun",
  1: "Tir",
  2: "Dribble",
  3: "Défense",
  4: "Arrêt",
  5: "Spécial",
  6: "Passif",
  9: "Boost Stats",
};

const INAGLE_TABLES = [
  "inagle_characters",
  "inagle_skills",
  "inagle_items",
  "inagle_passives",
  "inagle_keshins",
  "inagle_souls",
  "inagle_awakenings",
  "inagle_mode_changes",
  "inagle_miximax",
  "inagle_formations",
  "inagle_tactics",
  "inagle_teams",
  "inagle_auras",
  "inagle_coordinators",
  "inagle_drops",
  "inagle_override_skills",
  "inagle_kizuna_items",
];

const INAGLE_PARSERS: Record<string, string> = {
  chara_base: "parsers/chara-base.ts",
  chara_param: "parsers/chara-param.ts",
  chara_text: "parsers/text-parser.ts",
  skill_config: "skills/mapper.ts",
  skill_text: "parsers/text-parser.ts",
  belong_team: "parsers/belong-team.ts",
  constellation: "parsers/constellation.ts",
  star_sign: "parsers/constellation.ts",
  players_universe: "parsers/constellation.ts",
  growth_table: "core/data-loader.ts",
  team_config: "parsers/belong-team.ts",
  formation_config: "schemas/soccer.ts",
  basara: "parsers/hero-config.ts",
  passive_skill: "skills/mapper-passive.ts",
  aura_skill: "skills/mapper.ts",
  special_tactics: "skills/mapper.ts",
  item_config: "items/api.ts",
  soccer_summon: "—",
  gacha: "—",
  rarity: "core/types.ts",
  element: "core/types.ts",
  position: "core/types.ts",
};

function main() {
  // Load CRC32 dictionary
  const crc32Path = resolve(ANALYSIS_DIR, "crc32-dictionary.json");
  const crc32Dict: Record<string, string> = existsSync(crc32Path)
    ? JSON.parse(readFileSync(crc32Path, "utf-8"))
    : {};
  console.log(`CRC32 dictionary: ${Object.keys(crc32Dict).length} entries`);

  // Load Lua index
  const luaPath = resolve(ANALYSIS_DIR, "lua-global-index.json");
  let luaIndex: any = null;
  if (existsSync(luaPath)) {
    luaIndex = JSON.parse(readFileSync(luaPath, "utf-8"));
    console.log(`Lua index: ${luaIndex.totalFiles} files, ${luaIndex.totalFunctions} functions`);
  } else {
    console.log("WARNING: lua-global-index.json not found — run parse-lua-all.ts first");
  }

  // Load nie.c summary
  const nieSummaryPath = resolve(ANALYSIS_DIR, "nie-c-summary.json");
  let nieSummary: any = null;
  if (existsSync(nieSummaryPath)) {
    nieSummary = JSON.parse(readFileSync(nieSummaryPath, "utf-8"));
    console.log(
      `nie.c summary: ${nieSummary.totalFunctions || "?"} functions, ${nieSummary.rttClasses?.length || 0} RTTI classes`,
    );
  } else {
    console.log("WARNING: nie-c-summary.json not found — run parse-nie-c.ts first");
  }

  // --- 1. Resolve CRC32 numbers from Lua scripts ---
  const resolvedCRC32: Record<
    string,
    { decimal: string; hex: string; name: string; files: string[] }
  > = {};
  const unresolvedCRC32: Record<string, { decimal: string; hex: string; files: string[] }> = {};

  if (luaIndex?.allCRC32) {
    for (const [decimal, files] of Object.entries(luaIndex.allCRC32 as Record<string, string[]>)) {
      const unsigned = Number(decimal) >>> 0;
      const hex = `0x${unsigned.toString(16).toUpperCase().padStart(8, "0")}`;
      const name = crc32Dict[hex] || crc32Dict[decimal];
      if (name) {
        resolvedCRC32[hex] = { decimal, hex, name, files };
      } else {
        unresolvedCRC32[hex] = { decimal, hex, files };
      }
    }
  }
  console.log(
    `\nCRC32 resolution: ${Object.keys(resolvedCRC32).length} resolved, ${Object.keys(unresolvedCRC32).length} unresolved`,
  );

  // --- 2. Engine commands documentation ---
  const engineCommands: Record<
    string,
    Record<string, { hex: string; resolvedName: string | null; files: string[] }>
  > = {};
  if (luaIndex?.bridgeCalls) {
    for (const [bridge, hashes] of Object.entries(
      luaIndex.bridgeCalls as Record<string, Record<string, string[]>>,
    )) {
      engineCommands[bridge] = {};
      for (const [hash, files] of Object.entries(hashes)) {
        const unsigned = Number(hash) >>> 0;
        const hex = `0x${unsigned.toString(16).toUpperCase().padStart(8, "0")}`;
        const name = crc32Dict[hex] || crc32Dict[hash] || null;
        engineCommands[bridge][hash] = { hex, resolvedName: name, files };
      }
    }
  }

  // --- 3. Game constants from Lua strings ---
  const gameConstants: {
    series: { name: string; crc32?: string; files: string[] }[];
    elements: { name: string; crc32?: string; files: string[] }[];
    rarities: { name: string; crc32?: string; files: string[] }[];
    positions: { name: string; crc32?: string; files: string[] }[];
    playstyles: { name: string; crc32?: string; files: string[] }[];
    bodyTypes: { name: string; crc32?: string; files: string[] }[];
    filterTabs: { name: string; files: string[] }[];
  } = {
    series: [],
    elements: [],
    rarities: [],
    positions: [],
    playstyles: [],
    bodyTypes: [],
    filterTabs: [],
  };

  if (luaIndex?.allStrings) {
    const strs = luaIndex.allStrings as Record<string, string[]>;
    for (const [s, files] of Object.entries(strs)) {
      if (s.startsWith("chara_series_")) gameConstants.series.push({ name: s, files });
      if (s.startsWith("chara_filter_menu_tab_text_"))
        gameConstants.filterTabs.push({ name: s, files });
      if (s.includes("element") && s.includes("filter"))
        gameConstants.elements.push({ name: s, files });
      if (s.includes("rarity") && s.includes("filter"))
        gameConstants.rarities.push({ name: s, files });
      if (s.includes("position") && s.includes("filter"))
        gameConstants.positions.push({ name: s, files });
      if (s.includes("playstyle") || s.includes("play_style"))
        gameConstants.playstyles.push({ name: s, files });
      if (s.includes("body_type") || s.includes("bodytype"))
        gameConstants.bodyTypes.push({ name: s, files });
    }
  }

  // --- 4. Constellation / StarSign refs ---
  const constellationRefs: {
    luaStrings: { string: string; files: string[] }[];
    luaFunctions: { name: string; files: string[] }[];
    nieCStrings: { string: string; usedIn: string[] }[];
    nieCFunctions: string[];
  } = {
    luaStrings: [],
    luaFunctions: [],
    nieCStrings: [],
    nieCFunctions: [],
  };

  if (luaIndex?.allStrings) {
    for (const [s, files] of Object.entries(luaIndex.allStrings as Record<string, string[]>)) {
      if (/star|sign|universe|constellation|zodiac/i.test(s)) {
        constellationRefs.luaStrings.push({ string: s, files });
      }
    }
  }
  if (luaIndex?.allFunctions) {
    for (const [fn, files] of Object.entries(luaIndex.allFunctions as Record<string, string[]>)) {
      if (/StarSign|Universe|Constellation/i.test(fn)) {
        constellationRefs.luaFunctions.push({ name: fn, files });
      }
    }
  }
  if (nieSummary?.gameDataStrings) {
    for (const item of nieSummary.gameDataStrings) {
      if (/star|sign|universe|constellation/i.test(item.string)) {
        constellationRefs.nieCStrings.push(item);
      }
    }
  }

  // --- 5. Cross-refs: Lua ↔ nie.c string overlap ---
  const luaNieCOverlap: { string: string; luaFiles: string[]; nieCFunctions: string[] }[] = [];
  if (luaIndex?.allStrings && nieSummary?.gameDataStrings) {
    const nieCStringMap = new Map<string, string[]>();
    for (const item of nieSummary.gameDataStrings) {
      nieCStringMap.set(item.string, item.usedIn);
    }
    for (const [s, luaFiles] of Object.entries(luaIndex.allStrings as Record<string, string[]>)) {
      const nieFns = nieCStringMap.get(s);
      if (nieFns) {
        luaNieCOverlap.push({ string: s, luaFiles, nieCFunctions: nieFns });
      }
    }
  }

  // --- 6. Write outputs ---

  writeFileSync(
    resolve(ANALYSIS_DIR, "game-constants.json"),
    JSON.stringify(gameConstants, null, 2),
  );
  console.log("Wrote game-constants.json");

  writeFileSync(
    resolve(ANALYSIS_DIR, "engine-commands.json"),
    JSON.stringify(engineCommands, null, 2),
  );
  console.log(
    `Wrote engine-commands.json (${Object.values(engineCommands).reduce((s, h) => s + Object.keys(h).length, 0)} commands across ${Object.keys(engineCommands).length} bridges)`,
  );

  writeFileSync(
    resolve(ANALYSIS_DIR, "constellation-refs.json"),
    JSON.stringify(constellationRefs, null, 2),
  );
  console.log(
    `Wrote constellation-refs.json (${constellationRefs.luaStrings.length} lua strings, ${constellationRefs.nieCStrings.length} nie.c strings)`,
  );

  const crossRefs = {
    resolvedCRC32,
    unresolvedCRC32: Object.keys(unresolvedCRC32).length,
    luaNieCOverlap,
    engineCommandCount: Object.values(engineCommands).reduce(
      (s, h) => s + Object.keys(h).length,
      0,
    ),
    constellationRefs,
  };
  writeFileSync(resolve(ANALYSIS_DIR, "cross-refs.json"), JSON.stringify(crossRefs, null, 2));
  console.log("Wrote cross-refs.json");

  // --- 7. Generate REPORT.md ---
  const resolvedCount = Object.keys(resolvedCRC32).length;
  const unresolvedCount = Object.keys(unresolvedCRC32).length;
  const totalBridgeCommands = Object.values(engineCommands).reduce(
    (s, h) => s + Object.keys(h).length,
    0,
  );
  const resolvedBridgeCommands = Object.values(engineCommands).reduce(
    (s, h) => s + Object.values(h).filter((c) => c.resolvedName).length,
    0,
  );

  const report = `# Rapport d'analyse croisée — Lua × nie.c × inagle

*Généré le ${new Date().toISOString().split("T")[0]}*

## Sources

| Source | Données |
|--------|---------|
| **Scripts Lua** | ${luaIndex?.totalFiles || "?"} fichiers, ${luaIndex?.totalLines || "?"} lignes, ${luaIndex?.totalFunctions || "?"} fonctions |
| **nie.c (Ghidra)** | ${nieSummary?.totalLines || "?"} lignes, ${nieSummary?.totalFunctions || "?"} fonctions, ${nieSummary?.rttClasses?.length || "?"} classes RTTI |
| **Dictionnaire CRC32** | ${Object.keys(crc32Dict).length} entrées |
| **inagle parsers** | ${Object.keys(INAGLE_PARSERS).length} domaines, ${INAGLE_TABLES.length} tables Supabase |

## Résolution CRC32

| Métrique | Valeur |
|----------|--------|
| CRC32 uniques dans Lua | ${resolvedCount + unresolvedCount} |
| **Résolus** | **${resolvedCount}** (${((resolvedCount / (resolvedCount + unresolvedCount)) * 100).toFixed(1)}%) |
| Non résolus | ${unresolvedCount} |

## Commandes Engine (bridges Lua → C++)

| Bridge | Hashes uniques | Résolus | Taux |
|--------|---------------|---------|------|
${Object.entries(engineCommands)
  .map(([bridge, hashes]) => {
    const total = Object.keys(hashes).length;
    const resolved = Object.values(hashes).filter((c) => c.resolvedName).length;
    return `| \`${bridge}\` | ${total} | ${resolved} | ${total > 0 ? ((resolved / total) * 100).toFixed(0) : 0}% |`;
  })
  .join("\n")}
| **Total** | **${totalBridgeCommands}** | **${resolvedBridgeCommands}** | **${totalBridgeCommands > 0 ? ((resolvedBridgeCommands / totalBridgeCommands) * 100).toFixed(0) : 0}%** |

## Constantes de jeu extraites

| Catégorie | Entrées | Fichier inagle |
|-----------|---------|----------------|
| Séries | ${gameConstants.series.length} | \`parsers/belong-team.ts\` |
| Éléments | ${gameConstants.elements.length} | \`core/types.ts\` |
| Raretés | ${gameConstants.rarities.length} | \`core/types.ts\` |
| Positions | ${gameConstants.positions.length} | \`core/types.ts\` |
| Playstyles | ${gameConstants.playstyles.length} | — |
| Body types | ${gameConstants.bodyTypes.length} | — |
| Onglets filtre | ${gameConstants.filterTabs.length} | — |

## Constellation / StarSign

| Source | Refs trouvées |
|--------|--------------|
| Lua strings | ${constellationRefs.luaStrings.length} |
| Lua functions | ${constellationRefs.luaFunctions.length} |
| nie.c strings | ${constellationRefs.nieCStrings.length} |

## Chevauchement Lua ↔ nie.c

**${luaNieCOverlap.length}** strings communes entre les scripts Lua et nie.c.

${luaNieCOverlap
  .slice(0, 30)
  .map(
    (o) =>
      `- \`${o.string}\` — Lua: ${o.luaFiles.length} fichiers, nie.c: ${o.nieCFunctions.join(", ")}`,
  )
  .join("\n")}

## Mapping inagle

| Domaine | Parser inagle | Config .cfg.bin | Table Supabase |
|---------|---------------|-----------------|----------------|
${Object.entries(INAGLE_PARSERS)
  .slice(0, 15)
  .map(([domain, parser]) => {
    const table = INAGLE_TABLES.find((t) => t.includes(domain.split("_")[0])) || "—";
    return `| ${domain} | \`${parser}\` | \`${domain}*.cfg.bin\` | \`${table}\` |`;
  })
  .join("\n")}

## Fichiers générés

| Fichier | Contenu |
|---------|---------|
| \`nie-c-index.json\` | Index complet de nie.c (fonctions, globals, strings, hex) |
| \`nie-c-summary.json\` | Résumé compact (top functions, RTTI, game strings) |
| \`lua-global-index.json\` | Index complet des scripts Lua |
| \`lua-summary.json\` | Résumé compact (top strings, CRC32, fields) |
| \`cross-refs.json\` | Croisement Lua ↔ nie.c ↔ CRC32 |
| \`game-constants.json\` | Constantes de jeu extraites |
| \`engine-commands.json\` | Commandes engine documentées |
| \`constellation-refs.json\` | Références constellation/StarSign |
| \`crc32-dictionary.json\` | Dictionnaire CRC32 (${Object.keys(crc32Dict).length} entrées) |
`;

  writeFileSync(resolve(ANALYSIS_DIR, "REPORT.md"), report);
  console.log("Wrote REPORT.md");

  console.log("\n=== DONE ===");
}

main();
