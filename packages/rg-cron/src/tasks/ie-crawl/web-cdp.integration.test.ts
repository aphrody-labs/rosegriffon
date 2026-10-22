/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "bun:test";
import { WebCdpPage } from "../../lib/web-cdp";

/**
 * Le navigateur est-il lançable ici ? Créer une vue ne prouve rien (Chrome
 * démarre à la première commande) : la sonde navigue vers un document local,
 * sans réseau. Rend `null` si oui, la raison sinon.
 */
async function navigateurIndisponible(): Promise<string | null> {
  let page: WebCdpPage | undefined;
  try {
    page = await WebCdpPage.connect();
    await page.goto("data:text/html,<title>sonde</title>");
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    // Ferme la vue : le test qui suit en rouvre une aussitôt, sur le même Chrome.
    await page?.close().catch(() => undefined);
  }
}

const absent = await navigateurIndisponible();
// RG_REQUIRE_WEBVIEW=1 (hôte de production, CI navigateur) : l'absence est un échec, pas un saut.
if (absent && Bun.env.RG_REQUIRE_WEBVIEW === "1") throw new Error(`Bun.WebView indisponible : ${absent}`);
if (absent) console.warn(`[Aphrody Web CDP] Navigateur indisponible (${absent}) — test navigateur sauté.`);

describe("Aphrody Web CDP integration", () => {
  it.skipIf(absent !== null)(
    "navigates to example.com and returns rendered HTML",
    async () => {
      const page = await WebCdpPage.connect();
      try {
        await page.goto("https://example.com");
        expect(await page.title()).toBe("Example Domain");
        expect(await page.content()).toContain("Example Domain");
      } finally {
        await page.close().catch(() => undefined);
      }
    },
    60_000,
  );
});
