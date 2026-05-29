import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInagleService } from "../packages/inagle/src/service.ts";

function cleanJapanese(text: string): string {
  return text.replace(/\[([^/\]]+)\/[^\]]+\]/g, "$1").trim();
}

function extractNouns(json: any) {
  const map = new Map<string, string>();
  
  function traverse(node: any) {
    if (!node) return;
    if (node.name && node.name.startsWith("NOUN_INFO_") && node.name !== "NOUN_INFO_BEGIN_0") {
      const vars = node.variables || [];
      const ints = vars.filter((v: any) => v.type === "Int");
      const strings = vars.filter((v: any) => v.type === "String");
      
      if (ints.length >= 2) {
        const hash = ints[0].value;
        const subId = ints[1].value;
        const key = `${hash}_${subId}`;
        
        const textVal = strings.find((v: any) => v.value && v.value.trim())?.value || "";
        if (textVal) {
          map.set(key, textVal.trim());
        }
      }
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
    if (Array.isArray(node.entries)) {
      for (const entry of node.entries) {
        traverse(entry);
      }
    }
  }
  
  traverse(json);
  return map;
}

async function main() {
  console.log("=== Loading Inagle Service ===");
  const svc = await createInagleService();

  const charactersList: any[] = [];
  const techniquesList: any[] = [];
  const aurasList: any[] = [];
  const passivesList: any[] = [];
  const teamsList: any[] = [];
  const itemsList: any[] = [];
  const termsList: any[] = [];

  const seenJa = new Set<string>();

  // Helper to push to list while avoiding empty values and duplicate JA names
  const pushEntry = (list: any[], ja: string, en: string, fr: string, extra = {}) => {
    const cleanJa = cleanJapanese(ja);
    if (!cleanJa && !en && !fr) return;
    
    // De-duplicate on JA name to keep glossary lookup deterministic
    if (cleanJa && seenJa.has(cleanJa.toLowerCase())) {
      return;
    }
    if (cleanJa) {
      seenJa.add(cleanJa.toLowerCase());
    }

    list.push({
      ja: cleanJa,
      en: en.trim(),
      fr: fr.trim(),
      ...extra
    });
  };

  // 1. Load from Inagle Service
  console.log("Processing Inagle Service entities...");
  
  const chars = svc.characters.all();
  for (const c of chars) {
    const names = c.names || {};
    pushEntry(charactersList, names.ja || "", names.en || "", names.fr || "", { code: c.internalCode });
  }

  const skills = svc.skills.moves();
  for (const s of skills) {
    pushEntry(techniquesList, s.name_JA || "", s.name_EN || "", s.name_FR || "", {
      category: s.categoryName || "",
      element: s.elementName || ""
    });
  }

  const auras = svc.skills.auraAll();
  for (const a of auras) {
    pushEntry(aurasList, a.name_JA || "", a.name_EN || "", a.name_FR || "", { subType: a.subType || "" });
  }

  const passives = svc.skills.passiveAll();
  for (const p of passives) {
    pushEntry(passivesList, p.name_JA || "", "", p.name_FR || "", { boostType: p.boostType || "" });
  }

  const teams = svc.teams.allTeams();
  for (const t of teams) {
    pushEntry(teamsList, t.name_JA || "", t.name_EN || "", t.name_FR || "");
  }

  const items = svc.items.allItems();
  for (const i of items) {
    const names = i.names || {};
    pushEntry(itemsList, names.ja || "", names.en || "", names.fr || "", { category: i.category || "" });
  }

  // 2. Parse Game Noun Binaries to enrich and add missing items
  console.log("Processing game text binaries...");
  const binaryFiles = [
    { name: "chara_text", list: charactersList },
    { name: "skill_text", list: techniquesList },
    { name: "item_text", list: itemsList },
    { name: "team_text", list: teamsList },
    { name: "system_text", list: termsList }
  ];

  for (const file of binaryFiles) {
    const jaPath = `/home/ubuntu/data/common/text/ja/${file.name}.cfg.bin.json`;
    const enPath = `/home/ubuntu/data/common/text/en/${file.name}.cfg.bin.json`;
    const frPath = `/home/ubuntu/data/common/text/fr/${file.name}.cfg.bin.json`;
    
    if (existsSync(jaPath) && existsSync(enPath) && existsSync(frPath)) {
      console.log(`- Parsing binary ${file.name}...`);
      const ja = JSON.parse(readFileSync(jaPath, "utf-8"));
      const en = JSON.parse(readFileSync(enPath, "utf-8"));
      const fr = JSON.parse(readFileSync(frPath, "utf-8"));
      
      const jaMap = extractNouns(ja);
      const enMap = extractNouns(en);
      const frMap = extractNouns(fr);
      
      for (const [key, jaVal] of jaMap.entries()) {
        const enVal = enMap.get(key) || "";
        const frVal = frMap.get(key) || "";
        if (jaVal.trim() && (enVal.trim() || frVal.trim())) {
          pushEntry(file.list, jaVal, enVal, frVal);
        }
      }
    }
  }

  // 3. Load UI Translation Locales
  console.log("Processing UI translation locales...");
  const localesDir = "/home/ubuntu/rg/apps/azalee/public/locales";
  if (existsSync(join(localesDir, "fr.json"))) {
    const frLocale = JSON.parse(readFileSync(join(localesDir, "fr.json"), "utf-8"));
    const enLocale = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf-8"));
    const jaLocale = JSON.parse(readFileSync(join(localesDir, "ja.json"), "utf-8"));
    
    for (const [key, frVal] of Object.entries(frLocale)) {
      const enVal = enLocale[key] || "";
      const jaVal = jaLocale[key] || "";
      if (typeof frVal === "string" && frVal.trim() && typeof jaVal === "string" && jaVal.trim()) {
        pushEntry(termsList, jaVal, typeof enVal === "string" ? enVal : "", frVal);
      }
    }
  }

  // Consolidated glossary structure
  const glossary = {
    _meta: {
      generatedAt: new Date().toISOString(),
      counts: {
        characters: charactersList.length,
        techniques: techniquesList.length,
        auras: aurasList.length,
        passives: passivesList.length,
        teams: teamsList.length,
        items: itemsList.length,
        terms: termsList.length,
        total:
          charactersList.length +
          techniquesList.length +
          aurasList.length +
          passivesList.length +
          teamsList.length +
          itemsList.length +
          termsList.length
      }
    },
    characters: charactersList,
    techniques: techniquesList,
    auras: aurasList,
    passives: passivesList,
    teams: teamsList,
    items: itemsList,
    terms: termsList
  };

  const outDir = join(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });

  const jsonPath = join(outDir, "glossary.json");
  writeFileSync(jsonPath, JSON.stringify(glossary, null, 2));
  console.log(`=== Strengthening Completed ===`);
  console.log(`Saved consolidated glossary to: ${jsonPath}`);
  console.log(`Total glossary entries: ${glossary._meta.counts.total}`);
  console.log(`- Characters: ${glossary._meta.counts.characters}`);
  console.log(`- Techniques: ${glossary._meta.counts.techniques}`);
  console.log(`- Auras: ${glossary._meta.counts.auras}`);
  console.log(`- Passives: ${glossary._meta.counts.passives}`);
  console.log(`- Teams: ${glossary._meta.counts.teams}`);
  console.log(`- Items: ${glossary._meta.counts.items}`);
  console.log(`- Terms: ${glossary._meta.counts.terms}`);
}

main().catch(console.error);
