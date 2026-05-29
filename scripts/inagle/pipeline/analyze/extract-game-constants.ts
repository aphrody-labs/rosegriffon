/**
 * @file extract-game-constants.ts
 * @description Extrait les constantes de jeu completes depuis les scripts Lua decompiles.
 * Parse chara_filter_menu pour : series, elements, positions, rarities,
 * body types (playstyles), build types, genders, roles.
 * Parse soccer_parameter_menu pour : teamBuildNameTextIds.
 * Resout les labels japonais depuis menu_text.cfg.bin.json.
 *
 * Usage: bun src/scripts/analyze/extract-game-constants.ts
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = import.meta.path;
const __dirname = dirname(__filename);
const DATA_ROOT = join(__dirname, "../../../data");

// ─── menu_text CRC32 → texte japonais ────────────────────────────────

function buildMenuTextDict(): Map<string, string> {
  const dict = new Map<string, string>();
  const path = join(DATA_ROOT, "common/text/ja/menu_text.cfg.bin.json");
  if (!existsSync(path)) return dict;

  const data = JSON.parse(readFileSync(path, "utf8"));

  function walk(node: any) {
    const vars = node?.variables ?? [];
    const name: string = node?.name ?? "";
    if (!name.startsWith("TEXT_INFO_BEGIN") && name.startsWith("TEXT_INFO") && vars.length >= 3) {
      const crc = (Number(vars[0].value) >>> 0).toString(16).padStart(8, "0");
      dict.set(`0x${crc}`, vars[2].value as string);
    }
    for (const child of node?.children ?? []) walk(child);
  }

  for (const entry of data?.entries ?? []) walk(entry);
  return dict;
}

const MENU_TEXT = buildMenuTextDict();

function resolveText(crc32hex: string): string | null {
  return MENU_TEXT.get(crc32hex.toLowerCase()) ?? null;
}

// CRC32
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

const encoder = new TextEncoder();
function crc32String(str: string): number {
  let crc = 0xffffffff;
  const data = encoder.encode(str);
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xff];
  }
  return ~crc >>> 0;
}

function toHex(n: number): string {
  return `0x${(n >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

// ─── Parse chara_filter_menu ─────────────────────────────────────────

interface FilterConstant {
  name: string;
  crc32: string;
  index?: number;
  textureName?: string;
  textName?: string;
  fontStyleName?: string;
}

function parseFilterMenu(): {
  tabs: FilterConstant[];
  series: FilterConstant[];
  positions: FilterConstant[];
  elements: FilterConstant[];
  rarities: FilterConstant[];
  genders: FilterConstant[];
  bodyTypes: FilterConstant[];
  buildTypes: FilterConstant[];
  roles: FilterConstant[];
} {
  const luaPath = join(
    DATA_ROOT,
    "lua_scripts/decompiled/p0-critical/chara_filter_menu_4.00.01.00.lua",
  );
  const content = readFileSync(luaPath, "utf8");

  const lines = content.split("\n");

  // Pattern 1 : bloc d'initialisation (lignes 1-490)
  // L_x = CRC32 \n L_y = "string" \n L_x = L_x(L_y)
  const allStrings: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*\w+ = "([^"]+)"/);
    if (match && i > 0 && lines[i - 1].match(/= CRC32$/)) {
      allStrings.push(match[1]);
    }
  }

  // Pattern 2 : inline dans les fonctions (lignes 490+)
  // (upval_X.CRC32)("string") ou (upval_X_Y_Z.CRC32)("string")
  const inlineRegex = /\(upval[^)]*\.CRC32\)\("([^"]+)"\)/g;
  let inlineMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
  while ((inlineMatch = inlineRegex.exec(content)) !== null) {
    allStrings.push(inlineMatch[1]);
  }

  // Categorize strings by prefix
  const tabs: FilterConstant[] = [];
  const series: FilterConstant[] = [];
  const positions: FilterConstant[] = [];
  const elements: FilterConstant[] = [];
  const rarities: FilterConstant[] = [];
  const genders: FilterConstant[] = [];
  const bodyTypes: FilterConstant[] = [];
  const buildTypes: FilterConstant[] = [];
  const roles: FilterConstant[] = [];

  const seen = new Set<string>();
  for (const str of allStrings) {
    if (seen.has(str)) continue;
    seen.add(str);

    const entry: FilterConstant = {
      name: str,
      crc32: toHex(crc32String(str)),
    };

    if (str.includes("_dmy")) {
      // Placeholders UI (dummy slots) — ignorer
    } else if (str.startsWith("chara_filter_menu_tab_text_")) {
      tabs.push(entry);
    } else if (str.startsWith("chara_series_")) {
      series.push(entry);
    } else if (str.startsWith("icon_cmd_position")) {
      positions.push(entry);
    } else if (str.startsWith("chara_filter_menu_element_")) {
      elements.push(entry);
    } else if (str.startsWith("gtxt_rarity")) {
      rarities.push(entry);
    } else if (str.startsWith("chara_filter_menu_gender_")) {
      genders.push(entry);
    } else if (str.startsWith("chara_filter_menu_body_category_")) {
      bodyTypes.push(entry);
    } else if (str.startsWith("team_build_type_")) {
      buildTypes.push(entry);
    } else if (str.startsWith("chara_filter_menu_build_")) {
      roles.push(entry);
    }
  }

  return {
    tabs,
    series,
    positions,
    elements,
    rarities,
    genders,
    bodyTypes,
    buildTypes,
    roles,
  };
}

// ─── Parse soccer_parameter_menu ─────────────────────────────────────

interface TeamBuildConstant {
  index: number;
  nameTextCrc32: string;
  resolvedName: string | null;
}

function parseTeamBuilds(): TeamBuildConstant[] {
  const luaPath = join(DATA_ROOT, "lua_scripts/decompiled/soccer_parameter_menu_3.00.22.00.lua");
  const content = readFileSync(luaPath, "utf8");
  const lines = content.split("\n");

  // Load CRC32 dictionary for resolution
  const dictPath = join(DATA_ROOT, "lua_scripts/analysis/crc32-dictionary.json");
  const dict: Record<string, string> = JSON.parse(readFileSync(dictPath, "utf8"));

  const builds: TeamBuildConstant[] = [];

  // Parse pattern: L_x.teamBuildNameTextId = NUMBER \n L_y[INDEX] = L_x
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/\.teamBuildNameTextId\s*=\s*(\d+)/);
    if (match) {
      const crc = parseInt(match[1], 10) >>> 0;
      const hex = toHex(crc);

      // Find the index assignment: L_y[INDEX] = L_x
      let idx = -1;
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const idxMatch = lines[j].match(/\[(\d+)\]/);
        if (idxMatch) {
          idx = parseInt(idxMatch[1], 10);
          break;
        }
      }

      builds.push({
        index: idx,
        nameTextCrc32: hex,
        resolvedName: dict[hex] || null,
      });
    }
  }

  return builds;
}

// ─── Map known values to game constants ──────────────────────────────

function main() {
  console.log("=== Extraction des constantes de jeu ===\n");

  const filter = parseFilterMenu();
  const teamBuilds = parseTeamBuilds();

  // Known mappings from the Lua code
  const gameConstants = {
    // Mapping listItemType → categorie de filtre (source : DecompiledFunction_0_9 + _inc)
    listItemTypeMapping: [
      { listItemType: 1, category: "series", note: "Apparence / serie de jeu" },
      { listItemType: 2, category: "belongTeam", note: "Equipe d'appartenance (special)" },
      { listItemType: 3, category: "position", note: "Poste du joueur" },
      { listItemType: 4, category: "element", note: "Element (Vent/Foret/Feu/Montagne)" },
      {
        listItemType: 5,
        category: "rarity",
        note: "Rarete — value interne commence a 0 (offset +1 vers tableau)",
      },
      { listItemType: 6, category: "gender", note: "Genre (Masculin/Feminin/Inconnu)" },
      {
        listItemType: 7,
        category: "bodyType",
        note: "Morphologie (Normal/Petit/Grand/Svelte/Muscle/Petit-rond)",
      },
      {
        listItemType: 8,
        category: "reserved",
        note: "Jamais peuple — slot reserve (favoris ou DLC futur)",
      },
      { listItemType: 9, category: "selectAll", note: "Tout selectionner (meta-categorie)" },
      {
        listItemType: 10,
        category: "buildType",
        note: "Type de build strategique — value interne commence a 0 (offset +1)",
      },
      { listItemType: 11, category: "role", note: "Role : joueur / entraineur / manager" },
    ],

    // Onglets du filtre — mode normal (7 onglets, L0_1 dans le Lua)
    filterTabs: filter.tabs.map((t, i) => ({
      ...t,
      tabIconType: i,
      textJa: resolveText(t.crc32),
      description:
        [
          "Equipe d'appartenance",
          "Position",
          "Element",
          "Rarete",
          "Apparence (serie)",
          "Build (type de build)",
          "Role (joueur/coach/manager)",
        ][i] || "Inconnu",
    })),

    // Onglets mode Universe search (5 onglets, L1_1 — sans tabIconType 3=Rarete et 5=Build)
    filterTabsUniverse: [0, 1, 2, 4, 6].map((tabIconType, i) => ({
      tabIconType,
      description:
        ["Equipe d'appartenance", "Position", "Element", "Apparence (serie)", "Role"][i] ||
        "Inconnu",
    })),

    // Icones des onglets (source : SetTabIcon, Function 0_11)
    // Chemin : #/menu/200_icon/16_icon_list_tab_filter/<LG>/icon_list_tab_filter.g4tx
    tabIcons: Array.from({ length: 7 }, (_, i) => ({
      tabIconType: i,
      iconOn: `icon_list_tab_filter${String(i + 1).padStart(2, "0")}`,
      iconOff: `icon_list_tab_filter${String(i + 1).padStart(2, "0")}_off`,
      crc32On: toHex(crc32String(`icon_list_tab_filter${String(i + 1).padStart(2, "0")}`)),
      crc32Off: toHex(crc32String(`icon_list_tab_filter${String(i + 1).padStart(2, "0")}_off`)),
    })),

    series: filter.series.map((s, i) => ({
      ...s,
      index: i + 1,
      // Pas de textJa — affiches par icone uniquement (bannieres de serie)
      assetOnly: true,
      label:
        [
          "Inazuma Eleven",
          "Inazuma Eleven 2",
          "Inazuma Eleven 3",
          "Inazuma Eleven GO",
          "Inazuma Eleven GO Chrono Stone",
          "Inazuma Eleven GO Galaxy",
          "Inazuma Eleven Ares",
          "Inazuma Eleven Orion",
          "Inazuma Eleven Victory Road",
        ][i] || "Inconnu",
    })),

    elements: filter.elements.map((e, i) => ({
      ...e,
      elementId: i + 1,
      textJa: resolveText(e.crc32),
      label: ["Vent", "Foret", "Feu", "Montagne"][i] || "Inconnu",
      internalName: ["Wind", "Forest", "Fire", "Mountain"][i] || "?",
    })),

    positions: filter.positions.map((p, i) => ({
      ...p,
      // Ordre UI du filtre : DF(icon04)=index0, FW(icon01)=index1, MF(icon02)=index2, GK(icon03)=index3
      // IDs internes : GK=1, FW=2, MF=3, DF=4
      // Pas de textJa — positions affichees par icone, format string runtime : icon_cmd_position0%1u
      assetOnly: true,
      runtimeFormat: "icon_cmd_position0%1u",
      label: ["Defenseur", "Avant", "Milieu de terrain", "Gardien"][i] || "Inconnu",
    })),

    rarities: filter.rarities.map((r, i) => ({
      ...r,
      // gtxt_rarity01_01 a gtxt_rarity01_10 (pas de _09)
      // listItemType=5, value interne = index (0-base), offset +1 pour acceder au tableau
      // Pas de textJa — rarites affichees par icone, format string runtime : gtxt_rarity01_%02u
      assetOnly: true,
      runtimeFormat: "gtxt_rarity01_%02u",
      rarityLabel:
        [
          "Normal",
          "En Progression",
          "Experimente",
          "Emerite",
          "Legendaire",
          "Legendaire+",
          "Legendaire++",
          "Legendaire+++",
          "Hero",
        ][i] || "Inconnu",
      rarityId: [0, 1, 2, 3, 4, 5, 6, 7, 10][i] ?? -1,
      valueInternal: i,
    })),

    genders: filter.genders.map((g, i) => ({
      ...g,
      genderId: i + 1,
      textJa: resolveText(g.crc32),
      label: ["Masculin", "Feminin", "Inconnu"][i] || "?",
    })),

    bodyTypes: filter.bodyTypes.map((b) => {
      const internal = b.name.replace("chara_filter_menu_body_category_", "");
      const labelMap: Record<string, string> = {
        normal: "Normal",
        small: "Petit gabarit",
        big: "Grand gabarit",
        tall: "Elance",
        muscle: "Muscle",
        smallfat: "Petit et rond",
      };
      return {
        ...b,
        textJa: resolveText(b.crc32),
        label: labelMap[internal] ?? internal,
        internalName: internal,
      };
    }),

    buildTypes: filter.buildTypes.map((bt, i) => ({
      ...bt,
      buildTypeId: i,
      // listItemType=10, value interne = index (0-base), offset +1 pour acceder au tableau
      valueInternal: i,
      textJa: resolveText(bt.crc32),
      label:
        [
          "Force Win (Breach)",
          "Counter",
          "Kizuna (Bond)",
          "Tension",
          "Rough Play",
          "Fair Play (Justice)",
        ][i] || "Inconnu",
      internalName: bt.name.replace("team_build_type_", ""),
    })),

    roles: filter.roles.map((r) => ({
      ...r,
      textJa: resolveText(r.crc32),
      internalName: r.name.replace("chara_filter_menu_build_", ""),
      label: r.name.includes("player")
        ? "Joueur"
        : r.name.includes("coach")
          ? "Entraineur"
          : r.name.includes("manager")
            ? "Manager"
            : "Inconnu",
    })),

    teamBuildNameTextIds: teamBuilds.map((tb) => ({
      ...tb,
      description:
        tb.index === 0
          ? "Force Win (Breach)"
          : tb.index === 1
            ? "Counter"
            : tb.index === 2
              ? "Kizuna (Bond)"
              : tb.index === 3
                ? "Tension"
                : tb.index === 4
                  ? "Rough Play"
                  : tb.index === 5
                    ? "Fair Play (Justice)"
                    : tb.index === 6
                      ? "Total (aucun build specifique)"
                      : "Inconnu",
    })),

    playstyles: [
      {
        name: "play_style_offensive",
        label: "Offensif",
        note: "Non confirme dans les Lua decompiles - extrapole depuis les configs binaires",
      },
      {
        name: "play_style_defensive",
        label: "Defensif",
        note: "Non confirme dans les Lua decompiles",
      },
      {
        name: "play_style_balanced",
        label: "Equilibre",
        note: "Non confirme dans les Lua decompiles",
      },
    ],

    stats: [
      {
        name: "kick",
        label: "Tir",
        crc32: toHex(crc32String("kick")),
      },
      {
        name: "control",
        label: "Controle",
        crc32: toHex(crc32String("control")),
      },
      {
        name: "technique",
        label: "Technique",
        crc32: toHex(crc32String("technique")),
      },
      {
        name: "pressure",
        label: "Pression",
        crc32: toHex(crc32String("pressure")),
      },
      {
        name: "physical",
        label: "Physique",
        crc32: toHex(crc32String("physical")),
      },
      {
        name: "agility",
        label: "Vitesse",
        crc32: toHex(crc32String("agility")),
      },
      {
        name: "intelligence",
        label: "Intelligence",
        crc32: toHex(crc32String("intelligence")),
      },
    ],

    // Classes C++ du filtre dans nie.c (source : iecode nie search)
    engineClasses: [
      { class: "CMenuListViewCharaFilter", functions: ["FUN_14002d800", "FUN_1400aab00"] },
      { class: "CMenuListViewCharaBankFilter", functions: ["FUN_14002d900", "FUN_140c78950"] },
      { class: "CMenuListViewSoccerSpiritFilter", functions: ["FUN_140f8f580", "FUN_140ffcd80"] },
    ],

    // Callbacks engine de reception des filtres Lua → C++
    engineCallbacks: [
      {
        name: "OnBeforeReceiveFilterParam",
        functions: ["FUN_14107cd10", "FUN_14107d780", "FUN_14107d9f0"],
      },
      {
        name: "OnReceiveFilterParam",
        functions: ["FUN_14107cd10", "FUN_14107d780", "FUN_14107d9f0"],
      },
      {
        name: "OnAfterReceiveFilterParam",
        functions: ["FUN_14107cd10", "FUN_14107d780", "FUN_14107d9f0"],
      },
    ],

    skillCategories: [
      {
        name: "shoot",
        categoryId: 1,
        label: "Tir",
        crc32: toHex(crc32String("shoot")),
      },
      {
        name: "dribble",
        categoryId: 2,
        label: "Dribble",
        crc32: toHex(crc32String("dribble")),
      },
      {
        name: "block",
        categoryId: 3,
        label: "Blocage",
        crc32: toHex(crc32String("block")),
      },
      {
        name: "catch",
        categoryId: 4,
        label: "Arret",
        crc32: toHex(crc32String("catch")),
      },
    ],
  };

  // Summary
  console.log("Onglets (normal):", gameConstants.filterTabs.length);
  console.log("Onglets (universe):", gameConstants.filterTabsUniverse.length);
  console.log("Icones onglets:", gameConstants.tabIcons.length);
  console.log("Series:", gameConstants.series.length);
  console.log("Elements:", gameConstants.elements.length);
  console.log("Positions:", gameConstants.positions.length);
  console.log("Raretes:", gameConstants.rarities.length);
  console.log("Genres:", gameConstants.genders.length);
  console.log("Types de corps:", gameConstants.bodyTypes.length);
  console.log("Types de build:", gameConstants.buildTypes.length);
  console.log("Roles:", gameConstants.roles.length);
  console.log("Build text IDs:", gameConstants.teamBuildNameTextIds.length);
  console.log("Styles de jeu:", gameConstants.playstyles.length);
  console.log("Stats:", gameConstants.stats.length);
  console.log("Categories de skill:", gameConstants.skillCategories.length);

  // Write
  const outPath = join(DATA_ROOT, "lua_scripts/analysis/game-constants.json");
  writeFileSync(outPath, JSON.stringify(gameConstants, null, 2));
  console.log("\nEcrit dans", outPath);
}

main();
