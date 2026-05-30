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

// Interfaces
interface CharaSkill {
  skillId: string;
  learnLevel: number;
}

interface CharaStats {
  kick: number;
  control: number;
  technique: number;
  physical: number;
  pressure: number;
  agility: number;
  intelligence: number;
}

interface CharaStatsGroup {
  lv1?: CharaStats;
  lv50?: CharaStats;
  lv99?: CharaStats;
}

interface CharaNames {
  ja: string;
  en: string;
  fr: string;
  romanized?: {
    firstName?: string;
    lastName?: string;
  };
}

interface CharaTeamRef {
  id: string;
  names: {
    fr: string;
    en: string;
    ja: string;
  };
  seasons: string[];
}

interface CharacterEntry {
  index: number;
  charaParamId: string;
  charaId: string;
  names: CharaNames;
  position: string;
  positionRaw: number;
  subPosition?: string;
  element: string;
  elementRaw: number;
  rarity: string;
  rarityCode: number;
  gender: number;
  growthPattern: number;
  skills: CharaSkill[];
  stats: CharaStatsGroup;
  slug: string;
  internalCode: string;
  image?: string | null;
  descriptions: {
    en?: string;
    fr?: string;
    ja?: string;
  };
  zukanHash?: string | null;
  zukanOrder?: number;
  seriesId: string;
  series: string;
  teams: CharaTeamRef[];
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
  description_EN?: string;
  description_FR?: string;
  description_JA?: string;
}

function runAnalysis() {
  console.log("Loading entry files...");
  const characters = loadEntryJson<CharacterEntry[]>("characters.json");
  const skills = loadEntryJson<SkillEntry[]>("skills.json");
  const teams = loadEntryJson<TeamEntry[]>("teams.json");
  const items = loadEntryJson<ItemEntry[]>("items.json");

  console.log(`Loaded ${characters.length} characters.`);
  console.log(`Loaded ${skills.length} skills.`);
  console.log(`Loaded ${teams.length} teams.`);
  console.log(`Loaded ${items.length} items.`);

  // Maps for faster lookup
  const skillMap = new Map<string, SkillEntry>();
  for (const s of skills) {
    skillMap.set(s.skillID.toLowerCase(), s);
  }

  const teamMap = new Map<string, TeamEntry>();
  for (const t of teams) {
    teamMap.set(t.teamId.toLowerCase(), t);
  }

  // --- 1. Duplicate detection ---
  // Group by: French name, position, element, gender
  // (We use French name because it's standard, fallback to English or Japanese if missing/empty)
  const getCharaNameKey = (c: CharacterEntry) => {
    return c.names.fr || c.names.en || c.names.ja || "Unknown";
  };

  const duplicateGroups = new Map<string, CharacterEntry[]>();
  for (const c of characters) {
    const name = getCharaNameKey(c);
    const key = `${name.trim().toLowerCase()}|${c.position}|${c.element}|${c.gender}`;
    if (!duplicateGroups.has(key)) {
      duplicateGroups.set(key, []);
    }
    duplicateGroups.get(key)!.push(c);
  }

  const trueDuplicates: Array<{ key: string; characters: CharacterEntry[] }> = [];
  const variantDuplicates: Array<{ key: string; characters: CharacterEntry[] }> = [];

  for (const [key, group] of duplicateGroups.entries()) {
    if (group.length > 1) {
      // Determine if it is DLC/Variant duplicate or True duplicate
      // A group contains DLC/Variant duplicates if there are shared base internalCodes, or variant suffixes like _5000, _2 etc.
      // Let's check if all internalCodes split by '_' share the same base code.
      // E.g. "c01000010" and "c01000010_5000" are variant duplicates.
      // What about other characters? Let's check how many unique base codes are in the group.
      const baseCodes = new Set(group.map(c => c.internalCode.split('_')[0]));
      
      // If there is only 1 unique base code (meaning they are all variants of the same character code like c01000010 and c01000010_5000),
      // it's a DLC/Variant duplicate group.
      // Wait, what if there are multiple base codes? That means they have different base internal codes (e.g. c01000010 and c02000020),
      // making them "True duplicates" (same name/attributes, but different character ID).
      // Let's refine this: if baseCodes.size > 1, it's a "True Duplicate". Otherwise, it's a "Variant/DLC Duplicate".
      if (baseCodes.size > 1) {
        trueDuplicates.push({ key, characters: group });
      } else {
        variantDuplicates.push({ key, characters: group });
      }
    }
  }

  // --- 2. Missing Stats detection ---
  // Check characters where stats are missing or default/zero at Lv1, Lv50, or Lv99.
  const missingStats: Array<{
    character: CharacterEntry;
    reason: string;
    details: string;
  }> = [];

  for (const c of characters) {
    if (!c.stats) {
      missingStats.push({ character: c, reason: "No stats object", details: "entire stats object is missing" });
      continue;
    }
    const levels: Array<keyof CharaStatsGroup> = ["lv1", "lv50", "lv99"];
    for (const lvl of levels) {
      const statGroup = c.stats[lvl];
      if (!statGroup) {
        missingStats.push({ character: c, reason: `Missing level ${lvl}`, details: `stats for level ${lvl} are undefined/null` });
        continue;
      }
      // Check if stats are all 0 or some are 0
      const statKeys: Array<keyof CharaStats> = ["kick", "control", "technique", "physical", "pressure", "agility", "intelligence"];
      const zeroStats = statKeys.filter(k => !statGroup[k] || statGroup[k] === 0);
      if (zeroStats.length > 0) {
        missingStats.push({
          character: c,
          reason: `Zero/Missing stats at ${lvl}`,
          details: `Stats with zero/falsy value: ${zeroStats.join(", ")} (${statKeys.map(k => `${k}:${statGroup[k]}`).join(", ")})`
        });
      }
    }
  }

  // --- 3. Missing Images detection ---
  // Check characters without face images or with default webp placeholders.
  const missingImages: Array<{
    character: CharacterEntry;
    imageValue: string | null | undefined;
    reason: string;
  }> = [];

  for (const c of characters) {
    const img = c.image;
    if (!img) {
      missingImages.push({ character: c, imageValue: img, reason: "Image is null or empty" });
    } else if (
      img.includes("default") ||
      img.includes("placeholder") ||
      img.includes("no_image") ||
      img.includes("fallback") ||
      img.toLowerCase().includes("dummy")
    ) {
      missingImages.push({ character: c, imageValue: img, reason: "Image is a default/fallback/placeholder" });
    }
  }

  // --- 4. Inconsistencies / Anomalies ---
  const brokenSkillRefs: Array<{
    character: CharacterEntry;
    skillId: string;
    learnLevel: number;
  }> = [];

  const brokenTeamRefs: Array<{
    character: CharacterEntry;
    teamId: string;
  }> = [];

  const missingDescriptions: Array<{
    character: CharacterEntry;
    missingLangs: string[];
  }> = [];

  const missingNames: Array<{
    character: CharacterEntry;
    missingLangs: string[];
  }> = [];

  for (const c of characters) {
    // Check skills refer to valid skillIDs
    if (c.skills) {
      for (const cs of c.skills) {
        if (!skillMap.has(cs.skillId.toLowerCase())) {
          brokenSkillRefs.push({ character: c, skillId: cs.skillId, learnLevel: cs.learnLevel });
        }
      }
    }

    // Check teams refer to valid teamIds
    if (c.teams) {
      for (const ct of c.teams) {
        if (!teamMap.has(ct.id.toLowerCase())) {
          brokenTeamRefs.push({ character: c, teamId: ct.id });
        }
      }
    }

    // Check missing descriptions
    const missingDesc: string[] = [];
    if (!c.descriptions.en || c.descriptions.en.trim() === "") missingDesc.push("en");
    if (!c.descriptions.fr || c.descriptions.fr.trim() === "") missingDesc.push("fr");
    if (!c.descriptions.ja || c.descriptions.ja.trim() === "") missingDesc.push("ja");
    if (missingDesc.length > 0) {
      missingDescriptions.push({ character: c, missingLangs: missingDesc });
    }

    // Check missing names
    const missingNm: string[] = [];
    if (!c.names.en || c.names.en.trim() === "") missingNm.push("en");
    if (!c.names.fr || c.names.fr.trim() === "") missingNm.push("fr");
    if (!c.names.ja || c.names.ja.trim() === "") missingNm.push("ja");
    if (missingNm.length > 0) {
      missingNames.push({ character: c, missingLangs: missingNm });
    }
  }

  // Also check skills themselves for missing metadata
  const skillsMissingNamesOrDescs: Array<{
    skill: SkillEntry;
    reason: string;
  }> = [];
  for (const s of skills) {
    const missing: string[] = [];
    if (!s.name_EN || s.name_EN.trim() === "") missing.push("name_EN");
    if (!s.name_FR || s.name_FR.trim() === "") missing.push("name_FR");
    if (!s.name_JA || s.name_JA.trim() === "") missing.push("name_JA");
    if (missing.length > 0) {
      skillsMissingNamesOrDescs.push({ skill: s, reason: `Missing localized names: ${missing.join(", ")}` });
    }
  }

  // Log results to console
  console.log("\n=== ANALYSIS COMPLETE ===");
  console.log(`True duplicates: ${trueDuplicates.length} groups`);
  console.log(`Variant duplicates: ${variantDuplicates.length} groups`);
  console.log(`Missing stats characters: ${missingStats.length}`);
  console.log(`Missing images characters: ${missingImages.length}`);
  console.log(`Broken skill refs: ${brokenSkillRefs.length}`);
  console.log(`Broken team refs: ${brokenTeamRefs.length}`);
  console.log(`Characters with missing names: ${missingNames.length}`);
  console.log(`Characters with missing descriptions: ${missingDescriptions.length}`);
  console.log(`Skills with missing names: ${skillsMissingNamesOrDescs.length}`);

  // Write detailed results to a JSON file for generating report
  const analysisData = {
    trueDuplicates: trueDuplicates.map(g => ({
      key: g.key,
      characters: g.characters.map(c => ({
        index: c.index,
        charaParamId: c.charaParamId,
        charaId: c.charaId,
        name: getCharaNameKey(c),
        internalCode: c.internalCode,
        position: c.position,
        element: c.element,
        gender: c.gender
      }))
    })),
    variantDuplicates: variantDuplicates.map(g => ({
      key: g.key,
      characters: g.characters.map(c => ({
        index: c.index,
        charaParamId: c.charaParamId,
        charaId: c.charaId,
        name: getCharaNameKey(c),
        internalCode: c.internalCode,
        position: c.position,
        element: c.element,
        gender: c.gender
      }))
    })),
    missingStats: missingStats.map(m => ({
      index: m.character.index,
      charaParamId: m.character.charaParamId,
      name: getCharaNameKey(m.character),
      internalCode: m.character.internalCode,
      reason: m.reason,
      details: m.details
    })),
    missingImages: missingImages.map(m => ({
      index: m.character.index,
      charaParamId: m.character.charaParamId,
      name: getCharaNameKey(m.character),
      internalCode: m.character.internalCode,
      imageValue: m.imageValue,
      reason: m.reason
    })),
    brokenSkillRefs: brokenSkillRefs.map(b => ({
      charaIndex: b.character.index,
      charaName: getCharaNameKey(b.character),
      charaParamId: b.character.charaParamId,
      skillId: b.skillId,
      learnLevel: b.learnLevel
    })),
    brokenTeamRefs: brokenTeamRefs.map(b => ({
      charaIndex: b.character.index,
      charaName: getCharaNameKey(b.character),
      charaParamId: b.character.charaParamId,
      teamId: b.teamId
    })),
    missingNames: missingNames.map(m => ({
      index: m.character.index,
      charaParamId: m.character.charaParamId,
      internalCode: m.character.internalCode,
      names: m.character.names,
      missingLangs: m.missingLangs
    })),
    missingDescriptions: missingDescriptions.map(m => ({
      index: m.character.index,
      charaParamId: m.character.charaParamId,
      name: getCharaNameKey(m.character),
      internalCode: m.character.internalCode,
      missingLangs: m.missingLangs
    })),
    skillsMissingNamesOrDescs: skillsMissingNamesOrDescs.map(s => ({
      skillID: s.skill.skillID,
      displayName: s.skill.displayName,
      internalCode: s.skill.internalCode,
      reason: s.reason
    }))
  };

  writeFileSync(
    resolve(import.meta.dirname, "analysis_results.json"),
    JSON.stringify(analysisData, null, 2),
    "utf-8"
  );
  console.log("Analysis results saved to analysis_results.json");
}

runAnalysis();
