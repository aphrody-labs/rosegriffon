import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const resultsPath = resolve(import.meta.dirname, "analysis_results.json");
const data = JSON.parse(readFileSync(resultsPath, "utf-8"));

console.log("--- TRUE DUPLICATES SAMPLE (First 5) ---");
console.log(JSON.stringify(data.trueDuplicates.slice(0, 5), null, 2));

console.log("\n--- VARIANT DUPLICATES SAMPLE (First 5) ---");
console.log(JSON.stringify(data.variantDuplicates.slice(0, 5), null, 2));

console.log("\n--- MISSING STATS ---");
console.log(JSON.stringify(data.missingStats, null, 2));

console.log("\n--- MISSING IMAGES ---");
console.log(JSON.stringify(data.missingImages, null, 2));

console.log("\n--- BROKEN SKILL REFS SAMPLE (First 10) ---");
console.log(JSON.stringify(data.brokenSkillRefs.slice(0, 10), null, 2));

console.log("\n--- SKILLS MISSING NAMES OR DESCS SAMPLE (First 5) ---");
console.log(JSON.stringify(data.skillsMissingNamesOrDescs.slice(0, 5), null, 2));
