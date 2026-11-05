/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { crawlDataPath } from "../../lib/shared-path";
import { WebCdpPage, waitForSelector } from "../../lib/web-cdp";
import { extraireLevel5News } from "./html-extract";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_ROOT = crawlDataPath("level5.co.jp/inazuma");

async function safeGoto(page: WebCdpPage, url: string, timeout = 30000): Promise<unknown> {
  return Promise.race([
    page.goto(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Navigation timeout (${timeout}ms) pour ${url}`)), timeout),
    ),
  ]);
}

export async function crawlLevel5(): Promise<{ success: boolean; error?: string }> {
  console.log("[Crawl Level5] Démarrage du crawl des actualités LEVEL-5...");

  let page: WebCdpPage | undefined;
  try {
    page = await WebCdpPage.connect();

    console.log("[Crawl Level5] Navigation vers https://www.level5.co.jp/news/");
    await safeGoto(page, "https://www.level5.co.jp/news/");
    await waitForSelector(page, "body", 15000).catch(() => {});
    const indexHtml = await page.content();

    // Liens vers les articles d'actualités (format news/YYYYMMDD/)
    const articles = extraireLevel5News(indexHtml);

    console.log(`[Crawl Level5] ${articles.length} communiqués trouvés au total. Filtrage pour Inazuma Eleven...`);
    let crawlCount = 0;

    for (const art of articles) {
      const outputDir = join(DATA_ROOT, art.id);
      const indexPath = join(outputDir, "index.html");

      if (existsSync(indexPath)) {
        // Déjà traité
        continue;
      }

      console.log(`[Crawl Level5] Inspection de l'article : ${art.title} (${art.url})`);
      try {
        await safeGoto(page, art.url);
        await waitForSelector(page, "body", 15000).catch(() => {});
        const detailHtml = await page.content();

        // On vérifie si l'article parle de Inazuma Eleven (イナズマ or Inazuma)
        const lowerHtml = detailHtml.toLowerCase();
        const isInazumaRelated = lowerHtml.includes("イナズマ") || lowerHtml.includes("inazuma");

        if (!isInazumaRelated) {
          console.log(`[Crawl Level5] Article ${art.id} non lié à Inazuma Eleven, ignoré.`);
          continue;
        }

        console.log(`[Crawl Level5] -> Sauvegarde de l'article lié à Inazuma: ${art.title}`);
        await mkdir(outputDir, { recursive: true });
        await writeFile(indexPath, detailHtml);

        const meta = {
          id: art.id,
          title: art.title,
          date: art.date,
          url: art.url,
          category: "LEVEL-5 Press Release",
          language: "ja",
        };
        await writeFile(join(outputDir, "meta.json"), JSON.stringify(meta, null, 2));
        crawlCount++;
      } catch (err) {
        console.error(`[Crawl Level5] Erreur lors du scraping de l'article ${art.id} :`, err);
      }
    }

    console.log(`[Crawl Level5] Crawl terminé. ${crawlCount} nouveaux articles Inazuma Eleven enregistrés.`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Crawl Level5] Erreur critique lors du crawl Level5 :", err);
    return { success: false, error: msg };
  } finally {
    await page?.close().catch(() => undefined);
  }
}
