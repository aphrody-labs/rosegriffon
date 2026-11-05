#!/usr/bin/env bun
// Lighthouse mobile on every sitemap URL plus the N heaviest crawled pages, one run at a time.
// Usage: bun tools/crawl/lighthouse.ts [--heaviest 20] [--only <url>...]
import { OUT_DIR, UA, readJson, writeJson } from "./lib.ts";
import type { PageRecord } from "./crawl.ts";

const LH = process.env.LIGHTHOUSE_BIN ?? "C:/Users/aphro/.bun/bin/lighthouse";
const argv = Bun.argv.slice(2);
const heaviestN = argv.includes("--heaviest") ? Number(argv[argv.indexOf("--heaviest") + 1]) : 20;
const only = argv.includes("--only") ? argv.slice(argv.indexOf("--only") + 1) : null;

export interface LhResult {
  url: string;
  reason: "sitemap" | "heavy";
  ok: boolean;
  error?: string;
  attempts: number;
  performance?: number;
  accessibility?: number;
  bestPractices?: number;
  seo?: number;
  lcpMs?: number;
  tbtMs?: number;
  cls?: number;
  totalBytes?: number;
  requests?: number;
  topIssues?: string[];
}

const pages = await readJson<PageRecord[]>("pages.json");
const html = pages.filter(p => p.status === 200 && p.contentType.includes("text/html"));
const sitemap = html.filter(p => p.fromSitemap).map(p => p.url);
const heavy = html
  .filter(p => !p.fromSitemap)
  .sort((a, b) => (b.weightBytes ?? 0) - (a.weightBytes ?? 0))
  .slice(0, heaviestN)
  .map(p => p.url);
const targets: Array<{ url: string; reason: LhResult["reason"] }> = only
  ? only.map(url => ({ url, reason: "sitemap" as const }))
  : [...sitemap.map(url => ({ url, reason: "sitemap" as const })), ...heavy.map(url => ({ url, reason: "heavy" as const }))];

const lhDir = `${OUT_DIR}lh/`;
const headers = `${lhDir}headers.json`;
await Bun.write(headers, JSON.stringify({ "X-Audit-Agent": UA }));
const slug = (u: string) => new URL(u).pathname.replace(/[^\w-]+/g, "_").replace(/^_|_$/g, "") || "home";
const score = (c: { score: number | null } | undefined) => (c?.score == null ? undefined : Math.round(c.score * 100));

async function runOnce(url: string): Promise<{ report?: any; error?: string }> {
  const out = `${lhDir}${slug(url)}.json`;
  const proc = Bun.spawn(
    [
      LH,
      url,
      "--output=json",
      `--output-path=${out}`,
      "--only-categories=performance,accessibility,best-practices,seo",
      "--form-factor=mobile",
      "--max-wait-for-load=60000",
      `--extra-headers=${headers}`,
      "--chrome-flags=--headless=new --no-first-run --disable-extensions",
      "--quiet",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const timer = setTimeout(() => proc.kill(), 240_000);
  const code = await proc.exited;
  clearTimeout(timer);
  const stderr = await new Response(proc.stderr).text();
  const f = Bun.file(out);
  if (code !== 0 || !(await f.exists())) return { error: `exit ${code}: ${stderr.trim().split("\n").slice(-2).join(" ")}` };
  const report = await f.json();
  if (report.runtimeError) return { report, error: `${report.runtimeError.code}: ${report.runtimeError.message}` };
  return { report };
}

const results: LhResult[] = [];
for (const [i, t] of targets.entries()) {
  let r: { report?: any; error?: string } = {};
  let attempts = 0;
  while (attempts < 2) {
    attempts++;
    r = await runOnce(t.url);
    if (!r.error) break;
  }
  const rep = r.report;
  const a = rep?.audits ?? {};
  const c = rep?.categories ?? {};
  const res: LhResult = {
    url: t.url,
    reason: t.reason,
    ok: !r.error,
    error: r.error,
    attempts,
    performance: score(c.performance),
    accessibility: score(c.accessibility),
    bestPractices: score(c["best-practices"]),
    seo: score(c.seo),
    lcpMs: a["largest-contentful-paint"]?.numericValue,
    tbtMs: a["total-blocking-time"]?.numericValue,
    cls: a["cumulative-layout-shift"]?.numericValue,
    totalBytes: a["total-byte-weight"]?.numericValue,
    requests: a["network-requests"]?.details?.items?.length,
    topIssues: Object.values(a as Record<string, any>)
      .filter(x => x.score !== null && x.score < 0.5 && x.scoreDisplayMode !== "informative" && x.scoreDisplayMode !== "notApplicable")
      .map(x => x.id as string)
      .slice(0, 12),
  };
  results.push(res);
  console.log(
    `[${i + 1}/${targets.length}] ${t.url} perf=${res.performance ?? "-"} a11y=${res.accessibility ?? "-"} ${res.error ?? ""}`,
  );
  await writeJson(only ? "lighthouse-only.json" : "lighthouse.json", results);
}
