/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { crawlDataPath } from "../../lib/shared-path";
import { WebCdpPage, waitForSelector } from "../../lib/web-cdp";
import { extrairePatchNotes, extraireTopics } from "./html-extract";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const DATA_ROOT = crawlDataPath("inazuma.jp/victory-road");

async function safeGoto(page: WebCdpPage, url: string, timeout = 30000): Promise<unknown> {
  return Promise.race([
    page.goto(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Navigation timeout (${timeout}ms) pour ${url}`)), timeout),
    ),
  ]);
}

export async function crawlNews(): Promise<{ success: boolean; error?: string }> {
  console.log("[Crawl News] Démarrage du crawl des actualités (Topics et Patch Notes) multi-langues...");

  let page: WebCdpPage | undefined;
  try {
    page = await WebCdpPage.connect();

    // ==========================================
    // 1. CRAWL TOPICS (FR, EN, JA)
    // ==========================================
    const topicLocales = ["fr", "en", "ja", "es", "de", "it", "zh-tw", "zh-cn", "pt-br"] as const;

    for (const locale of topicLocales) {
      const topicsDir = join(DATA_ROOT, locale, "topics");
      await mkdir(topicsDir, { recursive: true });

      const url =
        locale === "ja"
          ? "https://www.inazuma.jp/victory-road/topics/"
          : `https://www.inazuma.jp/victory-road/${locale}/topics/`;

      console.log(`[Crawl News] Scraping Topics index [${locale}] : ${url}`);
      try {
        await safeGoto(page, url);
        await waitForSelector(page, "body", 15000).catch(() => {});
        const topicsIndexHtml = await page.content();
        await writeFile(join(topicsDir, "index.html"), topicsIndexHtml);

        const topicLinks = extraireTopics(topicsIndexHtml);

        console.log(`[Crawl News] Topics [${locale}] : ${topicLinks.length} trouvés. Traitement des détails...`);

        for (const topic of topicLinks) {
          const detailDir = join(topicsDir, topic.id);
          const detailPath = join(detailDir, "index.html");

          if (existsSync(detailPath)) {
            continue;
          }

          console.log(`[Crawl News] Scraping topic detail [${locale}]: ${topic.title} (${topic.url})`);
          await mkdir(detailDir, { recursive: true });

          try {
            await safeGoto(page, topic.url);
            await waitForSelector(page, "body", 15000).catch(() => {});
            const detailHtml = await page.content();
            await writeFile(detailPath, detailHtml);

            const meta = {
              id: topic.id,
              title: topic.title,
              date: topic.date,
              url: topic.url,
              locale,
              category: "General",
              thumbnail: null,
            };
            await writeFile(join(detailDir, "meta.json"), JSON.stringify(meta, null, 2));
          } catch (err) {
            console.error(`[Crawl News] Erreur lors du scraping de topic ${topic.id} [${locale}] :`, err);
          }
        }
      } catch (err) {
        console.error(`[Crawl News] Erreur lors du chargement de l'index des topics [${locale}] :`, err);
      }
    }

    // ==========================================
    // 2. CRAWL PATCH NOTES (EN, JA)
    // ==========================================
    const patchLocales = ["en", "ja"] as const;
    const platforms = ["ps-steam", "switch", "xbox"] as const;

    for (const locale of patchLocales) {
      for (const platform of platforms) {
        const platformDir = join(DATA_ROOT, locale, "patchnote", platform);
        await mkdir(platformDir, { recursive: true });

        const platformUrl =
          locale === "ja"
            ? `https://www.inazuma.jp/victory-road/patchnote/${platform}/`
            : `https://www.inazuma.jp/victory-road/en/patchnote/${platform}/`;

        console.log(`[Crawl News] Scraping Patch Notes index [${locale}] plateforme ${platform} : ${platformUrl}`);

        try {
          await safeGoto(page, platformUrl);
          await waitForSelector(page, "body", 15000).catch(() => {});
          const platformHtml = await page.content();

          const patchLinks = extrairePatchNotes(platformHtml);

          await writeFile(join(platformDir, "index.json"), JSON.stringify(patchLinks, null, 2));
          console.log(`[Crawl News] Platform [${locale}] ${platform} : ${patchLinks.length} patch notes trouvés.`);

          for (const patch of patchLinks) {
            const patchDetailDir = join(platformDir, patch.id);
            const patchDetailPath = join(patchDetailDir, "index.html");

            if (existsSync(patchDetailPath)) {
              continue;
            }

            console.log(`[Crawl News] Scraping patch note detail [${locale}]: ${patch.title} (${patch.url})`);
            await mkdir(patchDetailDir, { recursive: true });

            try {
              await safeGoto(page, patch.url);
              await waitForSelector(page, "body", 15000).catch(() => {});
              const patchHtml = await page.content();
              await writeFile(patchDetailPath, patchHtml);

              const data = {
                id: patch.id,
                title: patch.title,
                date: patch.date,
                url: patch.url,
                locale,
                platform: platform === "ps-steam" ? ["ps4", "ps5", "steam"] : [platform],
                featured_image: null,
              };
              await writeFile(join(patchDetailDir, "data.json"), JSON.stringify(data, null, 2));
            } catch (err) {
              console.error(`[Crawl News] Erreur lors du scraping du patch note ${patch.id} [${locale}] :`, err);
            }
          }
        } catch (err) {
          console.error(`[Crawl News] Erreur de chargement pour la plateforme ${platform} [${locale}] :`, err);
        }
      }
    }

    console.log("[Crawl News] Synchronisation des actualités multi-langues terminée avec succès.");
    return { success: true };
  } catch (err: any) {
    console.error("[Crawl News] Erreur critique lors du crawl des actualités :", err);
    return { success: false, error: err.message || String(err) };
  } finally {
    await page?.close().catch(() => undefined);
  }
}
