// SPDX-License-Identifier: Apache-2.0
/**
 * Rose Griffon preset checks, preserved from aphrody-labs/bun-ui
 * packages/bun-web/test/testing/sites.test.ts when the presets moved here. They need the
 * bun-web test engine (test/testing/setup.ts) and BunCdpPage (src/testing/cdp.ts) of a bun-web
 * checkout, so this file is not named *.test.ts and is not collected by `bun test`.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { BunCdpPage } from "@aphrody/bun-web/src/testing/cdp.ts";
import type { CdpSend } from "@aphrody/bun-web/testing/next";
import {
  ROSE_GRIFFON_ORIGINS,
  ROSE_GRIFFON_ROUTES,
  ROSE_GRIFFON_URLS,
  ROSE_GRIFFON_AUTH_COOKIES,
  type FetchLike,
  roseGriffonUrl,
  createRoseGriffonAuthCookies,
  roseGriffonAuthHeaders,
  injectRoseGriffonAuth,
  checkRoseGriffonApiHealth,
} from "./rosegriffon-site.ts";

const mockFetch: FetchLike = async () => {
  return new Response(JSON.stringify({ status: "healthy", version: "1.0.0" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const mockFailingFetch: FetchLike = async () => {
  throw new Error("Connection refused");
};

describe("Rose Griffon site helpers", () => {
  let page: BunCdpPage;

  beforeEach(async () => {
    page = await BunCdpPage.connect();
  });

  afterEach(async () => {
    await page.close();
  });

  test("URL presets and roseGriffonUrl normalizer enforce canonical SEO shape", () => {
    expect(ROSE_GRIFFON_ORIGINS.site).toBe("https://rosegriffon.fr");
    expect(ROSE_GRIFFON_ROUTES.news).toBe("/news");
    expect(ROSE_GRIFFON_URLS.news).toBe("https://rosegriffon.fr/news");

    // Strip trailing slashes on sub-paths
    expect(roseGriffonUrl("/news/")).toBe("https://rosegriffon.fr/news");
    expect(roseGriffonUrl("a-propos")).toBe("https://rosegriffon.fr/a-propos");
    expect(roseGriffonUrl("/")).toBe("https://rosegriffon.fr/");
    expect(roseGriffonUrl("/api/v1/status", ROSE_GRIFFON_ORIGINS.api)).toBe("https://api.rosegriffon.fr/api/v1/status");
  });

  test("createRoseGriffonAuthCookies creates valid cookie parameters", () => {
    const cookies = createRoseGriffonAuthCookies({
      session: "custom-sess-123",
      csrf: "custom-csrf-456",
      token: "custom-jwt-789",
    });

    expect(cookies).toHaveLength(3);
    expect(cookies.find(c => c.name === ROSE_GRIFFON_AUTH_COOKIES.session)?.value).toBe("custom-sess-123");
    expect(cookies.find(c => c.name === ROSE_GRIFFON_AUTH_COOKIES.csrf)?.value).toBe("custom-csrf-456");
    expect(cookies.find(c => c.name === ROSE_GRIFFON_AUTH_COOKIES.token)?.value).toBe("custom-jwt-789");
    expect(cookies.every(c => c.domain === "rosegriffon.fr")).toBe(true);
  });

  test("roseGriffonAuthHeaders creates bearer and csrf headers", () => {
    const headers = roseGriffonAuthHeaders("tok-abc", "csrf-xyz");
    expect(headers.Authorization).toBe("Bearer tok-abc");
    expect(headers["x-csrf-token"]).toBe("csrf-xyz");
    expect(headers.Cookie).toContain("rg_session=tok-abc");
    expect(headers.Cookie).toContain("rg_csrf=csrf-xyz");
  });

  test("injectRoseGriffonAuth injects cookies into a CDP page", async () => {
    await injectRoseGriffonAuth(
      { _cdp: page as unknown as CdpSend },
      { session: "injected-session", csrf: "injected-csrf" },
    );

    const result = (await (page as unknown as CdpSend)._send("Network.getCookies", {})) as {
      cookies: Array<{ name: string; value: string }>;
    };
    const sessionCookie = result.cookies.find(c => c.name === "rg_session");
    expect(sessionCookie?.value).toBe("injected-session");
    const csrfCookie = result.cookies.find(c => c.name === "rg_csrf");
    expect(csrfCookie?.value).toBe("injected-csrf");
  });

  test("checkRoseGriffonApiHealth reports latency and status", async () => {
    const health = await checkRoseGriffonApiHealth({
      fetch: mockFetch,
      apiOrigin: "https://api.rosegriffon.fr",
      endpoint: "/health",
    });

    expect(health.ok).toBe(true);
    expect(health.status).toBe(200);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.data).toEqual({ status: "healthy", version: "1.0.0" });
  });

  test("checkRoseGriffonApiHealth handles network errors gracefully", async () => {
    const health = await checkRoseGriffonApiHealth({
      fetch: mockFailingFetch,
      apiOrigin: "https://api.rosegriffon.fr",
    });

    expect(health.ok).toBe(false);
    expect(health.status).toBe(0);
    expect(health.error).toContain("Connection refused");
  });
});
