/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import {
  vectorStore,
  getEmbedding,
  crawlerTracker,
  cache
} from "@rose-griffon/db/redis";

const DATA_ROOT = "/home/ubuntu/rg/data/inazuma.jp/victory-road";

interface ScrapedItem {
  id: string;
  type: "topic" | "patchnote";
  title: string;
  url: string;
  date: string;
  htmlPath: string;
  metadata: Record<string, any>;
}

/**
 * Nettoie le contenu HTML pour en extraire le texte brut utile au RAG.
 */
function cleanHtml(html: string): string {
  const $ = cheerio.load(html);
  
  // Supprimer les éléments inutiles (scripts, styles, navigation, pied de page)
  $("script, style, nav, footer, header, noscript, iframe").remove();
  
  // Cibles fréquentes pour les articles/contenus
  let contentArea = $(".detailArea, .newsArea, #newsDetail, .mainContents, article").first();
  if (contentArea.length === 0) {
    contentArea = $("body");
  }

  // Extraire le texte propre
  const text = contentArea.text()
    .replace(/\s+/g, " ") // normaliser les espaces/retours à la ligne
    .trim();

  return text;
}

/**
 * Calcule un hash simple pour détecter les modifications de texte.
 */
function computeStringHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * Scanne le dossier de données local pour collecter tous les topics et patch notes scrapés.
 */
function collectScrapedItems(): ScrapedItem[] {
  const items: ScrapedItem[] = [];

  // 1. Collecter les Topics (fr/topics)
  const topicsDir = join(DATA_ROOT, "fr/topics");
  if (existsSync(topicsDir)) {
    const subDirs = readdirSync(topicsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dir of subDirs) {
      const dirPath = join(topicsDir, dir);
      const metaPath = join(dirPath, "meta.json");
      const htmlPath = join(dirPath, "index.html");

      if (existsSync(metaPath) && existsSync(htmlPath)) {
        try {
          const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
          items.push({
            id: `topic-${dir}`,
            type: "topic",
            title: meta.title || "Topic",
            url: meta.url || "",
            date: meta.date || "",
            htmlPath,
            metadata: {
              id: dir,
              category: meta.category || "General",
              language: "fr"
            }
          });
        } catch (err) {
          console.error(`[RAG Sync] Erreur de lecture de meta pour topic ${dir} :`, err);
        }
      }
    }
  }

  // 2. Collecter les Patch Notes (en/patchnote)
  const patchNotesDir = join(DATA_ROOT, "en/patchnote");
  if (existsSync(patchNotesDir)) {
    const platforms = ["ps-steam", "switch", "xbox"];
    for (const platform of platforms) {
      const platformDir = join(patchNotesDir, platform);
      if (!existsSync(platformDir)) continue;

      const subDirs = readdirSync(platformDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const dir of subDirs) {
        const dirPath = join(platformDir, dir);
        const dataPath = join(dirPath, "data.json");
        const htmlPath = join(dirPath, "index.html");

        if (existsSync(dataPath) && existsSync(htmlPath)) {
          try {
            const data = JSON.parse(readFileSync(dataPath, "utf-8"));
            items.push({
              id: `patchnote-${platform}-${dir}`,
              type: "patchnote",
              title: data.title || "Patch Note",
              url: data.url || "",
              date: data.date || "",
              htmlPath,
              metadata: {
                id: dir,
                platform: data.platform || [platform],
                language: "en"
              }
            });
          } catch (err) {
            console.error(`[RAG Sync] Erreur de lecture de data pour patch ${dir} :`, err);
          }
        }
      }
    }
  }

  // 3. Collecter les pages Inazuma Eleven RE (re)
  const reDir = "/home/ubuntu/rg/data/inazuma.jp/re";
  if (existsSync(reDir)) {
    const subDirs = readdirSync(reDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dir of subDirs) {
      const dirPath = join(reDir, dir);
      const metaPath = join(dirPath, "meta.json");
      const htmlPath = join(dirPath, "index.html");

      if (existsSync(metaPath) && existsSync(htmlPath)) {
        try {
          const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
          items.push({
            id: `re-${dir}`,
            type: "re" as any,
            title: meta.title || "Inazuma Eleven RE",
            url: meta.url || "",
            date: meta.date || "",
            htmlPath,
            metadata: {
              id: dir,
              category: meta.category || "RE Remake",
              language: meta.language || dir
            }
          });
        } catch (err) {
          console.error(`[RAG Sync] Erreur de lecture de meta pour RE ${dir} :`, err);
        }
      }
    }
  }

  // 4. Collecter les pages Inazuma Eleven: Cross (cross)
  const crossDir = "/home/ubuntu/rg/data/inazuma-cross.jp";
  if (existsSync(crossDir)) {
    const subDirs = readdirSync(crossDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dir of subDirs) {
      const dirPath = join(crossDir, dir);
      const metaPath = join(dirPath, "meta.json");
      const htmlPath = join(dirPath, "index.html");

      if (existsSync(metaPath) && existsSync(htmlPath)) {
        try {
          const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
          items.push({
            id: `cross-${dir}`,
            type: "cross" as any,
            title: meta.title || "Inazuma Eleven: Cross",
            url: meta.url || "",
            date: meta.date || "",
            htmlPath,
            metadata: {
              id: dir,
              category: meta.category || "Cross Mobile",
              language: meta.language || dir
            }
          });
        } catch (err) {
          console.error(`[RAG Sync] Erreur de lecture de meta pour Cross ${dir} :`, err);
        }
      }
    }
  }

  // 5. Collecter les articles LEVEL-5 (level5)
  const level5Dir = "/home/ubuntu/rg/data/level5.co.jp/inazuma";
  if (existsSync(level5Dir)) {
    const subDirs = readdirSync(level5Dir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dir of subDirs) {
      const dirPath = join(level5Dir, dir);
      const metaPath = join(dirPath, "meta.json");
      const htmlPath = join(dirPath, "index.html");

      if (existsSync(metaPath) && existsSync(htmlPath)) {
        try {
          const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
          items.push({
            id: `level5-${dir}`,
            type: "level5" as any,
            title: meta.title || "LEVEL-5 Announcement",
            url: meta.url || "",
            date: meta.date || "",
            htmlPath,
            metadata: {
              id: dir,
              category: meta.category || "LEVEL-5 Press Release",
              language: meta.language || "ja"
            }
          });
        } catch (err) {
          console.error(`[RAG Sync] Erreur de lecture de meta pour Level5 ${dir} :`, err);
        }
      }
    }
  }

  return items;
}

/**
 * Synchronise et vectorise tous les nouveaux documents ou documents modifiés dans Redis.
 */
export async function runRagSync(): Promise<{ success: boolean; processed: number; errors: number }> {
  console.log("[RAG Sync] Lancement de la synchronisation vectorielle...");
  
  let processed = 0;
  let errors = 0;

  try {
    const items = collectScrapedItems();
    console.log(`[RAG Sync] ${items.length} documents scrapés trouvés localement.`);

    for (const item of items) {
      try {
        const html = readFileSync(item.htmlPath, "utf-8");
        const cleanText = cleanHtml(html);
        
        if (cleanText.length < 50) {
          // Document vide ou invalide
          continue;
        }

        // Ajout d'une entête descriptive pour enrichir le contexte RAG
        const formattedDocumentText = `Titre: ${item.title}\nDate: ${item.date}\nType: ${item.type}\nContenu:\n${cleanText}`;
        const contentHash = computeStringHash(formattedDocumentText);

        const shouldSync = await crawlerTracker.shouldProcess(item.id, contentHash);
        
        if (!shouldSync) {
          // Déjà indexé avec ce contenu exact
          continue;
        }

        console.log(`[RAG Sync] Vectorisation de : ${item.title} (${item.type})`);
        
        // Génération de l'embedding (OpenAI ou Fallback déterministe)
        const embedding = await getEmbedding(formattedDocumentText);
        
        // Sauvegarde dans le vectorStore Redis
        await vectorStore.saveDocument("inazuma-news", {
          id: item.id,
          text: formattedDocumentText,
          embedding,
          metadata: {
            title: item.title,
            url: item.url,
            date: item.date,
            type: item.type,
            ...item.metadata
          }
        });

        // Enregistrer le hash
        await crawlerTracker.markProcessed(item.id, contentHash);
        processed++;
      } catch (err) {
        console.error(`[RAG Sync] Erreur lors de la vectorisation de ${item.title} :`, err);
        errors++;
      }
    }

    console.log(`[RAG Sync] Fin de la synchronisation. ${processed} documents vectorisés, ${errors} erreurs.`);
    return { success: true, processed, errors };
  } catch (err) {
    console.error("[RAG Sync] Erreur critique lors de la synchronisation RAG :", err);
    return { success: false, processed, errors };
  }
}

/**
 * Interroge le RAG en cherchant les documents les plus proches sémantiquement.
 */
export async function queryRag(question: string, limit = 4) {
  console.log(`[RAG Query] Recherche sémantique pour : "${question}"`);
  
  // Générer l'embedding de la question
  const questionEmbedding = await getEmbedding(question);
  
  // Rechercher dans la collection
  const results = await vectorStore.search("inazuma-news", questionEmbedding, limit);
  
  return results.map(r => ({
    id: r.document.id,
    title: r.document.metadata.title,
    date: r.document.metadata.date,
    url: r.document.metadata.url,
    type: r.document.metadata.type,
    text: r.document.text,
    score: r.score
  }));
}
