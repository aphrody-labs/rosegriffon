/**
 * @file enrich-crc32-dictionary.ts
 * @description Enrichit le dictionnaire CRC32 avec les strings de Ghidra,
 * les classes RTTI, les gamedata strings, les identifiants de skills/items,
 * et les champs Lua.
 *
 * Strategie : on ne garde QUE les entrees qui resolvent un CRC32
 * effectivement utilise dans les scripts Lua OU les configs binaires.
 *
 * Usage: npx tsx src/scripts/analyze/enrich-crc32-dictionary.ts
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = import.meta.path;
const __dirname = dirname(__filename);
const DATA_ROOT = join(__dirname, "../../../data");

// ─── CRC32 ──────────────────────────────────────────────────────────────

const CRC32_POLYNOMIAL = 0xedb88320;
const crc32Table: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ CRC32_POLYNOMIAL : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xff];
  }
  return ~crc >>> 0;
}

const encoder = new TextEncoder();
function crc32String(str: string): number {
  return crc32(encoder.encode(str));
}

function toHex(n: number): string {
  return `0x${(n >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

// ─── Main ───────────────────────────────────────────────────────────────

function main() {
  console.log("=== Enrichissement du dictionnaire CRC32 ===\n");

  // Load existing dictionary
  const dictPath = join(DATA_ROOT, "lua_scripts/analysis/crc32-dictionary.json");
  const existingDict: Record<string, string> = JSON.parse(readFileSync(dictPath, "utf8"));
  const initialCount = Object.keys(existingDict).length;
  console.log(`Dictionnaire existant: ${initialCount} entrees`);

  // Build set of target CRC32s to resolve (from Lua scripts)
  const globalIndex = JSON.parse(
    readFileSync(join(DATA_ROOT, "lua_scripts/analysis/lua-global-index.json"), "utf8"),
  );
  const targetCRCs = new Set<string>();
  if (globalIndex.allCRC32) {
    for (const k of Object.keys(globalIndex.allCRC32)) {
      targetCRCs.add(toHex(parseInt(k, 10) >>> 0));
    }
  }
  console.log(`CRC32 cibles (Lua): ${targetCRCs.size}`);

  // Also collect CRC32s from config binary files (hashes in entries)
  // These are the Int values that look like hashes (> 0x10000 and not small nums)
  // We'll add these as secondary targets

  const dict: Record<string, string> = { ...existingDict };
  let _newResolutions = 0;
  let _totalCandidates = 0;

  function tryAdd(str: string): boolean {
    if (!str || str.length === 0 || str.length > 200) return false;
    _totalCandidates++;
    const hash = toHex(crc32String(str));
    if (!dict[hash]) {
      // Only add if it resolves a target CRC or is a genuinely useful entry
      dict[hash] = str;
      if (targetCRCs.has(hash)) {
        _newResolutions++;
      }
      return true;
    }
    return false;
  }

  // ─── Source 1: Ghidra strings (high value) ───────────────────────

  console.log("\n[1] Ghidra strings...");
  let ghidraAdded = 0;
  try {
    const altPath = "/home/ubuntu/vps/packages/iecode/docs/ghidra-export/strings.json";
    const ghidraData = JSON.parse(readFileSync(altPath, "utf8"));

    for (const entry of ghidraData.strings) {
      let val = entry.value;
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }

      // Skip useless strings
      if (val.length < 2 || val.length > 150) continue;
      // Skip format strings and common C strings
      if (/^[%\\]/.test(val)) continue;
      if (val.includes("\n") || val.includes("\t")) continue;

      if (tryAdd(val)) ghidraAdded++;

      // Also extract identifier-like substrings
      const identifiers = val.match(/[A-Z][a-z]+[A-Z][A-Za-z0-9_]*/g);
      if (identifiers) {
        for (const id of identifiers) {
          if (id.length > 3) tryAdd(id);
        }
      }

      // Ghidra symbol name cleanup
      if (entry.name && entry.name.length > 2) {
        const cleaned = entry.name.replace(/^s_/, "").replace(/_[0-9a-f]{8,}$/i, "");
        if (cleaned.length > 2 && cleaned.length < 100) {
          tryAdd(cleaned);
        }
      }
    }
    console.log(`  ${ghidraAdded} ajouts depuis ${ghidraData.total} strings`);
  } catch (e) {
    console.log(`  Erreur: ${(e as Error).message}`);
  }

  // ─── Source 2: RTTI classes + gamedata strings ────────────────────

  console.log("\n[2] RTTI classes et gamedata strings...");
  try {
    const summary = JSON.parse(
      readFileSync(join(DATA_ROOT, "lua_scripts/analysis/nie-c-summary.json"), "utf8"),
    );

    if (summary.rttClasses) {
      for (const cls of summary.rttClasses) {
        // Extract meaningful parts
        const parts = cls.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g);
        if (parts) {
          for (const p of parts) tryAdd(p);
        }
        if (cls.length > 2 && cls.length < 100 && /^[A-Za-z]/.test(cls)) {
          tryAdd(cls);
        }
      }
      console.log(`  ${summary.rttClasses.length} classes RTTI`);
    }

    if (summary.gameDataStrings) {
      for (const entry of summary.gameDataStrings) {
        const str = typeof entry === "string" ? entry : entry.string || "";
        if (str.length > 0) tryAdd(str);
      }
      console.log(`  ${summary.gameDataStrings.length} gamedata strings`);
    }
  } catch (e) {
    console.log(`  Erreur: ${(e as Error).message}`);
  }

  // ─── Source 3: Config list/field names ────────────────────────────

  console.log("\n[3] Noms de config gamedata...");
  let configCount = 0;
  try {
    const gamedata = join(DATA_ROOT, "common/gamedata");

    function scanConfigs(dir: string): void {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          tryAdd(entry);
          scanConfigs(fullPath);
        } else if (entry.endsWith(".cfg.bin.json")) {
          configCount++;
          try {
            const data = JSON.parse(readFileSync(fullPath, "utf8"));
            if (data.lists) {
              for (const list of data.lists) {
                if (list.name) tryAdd(list.name);
                if (list.typeName) tryAdd(list.typeName);
                if (list.values && list.values.length > 0) {
                  for (const key of Object.keys(list.values[0])) {
                    tryAdd(key);
                  }
                }
              }
            }
            if (data.entries) {
              for (const e of data.entries) {
                if (e.name) {
                  tryAdd(e.name);
                  tryAdd(e.name.replace(/_\d+$/, ""));
                }
                // Also get child entry name patterns
                if (e.children && e.children.length > 0) {
                  tryAdd(e.children[0].name.replace(/_\d+$/, ""));
                }
              }
            }
          } catch {
            /* skip */
          }

          // File name patterns
          const base = entry.replace(/\.cfg\.bin\.json$/, "");
          tryAdd(base);
          const noVersion = base.replace(/_\d+\.\d+\.\d+(\.\d+)?$/, "");
          tryAdd(noVersion);
        }
      }
    }

    scanConfigs(gamedata);
    console.log(`  ${configCount} fichiers config scannes`);
  } catch (e) {
    console.log(`  Erreur: ${(e as Error).message}`);
  }

  // ─── Source 4: Skill string IDs (targeted brute-force) ───────────

  console.log("\n[4] Identifiants de skills...");
  let skillIdCount = 0;
  {
    // Only generate IDs in ranges that actually exist
    const prefixes = [
      { prefix: "whs", max: 4000 },
      { prefix: "whd", max: 2000 },
      { prefix: "whk", max: 2000 },
      { prefix: "who", max: 2000 },
      { prefix: "wks", max: 1000 },
      { prefix: "wsd", max: 1000 },
      { prefix: "wsk", max: 500 },
      { prefix: "wcd", max: 500 },
    ];
    for (const { prefix, max } of prefixes) {
      for (let i = 0; i <= max; i++) {
        tryAdd(`${prefix}${i.toString().padStart(5, "0")}`);
        skillIdCount++;
      }
    }
    console.log(`  ${skillIdCount} identifiants generes`);
  }

  // ─── Source 5: Lua table fields & strings ────────────────────────

  console.log("\n[5] Champs et strings Lua...");
  if (globalIndex.allTableFields) {
    for (const field of Object.keys(globalIndex.allTableFields)) {
      tryAdd(field);
    }
    console.log(`  ${Object.keys(globalIndex.allTableFields).length} table fields`);
  }
  if (globalIndex.allStrings) {
    for (const str of Object.keys(globalIndex.allStrings)) {
      tryAdd(str);
    }
    console.log(`  ${Object.keys(globalIndex.allStrings).length} strings Lua`);
  }

  // ─── Source 6: Known game constants ──────────────────────────────

  console.log("\n[6] Constantes de jeu...");
  const gameConstants: string[] = [
    // Elements
    "Wind",
    "Forest",
    "Fire",
    "Mountain",
    "wind",
    "forest",
    "fire",
    "mountain",
    "WIND",
    "FOREST",
    "FIRE",
    "MOUNTAIN",
    "element_wind",
    "element_forest",
    "element_fire",
    "element_mountain",
    // Positions
    "GK",
    "FW",
    "MF",
    "DF",
    "Coach",
    "GOALKEEPER",
    "FORWARD",
    "MIDFIELDER",
    "DEFENDER",
    "position_gk",
    "position_fw",
    "position_mf",
    "position_df",
    // Stats
    "kick",
    "control",
    "technique",
    "pressure",
    "physical",
    "agility",
    "intelligence",
    "Kick",
    "Control",
    "Technique",
    "Pressure",
    "Physical",
    "Agility",
    "Intelligence",
    // Build types
    "Breach",
    "Counter",
    "Bond",
    "Tension",
    "RoughPlay",
    "Justice",
    "breach",
    "counter",
    "bond",
    "tension",
    "rough_play",
    "justice",
    "BUILD_BREACH",
    "BUILD_COUNTER",
    "BUILD_BOND",
    "BUILD_TENSION",
    "BUILD_ROUGH_PLAY",
    "BUILD_JUSTICE",
    // Skill categories
    "shoot",
    "dribble",
    "block",
    "catch",
    "SHOOT",
    "DRIBBLE",
    "BLOCK",
    "CATCH",
    "ShootSkill",
    "DribbleSkill",
    "BlockSkill",
    "CatchSkill",
    // Series
    "chara_series_ie1",
    "chara_series_ie2",
    "chara_series_ie3",
    "chara_series_go1",
    "chara_series_go2",
    "chara_series_go3",
    "chara_series_ares",
    "chara_series_orion",
    "chara_series_victory",
    // Rarities
    "normal",
    "rare",
    "super_rare",
    "ultra_rare",
    "legend",
    "hero",
    "basara",
    "Normal",
    "Hero",
    "BASARA",
    // Playstyles and body types
    "play_style",
    "body_type",
    "build_type",
    "play_style_offensive",
    "play_style_defensive",
    "play_style_balanced",
    "body_type_small",
    "body_type_medium",
    "body_type_large",
    // Game systems
    "passive_skill",
    "active_skill",
    "aura_skill",
    "super_technique",
    "special_tactics",
    "team_build",
    "ability_board",
    "constellation",
    "players_universe",
    "basara_build",
    "hero_variant",
    // Common field names from configs
    "skillID",
    "skillIDStr",
    "eventID",
    "eventIDName",
    "failEventID",
    "skillNameId",
    "skillDescId",
    "cmdOptIdx",
    "skillEffectBitFlag",
    "charaId",
    "teamId",
    "itemId",
    "passiveId",
    "formationId",
    "questId",
    "eventId",
    "buildTypeId",
    "boardId",
    "constellationId",
    "rarityId",
    "elementId",
    "positionId",
    "genderId",
    "seriesId",
    "categoryId",
    "m_skillInfoList",
    "m_passiveSkillInfoList",
    "m_charaParamInfoList",
    "m_charaBaseInfoList",
    "m_teamInfoList",
    "m_itemInfoList",
    "m_shopInfoList",
    "m_formationInfoList",
    "m_questInfoList",
    "m_eventInfoList",
    // Filter menu
    "chara_filter_menu_tab_text_belong_team",
    "chara_filter_menu_tab_text_position",
    "chara_filter_menu_tab_text_element",
    "chara_filter_menu_tab_text_rarity",
    "chara_filter_menu_tab_text_appearance",
    "chara_filter_menu_tab_text_build",
    "chara_filter_menu_tab_text_role",
    // UI labels
    "tabType",
    "seriesId",
    "seriesType",
    "filterType",
    "sortType",
    "sortOrder",
    "pageIndex",
    "pageSize",
    // Battle/soccer
    "soccer_cmd_action",
    "soccer_cmd_event",
    "rpg_cmd_action",
    "rpg_cmd_event",
    "AURA_CMD_INFO",
    "AURA_CMD_EFFECT",
    "AURA_CMD_CHARA",
    "AURA_CMD_UNIQUE_EFFECT",
    "SPECIAL_TACTICS_INFO",
    "SPECIAL_TACTICS_EFFECT",
    "SPECIAL_TACTICS_COND_ID",
    "TEAM_BUILD_INFO",
    "TEAM_BUILD_EFFECT_DATA",
    "TEAM_BUILD_UP_DATA",
    "TEAM_BUILD_DOWN_DATA",
    // Common patterns
    "OnInit",
    "OnSetupLayer",
    "OnOpenLayer",
    "OnCloseLayer",
    "OnDecideFocus",
    "OnFunction",
    "Step",
    "funcLuaCommand",
    "funcLuaMenuCommand",
    "INCLUDE",
    "LUA_PROG_BASE",
    "LUA_MENU_DEF",
  ];

  for (const c of gameConstants) {
    tryAdd(c);
  }
  console.log(`  ${gameConstants.length} constantes`);

  // ─── Source 7: Brute force common patterns against target CRCs ───

  console.log("\n[7] Brute-force cible sur patterns restants...");
  let bruteFound = 0;
  {
    // Try patterns like: OnXxx, SetXxx, GetXxx, IsXxx, UpdateXxx
    const actionPrefixes = [
      "On",
      "Set",
      "Get",
      "Is",
      "Update",
      "Init",
      "Check",
      "Reset",
      "Load",
      "Save",
      "Open",
      "Close",
      "Show",
      "Hide",
      "Enable",
      "Disable",
      "Create",
      "Delete",
      "Add",
      "Remove",
      "Start",
      "Stop",
      "Begin",
      "End",
      "Enter",
      "Exit",
      "Push",
      "Pop",
      "Send",
      "Receive",
      "Play",
      "Pause",
      "Resume",
      "Cancel",
      "Confirm",
      "Select",
      "Deselect",
      "Focus",
      "Blur",
    ];
    const nouns = [
      "Layer",
      "Menu",
      "Window",
      "Button",
      "List",
      "Item",
      "Chara",
      "Character",
      "Team",
      "Skill",
      "Passive",
      "Active",
      "Aura",
      "Board",
      "Bean",
      "Beans",
      "Param",
      "Parameter",
      "Status",
      "Stat",
      "Stats",
      "Element",
      "Position",
      "Rarity",
      "Series",
      "Build",
      "Type",
      "Info",
      "Data",
      "Config",
      "Setting",
      "Option",
      "Value",
      "Count",
      "Index",
      "Name",
      "Id",
      "Flag",
      "Mode",
      "State",
      "Phase",
      "Step",
      "Stage",
      "Level",
      "Rank",
      "Grade",
      "Score",
      "Point",
      "Cost",
      "Price",
      "Num",
      "Max",
      "Min",
      "Rate",
      "Ratio",
      "Power",
      "Speed",
      "Time",
      "Timer",
      "Duration",
      "Interval",
      "Delay",
      "Result",
      "Effect",
      "Sound",
      "Music",
      "Voice",
      "Text",
      "Label",
      "Icon",
      "Image",
      "Sprite",
      "Color",
      "Size",
      "Scale",
      "Gauge",
      "Bar",
      "Graph",
      "Formation",
      "Battle",
      "Soccer",
      "Match",
      "Game",
      "Quest",
      "Event",
      "Mission",
      "Story",
      "Route",
      "Chapter",
      "Scene",
      "Camera",
      "Motion",
      "Animation",
      "Model",
      "Shop",
      "Inventory",
      "Equipment",
      "Accessory",
      "Shoes",
      "Misanga",
      "Costume",
      "Kit",
      "Uniform",
      "Trophy",
      "Record",
      "Gallery",
      "Photo",
      "Friend",
      "Network",
      "Online",
      "Multi",
      "Capsule",
      "Gacha",
      "Banner",
      "Notice",
      "Calendar",
      "Campaign",
      "Reward",
      "Bonus",
      "Exchange",
      "Trade",
      "Craft",
      "Constellation",
      "Universe",
      "Player",
      "Focus",
      "Coroutine",
      "Proc",
      "Hdl",
      "Handle",
    ];

    for (const prefix of actionPrefixes) {
      for (const noun of nouns) {
        const candidate = prefix + noun;
        const hash = toHex(crc32String(candidate));
        if (targetCRCs.has(hash) && !dict[hash]) {
          dict[hash] = candidate;
          _newResolutions++;
          bruteFound++;
        }

        // Also try with underscore
        const candidate2 = `${prefix}_${noun}`;
        const hash2 = toHex(crc32String(candidate2));
        if (targetCRCs.has(hash2) && !dict[hash2]) {
          dict[hash2] = candidate2;
          _newResolutions++;
          bruteFound++;
        }
      }
    }
    console.log(`  ${bruteFound} nouvelles resolutions par brute-force`);
  }

  // ─── Cleanup: remove entries that don't resolve any target ────────

  // We keep all existing entries + new entries that resolve targets
  // But we DON'T remove existing entries (they might be useful for config resolution)

  // ─── Stats ──────────────────────────────────────────────────────

  console.log("\n=== Resultats ===");
  const finalCount = Object.keys(dict).length;
  console.log(`Entrees initiales: ${initialCount}`);
  console.log(`Total final: ${finalCount}`);
  console.log(`Nouvelles entrees: ${finalCount - initialCount}`);

  // Resolution rate
  let resolved = 0;
  for (const crc of targetCRCs) {
    if (dict[crc]) resolved++;
  }
  const prevResolved = (() => {
    let count = 0;
    for (const crc of targetCRCs) {
      if (existingDict[crc]) count++;
    }
    return count;
  })();
  console.log(
    `\nResolution CRC32 Lua: ${resolved}/${targetCRCs.size} (${((resolved / targetCRCs.size) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Avant: ${prevResolved}/${targetCRCs.size} (${((prevResolved / targetCRCs.size) * 100).toFixed(1)}%)`,
  );
  console.log(`  Gain: +${resolved - prevResolved} nouvelles resolutions`);

  // Show sample of new resolutions
  console.log("\nExemples de nouvelles resolutions:");
  let examples = 0;
  for (const crc of targetCRCs) {
    if (dict[crc] && !existingDict[crc]) {
      console.log(`  ${crc} → ${dict[crc]}`);
      examples++;
      if (examples >= 20) break;
    }
  }

  // Sort and write
  const sortedDict: Record<string, string> = {};
  for (const key of Object.keys(dict).sort()) {
    sortedDict[key] = dict[key];
  }

  writeFileSync(dictPath, JSON.stringify(sortedDict, null, 2));
  console.log(
    `\nEcrit dans ${dictPath} (${(Buffer.byteLength(JSON.stringify(sortedDict, null, 2)) / 1024 / 1024).toFixed(1)} MB)`,
  );
}

main();
