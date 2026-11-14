/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from "bun:test";
import { assertPublicCrawlUrl, isObscuraCdpAvailable, resolveObscuraCdpUrl } from "./obscura";

describe("obscura cloud/cdp bridge", () => {
  test("autorise les URLs publiques HTTPS et refuse les adresses privées", () => {
    expect(assertPublicCrawlUrl("https://rosegriffon.fr/").hostname).toBe("rosegriffon.fr");
    expect(() => assertPublicCrawlUrl("http://127.0.0.1:9222/")).toThrow();
    expect(() => assertPublicCrawlUrl("http://localhost:3000/")).toThrow();
    expect(() => assertPublicCrawlUrl("file:///etc/passwd")).toThrow();
  });

  test("résout l'URL CDP par défaut et vérifie la disponibilité sans lever", async () => {
    expect(resolveObscuraCdpUrl()).toContain("9222");
    const available = await isObscuraCdpAvailable("http://127.0.0.1:59999", 200);
    expect(available).toBe(false);
  });
});
