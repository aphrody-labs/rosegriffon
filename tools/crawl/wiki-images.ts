#!/usr/bin/env bun
// Read-only audit of the /wiki pages: images that fail, empty/placeholder data.
// Usage: bun tools/crawl/wiki-images.ts <label> [perType=20]
// Writes var/wiki-audit/<label>.json. Politeness: 2 in flight, 250 ms gap;
// GET only on rosegriffon.fr hosts, HEAD elsewhere.

import { Gate, UA, decodeEntities, isOwnHost } from "./lib";

const ORIGIN = "https://rosegriffon.fr";
const OUT = new URL("../../var/wiki-audit/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const label = process.argv[2] ?? "run";
const perType = Number(process.argv[3] ?? 20);
const gate = new Gate(2, 250);

/** Pages outside the wiki sitemap (asset browsers, tools). */
const EXTRA = [
  "/wiki/avatar",
  "/wiki/sons",
  "/wiki/videos",
  "/wiki/textures",
  "/wiki/gallery",
  "/wiki/keshin",
  "/wiki/mode",
  "/wiki/modeles",
  "/wiki/save",
  "/wiki/demo",
  "/wiki/vroid",
  "/wiki/tools",
  "/wiki/tools/compare",
  "/wiki/tools/my-team",
  "/wiki/tools/random-team",
  "/wiki/tools/stats",
  "/wiki/tools/translator",
];
/** Roots whose child pages are discovered from links (catch-all or not in the sitemap). */
const FOLLOW = ["/wiki/mode", "/wiki/modeles", "/wiki/textures", "/wiki/patch-notes"];

/** One request through the gate, body included, with a hard deadline (a stalled body must not hang the run). */
async function get(url: string, method: "GET" | "HEAD"): Promise<{ status: number; text: string }> {
  return gate.run(async () => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45_000);
    try {
      const r = await fetch(url, {
        headers: { accept: method === "GET" ? "text/html,*/*;q=0.8" : "*/*", "user-agent": UA },
        method,
        redirect: "follow",
        signal: ctl.signal,
      });
      const isHtml = method === "GET" && /text|xml/.test(r.headers.get("content-type") ?? "");
      const text = isHtml ? await r.text() : "";
      if (!isHtml) ctl.abort();
      return { status: r.status, text };
    } catch {
      return { status: 0, text: "" };
    } finally {
      clearTimeout(timer);
    }
  });
}

function routeType(path: string): { type: string; kind: "list" | "detail" } {
  const seg = path.replace(/^\/wiki\/?/, "").split("/").filter(Boolean);
  if (seg.length === 0) return { kind: "list", type: "(index)" };
  const t = seg[0]!;
  if (t === "aura") return { kind: seg.length >= 3 ? "detail" : "list", type: "aura" };
  if (t === "tools") return { kind: "list", type: seg.length > 1 ? `tools/${seg[1]}` : "tools" };
  return { kind: seg.length > 1 ? "detail" : "list", type: t };
}

function spread<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * (arr.length - 1)) / (n - 1))]!);
  return out;
}

interface ImgRef {
  /** URL as found in the HTML (absolute). */
  src: string;
  /** Underlying asset when wrapped in /_next/image. */
  asset: string;
}

interface PageResult {
  url: string;
  type: string;
  kind: string;
  status: number;
  ms: number;
  title: string;
  imgs: number;
  broken: Array<{ asset: string; status: number }>;
  placeholders: Record<string, number>;
  emptyTables: number;
  textLen: number;
}

function extractImgs(html: string, base: string): ImgRef[] {
  const out: ImgRef[] = [];
  const re = /<(img|source)\b[^>]*>/gi;
  for (const m of html.matchAll(re)) {
    const tag = m[0];
    const attr = (name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`, "i"))?.[1];
    let raw = attr("src") ?? attr("data-src");
    if (!raw) raw = attr("srcset")?.split(",")[0]?.trim().split(/\s+/)[0];
    if (!raw || raw.startsWith("data:")) continue;
    let abs: string;
    try {
      abs = new URL(decodeEntities(raw), base).href;
    } catch {
      continue;
    }
    let asset = abs;
    const u = new URL(abs);
    if (u.pathname === "/_next/image" && u.searchParams.get("url")) {
      asset = new URL(u.searchParams.get("url")!, base).href;
    }
    // CDN variant parameters do not change which object is requested.
    out.push({ asset, src: abs });
  }
  return out;
}

const PLACEHOLDER_PATTERNS: Record<string, RegExp> = {
  aucun: /\bAucun(e|s|es)?\b/g,
  inconnu: /\bInconnu(e|s|es)?\b/g,
  nodata: /\b(No data|Non disponible|Non renseign[ée]e?s?|Pas de donn[ée]es|Indisponible|N\/A)\b/g,
  tiret: /(^|\s)[—–-](\s|$)/gm,
  erreur: /\b(Erreur|Une erreur est survenue|introuvable|Page not found)\b/gi,
};

function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<template\b[\s\S]*?<\/template>/gi, " ")
      .replace(/<(header|footer|nav)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, "\n"),
  )
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean)
    .join("\n");
}

const assetStatus = new Map<string, Promise<number>>();
function checkAsset(asset: string): Promise<number> {
  const hit = assetStatus.get(asset);
  if (hit) return hit;
  const p = (async () => {
    const host = new URL(asset).hostname;
    let r = await get(asset, "HEAD");
    if ((r.status === 405 || r.status === 403) && isOwnHost(host)) r = await get(asset, "GET");
    return r.status;
  })();
  assetStatus.set(asset, p);
  return p;
}

async function auditPage(url: string): Promise<{ result: PageResult; links: string[] }> {
  const { type, kind } = routeType(new URL(url).pathname);
  const t0 = performance.now();
  const { status, text: html } = await get(url, "GET");
  const ms = Math.round(performance.now() - t0);
  const imgs = extractImgs(html, url);
  const uniq = [...new Map(imgs.map(i => [i.asset, i])).values()];
  const statuses = await Promise.all(uniq.map(async i => ({ asset: i.asset, status: await checkAsset(i.asset) })));
  const text = visibleText(html);
  const placeholders: Record<string, number> = {};
  for (const [k, re] of Object.entries(PLACEHOLDER_PATTERNS)) placeholders[k] = text.match(re)?.length ?? 0;
  const links = [...html.matchAll(/href="(\/wiki\/[^"#?]*)"/g)].map(m => m[1]!);
  return {
    links,
    result: {
      broken: statuses.filter(s => s.status < 200 || s.status >= 300),
      emptyTables: html.match(/<tbody[^>]*>\s*<\/tbody>/g)?.length ?? 0,
      imgs: imgs.length,
      kind,
      ms,
      placeholders,
      status,
      textLen: text.length,
      title: decodeEntities(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ""),
      type,
      url,
    },
  };
}

const sm = (await get(`${ORIGIN}/wiki/sitemap.xml`, "GET")).text;
const all = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]!);
const byType = new Map<string, string[]>();
const lists: string[] = [];
for (const u of all) {
  const { type, kind } = routeType(new URL(u).pathname);
  if (kind === "list") lists.push(u);
  else byType.set(type, [...(byType.get(type) ?? []), u]);
}
const queue = [...lists, ...EXTRA.map(p => ORIGIN + p)];
for (const [, urls] of byType) queue.push(...spread(urls, perType));
const seen = new Set(queue);

const results: PageResult[] = [];
let done = 0;
async function worker(list: string[]) {
  while (list.length) {
    const url = list.shift()!;
    const { result, links } = await auditPage(url);
    results.push(result);
    done++;
    console.error(`${done} ${result.status} img=${result.imgs} broken=${result.broken.length} ${result.ms}ms ${url}`);
    const path = new URL(url).pathname;
    const root = FOLLOW.find(f => path === f);
    if (root) {
      const kids = [...new Set(links.filter(l => l.startsWith(`${root}/`)))];
      for (const k of spread(kids, root === "/wiki/patch-notes" ? perType : 8)) {
        const abs = ORIGIN + k;
        if (!seen.has(abs)) (seen.add(abs), list.push(abs));
      }
    }
  }
}
await Promise.all([worker(queue), worker(queue)]);

const assets: Record<string, number> = {};
for (const [a, p] of assetStatus) assets[a] = await p;
await Bun.write(`${OUT}${label}.json`, JSON.stringify({ assets, at: new Date().toISOString(), pages: results }, null, 1));

// Summary per route type.
const sum = new Map<string, { pages: number; broken: number; empty: number; err: number; imgs: number }>();
for (const r of results) {
  const k = `${r.type} ${r.kind}`;
  const s = sum.get(k) ?? { broken: 0, empty: 0, err: 0, imgs: 0, pages: 0 };
  s.pages++;
  s.imgs += r.imgs;
  if (r.broken.length) s.broken++;
  if (r.status !== 200) s.err++;
  if (r.emptyTables || r.placeholders.nodata || r.imgs === 0 || r.textLen < 400) s.empty++;
  sum.set(k, s);
}
console.log("type kind | pages | non200 | withBrokenImg | imgs | suspectEmpty");
for (const [k, s] of [...sum].sort())
  console.log(`${k} | ${s.pages} | ${s.err} | ${s.broken} | ${s.imgs} | ${s.empty}`);
const failing = Object.entries(assets).filter(([, s]) => s < 200 || s >= 300);
const byHost = new Map<string, number>();
for (const [a, s] of failing) {
  const u = new URL(a);
  const k = `${u.hostname}${u.pathname.split("/").slice(0, 2).join("/")} ${s}`;
  byHost.set(k, (byHost.get(k) ?? 0) + 1);
}
console.log(`assets ${Object.keys(assets).length}, failing ${failing.length}`);
for (const [k, n] of [...byHost].sort((a, b) => b[1] - a[1])) console.log(`  ${n} ${k}`);
