/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { crawlDataPath } from "../../lib/shared-path";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const DATA_ROOT = crawlDataPath("reddit");

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  permalink: string;
  url: string;
  created_utc: number;
  score: number;
  num_comments: number;
}

/**
 * Crawle les derniers posts du subreddit r/inazumaeleven pour Victory Road.
 */
export async function crawlReddit(): Promise<{ success: boolean; count: number; error?: string }> {
  console.log("[Crawl Reddit] Démarrage du crawl Reddit...");

  try {
    await mkdir(DATA_ROOT, { recursive: true });

    // Requête sur le flux JSON de Reddit
    const url = "https://www.reddit.com/r/inazumaeleven/new.json?limit=50";

    // `fetch` natif : Reddit sert ce flux JSON sans navigateur. Il refuse en revanche
    // les IP de centres de données sans jeton développeur (403 « blocked by network
    // security ») : l'échec est alors explicite, jamais un succès à vide.
    const reponse = await fetch(url, {
      headers: { "user-agent": "rosegriffon-cron/1.0 (+https://rosegriffon.fr)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!reponse.ok) {
      throw new Error(`Reddit a répondu HTTP ${reponse.status} (${(await reponse.text()).slice(0, 80).trim()})`);
    }
    const json = (await reponse.json()) as { data?: { children?: { data: RedditPost }[] } };

    const children = json?.data?.children || [];
    let crawlCount = 0;

    console.log(`[Crawl Reddit] ${children.length} posts récupérés. Filtrage...`);

    for (const child of children) {
      const post = child.data as RedditPost;
      if (!post || !post.id) continue;

      // On ne garde que les posts en rapport avec Victory Road ou le jeu
      const isVictoryRoad =
        post.title.toLowerCase().includes("victory road") ||
        post.title.toLowerCase().includes("victoryroad") ||
        post.title.toLowerCase().includes("ievr") ||
        post.title.toLowerCase().includes("beta") ||
        post.title.toLowerCase().includes("hino") ||
        post.selftext.toLowerCase().includes("victory road") ||
        post.selftext.toLowerCase().includes("ievr");

      if (!isVictoryRoad) continue;

      const postDir = join(DATA_ROOT, post.id);
      const metaPath = join(postDir, "meta.json");
      const htmlPath = join(postDir, "index.html");

      // Si déjà sauvegardé, on passe
      if (existsSync(metaPath) && existsSync(htmlPath)) {
        continue;
      }

      await mkdir(postDir, { recursive: true });

      const meta = {
        id: post.id,
        title: post.title,
        url: `https://www.reddit.com${post.permalink}`,
        date: new Date(post.created_utc * 1000).toISOString().split("T")[0] || "",
        author: post.author,
        score: post.score,
        num_comments: post.num_comments,
        category: "Reddit",
        language: "en", // r/inazumaeleven est principalement anglophone
      };

      // Le corps du post au format HTML simple pour indexation
      const htmlContent = `
				<div class="reddit-post">
					<h1>${post.title}</h1>
					<p class="meta">Posté par u/${post.author} le ${meta.date} - Score: ${post.score} - Commentaires: ${post.num_comments}</p>
					<div class="content">
						${post.selftext ? post.selftext.replace(/\n/g, "<br/>") : `<a href="${post.url}">${post.url}</a>`}
					</div>
				</div>
			`;

      await writeFile(metaPath, JSON.stringify(meta, null, 2));
      await writeFile(htmlPath, htmlContent);
      crawlCount++;
    }

    console.log(`[Crawl Reddit] Terminé. ${crawlCount} nouveaux posts Victory Road enregistrés.`);
    return { success: true, count: crawlCount };
  } catch (err: any) {
    const msg = err.message || String(err);
    console.error("[Crawl Reddit] Erreur de crawl Reddit :", err);
    return { success: false, count: 0, error: msg };
  }
}
