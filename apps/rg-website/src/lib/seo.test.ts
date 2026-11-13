import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import {
  clampText,
  DEFAULT_OG_IMAGE,
  DESCRIPTION_MAX,
  TITLE_MAX,
  titleWithSuffix,
  wikiTitle,
  withDefaultOgImage,
} from "./seo";

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
    expect(
      titleWithSuffix("mot ".repeat(40), " | Azalée").length,
    ).toBeLessThanOrEqual(TITLE_MAX);
  });

  it("wikiTitle falls back to the short brand for long subjects", () => {
    expect(wikiTitle("Kevin")).toBe(
      "Kevin | Inazuma Eleven Victory Road - Azalée",
    );
    expect(wikiTitle("Kevin Dragonfly Archibald Nathan")).toBe(
      "Kevin Dragonfly Archibald Nathan | Azalée",
    );
    expect(wikiTitle("Raimon", "Équipes")).toBe(
      "Raimon | Équipes - Inazuma Eleven Victory Road - Azalée",
    );
  });

  it("hard-cuts a single overlong word", () => {
    const out = clampText("x".repeat(50), 10);
    expect(out).toBe(`${"x".repeat(9)}…`);
  });
});

describe("withDefaultOgImage", () => {
  it("adds the default image when none is given", () => {
    expect<unknown>(withDefaultOgImage({ title: "Événements" }).images).toEqual(
      [DEFAULT_OG_IMAGE],
    );
    expect<unknown>(
      withDefaultOgImage({ images: [], title: "x" }).images,
    ).toEqual([DEFAULT_OG_IMAGE]);
    expect<unknown>(
      withDefaultOgImage({ images: undefined, title: "x" }).images,
    ).toEqual([DEFAULT_OG_IMAGE]);
  });

  it("keeps an explicit image and the other fields", () => {
    const og = withDefaultOgImage({
      images: [{ url: "/a.png" }],
      title: "x",
      type: "article" as const,
    });
    expect(og.images).toEqual([{ url: "/a.png" }]);
    expect(og.type).toBe("article");
    expect(og.title).toBe("x");
  });

  // Next fusionne `openGraph` superficiellement : un bloc sans `images` sous la
  // racine efface l'image de `app/opengraph-image.png`. Seul le layout racine,
  // dont le segment porte ce fichier, peut s'en passer.
  it("every openGraph block under app/ declares images or goes through withDefaultOgImage", async () => {
    const appDir = join(import.meta.dir, "..", "app");
    const offenders: string[] = [];
    for await (const rel of new Bun.Glob("**/{page,layout}.tsx").scan(appDir)) {
      if (rel === "layout.tsx") continue;
      const src = await Bun.file(join(appDir, rel)).text();
      let from = 0;
      for (;;) {
        const at = src.indexOf("openGraph: {", from);
        if (at < 0) break;
        let depth = 0;
        let end = at + "openGraph: ".length;
        for (; end < src.length; end++) {
          if (src[end] === "{") depth++;
          else if (src[end] === "}" && --depth === 0) break;
        }
        if (!src.slice(at, end).includes("images")) offenders.push(rel);
        from = end;
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("poll titles (/sondages/<id>)", () => {
  // Questions des sondages relevés à 104-106 caractères par l'audit de production.
  const questions = [
    "Quel personnage irait le mieux pour cette émote (visuel ci-dessus) ? Vous avez jusqu'à dimanche pour voter !",
    "Quel sticker (références ci-dessus) vous voulez qu'on redessine avec un autre personnage ?",
    "Quel personnage irait le mieux pour l'émote :IE_Shocked: (visuels ci-dessus) ?",
    "Alors, pour l'InazumaRG, vous êtes plutôt team Roy ou Gaëlle ?",
    "12 - Dernier sondage pour le détail bonus ! Réagissez si vous souhaitez participer 😀😀😀",
  ];
  it("stay within TITLE_MAX with the same construction as the page", async () => {
    const { resumeQuestion } = await import("./discord/polls-types");
    for (const q of questions) {
      const titre = titleWithSuffix(
        resumeQuestion(q, 500),
        " · Sondages · Rose Griffon",
      );
      expect(titre.length).toBeLessThanOrEqual(TITLE_MAX);
    }
    expect(
      titleWithSuffix(
        resumeQuestion("Vice-Versa", 500),
        " · Sondages · Rose Griffon",
      ),
    ).toBe("Vice-Versa · Sondages · Rose Griffon");
  });
});
