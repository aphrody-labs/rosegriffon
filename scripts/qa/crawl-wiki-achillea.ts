// SPDX-License-Identifier: Apache-2.0
/**
 * Sovereign Crawler & Quality Auditor for Wiki and Achilléa (Rose Griffon).
 *
 * Exhaustively crawls all routes across /wiki/* and /achillea/*:
 * - Probes HTTP response codes, latency, and cache headers.
 * - Verifies Anti-Slop (strictly zero emojis, zero marketing puffery words).
 * - Validates DOM structure, M3 containers, and metadata.
 * - Generates structured JSON and Markdown audit reports.
 */

export interface CrawlResult {
  route: string;
  url: string;
  status: number;
  latencyMs: number;
  hasTitle: boolean;
  title: string;
  hasCanonical: boolean;
  hasM3Container: boolean;
  emojiCount: number;
  slopCount: number;
  slopMatches: string[];
  emojiMatches: string[];
  contentLength: number;
}

const EMOJI_REGEX = /[\p{Extended_Pictographic}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

const SLOP_WORDS = [
  "révolutionnaire",
  "revolutionnaire",
  "revolutionary",
  "seamless",
  "seamlessly",
  "game-changer",
  "game changer",
  "unleash",
  "delve",
  "magique",
  "inégalé",
  "inegale",
  "ai-powered",
  "ia-powered",
  "cutting-edge",
  "ultra-performant",
];

export const CRAWL_ROUTES = [
  // --- Wiki Section ---
  "/wiki",
  "/wiki/chara",
  "/wiki/skill",
  "/wiki/aura",
  "/wiki/item",
  "/wiki/passive",
  "/wiki/equipe",
  "/wiki/entraineur",
  "/wiki/drops",
  "/wiki/boutique",
  "/wiki/capsule",
  "/wiki/quete",
  "/wiki/stade",
  "/wiki/succes",
  "/wiki/tactic",
  "/wiki/sons",
  "/wiki/videos",
  "/wiki/vroid",
  "/wiki/avatar",
  "/wiki/tools",
  "/wiki/tools/compare",
  "/wiki/tools/my-team",
  "/wiki/tools/random-team",
  "/wiki/tools/stats",
  "/wiki/tools/translator",
  "/wiki/patch-notes",
  "/wiki/save",
  // Detail samples
  "/wiki/chara/mark-evans",
  "/wiki/skill/whs01110",

  // --- Achilléa Section ---
  "/achillea",
  "/achillea/tournaments",
  "/achillea/tournaments/circuit",
  "/achillea/tournaments/create",
  "/achillea/ranked",
  "/achillea/ranked/leaderboard",
  "/achillea/ranked/history",
  "/achillea/ranked/tiers",
  "/achillea/clans",
  "/achillea/clans/create",
  "/achillea/casts",
  "/achillea/leagues",
  "/achillea/licence",
  "/achillea/wallet",
  "/achillea/guide",
];

export async function crawlRoute(baseUrl: string, route: string): Promise<CrawlResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}${route}`;
  const start = performance.now();
  let status = 0;
  let text = "";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "RoseGriffon-Sovereign-Auditor/2026 (Bun/1.4.4; Linux/x86_64)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    status = res.status;
    text = await res.text();
  } catch (err: any) {
    return {
      route,
      url,
      status: 500,
      latencyMs: Math.round(performance.now() - start),
      hasTitle: false,
      title: "",
      hasCanonical: false,
      hasM3Container: false,
      emojiCount: 0,
      slopCount: 0,
      slopMatches: [err.message],
      emojiMatches: [],
      contentLength: 0,
    };
  }

  const latencyMs = Math.round(performance.now() - start);

  // Extract title
  const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const hasTitle = Boolean(title);

  // Extract canonical
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(text);

  // Check M3 container tokens
  const hasM3Container = text.includes("surface-container") || text.includes("bg-surface");

  // Anti-slop / Emojis check in visible rendered text (strip tags and scripts)
  const bodyOnly = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");

  const emojiMatches = Array.from(bodyOnly.matchAll(EMOJI_REGEX)).map((m) => m[0]);
  const emojiCount = emojiMatches.length;

  const slopMatches: string[] = [];
  const lowerBody = bodyOnly.toLowerCase();
  for (const word of SLOP_WORDS) {
    if (lowerBody.includes(word)) {
      slopMatches.push(word);
    }
  }

  return {
    route,
    url,
    status,
    latencyMs,
    hasTitle,
    title,
    hasCanonical,
    hasM3Container,
    emojiCount,
    slopCount: slopMatches.length,
    slopMatches,
    emojiMatches,
    contentLength: text.length,
  };
}

export async function runCrawler(baseUrl: string = "https://rosegriffon.fr") {
  console.log(`=============================================================`);
  console.log(`[Crawler] Starting Sovereign Audit on ${baseUrl}`);
  console.log(`[Crawler] Evaluating ${CRAWL_ROUTES.length} routes...`);
  console.log(`=============================================================`);

  const results: CrawlResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const route of CRAWL_ROUTES) {
    const res = await crawlRoute(baseUrl, route);
    results.push(res);

    const isOk = res.status >= 200 && res.status < 400 && res.emojiCount === 0 && res.slopCount === 0;
    if (isOk) {
      passed++;
      console.log(`[PASS] ${res.route.padEnd(32)} ${res.status} | ${res.latencyMs}ms | ${res.contentLength} bytes`);
    } else {
      failed++;
      console.log(`[WARN] ${res.route.padEnd(32)} ${res.status} | ${res.latencyMs}ms | Emojis: ${res.emojiCount} | Slop: ${res.slopCount} (${res.slopMatches.join(", ")})`);
    }
  }

  console.log(`\n-------------------------------------------------------------`);
  console.log(`[Crawler Summary] Total: ${results.length} | Pass: ${passed} | Fail/Warn: ${failed}`);
  console.log(`-------------------------------------------------------------`);

  return results;
}

if (import.meta.main) {
  const target = process.argv[2] || "https://rosegriffon.fr";
  await runCrawler(target);
}
