import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildSkillDatabase } from "@rosegriffon/inagle/skills/mapper.ts";

async function main() {
  console.log("Regenerating skills database...");

  try {
    const db = buildSkillDatabase();
    console.log(`Generated ${db.skills.length} skills.`);

    const outputPath = "c:\\iecode\\data\\entities\\skills.json";

    // Ensure directory exists
    const dir = dirname(outputPath);
    try {
      mkdirSync(dir, { recursive: true });
    } catch {}

    writeFileSync(outputPath, JSON.stringify(db, null, 2), "utf-8");
    console.log(`Wrote to ${outputPath}`);
  } catch (e) {
    console.error("Failed active skills:", e);
  }

  try {
    console.log("Regenerating PASSIVE database...");
    // Dynamic import to avoid earlier "cannot find" issues if sync file writes happened
    const { buildPassiveSkillDatabase } = await import("../skills/mapper-passive.js");
    const pasDb = buildPassiveSkillDatabase();
    console.log(`Generated ${pasDb.stats.uniqueEffects} unique passive skills.`);

    const pasOutputPath = "c:\\iecode\\data\\entities\\passive_skills.json";
    writeFileSync(pasOutputPath, JSON.stringify(pasDb, null, 2), "utf-8");
    console.log(`Wrote to ${pasOutputPath}`);
  } catch (e) {
    console.error("Failed passive skills:", e);
  }
}

main();
