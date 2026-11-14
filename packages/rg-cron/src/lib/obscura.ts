/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pont unifié Obscura + Agent Browser pour rg-cron, tests et crawls (.io / réseaux sociaux).
 *
 * Modes supportés sans coûts additionnels :
 * 1. `cloud`  : via Cloudflare Worker (`OBSCURA_CLOUD_URL` / `https://rosegriffon-edge.aphrody-labs.workers.dev/fetch`)
 * 2. `cdp`    : via démon CDP local/VPS (`OBSCURA_CDP_URL` / `http://127.0.0.1:9222`) compatible `agent-browser --cdp 9222`
 * 3. `cli`    : via binaire `obscura fetch --stealth` (local PC ou VPS `prd`)
 */

export type ObscuraDumpMode = "html" | "text" | "markdown" | "links";

export interface ObscuraFetchOptions {
  dump?: ObscuraDumpMode;
  timeoutMs?: number;
  cloudUrl?: string;
  cdpUrl?: string;
}

export interface ObscuraFetchResult {
  ok: boolean;
  mode: "cli" | "cloud" | "direct";
  status: number;
  content: string;
  ms: number;
}

const DEFAULT_CLOUD_FETCH_URL = "https://rosegriffon-edge.aphrody-labs.workers.dev/fetch";
const DEFAULT_CDP_URL = "http://127.0.0.1:9222";
const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?|.*\.local$)/i;

export function assertPublicCrawlUrl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Schéma non autorisé: ${parsed.protocol}`);
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    throw new Error(`Hôte privé refusé: ${parsed.hostname}`);
  }
  return parsed;
}

export function resolveObscuraCdpUrl(override?: string): string {
  return (
    override ?? process.env.OBSCURA_CDP_URL ?? process.env.AGENT_BROWSER_CDP_URL ?? DEFAULT_CDP_URL
  );
}

export async function isObscuraCdpAvailable(
  cdpUrl = resolveObscuraCdpUrl(),
  timeoutMs = 1500,
): Promise<boolean> {
  try {
    const res = await fetch(`${cdpUrl.replace(/\/+$/, "")}/json/version`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function obscuraFetch(
  targetUrl: string,
  options: ObscuraFetchOptions = {},
): Promise<ObscuraFetchResult> {
  const url = assertPublicCrawlUrl(targetUrl).toString();
  const dump = options.dump ?? "markdown";
  const timeoutMs = options.timeoutMs ?? 20_000;
  const started = performance.now();

  const obscuraBin = Bun.which("obscura");
  if (obscuraBin) {
    try {
      const proc = Bun.spawn([obscuraBin, "fetch", "--stealth", "--quiet", "--dump", dump, url], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const timer = setTimeout(() => proc.kill(), timeoutMs);
      const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
      clearTimeout(timer);
      if (exitCode === 0 && stdout.trim().length > 0) {
        return {
          ok: true,
          mode: "cli",
          status: 200,
          content: stdout,
          ms: Math.round(performance.now() - started),
        };
      }
    } catch {
      // Fall through to cloud / direct fetch
    }
  }

  const cloudEndpoint =
    options.cloudUrl ?? process.env.OBSCURA_CLOUD_URL ?? DEFAULT_CLOUD_FETCH_URL;
  try {
    const res = await fetch(`${cloudEndpoint}?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      return {
        ok: true,
        mode: "cloud",
        status: res.status,
        content: await res.text(),
        ms: Math.round(performance.now() - started),
      };
    }
  } catch {
    // Fall through to direct fetch
  }

  const direct = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return {
    ok: direct.ok,
    mode: "direct",
    status: direct.status,
    content: await direct.text(),
    ms: Math.round(performance.now() - started),
  };
}
