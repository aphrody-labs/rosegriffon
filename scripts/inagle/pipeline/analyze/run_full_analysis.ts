import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENTRIES_DIR = resolve(import.meta.dirname, "../../../../packages/inagle/src/entries");

// Helper to load entry JSON
function loadEntryJson<T>(filename: string): T {
  const filePath = resolve(ENTRIES_DIR, filename);
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch (err) {
    console.error(`Failed to load ${filename}:`, err);
    return [] as unknown as T;
  }
}

// Structs
interface CharacterEntry {
  index: number;
  charaParamId: string;
  charaId: string;
  names: { ja: string; en: string; fr: string; romanized?: any };
  position: string;
  positionRaw: number;
  subPosition?: string;
  element: string;
  elementRaw: number;
  rarity: string;
  rarityCode: number;
  gender: number;
  skills: Array<{ skillId: string; learnLevel: number }>;
  stats: any;
  slug: string;
  internalCode: string;
  image?: string | null;
  descriptions: { en?: string; fr?: string; ja?: string };
  zukanHash?: string | null;
  zukanOrder?: number;
  seriesId: string;
  series: string;
  teams: Array<{ id: string; names: any; seasons: string[] }>;
}

interface SkillEntry {
  skillID: string;
  skillIDStr: string;
  element: number;
  category: number;
  internalCode: string;
  name_EN: string;
  name_FR: string;
  name_JA: string;
  skillType: string;
  displayName: string;
  elementName: { en: string; fr: string; ja: string };
  categoryName: { en: string; fr: string; ja: string };
  image?: string;
  consumeTp?: number;
  power_min?: number;
  power_max?: number;
}

interface TeamEntry {
  teamId: string;
  teamIdStr: string;
  name: string;
  displayName: string;
  name_FR: string;
  name_EN: string;
  name_JA: string;
}

interface ItemEntry {
  itemId: string;
  internalCode: string;
  name_EN: string;
  name_FR: string;
  name_JA: string;
}

interface BasaraEntry {
  charaParamId: string;
  boardId?: string;
  [key: string]: any;
}

interface AuraEntry {
  auraId?: string;
  charaParamId?: string;
  [key: string]: any;
}

interface MiximaxEntry {
  miximaxId?: string;
  baseCharaParamId?: string;
  auraCharaParamId?: string;
  [key: string]: any;
}

function runFullAnalysis() {
  console.log("Loading all database files...");
  const characters = loadEntryJson<CharacterEntry[]>("characters.json");
  const skills = loadEntryJson<SkillEntry[]>("skills.json");
  const teams = loadEntryJson<TeamEntry[]>("teams.json");
  const items = loadEntryJson<ItemEntry[]>("items.json");
  const basara = loadEntryJson<BasaraEntry[]>("basara.json");
  const auras = loadEntryJson<AuraEntry[]>("auras.json");
  const miximax = loadEntryJson<MiximaxEntry[]>("miximax.json");

  console.log(`Loaded ${characters.length} characters.`);
  console.log(`Loaded ${skills.length} skills.`);
  console.log(`Loaded ${teams.length} teams.`);
  console.log(`Loaded ${items.length} items.`);
  console.log(`Loaded ${basara.length} basara entries.`);
  console.log(`Loaded ${auras.length} auras.`);
  console.log(`Loaded ${miximax.length} miximax entries.`);

  const skillIds = new Set(skills.map(s => s.skillID.toLowerCase()));
  const teamIds = new Set(teams.map(t => t.teamId.toLowerCase()));
  const charaParamIds = new Set(characters.map(c => c.charaParamId.toLowerCase()));
  const charaIds = new Set(characters.map(c => c.charaId.toLowerCase()));

  // 1. DUPLICATE DETECTION
  console.log("\nAnalyzing duplicates...");
  const groups = new Map<string, CharacterEntry[]>();
  for (const c of characters) {
    const name = c.names.fr || c.names.en || c.names.ja || "Unknown";
    const key = `${name.trim().toLowerCase()}|${c.position}|${c.element}|${c.gender}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(c);
  }

  const trueDuplicates: any[] = [];
  const variantDuplicates: any[] = [];

  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      // Base codes split by '_'
      const baseCodes = new Set(group.map(c => c.internalCode.split('_')[0]));
      // Also check if internalCodes are actually identical or represent variants
      // If baseCodes size is 1, they all belong to the same base character (e.g. c01000100).
      // If baseCodes size > 1, they belong to different base characters (e.g. c01000100 and c02000200).
      const summaryGroup = group.map(c => ({
        index: c.index,
        charaParamId: c.charaParamId,
        charaId: c.charaId,
        name: c.names.fr || c.names.en || c.names.ja,
        internalCode: c.internalCode,
        position: c.position,
        element: c.element,
        gender: c.gender,
        rarity: c.rarity,
        rarityCode: c.rarityCode
      }));

      if (baseCodes.size > 1) {
        trueDuplicates.push({ key, characters: summaryGroup });
      } else {
        variantDuplicates.push({ key, characters: summaryGroup });
      }
    }
  }

  // 2. MISSING STATS DETECTION
  console.log("Analyzing missing stats...");
  const missingStats: any[] = [];
  for (const c of characters) {
    if (!c.stats) {
      missingStats.push({
        charaParamId: c.charaParamId,
        name: c.names.fr || c.names.en || c.names.ja,
        internalCode: c.internalCode,
        reason: "No stats object at all"
      });
      continue;
    }
    for (const lvl of ["lv1", "lv50", "lv99"]) {
      const statsObj = c.stats[lvl];
      if (!statsObj) {
        missingStats.push({
          charaParamId: c.charaParamId,
          name: c.names.fr || c.names.en || c.names.ja,
          internalCode: c.internalCode,
          reason: `Missing stats for level ${lvl}`
        });
      } else {
        const statKeys = ["kick", "control", "technique", "physical", "pressure", "agility", "intelligence"];
        const zeroStats = statKeys.filter(k => statsObj[k] === undefined || statsObj[k] === null || statsObj[k] === 0);
        if (zeroStats.length > 0) {
          missingStats.push({
            charaParamId: c.charaParamId,
            name: c.names.fr || c.names.en || c.names.ja,
            internalCode: c.internalCode,
            reason: `Stats ${zeroStats.join(", ")} are 0 or null at level ${lvl}`,
            stats: statsObj
          });
        }
      }
    }
  }

  // 3. MISSING IMAGES DETECTION
  console.log("Analyzing missing images...");
  const missingImages: any[] = [];
  for (const c of characters) {
    const img = c.image;
    if (!img || img.trim() === "") {
      missingImages.push({
        charaParamId: c.charaParamId,
        name: c.names.fr || c.names.en || c.names.ja,
        internalCode: c.internalCode,
        imageValue: img,
        reason: "Image field is null or empty"
      });
    } else {
      const imgLower = img.toLowerCase();
      if (
        imgLower.includes("placeholder") ||
        imgLower.includes("default") ||
        imgLower.includes("no_image") ||
        imgLower.includes("fallback") ||
        imgLower.includes("dummy")
      ) {
        missingImages.push({
          charaParamId: c.charaParamId,
          name: c.names.fr || c.names.en || c.names.ja,
          internalCode: c.internalCode,
          imageValue: img,
          reason: "Image is a placeholder/fallback file"
        });
      }
    }
  }

  // 4. INCONSISTENCIES / ANOMALIES
  console.log("Analyzing inconsistencies and anomalies...");
  
  // Broken Skill Refs & Corrupted Learn Levels
  const brokenSkillRefs: any[] = [];
  const corruptedLearnLevels: any[] = [];
  const placeholderSkillRefsCount: Record<string, number> = {};
  
  for (const c of characters) {
    if (c.skills) {
      for (const cs of c.skills) {
        const isPlaceholder = cs.skillId === "0x00000003" || cs.skillId === "0x00000004";
        if (isPlaceholder) {
          placeholderSkillRefsCount[cs.skillId] = (placeholderSkillRefsCount[cs.skillId] || 0) + 1;
        }

        const skillExists = skillIds.has(cs.skillId.toLowerCase());
        if (!skillExists) {
          brokenSkillRefs.push({
            charaParamId: c.charaParamId,
            charaName: c.names.fr || c.names.en || c.names.ja,
            internalCode: c.internalCode,
            skillId: cs.skillId,
            learnLevel: cs.learnLevel,
            isPlaceholder
          });
        }

        if (cs.learnLevel < 0 || cs.learnLevel > 99) {
          corruptedLearnLevels.push({
            charaParamId: c.charaParamId,
            charaName: c.names.fr || c.names.en || c.names.ja,
            internalCode: c.internalCode,
            skillId: cs.skillId,
            learnLevel: cs.learnLevel
          });
        }
      }
    }
  }

  // Broken Team Refs in character objects
  const brokenTeamRefs: any[] = [];
  for (const c of characters) {
    if (c.teams) {
      for (const t of c.teams) {
        if (!teamIds.has(t.id.toLowerCase())) {
          brokenTeamRefs.push({
            charaParamId: c.charaParamId,
            charaName: c.names.fr || c.names.en || c.names.ja,
            teamId: t.id,
            teamNames: t.names
          });
        }
      }
    }
  }

  // Missing Localization names in skills
  const skillsMissingNames: any[] = [];
  for (const s of skills) {
    const missing: string[] = [];
    if (!s.name_EN || s.name_EN.trim() === "") missing.push("EN");
    if (!s.name_FR || s.name_FR.trim() === "") missing.push("FR");
    if (!s.name_JA || s.name_JA.trim() === "") missing.push("JA");
    if (missing.length > 0) {
      skillsMissingNames.push({
        skillID: s.skillID,
        internalCode: s.internalCode,
        displayName: s.displayName,
        missing
      });
    }
  }

  // Missing descriptions in characters
  const charasMissingDescriptions: any[] = [];
  for (const c of characters) {
    const missing: string[] = [];
    if (!c.descriptions.en || c.descriptions.en.trim() === "") missing.push("EN");
    if (!c.descriptions.fr || c.descriptions.fr.trim() === "") missing.push("FR");
    if (!c.descriptions.ja || c.descriptions.ja.trim() === "") missing.push("JA");
    if (missing.length > 0) {
      charasMissingDescriptions.push({
        charaParamId: c.charaParamId,
        internalCode: c.internalCode,
        name: c.names.fr || c.names.en || c.names.ja,
        missing
      });
    }
  }

  // BASARA references integrity check
  const basaraBrokenRefs: any[] = [];
  for (const b of basara) {
    if (!charaParamIds.has(b.charaParamId.toLowerCase())) {
      basaraBrokenRefs.push({
        charaParamId: b.charaParamId,
        reason: "charaParamId in basara.json does not exist in characters.json"
      });
    }
  }

  // Auras references integrity check
  const aurasBrokenRefs: any[] = [];
  for (const a of auras) {
    if (a.charaParamId && !charaParamIds.has(a.charaParamId.toLowerCase())) {
      aurasBrokenRefs.push({
        auraId: a.auraId,
        charaParamId: a.charaParamId,
        reason: "charaParamId in auras.json does not exist in characters.json"
      });
    }
  }

  // Miximax references integrity check
  const miximaxBrokenRefs: any[] = [];
  for (const m of miximax) {
    if (m.baseCharaParamId && !charaParamIds.has(m.baseCharaParamId.toLowerCase())) {
      miximaxBrokenRefs.push({
        miximaxId: m.miximaxId,
        charaParamId: m.baseCharaParamId,
        role: "baseCharaParamId",
        reason: "baseCharaParamId in miximax.json does not exist in characters.json"
      });
    }
    if (m.auraCharaParamId && !charaParamIds.has(m.auraCharaParamId.toLowerCase())) {
      miximaxBrokenRefs.push({
        miximaxId: m.miximaxId,
        charaParamId: m.auraCharaParamId,
        role: "auraCharaParamId",
        reason: "auraCharaParamId in miximax.json does not exist in characters.json"
      });
    }
  }

  // Compile full audit report data
  const finalSummary = {
    counts: {
      characters: characters.length,
      skills: skills.length,
      teams: teams.length,
      items: items.length,
      basara: basara.length,
      auras: auras.length,
      miximax: miximax.length,
      trueDuplicatesGroups: trueDuplicates.length,
      trueDuplicatesTotal: trueDuplicates.reduce((sum, g) => sum + g.characters.length, 0),
      variantDuplicatesGroups: variantDuplicates.length,
      variantDuplicatesTotal: variantDuplicates.reduce((sum, g) => sum + g.characters.length, 0),
      missingStats: missingStats.length,
      missingImages: missingImages.length,
      brokenSkillRefs: brokenSkillRefs.length,
      brokenSkillRefsNonPlaceholder: brokenSkillRefs.filter(b => !b.isPlaceholder).length,
      corruptedLearnLevels: corruptedLearnLevels.length,
      brokenTeamRefs: brokenTeamRefs.length,
      skillsMissingNames: skillsMissingNames.length,
      charasMissingDescriptions: charasMissingDescriptions.length,
      basaraBrokenRefs: basaraBrokenRefs.length,
      aurasBrokenRefs: aurasBrokenRefs.length,
      miximaxBrokenRefs: miximaxBrokenRefs.length
    },
    placeholderSkillRefsCount,
    trueDuplicates,
    variantDuplicates,
    missingStats,
    missingImages,
    brokenSkillRefs,
    corruptedLearnLevels,
    brokenTeamRefs,
    skillsMissingNames,
    charasMissingDescriptions,
    basaraBrokenRefs,
    aurasBrokenRefs,
    miximaxBrokenRefs
  };

  writeFileSync(
    resolve(import.meta.dirname, "detailed_audit_results.json"),
    JSON.stringify(finalSummary, null, 2),
    "utf-8"
  );
  console.log("Detailed audit results saved to detailed_audit_results.json");
}

runFullAnalysis();
