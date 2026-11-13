/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Non-régression de l'extraction HTMLRewriter. Les fixtures sont des pages réelles
 * (level5.co.jp/blog, inazuma.jp/victory-road ; l'index level5.co.jp/news, protégé, est
 * reconstitué) sérialisées comme le fait la WebView (`outerHTML`), allégées de head,
 * scripts et médias. `expected.json` est la sortie de l'ancienne extraction cheerio
 * sur ces mêmes fichiers.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  decodeEntities,
  extraireLevel5BlogIndex,
  extraireLevel5BlogTexte,
  extraireLevel5News,
  extrairePatchNotes,
  extraireTopics,
} from "./html-extract";

const FIXTURES = join(import.meta.dir, "__fixtures__");
const expected = (await Bun.file(
  join(FIXTURES, "expected.json"),
).json()) as Record<string, Record<string, unknown>>;
const fixture = (nom: string) => Bun.file(join(FIXTURES, `${nom}.html`)).text();

describe("extraction identique à cheerio sur les fixtures", () => {
  test("level5.co.jp/news : liens news/YYYYMMDD dédoublonnés", async () => {
    expect(extraireLevel5News(await fixture("level5-news"))).toEqual(
      expected["level5-news"]!.level5News as never,
    );
  });

  test("level5.co.jp/blog : articles récents + article à la une", async () => {
    const html = await fixture("level5-blog-ja");
    expect(
      extraireLevel5BlogIndex(html, "https://www.level5.co.jp/blog/"),
    ).toEqual(expected["level5-blog-ja"]!.level5BlogIndex as never);
  });

  test("level5.co.jp/blog/250303 : texte de l'article", async () => {
    expect(extraireLevel5BlogTexte(await fixture("level5-blog-250303"))).toBe(
      expected["level5-blog-250303"]!.level5BlogTexte as string,
    );
  });

  for (const nom of ["victory-road-topics-ja", "victory-road-topics-fr"]) {
    test(`${nom} : topics et liens de patch notes`, async () => {
      const html = await fixture(nom);
      expect(extraireTopics(html)).toEqual(expected[nom]!.topics as never);
      expect(extrairePatchNotes(html)).toEqual(
        expected[nom]!.patchNotes as never,
      );
    });
  }

  test("victory-road patchnote en/switch : liens /ver_*", async () => {
    const html = await fixture("victory-road-patchnote-en-switch");
    expect(extrairePatchNotes(html)).toEqual(
      expected["victory-road-patchnote-en-switch"]!.patchNotes as never,
    );
  });
});

describe("decodeEntities", () => {
  test("entités nommées, numériques, fins de ligne ; inconnues laissées telles quelles", () => {
    expect(
      decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#x27;"),
    ).toBe(`a & b <c> "d" 'e'`);
    expect(
      decodeEntities("PlayStation&reg;5 &copy; &eacute;t&eacute;&nbsp;!"),
    ).toBe("PlayStation®5 © été !");
    expect(decodeEntities("l1\r\nl2\rl3")).toBe("l1\nl2\nl3");
    expect(decodeEntities("&inconnue; &#0; & seul")).toBe(
      "&inconnue; &#0; & seul",
    );
  });
});
