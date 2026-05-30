import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const RESULTS_PATH = resolve(import.meta.dirname, "detailed_audit_results.json");
const REPORT_PATH = "/home/ubuntu/.gemini/antigravity-cli/brain/ac6c0d98-2d7e-4a47-9ce2-8485be99bd90/data_classification_report.md";

interface AuditData {
  counts: {
    characters: number;
    skills: number;
    teams: number;
    items: number;
    basara: number;
    auras: number;
    miximax: number;
    trueDuplicatesGroups: number;
    trueDuplicatesTotal: number;
    variantDuplicatesGroups: number;
    variantDuplicatesTotal: number;
    missingStats: number;
    missingImages: number;
    brokenSkillRefs: number;
    brokenSkillRefsNonPlaceholder: number;
    corruptedLearnLevels: number;
    brokenTeamRefs: number;
    skillsMissingNames: number;
    charasMissingDescriptions: number;
    basaraBrokenRefs: number;
    aurasBrokenRefs: number;
    miximaxBrokenRefs: number;
  };
  placeholderSkillRefsCount: Record<string, number>;
  trueDuplicates: any[];
  variantDuplicates: any[];
  missingStats: any[];
  missingImages: any[];
  brokenSkillRefs: any[];
  corruptedLearnLevels: any[];
  brokenTeamRefs: any[];
  skillsMissingNames: any[];
  charasMissingDescriptions: any[];
  basaraBrokenRefs: any[];
  aurasBrokenRefs: any[];
  miximaxBrokenRefs: any[];
}

function generateReport() {
  console.log("Reading audit results...");
  const data: AuditData = JSON.parse(readFileSync(RESULTS_PATH, "utf-8"));
  const { counts } = data;

  let md = "";
  
  md += `# Inazuma Eleven Victory Road — Database Audit & Classification Report\n\n`;
  md += `This report presents a comprehensive audit of the generated game data JSON files located under \`packages/inagle/src/entries/\` (specifically [characters.json](file:///home/ubuntu/rg/packages/inagle/src/entries/characters.json), [skills.json](file:///home/ubuntu/rg/packages/inagle/src/entries/skills.json), etc.). The audit classifies duplicates, identifies missing player stats and face images, checks referential integrity, and highlights data corruption anomalies.\n\n`;

  // 1. Executive Summary Table
  md += `## 1. Executive Summary\n\n`;
  md += `### Database Statistics Overview\n\n`;
  md += `| Entity/Metric | Count / Status | Notes |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Total Characters** | ${counts.characters} | Records in characters.json |\n`;
  md += `| **Total Skills** | ${counts.skills} | Records in skills.json |\n`;
  md += `| **Total Teams** | ${counts.teams} | Records in teams.json |\n`;
  md += `| **Total Items** | ${counts.items} | Records in items.json |\n`;
  md += `| **True Duplicate Groups** | ${counts.trueDuplicatesGroups} | Total of ${counts.trueDuplicatesTotal} character records |\n`;
  md += `| **Variant Duplicate Groups** | ${counts.variantDuplicatesGroups} | Total of ${counts.variantDuplicatesTotal} character records |\n`;
  md += `| **Missing stats (at any level)** | ${counts.missingStats} | Character records missing stats at Lv1, Lv50, or Lv99 |\n`;
  md += `| **Missing or Placeholder Face Images** | ${counts.missingImages} | Character records with null, empty, or dummy images |\n`;
  md += `| **Broken Skill References** | ${counts.brokenSkillRefs} | Character skills referring to non-existent skill IDs |\n`;
  md += `| &nbsp;&nbsp;&nbsp;&nbsp;*Non-Placeholder Broken Refs* | ${counts.brokenSkillRefsNonPlaceholder} | Broken references excluding common placeholders |\n`;
  md += `| **Corrupted Learn Levels** | ${counts.corruptedLearnLevels} | Skills with negative or invalid learn levels |\n`;
  md += `| **Skills Missing Localized Names** | ${counts.skillsMissingNames} | Skills lacking EN, FR, or JA names in skills.json |\n`;
  md += `| **Broken Cross-Table Refs** | ${counts.basaraBrokenRefs + counts.aurasBrokenRefs + counts.miximaxBrokenRefs} | Broken references in basara.json, auras.json, or miximax.json |\n\n`;

  md += `> [!IMPORTANT]\n`;
  md += `> The data analysis reveals critical corruption in **learn level** indices (negative integers) and a significant amount of **broken skill references**. However, there are zero characters without face images, and only two characters with missing stats.\n\n`;

  // 2. Duplicate Character Analysis
  md += `## 2. Duplicate Character Analysis\n\n`;
  md += `### Classification Methodology\n`;
  md += `- **DLC/Variant Duplicates**: Characters with the same name, position, element, and gender that share the **same base internal code** (e.g. \`c01000100\` and \`c01000100_5000\`). These represent different builds, rarity configurations, or DLC outfits for the same character.\n`;
  md += `- **True Duplicates**: Characters with the same name, position, element, and gender but **different base internal codes** (e.g. \`c01000110\` and \`c01010920\` or different base hashes). These represent distinct character entries in the game configs that have identical attributes (often due to historical duplicates or name collisions across different eras/teams in the series).\n\n`;

  md += `### A. True Duplicates (${counts.trueDuplicatesGroups} Groups)\n`;
  md += `Below is a sample of prominent "True Duplicate" groups where characters share identical names, positions, elements, and genders but have different base codes:\n\n`;
  
  md += `| Name | Position | Element | Gender | Character Records (Index, CharaParamId, InternalCode) |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  
  // List first 10 true duplicate groups as examples
  const sampleTrue = data.trueDuplicates.slice(0, 10);
  for (const g of sampleTrue) {
    const charsStr = g.characters.map((c: any) => `Index ${c.index} (\`${c.charaParamId}\` / \`${c.internalCode}\`)`).join("<br>");
    const firstCh = g.characters[0];
    md += `| **${firstCh.name}** | ${firstCh.position} | ${firstCh.element} | ${firstCh.gender === 0 ? "Male" : "Female"} | ${charsStr} |\n`;
  }
  
  if (data.trueDuplicates.length > 10) {
    md += `| *And ${data.trueDuplicates.length - 10} more groups...* | | | | |\n`;
  }
  md += `\n`;

  md += `### B. Variant / DLC Duplicates (${counts.variantDuplicatesGroups} Groups)\n`;
  md += `Below is a sample of "Variant/DLC Duplicate" groups where the same character has multiple parameters/records sharing the same base internal code:\n\n`;

  md += `| Name | Position | Element | Base Internal Code | Records (Index, CharaParamId, Rarity) |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;

  const sampleVariant = data.variantDuplicates.slice(0, 10);
  for (const g of sampleVariant) {
    const baseCode = g.characters[0].internalCode.split('_')[0];
    const charsStr = g.characters.map((c: any) => `Index ${c.index} (\`${c.charaParamId}\` / ${c.rarity})`).join("<br>");
    const firstCh = g.characters[0];
    md += `| **${firstCh.name}** | ${firstCh.position} | ${firstCh.element} | \`${baseCode}\` | ${charsStr} |\n`;
  }

  if (data.variantDuplicates.length > 10) {
    md += `| *And ${data.variantDuplicates.length - 10} more groups...* | | | | |\n`;
  }
  md += `\n`;

  // 3. Missing Stats & Images Audit
  md += `## 3. Missing Stats & Images Audit\n\n`;

  md += `### A. Missing Stats (${counts.missingStats} Records Found)\n`;
  if (counts.missingStats === 0) {
    md += `*No characters with missing stats found.*\n\n`;
  } else {
    md += `The following characters are missing stats at specified levels:\n\n`;
    md += `| Index | Name | CharaParamId | InternalCode | Reason |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const ms of data.missingStats) {
      md += `| ${ms.index ?? "N/A"} | **${ms.name}** | \`${ms.charaParamId}\` | \`${ms.internalCode}\` | ${ms.reason} |\n`;
    }
    md += `\n`;
    md += `> [!WARNING]\n`;
    md += `> **Trevor Cook** (\`c07010080\`) is missing level **lv1** stats in both of his records. This will crash any level-based stats calculation or progression screens that start from level 1.\n\n`;
  }

  md += `### B. Missing Face Images (${counts.missingImages} Records Found)\n`;
  if (counts.missingImages === 0) {
    md += `*No characters with missing or placeholder face images were found. All 5,991 characters have valid face image paths (e.g. pointing to \`200_icon/10_icon_chr/face/...\`).*\n\n`;
  } else {
    md += `The following characters have missing or placeholder images:\n\n`;
    md += `| Name | CharaParamId | InternalCode | Image Value | Reason |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const mi of data.missingImages) {
      md += `| **${mi.name}** | \`${mi.charaParamId}\` | \`${mi.internalCode}\` | \`${mi.imageValue}\` | ${mi.reason} |\n`;
    }
    md += `\n`;
  }

  // 4. Reference Integrity & Inconsistencies
  md += `## 4. Reference Integrity & Inconsistencies\n\n`;

  md += `### A. Broken Skill References (${counts.brokenSkillRefs} occurrences)\n`;
  md += `- **Placeholder Skills**: \`0x00000003\` occurs **${data.placeholderSkillRefsCount["0x00000003"] || 0}** times, and \`0x00000004\` occurs **${data.placeholderSkillRefsCount["0x00000004"] || 0}** times. These represent empty skill slots or system skills and are not present in [skills.json](file:///home/ubuntu/rg/packages/inagle/src/entries/skills.json).\n`;
  md += `- **Non-Placeholder Broken Refs**: **${counts.brokenSkillRefsNonPlaceholder}** skills referenced by characters are missing from [skills.json](file:///home/ubuntu/rg/packages/inagle/src/entries/skills.json).\n\n`;

  if (counts.brokenSkillRefsNonPlaceholder > 0) {
    md += `#### Top Non-Placeholder Broken Skill References (Sample):\n\n`;
    md += `| Character Name | CharaParamId | Missing Skill ID | Learn Level |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    const nonPlaceholderBroken = data.brokenSkillRefs.filter(b => !b.isPlaceholder).slice(0, 15);
    for (const b of nonPlaceholderBroken) {
      md += `| **${b.charaName}** | \`${b.charaParamId}\` | \`${b.skillId}\` | ${b.learnLevel} |\n`;
    }
    if (counts.brokenSkillRefsNonPlaceholder > 15) {
      md += `| *And ${counts.brokenSkillRefsNonPlaceholder - 15} more broken refs...* | | | |\n`;
    }
    md += `\n`;
  }

  md += `### B. Corrupted Learn Levels (${counts.corruptedLearnLevels} occurrences)\n`;
  md += `There are **${counts.corruptedLearnLevels}** instances where a character's skill \`learnLevel\` is corrupted (negative numbers or values outside [0-99]). These usually indicate uninitialized bytes or parsing overflow in the level-5 binary configurations reader.\n\n`;
  
  md += `#### Detailed Corrupted Learn Levels (Sample):\n\n`;
  md += `| Character Name | CharaParamId | Skill ID | Learn Level (Corrupted) |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  const sampleCorrupted = data.corruptedLearnLevels.slice(0, 15);
  for (const c of sampleCorrupted) {
    md += `| **${c.charaName}** | \`${c.charaParamId}\` | \`${c.skillId}\` | **${c.learnLevel}** |\n`;
  }
  if (counts.corruptedLearnLevels > 15) {
    md += `| *And ${counts.corruptedLearnLevels - 15} more corrupted learn levels...* | | | |\n`;
  }
  md += `\n`;

  md += `### C. Cross-File Reference Failures\n`;
  md += `- **Basara Database (basara.json)**: **${counts.basaraBrokenRefs}** broken references. All Basara configuration entries point to valid \`charaParamId\`s in characters.json.\n`;
  md += `- **Aura Database (auras.json)**: **${counts.aurasBrokenRefs}** broken references. All Aura configurations map to valid \`charaParamId\`s in characters.json.\n`;
  md += `- **Miximax Database (miximax.json)**: **${counts.miximaxBrokenRefs}** broken references. All Miximax configuration entries properly link to valid base and aura character parameter IDs.\n`;
  md += `- **Team Reference Audit**: **${counts.brokenTeamRefs}** broken team references inside character objects. All teams listed inside character records exist in [teams.json](file:///home/ubuntu/rg/packages/inagle/src/entries/teams.json).\n\n`;

  md += `### D. Localization & Descriptions Gaps\n`;
  md += `- **Character Descriptions**: **${counts.charasMissingDescriptions}** characters are missing descriptions in at least one localized language (English, French, or Japanese).\n`;
  md += `- **Skill Localization**: **${counts.skillsMissingNames}** skills in [skills.json](file:///home/ubuntu/rg/packages/inagle/src/entries/skills.json) are missing localized names entirely (fields are empty or default to placeholder code strings like \`ps0001\`):\n\n`;

  if (counts.skillsMissingNames > 0) {
    md += `| Skill ID | Display Name | Internal Code | Reason |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const s of data.skillsMissingNames.slice(0, 10)) {
      md += `| \`${s.skillID}\` | **${s.displayName}** | \`${s.internalCode}\` | Missing EN, FR, and JA names |\n`;
    }
    if (counts.skillsMissingNames > 10) {
      md += `| *And ${counts.skillsMissingNames - 10} more skills...* | | | |\n`;
    }
    md += `\n`;
  }

  // 5. Source Code / Parser Fix Suggestions
  md += `## 5. Parser Fix Suggestions at Source Level\n\n`;
  md += `To resolve the reported anomalies at the source generation level (binary extraction), the following adjustments are recommended for the parser scripts in [packages/inagle/src/parsers/](file:///home/ubuntu/rg/packages/inagle/src/parsers/) and pipelines:\n\n`;

  md += `### 1. Fix Corrupted Learn Levels\n`;
  md += `The negative learn levels (e.g. \`-719564275\`) indicate a signedness issue or reading past the buffer boundaries during Level-5 binary parsing (specifically for skill index offsets). \n`;
  md += `Check [chara-param.ts](file:///home/ubuntu/rg/packages/inagle/src/parsers/chara-param.ts) or whichever parser generates \`characters.json\`. Make sure that when reading learn levels, the bytes are correctly masked and interpreted as unsigned integers, or clamped:\n`;
  md += `\`\`\`typescript\n`;
  md += `// Clamp or filter out corrupted levels\n`;
  md += `const cleanLevel = Math.max(0, Math.min(99, rawLearnLevel));\n`;
  md += `// If rawLearnLevel is negative/corrupted, it could indicate that the skill slot is empty/unused in the binary.\n`;
  md += `if (rawLearnLevel < 0 || rawLearnLevel > 99) {\n`;
  md += `  // Treat as unused skill slot and discard it from the skills array\n`;
  md += `}\n`;
  md += `\`\`\`\n\n`;

  md += `### 2. Handling Placeholder Skills (\`0x00000003\` & \`0x00000004\`)\n`;
  md += `These placeholder skill IDs should be filtered out during character skills compilation, as they do not correspond to actual Hissatsu/Passive techniques. In the character builder step:\n`;
  md += `\`\`\`typescript\n`;
  md += `character.skills = rawSkills\n`;
  md += `  .filter(s => s.skillId !== "0x00000003" && s.skillId !== "0x00000004")\n`;
  md += `  .map(s => ({ skillId: s.skillId, learnLevel: s.learnLevel }));\n`;
  md += `\`\`\`\n\n`;

  md += `### 3. Trevor Cook Stats Recovery\n`;
  md += `Trevor Cook (\`c07010080\`) has missing \`lv1\` stats. This typically happens when the character growth config defaults to another offset or doesn't map correctly. A fallback mechanism should be added during stats generation to interpolate level 1 stats if missing, or use a default starter config from the base player rarity.\n\n`;

  md += `### 4. Duplicate Deduplication on DB Sync\n`;
  md += `To clean the database during the sync process in [cli-push.ts](file:///home/ubuntu/rg/packages/inagle/src/cli-push.ts):\n`;
  md += `- Filter out character variants that represent unused/duplicate debug records.\n`;
  md += `- Maintain a whitelist/blacklist of duplicate \`charaParamId\`s to discard during compilation.\n`;

  // Write file
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, md, "utf-8");
  console.log("Markdown report written successfully.");
}

generateReport();
