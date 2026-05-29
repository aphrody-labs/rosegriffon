/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { Browser } from "@aphrody-code/bxc";
import * as cheerio from "cheerio";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

const DATA_ROOT = "/home/ubuntu/rg/data/inazuma.jp/victory-road";

export async function crawlNews(): Promise<{ success: boolean; error?: string }> {
  console.log("[Crawl News] Démarrage du crawl des actualités (Topics et Patch Notes)...");
  
  try {
    const page = await Browser.newPage({ profile: "stealth" });

    // ==========================================
    // 1. CRAWL TOPICS (FR)
    // ==========================================
    const topicsDir = join(DATA_ROOT, "fr/topics");
    await mkdir(topicsDir, { recursive: true });

    console.log("[Crawl News] Scraping Topics list index...");
    await page.goto("https://www.inazuma.jp/victory-road/fr/topics/");
    const topicsIndexHtml = await page.content();
    await writeFile(join(topicsDir, "index.html"), topicsIndexHtml);

    const $topics = cheerio.load(topicsIndexHtml);
    const topicLinks: { id: string; url: string; title: string; date: string }[] = [];

    // Récupère les liens de topics
    $topics("ul.list li").each((_, el) => {
      const dt = $topics(el).find("dt").text().trim();
      const dd = $topics(el).find("dd");
      const link = dd.find("a");
      const href = link.attr("href") || "";
      const title = link.text().trim();

      if (!href || !title) return;

      const absoluteUrl = href.startsWith("http")
        ? href
        : `https://www.inazuma.jp${href}`;

      const id = absoluteUrl.split("/").filter(Boolean).pop() || "";
      if (id && id !== "topics" && id !== "fr") {
        topicLinks.push({ id, url: absoluteUrl, title, date: dt });
      }
    });

    console.log(`[Crawl News] ${topicLinks.length} topics trouvés. Traitement des détails...`);

    for (const topic of topicLinks) {
      const detailDir = join(topicsDir, topic.id);
      const detailPath = join(detailDir, "index.html");

      if (existsSync(detailPath)) {
        // Déjà scrapé, on passe
        continue;
      }

      console.log(`[Crawl News] Scraping topic detail: ${topic.title} (${topic.url})`);
      await mkdir(detailDir, { recursive: true });

      try {
        await page.goto(topic.url);
        const detailHtml = await page.content();
        await writeFile(detailPath, detailHtml);

        // Sauvegarde de meta.json
        const meta = {
          id: topic.id,
          title: topic.title,
          date: topic.date,
          url: topic.url,
          category: "General",
          thumbnail: null
        };
        await writeFile(join(detailDir, "meta.json"), JSON.stringify(meta, null, 2));
      } catch (err) {
        console.error(`[Crawl News] Erreur lors du scraping de topic ${topic.id} :`, err);
      }
    }

    // ==========================================
    // 2. CRAWL PATCH NOTES (EN)
    // ==========================================
    const patchNotesDir = join(DATA_ROOT, "en/patchnote");
    const platforms = ["ps-steam", "switch", "xbox"] as const;

    for (const platform of platforms) {
      const platformDir = join(patchNotesDir, platform);
      await mkdir(platformDir, { recursive: true });

      const platformUrl = `https://www.inazuma.jp/victory-road/en/patchnote/${platform}/`;
      console.log(`[Crawl News] Scraping Patch Notes index pour la plateforme ${platform} : ${platformUrl}`);
      
      try {
        await page.goto(platformUrl);
        const platformHtml = await page.content();
        
        const $patch = cheerio.load(platformHtml);
        const patchLinks: { id: string; url: string; title: string; date: string }[] = [];

        $patch("a").each((_, el) => {
          const href = $patch(el).attr("href");
          if (!href || !href.includes("/ver_")) return;

          const fullText = $patch(el).text().trim();
          const dateMatch = fullText.match(/(\d{4}\.\d{1,2}\.\d{1,2})/);
          const date = dateMatch ? dateMatch[0] : "";
          const title = fullText.replace(date, "").replace("[JST]", "").replace(/\s+/g, " ").trim();

          const absoluteUrl = href.startsWith("http") ? href : `https://www.inazuma.jp${href}`;
          const id = absoluteUrl.split("/").filter(Boolean).pop() || "";

          if (id && !patchLinks.find(p => p.id === id)) {
            patchLinks.push({ id, url: absoluteUrl, title: title || "Patch Note", date });
          }
        });

        // Sauvegarde de index.json pour la plateforme
        await writeFile(join(platformDir, "index.json"), JSON.stringify(patchLinks, null, 2));

        console.log(`[Crawl News] Platform ${platform} : ${patchLinks.length} patch notes trouvés.`);

        for (const patch of patchLinks) {
          const patchDetailDir = join(platformDir, patch.id);
          const patchDetailPath = join(patchDetailDir, "index.html");

          if (existsSync(patchDetailPath)) {
            continue;
          }

          console.log(`[Crawl News] Scraping patch note detail: ${patch.title} (${patch.url})`);
          await mkdir(patchDetailDir, { recursive: true });

          try {
            await page.goto(patch.url);
            const patchHtml = await page.content();
            await writeFile(patchDetailPath, patchHtml);

            // Sauvegarde de data.json
            const data = {
              id: patch.id,
              title: patch.title,
              date: patch.date,
              url: patch.url,
              platform: platform === "ps-steam" ? ["ps4", "ps5", "steam"] : [platform],
              featured_image: null
            };
            await writeFile(join(patchDetailDir, "data.json"), JSON.stringify(data, null, 2));
          } catch (err) {
            console.error(`[Crawl News] Erreur lors du scraping du patch note ${patch.id} :`, err);
          }
        }
      } catch (err) {
        console.error(`[Crawl News] Erreur de chargement pour la plateforme ${platform} :`, err);
      }
    }

    await page.close();
    console.log("[Crawl News] Synchronisation des actualités terminée avec succès.");
    return { success: true };
  } catch (err: any) {
    console.error("[Crawl News] Erreur critique lors du crawl des actualités :", err);
    return { success: false, error: err.message || String(err) };
  }
}
