#!/usr/bin/env bun
// Builds docs/audits/<date>-crawl.md from var/crawl/*.json (worst first, short tables).
// Usage: bun tools/crawl/report.ts [--date 2026-11-05]
import { ORIGIN, readJson } from "./lib.ts";
import type { PageRecord } from "./crawl.ts";
import type { LhResult } from "./lighthouse.ts";

const argv = Bun.argv.slice(2);
const date = argv.includes("--date") ? argv[argv.indexOf("--date") + 1]! : new Date().toISOString().slice(0, 10);
const pages = await readJson<PageRecord[]>("pages.json");
const links = await readJson<{
  broken: Array<{ url: string; status: number; error?: string; from: string[] }>;
  checked: Record<string, { status: number }>;
  uncheckedCount: number;
}>("links.json");
const meta = await readJson<{ at: string; internalLinks: number; assets: number }>("meta.json");
const lh = await readJson<LhResult[]>("lighthouse.json").catch(() => [] as LhResult[]);

const BASELINE: Record<string, { perf: number | null; cls?: number }> = {
  "/iergday": { perf: 34, cls: 0.52 },
  "/achillea/tournaments/circuit/ranking": { perf: 34 },
  "/community": { perf: 41 },
  "/achillea/ranked": { perf: 43 },
  "/projets/nostalgie": { perf: null },
  "/achillea/leagues/astral": { perf: null },
};

const path = (u: string) => (u.startsWith(ORIGIN) ? u.slice(ORIGIN.length) || "/" : u);
const kb = (b?: number) => (b == null ? "-" : `${Math.round(b / 1024)}`);
const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const table = (head: string[], rows: Array<Array<string | number | undefined>>) =>
  rows.length
    ? [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map(r => `| ${r.map(c => esc(String(c ?? "-"))).join(" | ")} |`)].join("\n")
    : "_none_";

const html = pages.filter(p => p.contentType.includes("text/html") && p.status === 200);
const byStatus = new Map<number, number>();
for (const p of pages) byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
const allStatuses = Object.values(links.checked).map(s => s.status);
const fiveXX = allStatuses.filter(s => s >= 500).length;
const fourXX = allStatuses.filter(s => s >= 400 && s < 500).length;
const missing = new Map<string, { status: number; pages: Set<string> }>();
for (const p of pages)
  for (const m of p.missingAssets ?? []) {
    // Data from crawls before the entity-decoding fix kept "&amp;" in query strings: false 400s.
    if (m.url.includes("&amp;")) continue;
    if (!missing.has(m.url)) missing.set(m.url, { status: m.status, pages: new Set() });
    missing.get(m.url)!.pages.add(path(p.url));
  }
const redirected = pages.filter(p => p.hops.length > 1);
const mixed = pages.filter(p => p.mixedContent.length);

// SEO meta problems.
const seo = html
  .map(p => {
    const issues: string[] = [];
    const tl = p.title?.length ?? 0;
    const dl = p.description?.length ?? 0;
    if (!p.title) issues.push("no title");
    else if (tl > 60 || tl < 15) issues.push(`title ${tl}c`);
    if (!p.description) issues.push("no description");
    else if (dl > 160 || dl < 50) issues.push(`desc ${dl}c`);
    if (p.h1Count !== 1) issues.push(`h1 x${p.h1Count}`);
    if (!p.canonical) issues.push("no canonical");
    else if (new URL(p.canonical, p.finalUrl).href.replace(/\/$/, "") !== p.finalUrl.replace(/\/$/, ""))
      issues.push(`canonical -> ${path(new URL(p.canonical, p.finalUrl).href)}`);
    if (!p.lang) issues.push("no lang");
    else if (!p.lang.startsWith("fr")) issues.push(`lang=${p.lang}`);
    return { p, issues };
  })
  .filter(x => x.issues.length);
const seoCounts = new Map<string, number>();
for (const { issues } of seo) for (const i of issues) {
  const k = i.replace(/\d+c$/, "Nc").replace(/x\d+$/, "xN").replace(/-> .*/, "mismatch");
  seoCounts.set(k, (seoCounts.get(k) ?? 0) + 1);
}

const imgs = html
  .map(p => ({
    p,
    total: p.images.length,
    noAlt: p.images.filter(i => i.alt === null).length,
    noDim: p.images.filter(i => !i.width || !i.height).length,
  }))
  .filter(x => x.noAlt || x.noDim)
  .sort((a, b) => b.noAlt * 3 + b.noDim - (a.noAlt * 3 + a.noDim));

const third = new Map<string, number>();
for (const p of html) for (const h of p.thirdPartyHosts) third.set(h, (third.get(h) ?? 0) + 1);

const heaviest = [...html].sort((a, b) => (b.weightBytes ?? 0) - (a.weightBytes ?? 0)).slice(0, 20);

const FOCUS = [
  /^\/$/,
  /^\/projets$/,
  /^\/achillea$/,
  /^\/wiki\/?$/,
  /^\/news$/,
  /^\/news\/[^/]+$/,
  /^\/notre-equipe$/,
  /^\/evenements$/,
  /^\/legal\//,
];
const focusPages: PageRecord[] = [];
for (const re of FOCUS) {
  const hits = html.filter(p => re.test(path(p.url)));
  focusPages.push(...(re.source.includes("[^/]+") ? hits.slice(0, 1) : hits));
}
const copyRows = (ps: PageRecord[]) =>
  ps.flatMap(p => p.copy.map(c => [path(p.url), c.kind, c.match, c.context.slice(0, 110)]));
const KIND_ORDER = ["broken", "garbled", "mojibake", "placeholder", "english", "ai-tone"];
const sortCopy = (rows: string[][]) => rows.sort((a, b) => KIND_ORDER.indexOf(a[1]!) - KIND_ORDER.indexOf(b[1]!));
const focusSet = new Set(focusPages.map(p => p.url));
const otherCopy = sortCopy(copyRows(html.filter(p => !focusSet.has(p.url)))).filter(r =>
  ["broken", "garbled", "mojibake", "placeholder"].includes(r[1]!),
);

const lhSorted = [...lh].sort((a, b) => (a.performance ?? -1) - (b.performance ?? -1));
const lhOk = lh.filter(r => r.ok && r.performance != null);
const range = (k: keyof LhResult) => {
  const v = lhOk.map(r => r[k] as number).filter(n => n != null);
  return v.length ? `${Math.min(...v)}-${Math.max(...v)} (median ${v.sort((a, b) => a - b)[v.length >> 1]})` : "-";
};

const out = `# Crawl audit ${date}

Read-only crawl of ${ORIGIN} (UA \`RoseGriffonAudit/1.0\`, 2 concurrent, robots.txt honored), run ${meta.at.slice(0, 16)}Z.
Tooling: \`tools/crawl/\` (\`crawl.ts\`, \`lighthouse.ts\`, \`report.ts\`). Raw JSON: \`var/crawl/\`.
Production still runs the build from before the pending perf fixes, so Lighthouse numbers are pre-fix.
${process.env.CRAWL_NOTE ?? ""}

## Counts

| Metric | Value |
|---|---|
| Pages crawled (sitemap 40 + links, depth <= 3, cap 400) | ${pages.length} (${html.length} HTML 200) |
| Status codes (crawled) | ${[...byStatus].sort((a, b) => b[0] - a[0]).map(([s, n]) => `${s}: ${n}`).join(", ")} |
| Internal link targets seen / status-checked | ${meta.internalLinks} / ${Object.keys(links.checked).length} (${links.uncheckedCount} unchecked over budget) |
| Broken internal links (4xx/5xx/network) | ${links.broken.length} (5xx: ${fiveXX}, 4xx: ${fourXX}) |
| Missing assets (own hosts) | ${missing.size} |
| Pages reached through a redirect | ${redirected.length} |
| Pages with mixed content | ${mixed.length} |
| Unique assets | ${meta.assets} |

## Lighthouse mobile (${lh.length} runs, worst first)

Performance ${range("performance")}, accessibility ${range("accessibility")}, best-practices ${range("bestPractices")}, SEO ${range("seo")}. Failed: ${lh.filter(r => !r.ok).length}.

${table(
  ["URL", "Why", "Perf", "A11y", "BP", "SEO", "LCP s", "TBT ms", "CLS", "KB", "Baseline"],
  lhSorted.map(r => {
    const b = BASELINE[path(r.url)];
    return [
      path(r.url),
      r.reason,
      r.ok ? r.performance : `FAIL ${r.error?.slice(0, 60)}`,
      r.accessibility,
      r.bestPractices,
      r.seo,
      r.lcpMs == null ? undefined : (r.lcpMs / 1000).toFixed(1),
      r.tbtMs == null ? undefined : Math.round(r.tbtMs),
      r.cls == null ? undefined : r.cls.toFixed(2),
      kb(r.totalBytes),
      b ? (b.perf == null ? "failed" : `${b.perf}${b.cls ? ` / CLS ${b.cls}` : ""}`) : undefined,
    ];
  }),
)}

## Broken internal links

${table(
  ["Target", "Status", "Linked from"],
  links.broken
    .sort((a, b) => b.status - a.status || b.from.length - a.from.length)
    .map(b => [path(b.url), b.status || b.error, b.from.map(path).slice(0, 3).join(", ") + (b.from.length > 3 ? ` +${b.from.length - 3}` : "")]),
)}

## Missing assets

${table(
  ["Asset", "Status", "Pages"],
  [...missing].sort((a, b) => b[1].pages.size - a[1].pages.size).slice(0, 30).map(([u, m]) => [u.replace(ORIGIN, ""), m.status, `${m.pages.size}: ${[...m.pages].slice(0, 3).join(", ")}`]),
)}

## Redirects on crawled URLs

${table(
  ["From", "Chain", "Final"],
  redirected.slice(0, 30).map(p => [path(p.url), p.hops.map(h => h.status).join(" > "), path(p.finalUrl)]),
)}

## SEO meta

Totals: ${[...seoCounts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}.

${table(
  ["URL", "Issues", "Title"],
  seo.sort((a, b) => b.issues.length - a.issues.length).slice(0, 30).map(({ p, issues }) => [path(p.url), issues.join("; "), (p.title ?? "").slice(0, 70)]),
)}

## Images without alt or dimensions

Pages affected: ${imgs.length}. Images without \`alt\`: ${imgs.reduce((s, x) => s + x.noAlt, 0)}; without width/height: ${imgs.reduce((s, x) => s + x.noDim, 0)}.

${table(
  ["URL", "Imgs", "No alt", "No dims", "Example"],
  imgs.slice(0, 15).map(x => [path(x.p.url), x.total, x.noAlt, x.noDim, (x.p.images.find(i => i.alt === null || !i.width) ?.src ?? "").replace(ORIGIN, "").slice(0, 70)]),
)}

## Heaviest pages (static estimate: HTML + referenced scripts/CSS/images, transfer bytes)

${table(
  ["URL", "KB", "Requests", "HTML KB", "TTFB+HTML ms"],
  heaviest.map(p => [path(p.url), kb(p.weightBytes), p.requestCount, kb(p.htmlBytes), p.ms]),
)}

## Third-party hosts

${table(["Host", "Pages"], [...third].sort((a, b) => b[1] - a[1]).map(([h, n]) => [h, n]))}

## Copy check: key pages

Heuristic scan of rendered French text and alt/title/aria-label/placeholder attributes (${focusPages.length} pages: ${focusPages.map(p => path(p.url)).join(", ")}).
Kinds: broken (undefined/NaN/[object Object]/templating), garbled (repeated name), mojibake, placeholder, english (untranslated UI string), ai-tone (stock phrasing). Review before fixing: "english" also catches proper nouns.

${table(["Page", "Kind", "Match", "Context"], sortCopy(copyRows(focusPages)))}

## Copy check: other crawled pages (broken, garbled, mojibake, placeholder only)

${table(["Page", "Kind", "Match", "Context"], otherCopy.slice(0, 40))}
`;

const dest = new URL(`../../docs/audits/${date}-crawl.md`, import.meta.url);
await Bun.write(dest, out);
console.log(`wrote ${dest.pathname}`);
