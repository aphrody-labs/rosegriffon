// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { crawlRoute } from "../../../scripts/qa/crawl-wiki-achillea";

describe("Wiki & Achilléa Modern Web UI/UX Pro & Anti-Slop Suite", () => {
  const PROD_URL = "https://rosegriffon.fr";

  test("Canonical routes exist and return HTTP 200", async () => {
    const keyRoutes = [
      "/wiki",
      "/wiki/chara",
      "/wiki/skill",
      "/wiki/item",
      "/wiki/passive",
      "/wiki/aura",
      "/wiki/equipe",
      "/wiki/tools",
      "/wiki/tools/compare",
      "/wiki/chara/mark-evans",
      "/wiki/skill/whs01110",
      "/achillea",
      "/achillea/tournaments",
      "/achillea/ranked",
      "/achillea/clans",
      "/achillea/licence",
      "/achillea/guide",
    ];

    for (const route of keyRoutes) {
      const res = await crawlRoute(PROD_URL, route);
      expect(res.status).toBe(200);
      expect(res.hasTitle).toBe(true);
      expect(res.contentLength).toBeGreaterThan(10000);
    }
  }, 30000);

  test("Anti-Slop Directive: Ban generic AI marketing buzzwords", async () => {
    const sampledRoutes = [
      "/wiki",
      "/wiki/chara",
      "/wiki/skill",
      "/achillea",
      "/achillea/tournaments",
      "/achillea/ranked",
    ];

    for (const route of sampledRoutes) {
      const res = await crawlRoute(PROD_URL, route);
      // Filter out official Level-5 team names like 'Les Révolutionnaires'
      const nonLoreSlop = res.slopMatches.filter(
        (w) => w !== "révolutionnaire" && w !== "revolutionnaire",
      );
      expect(nonLoreSlop).toHaveLength(0);
    }
  }, 30000);

  test("Anti-Slop Directive: Zero emojis in static Wiki UI", async () => {
    const staticWikiRoutes = [
      "/wiki/chara",
      "/wiki/skill",
      "/wiki/item",
      "/wiki/tools/random-team",
      "/wiki/tools/compare",
    ];

    for (const route of staticWikiRoutes) {
      const res = await crawlRoute(PROD_URL, route);
      expect(res.emojiCount).toBe(0);
    }
  }, 20000);

  test("Design System M3 & Fluent 2 Integration", async () => {
    const res = await crawlRoute(PROD_URL, "/wiki");
    expect(res.hasM3Container).toBe(true);

    const achilleaRes = await crawlRoute(PROD_URL, "/achillea");
    expect(achilleaRes.hasM3Container).toBe(true);
  }, 15000);
});
