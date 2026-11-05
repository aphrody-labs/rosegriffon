/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { crawlDataPath } from "../../lib/shared-path";
import { WebCdpPage, waitForSelector } from "../../lib/web-cdp";
import { extraireLevel5BlogIndex, extraireLevel5BlogTexte } from "./html-extract";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_ROOT = crawlDataPath("level5.co.jp/blog");

async function safeGoto(page: WebCdpPage, url: string, timeout = 30000): Promise<unknown> {
  return Promise.race([
    page.goto(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Navigation timeout (${timeout}ms) pour ${url}`)), timeout),
    ),
  ]);
}

interface BlogArticle {
  id: string;
  url: string;
  title: string;
  date: string;
  locale: "ja" | "en" | "zh-tw" | "zh-cn";
}

export async function crawlLevel5Blog(): Promise<{
  success: boolean;
  error?: string;
  count?: number;
}> {
  console.log("[Crawl Level5 Blog] Démarrage du crawl du blog LEVEL-5 (5つ星工房日記 / Five-Star Workshop)...");

  let page: WebCdpPage | undefined;
  try {
    page = await WebCdpPage.connect();
    const articles: BlogArticle[] = [];

    // 1. Scraping du Blog Japonais, Anglais et Chinois (Traditionnel & Simplifié)
    const targets = [
      { locale: "ja" as const, url: "https://www.level5.co.jp/blog/" },
      { locale: "en" as const, url: "https://www.level5.co.jp/blog/en/" },
      { locale: "zh-tw" as const, url: "https://www.level5.co.jp/blog/zh-tw/" },
      { locale: "zh-cn" as const, url: "https://www.level5.co.jp/blog/zh-cn/" },
    ];

    for (const target of targets) {
      console.log(`[Crawl Level5 Blog] Index scraping (${target.locale}) : ${target.url}`);
      try {
        await safeGoto(page, target.url);
        await waitForSelector(page, "body", 15000).catch(() => {});
        const indexHtml = await page.content();
        // Articles de la section "recent" de l'aside (hrefs "/blog/250303/", "/blog/en/250303/"…),
        // puis l'article à la une affiché en entier sur la page d'accueil (id "latest").
        for (const entree of extraireLevel5BlogIndex(indexHtml, target.url)) {
          if (!articles.find(a => a.id === entree.id && a.locale === target.locale)) {
            articles.push({ ...entree, locale: target.locale });
          }
        }
      } catch (err) {
        console.error(`[Crawl Level5 Blog] Erreur lors du scraping de l'index ${target.locale} :`, err);
      }
    }

    console.log(`[Crawl Level5 Blog] ${articles.length} articles trouvés. Téléchargement des détails...`);
    let count = 0;

    for (const art of articles) {
      const outputDir = join(DATA_ROOT, art.locale, art.id);
      const indexPath = join(outputDir, "index.html");

      if (existsSync(indexPath)) {
        continue;
      }

      console.log(`[Crawl Level5 Blog] Scraping article [${art.locale}] : ${art.title} (${art.url})`);
      await mkdir(outputDir, { recursive: true });

      try {
        await safeGoto(page, art.url);
        await waitForSelector(page, "body", 15000).catch(() => {});
        const detailHtml = await page.content();
        await writeFile(indexPath, detailHtml);

        const contentText = extraireLevel5BlogTexte(detailHtml);

        const meta = {
          id: art.id,
          title: art.title,
          date: art.date,
          url: art.url,
          locale: art.locale,
          category: "LEVEL-5 Developer Blog",
          content_text_snippet: contentText.substring(0, 500),
        };

        await writeFile(join(outputDir, "meta.json"), JSON.stringify(meta, null, 2));
        count++;
      } catch (err) {
        console.error(`[Crawl Level5 Blog] Erreur lors du scraping du détail pour ${art.id} :`, err);
      }
    }

    console.log(`[Crawl Level5 Blog] Crawl terminé avec succès. ${count} nouveaux articles stockés.`);
    return { success: true, count };
  } catch (err: any) {
    console.error("[Crawl Level5 Blog] Erreur critique lors du crawl du blog Level5 :", err);
    return { success: false, error: err.message || String(err) };
  } finally {
    await page?.close().catch(() => undefined);
  }
}
