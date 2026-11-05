import { describe, expect, it } from "bun:test";

import { clampText, DESCRIPTION_MAX, TITLE_MAX, titleWithSuffix, wikiTitle } from "./seo";

describe("clampText", () => {
  it("returns short text unchanged, whitespace collapsed", () => {
    expect(clampText("  a\n\nb   c ")).toBe("a b c");
    expect(clampText(null)).toBe("");
  });

  it("never exceeds the limit and cuts on a word boundary", () => {
    const long = "mot ".repeat(100);
    const out = clampText(long);
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out.endsWith("mot…")).toBe(true);
  });

  it("drops trailing punctuation before the ellipsis", () => {
    expect(clampText("Bonjour, le monde entier", 12)).toBe("Bonjour…");
  });

  it("titleWithSuffix keeps the suffix only when it fits", () => {
    expect(titleWithSuffix("Court", " | Azalée")).toBe("Court | Azalée");
    const base = "a ".repeat(30).trim();
    expect(titleWithSuffix(base, " | Azalée")).toBe(base);
    expect(titleWithSuffix("mot ".repeat(40), " | Azalée").length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it("wikiTitle falls back to the short brand for long subjects", () => {
    expect(wikiTitle("Kevin")).toBe("Kevin | Inazuma Eleven Victory Road - Azalée");
    expect(wikiTitle("Kevin Dragonfly Archibald Nathan")).toBe("Kevin Dragonfly Archibald Nathan | Azalée");
    expect(wikiTitle("Raimon", "Équipes")).toBe("Raimon | Équipes - Inazuma Eleven Victory Road - Azalée");
  });

  it("hard-cuts a single overlong word", () => {
    const out = clampText("x".repeat(50), 10);
    expect(out).toBe(`${"x".repeat(9)}…`);
  });
});
