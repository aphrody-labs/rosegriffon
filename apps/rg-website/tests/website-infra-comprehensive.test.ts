// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import rawConfigExport from "../next.config";

async function getNextConfig() {
  if (typeof rawConfigExport === "function") {
    return await rawConfigExport("phase-production-server", { defaultConfig: {} });
  }
  return rawConfigExport;
}

describe("Rose Griffon Website Infrastructure Suite (Next.js + Bun SSR)", () => {
  test("Configuration de base durcie (Sécurité et Performance)", async () => {
    const config = await getNextConfig();
    // poweredByHeader must be false to not leak framework version
    expect(config.poweredByHeader).toBe(false);
    // compress must be handled by reverse proxy (nginx / cloudflare), not Node/Bun runtime
    expect(config.compress).toBe(false);
    // NIE CDN Base resolution
    expect(config.env?.NIE_CDN_BASE).toBe("https://cdn.rosegriffon.fr");
  });

  test("Redirections canoniques et normalisation de domaine (Apex & Legacy)", async () => {
    const config = await getNextConfig();
    expect(typeof config.redirects).toBe("function");
    const redirects = typeof config.redirects === "function" ? await config.redirects() : [];

    // Apex domain enforcement from www
    const wwwRedirect = redirects.find(r => r.destination === "https://rosegriffon.fr/:path*");
    expect(wwwRedirect).toBeDefined();
    expect(wwwRedirect?.permanent).toBe(true);
    expect(wwwRedirect?.has).toEqual([{ type: "host", value: "www.rosegriffon.fr" }]);

    // Legacy /azalee -> /wiki redirect
    const azaleeRedirect = redirects.find(r => r.source === "/azalee" && r.destination === "/wiki");
    expect(azaleeRedirect).toBeDefined();
    expect(azaleeRedirect?.permanent).toBe(true);

    // Feed route backwards compatibility (/x -> /feed)
    const feedRedirect = redirects.find(r => r.source === "/x" && r.destination === "/feed");
    expect(feedRedirect).toBeDefined();
    expect(feedRedirect?.permanent).toBe(true);
  });

  test("En-têtes de sécurité HTTP (CSP, FrameGuard, COOP, Permissions)", async () => {
    const config = await getNextConfig();
    expect(typeof config.headers).toBe("function");
    const headerRules = typeof config.headers === "function" ? await config.headers() : [];
    const globalRule = headerRules.find(h => h.source === "/:path*" || !h.source || h.source === "/(.*)");

    expect(globalRule).toBeDefined();
    const headersMap = new Map(globalRule?.headers.map(h => [h.key, h.value]));

    // COOP
    expect(headersMap.get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups");
    // CSP Frame Ancestors
    expect(headersMap.get("Content-Security-Policy")).toContain("frame-ancestors 'self' https://*.rosegriffon.fr");
    // X-Frame-Options
    expect(headersMap.get("X-Frame-Options")).toBe("SAMEORIGIN");
    // Referrer-Policy
    expect(headersMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    // Permissions-Policy
    expect(headersMap.get("Permissions-Policy")).toContain("camera=()");
  });
});
