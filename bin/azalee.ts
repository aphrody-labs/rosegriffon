#!/usr/bin/env bun
/**
 * CLI Azalée - Inazuma Eleven Victory Road Monorepo Toolbelt
 *
 * Utilitaire ultra-rapide en Bun native API pour le traitement de données, RAG,
 * traductions, requêtes SQL/Redis et diagnostics.
 */

import { Command } from "commander";
import { readFileSync, existsSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createInagleService } from "../packages/inagle/src/service.ts";
import { cache } from "../packages/db/src/redis.ts";
import { createSupabaseServiceClient } from "../packages/db/src/service.ts";

const program = new Command();

program
  .name("azalee")
  .description("CLI d'Azalée pour Inazuma Eleven: Victory Road")
  .version("1.0.0");

// Helper ANSI colors for console styling
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  bold: "\x1b[1m"
};

// ─── UTILS ───────────────────────────────────────────────────────────

function cleanJapanese(text: string): string {
  return text.replace(/\[([^/\]]+)\/[^\]]+\]/g, "$1").trim();
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const containsJapanese = (text: string) =>
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(text);

async function translateWithGoogle(text: string, from: string, to: string): Promise<string> {
  if (!text.trim()) return "";
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as any;
      if (data && data[0]) {
        return data[0].map((x: any) => x[0]).join("");
      }
    }
  } catch (e) {
    console.error("Google Translation API Error:", e);
  }
  return text;
}

// Helper to find latest SQLite database
function getSqlitePath(): string | null {
  const dirs = [
    path.resolve(process.cwd(), "apps/azalee/data/backups"),
    path.resolve(process.cwd(), "data/backups"),
    "/home/ubuntu/rg/apps/azalee/data/backups"
  ];

  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir);
      const sqliteFiles = files
        .filter((f) => f.startsWith("supabase-") && f.endsWith(".sqlite"))
        .sort((a, b) => b.localeCompare(a));

      if (sqliteFiles.length > 0) {
        return path.join(dir, sqliteFiles[0]);
      }
    } catch {
      // ignore
    }
  }
  return null;
}

// ─── COMMANDS ────────────────────────────────────────────────────────

// 1. translate
program
  .command("translate <text>")
  .description("Traduit du texte en français en appliquant le glossaire consolidé")
  .action(async (text: string) => {
    const isJa = containsJapanese(text);
    const from = isJa ? "ja" : "en";
    console.log(`${colors.cyan}Langue source détectée : ${isJa ? "Japonais" : "Anglais"}${colors.reset}`);
    
    const glossaryPath = path.join(process.cwd(), "data", "glossary.json");
    const jpToFrMap = new Map<string, string>();
    const enToFrMap = new Map<string, string>();

    if (existsSync(glossaryPath)) {
      try {
        const glossary = JSON.parse(readFileSync(glossaryPath, "utf-8"));
        const categories = ["characters", "techniques", "auras", "passives", "teams", "items", "terms"];
        for (const cat of categories) {
          const list = glossary[cat] || [];
          for (const entry of list) {
            const frVal = entry.fr || entry.name_FR;
            if (!frVal) continue;

            if (entry.ja && entry.ja.trim()) {
              const cleanJa = cleanJapanese(entry.ja);
              if (cleanJa.length > 1) {
                jpToFrMap.set(cleanJa, frVal);
              }
            }
            if (entry.en && entry.en.trim() && entry.en.toLowerCase() !== frVal.toLowerCase()) {
              enToFrMap.set(entry.en.trim(), frVal);
            }
          }
        }
      } catch (e) {
        console.error("Glossary parse error:", e);
      }
    }

    const jpReplacements = Array.from(jpToFrMap.entries()).sort((a, b) => b[0].length - a[0].length);
    const enReplacements = Array.from(enToFrMap.entries()).sort((a, b) => b[0].length - a[0].length);

    const replacements = isJa ? jpReplacements : enReplacements;

    let processedText = text;
    const placeholderMap = new Map<string, string>();
    let placeholderIndex = 0;

    for (const [term, frVal] of replacements) {
      let matches = false;
      if (isJa) {
        matches = processedText.includes(term);
      } else {
        const regex = new RegExp("\\b" + escapeRegExp(term) + "\\b", "i");
        matches = regex.test(processedText);
      }

      if (matches) {
        const placeholder = ` [[T${placeholderIndex}]] `;
        placeholderMap.set(placeholder.trim(), frVal);

        if (isJa) {
          processedText = processedText.replaceAll(term, placeholder);
        } else {
          const regex = new RegExp("\\b" + escapeRegExp(term) + "\\b", "gi");
          processedText = processedText.replace(regex, placeholder);
        }
        placeholderIndex++;
      }
    }

    let translated = await translateWithGoogle(processedText, from, "fr");

    for (const [placeholder, frVal] of placeholderMap.entries()) {
      const cleanPlaceholder = placeholder.replace("[[", "").replace("]]", "").trim().toLowerCase();
      const num = cleanPlaceholder.replace("t", "");

      const dblRegex = new RegExp("\\[\\s*\\[\\s*[tT]\\s*" + num + "\\s*\\]\\s*\\]", "g");
      translated = translated.replace(dblRegex, frVal);

      const sglRegex = new RegExp("\\[\\s*[tT]\\s*" + num + "\\s*\\]", "g");
      translated = translated.replace(sglRegex, frVal);

      const rawRegex = new RegExp("\\b[tT]\\s*" + num + "\\b", "g");
      translated = translated.replace(rawRegex, frVal);
    }

    for (const [placeholder, frVal] of placeholderMap.entries()) {
      if (translated.includes(placeholder)) {
        translated = translated.replaceAll(placeholder, frVal);
      }
      const rawPlaceholder = placeholder.trim();
      if (translated.includes(rawPlaceholder)) {
        translated = translated.replaceAll(rawPlaceholder, frVal);
      }
    }

    translated = translated.replace(/\s+/g, " ").trim();
    console.log(`\n${colors.bold}${colors.green}Texte traduit :${colors.reset}`);
    console.log(translated);
  });

// 2. search
program
  .command("search <query>")
  .description("Fuzzy search ultra-rapide sur l'ensemble des entités du jeu (Inagle)")
  .action(async (query: string) => {
    console.log(`${colors.cyan}Recherche Inagle pour : "${query}"...${colors.reset}`);
    const svc = await createInagleService();
    const results = svc.search.global(query, { limit: 15 });

    if (results.length === 0) {
      console.log(`${colors.yellow}Aucun résultat trouvé.${colors.reset}`);
      return;
    }

    console.log(`\n${colors.bold}${colors.blue}Résultats de la recherche :${colors.reset}`);
    console.log("─".repeat(80));
    for (const r of results) {
      const typeLabel = r.type.toUpperCase().padEnd(10);
      const nameLabel = `${colors.bold}${r.name}${colors.reset}`.padEnd(45);
      const idLabel = `${colors.yellow}(ID/Code: ${r.id})${colors.reset}`;
      console.log(`[${colors.green}${typeLabel}${colors.reset}] ${nameLabel} ${idLabel}`);
    }
    console.log("─".repeat(80));
  });

// 3. db query
program
  .command("db <sql>")
  .description("Exécute une requête SQL sur le cache local SQLite")
  .action((sql: string) => {
    const dbPath = getSqlitePath();
    if (!dbPath) {
      console.error(`${colors.red}Erreur: Aucune base de données SQLite localisée.${colors.reset}`);
      return;
    }
    console.log(`${colors.cyan}SQLite DB utilisé : ${dbPath}${colors.reset}`);
    const { Database: DBConstructor } = require("bun:sqlite");
    
    try {
      const db = new DBConstructor(dbPath, { readonly: true });
      const results = db.query(sql).all();
      
      console.log(`\n${colors.green}Résultats (${results.length} lignes) :${colors.reset}`);
      console.log(JSON.stringify(results, null, 2));
      db.close();
    } catch (e: any) {
      console.error(`${colors.red}Erreur SQL : ${e.message}${colors.reset}`);
    }
  });

// 4. redis cache
program
  .command("redis <cmd> <key> [val]")
  .description("Interagit avec le cache Redis (get, set, del)")
  .action(async (cmd: string, key: string, val?: string) => {
    try {
      if (cmd === "get") {
        const res = await cache.get(key);
        console.log(`${colors.green}Résultat Redis (${key}) :${colors.reset}`);
        console.log(JSON.stringify(res, null, 2));
      } else if (cmd === "set") {
        if (!val) {
          console.error(`${colors.red}Erreur : Valeur requise pour set.${colors.reset}`);
          return;
        }
        let parsedVal: any = val;
        try {
          parsedVal = JSON.parse(val);
        } catch {
          // keep as string
        }
        await cache.set(key, parsedVal);
        console.log(`${colors.green}Clé Redis ${key} mise à jour avec succès.${colors.reset}`);
      } else if (cmd === "del") {
        await cache.del(key);
        console.log(`${colors.green}Clé Redis ${key} supprimée avec succès.${colors.reset}`);
      } else {
        console.error(`${colors.red}Commande inconnue. Utlisez: get, set ou del${colors.reset}`);
      }
    } catch (e: any) {
      console.error(`${colors.red}Erreur Redis : ${e.message}${colors.reset}`);
    } finally {
      // Bun force exit to release Redis handle
      process.exit(0);
    }
  });

// 5. glossary rebuild
program
  .command("glossary-rebuild")
  .description("Regroupe et renforce le glossaire (inagle, text binaries, fr.json)")
  .action(async () => {
    console.log(`${colors.cyan}Lancement de la reconstruction complète du glossaire...${colors.reset}`);
    try {
      const { main: rebuildGlossary } = require("../scripts/build-glossary.ts");
      await rebuildGlossary();
    } catch (e: any) {
      console.error(`${colors.red}Erreur de reconstruction : ${e.message}${colors.reset}`);
    }
  });

// 6. audit
program
  .command("audit")
  .description("Audit et diagnostics sur l'intégrité des traductions et de la base de données")
  .action(async () => {
    console.log(`${colors.cyan}Démarrage de l'audit de base de données...${colors.reset}`);
    const svc = await createInagleService();
    const chars = svc.characters.all();
    const skills = svc.skills.all();

    console.log(`\n${colors.bold}${colors.blue}Diagnostics Characters :${colors.reset}`);
    const missingName = chars.filter((c) => !c.names?.fr && !c.names?.en);
    const missingImg = chars.filter((c) => !c.image_url && !c.zukan_hash);
    const missingStats = chars.filter((c) => !c.stats || Object.keys(c.stats).length === 0);

    console.log(`- Total Characters : ${chars.length}`);
    console.log(`- Sans nom FR/EN   : ${missingName.length === 0 ? colors.green + "0 (Excellent)" : colors.red + missingName.length} ${colors.reset}`);
    console.log(`- Sans image       : ${missingImg.length === 0 ? colors.green + "0 (Excellent)" : colors.yellow + missingImg.length} ${colors.reset}`);
    console.log(`- Sans stats       : ${missingStats.length === 0 ? colors.green + "0 (Excellent)" : colors.red + missingStats.length} ${colors.reset}`);

    console.log(`\n${colors.bold}${colors.blue}Diagnostics Skills/Techniques :${colors.reset}`);
    const missingSkillName = skills.filter((s) => !s.name_FR && !s.name_EN);
    console.log(`- Total Skills     : ${skills.length}`);
    console.log(`- Sans nom FR/EN   : ${missingSkillName.length === 0 ? colors.green + "0 (Excellent)" : colors.red + missingSkillName.length} ${colors.reset}`);

    console.log(`\n${colors.bold}${colors.green}Audit complété avec succès !${colors.reset}`);
  });

program.parse();
