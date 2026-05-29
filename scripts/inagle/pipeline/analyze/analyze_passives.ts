import { createInagleService } from "@rosegriffon/inagle/service.ts";

const inagleService = await createInagleService();
const passives = inagleService.skills.passiveAll();

// Analyze effect types
const effectTypeMap = new Map<number, string[]>();
const keywordMap: Record<string, string[]> = {
  AT: [],
  DF: [],
  Brèche: [],
  Faute: [],
  Tension: [],
  PT: [],
};

passives.forEach((p) => {
  // Group by effectType
  if (p.effectType === undefined) return;

  if (!effectTypeMap.has(p.effectType)) {
    effectTypeMap.set(p.effectType, []);
  }
  const list = effectTypeMap.get(p.effectType);
  if (list && list.length < 3) {
    list.push(`${p.displayName}: ${p.desc_FR}`);
  }

  // Keyword matching
  if (p.desc_FR) {
    if (p.desc_FR.includes("AT")) keywordMap.AT.push(p.displayName);
    if (p.desc_FR.includes("DF")) keywordMap.DF.push(p.displayName);
    if (p.desc_FR.includes("Brèche")) keywordMap.Brèche.push(p.displayName);
    if (p.desc_FR.includes("Faute")) keywordMap.Faute.push(p.displayName);
  }
});

console.log("--- EFFECT TYPES ---");
effectTypeMap.forEach((examples, type) => {
  console.log(`Type ${type}:`);
  examples.forEach((ex) => {
    console.log(`  - ${ex}`);
  });
});
