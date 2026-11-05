#!/usr/bin/env bun
// Read-only crawl of https://rosegriffon.fr: sitemap seeds + internal links to depth 3, cap 400.
// Usage: bun tools/crawl/crawl.ts [--max 400] [--depth 3]
import { ORIGIN, decodeEntities, fetchChain, gate, isOwnHost, loadRobots, normalize, robotsAllowed, UA, writeJson, type Hop } from "./lib.ts";
import { copyCheck, type CopyHit } from "./copy.ts";

const argv = Bun.argv.slice(2);
const arg = (k: string, d: number) => {
  const i = argv.indexOf(k);
  return i >= 0 ? Number(argv[i + 1]) : d;
};
const MAX_PAGES = arg("--max", 400);
const MAX_DEPTH = arg("--depth", 3);
const MAX_LINK_CHECKS = arg("--link-checks", 900);

interface Img {
  src: string;
  alt: string | null;
  width: boolean;
  height: boolean;
}
export interface PageRecord {
  url: string;
  depth: number;
  fromSitemap: boolean;
  status: number;
  error?: string;
  hops: Hop[];
  finalUrl: string;
  contentType: string;
  ms: number;
  htmlBytes: number;
  canonical: string | null;
  title: string | null;
  description: string | null;
  h1Count: number;
  lang: string | null;
  robotsMeta: string | null;
  links: string[];
  assets: string[];
  srcsetCandidates: string[];
  images: Img[];
  mixedContent: string[];
  thirdPartyHosts: string[];
  copy: CopyHit[];
  // filled after asset checks
  weightBytes?: number;
  requestCount?: number;
  missingAssets?: Array<{ url: string; status: number }>;
}

async function sitemapUrls(): Promise<string[]> {
  const { res } = await fetchChain(`${ORIGIN}/sitemap.xml`);
  const xml = res ? await res.text() : "";
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]!);
}

async function parsePage(html: string, base: string) {
  const out = {
    canonical: null as string | null,
    title: "" as string,
    description: null as string | null,
    h1Count: 0,
    lang: null as string | null,
    robotsMeta: null as string | null,
    links: new Set<string>(),
    assets: new Set<string>(),
    candidates: new Set<string>(),
    images: [] as Img[],
    attrText: [] as string[],
    text: [] as string[],
  };
  let inTitle = false;
  let skip = 0;
  const addAsset = (v: string | null) => {
    if (!v || v.startsWith("data:")) return;
    const n = normalize(v, base);
    if (n) out.assets.add(n);
  };
  // srcset candidates are checked for 404 but not counted in page weight (browser picks one).
  const addSrcset = (v: string | null) => {
    if (!v) return;
    for (const part of v.split(",")) {
      const n = normalize(part.trim().split(/\s+/)[0] ?? "", base);
      if (n) out.candidates.add(n);
    }
  };
  const rw = new HTMLRewriter()
    .on("html", { element: e => void (out.lang = e.getAttribute("lang")) })
    .on("title", {
      element: e => {
        inTitle = true;
        e.onEndTag(() => void (inTitle = false));
      },
      text: t => void (inTitle && (out.title += t.text)),
    })
    .on('link[rel="canonical"]', { element: e => void (out.canonical = e.getAttribute("href")) })
    .on('meta[name="description"]', { element: e => void (out.description = e.getAttribute("content")) })
    .on('meta[name="robots"]', { element: e => void (out.robotsMeta = e.getAttribute("content")) })
    .on("h1", { element: () => void out.h1Count++ })
    .on("a[href]", {
      element: e => {
        const n = normalize(e.getAttribute("href")!, base);
        if (n) out.links.add(n);
      },
    })
    .on("script[src]", { element: e => addAsset(e.getAttribute("src")) })
    .on("link[href]", {
      element: e => {
        const rel = (e.getAttribute("rel") ?? "").toLowerCase();
        if (/stylesheet|preload|icon|modulepreload|manifest/.test(rel)) addAsset(e.getAttribute("href"));
      },
    })
    .on("img", {
      element: e => {
        const src = e.getAttribute("src");
        addAsset(src);
        addSrcset(e.getAttribute("srcset"));
        out.images.push({
          src: src ?? "",
          alt: e.getAttribute("alt"),
          width: e.hasAttribute("width"),
          height: e.hasAttribute("height"),
        });
      },
    })
    .on("source[srcset]", { element: e => addSrcset(e.getAttribute("srcset")) })
    .on("video[poster]", { element: e => addAsset(e.getAttribute("poster")) })
    .on("video[src], audio[src], iframe[src], source[src]", { element: e => addAsset(e.getAttribute("src")) })
    .on("[alt], [title], [aria-label], [placeholder]", {
      element: e => {
        for (const a of ["alt", "title", "aria-label", "placeholder"]) {
          const v = e.getAttribute(a);
          if (v) out.attrText.push(v);
        }
      },
    })
    .on("script, style, noscript, template, svg", {
      element: e => {
        skip++;
        e.onEndTag(() => void skip--);
      },
    })
    .onDocument({
      text: t => {
        if (skip) return;
        out.text.push(t.text);
        if (t.lastInTextNode) out.text.push(" ");
      },
    });
  await rw.transform(new Response(html)).text();
  return out;
}

const robots = await loadRobots();
const seeds = await sitemapUrls();
console.log(`robots: ${robots.disallow.length} disallow rules; sitemap: ${seeds.length} URLs`);

const pages = new Map<string, PageRecord>();
const queued = new Set<string>();
const linkSources = new Map<string, Set<string>>(); // internal link -> pages linking it
let frontier: Array<{ url: string; depth: number }> = seeds.map(u => ({ url: u, depth: 0 }));
for (const s of seeds) queued.add(s);

const crawlable = (u: string) => {
  const url = new URL(u);
  if (url.host !== "rosegriffon.fr") return false;
  if (!robotsAllowed(robots, url.pathname)) return false;
  return !/\.(png|jpe?g|gif|webp|avif|svg|ico|pdf|zip|mp4|webm|mp3|xml|json|txt|css|js)$/i.test(url.pathname);
};

async function crawlOne(url: string, depth: number) {
  const { hops, res, error, ms } = await fetchChain(url);
  const last = hops.at(-1);
  const ct = res?.headers.get("content-type") ?? "";
  const rec: PageRecord = {
    url,
    depth,
    fromSitemap: depth === 0 && seeds.includes(url),
    status: last?.status ?? 0,
    error,
    hops,
    finalUrl: last?.url ?? url,
    contentType: ct,
    ms: Math.round(ms),
    htmlBytes: 0,
    canonical: null,
    title: null,
    description: null,
    h1Count: 0,
    lang: null,
    robotsMeta: null,
    links: [],
    assets: [],
    srcsetCandidates: [],
    images: [],
    mixedContent: [],
    thirdPartyHosts: [],
    copy: [],
  };
  if (res && ct.includes("text/html")) {
    const html = await res.text();
    rec.htmlBytes = Buffer.byteLength(html);
    const p = await parsePage(html, rec.finalUrl);
    Object.assign(rec, {
      canonical: p.canonical,
      title: decodeEntities(p.title).trim() || null,
      description: p.description == null ? null : decodeEntities(p.description),
      h1Count: p.h1Count,
      lang: p.lang,
      robotsMeta: p.robotsMeta,
      links: [...p.links],
      assets: [...p.assets],
      srcsetCandidates: [...p.candidates].filter(c => !p.assets.has(c)),
      images: p.images,
    });
    rec.mixedContent = rec.assets.filter(a => a.startsWith("http:"));
    rec.thirdPartyHosts = [...new Set(rec.assets.map(a => new URL(a).host).filter(h => !isOwnHost(h)))];
    rec.copy = copyCheck(decodeEntities(p.text.join("")), p.attrText.map(decodeEntities));
  } else if (res) {
    await res.body?.cancel();
  }
  pages.set(url, rec);
  return rec;
}

for (let depth = 0; depth <= MAX_DEPTH && frontier.length && pages.size < MAX_PAGES; depth++) {
  const next: typeof frontier = [];
  const batch = frontier.slice(0, MAX_PAGES - pages.size);
  await Promise.all(
    batch.map(async ({ url }) => {
      const rec = await crawlOne(url, depth);
      for (const l of rec.links) {
        const u = new URL(l);
        if (u.host !== "rosegriffon.fr") continue;
        if (!linkSources.has(l)) linkSources.set(l, new Set());
        linkSources.get(l)!.add(url);
        if (depth < MAX_DEPTH && !queued.has(l) && crawlable(l)) {
          queued.add(l);
          next.push({ url: l, depth: depth + 1 });
        }
      }
    }),
  );
  console.log(`depth ${depth}: crawled ${batch.length}, total ${pages.size}, next ${next.length}`);
  frontier = next;
}

// Status of internal links that were not crawled as pages (beyond cap/depth, or robots-blocked assets).
const linkStatus = new Map<string, { status: number; finalUrl: string; error?: string }>();
for (const [u, p] of pages) linkStatus.set(u, { status: p.status, finalUrl: p.finalUrl, error: p.error });
const unchecked = [...linkSources.keys()].filter(
  l => !linkStatus.has(l) && robotsAllowed(robots, new URL(l).pathname),
);
const toCheck = unchecked.slice(0, MAX_LINK_CHECKS);
console.log(`link checks: ${toCheck.length} of ${unchecked.length} uncrawled internal links`);
await Promise.all(
  toCheck.map(async l => {
    let r = await fetchChain(l, "HEAD");
    if (r.res && (r.res.status === 405 || r.res.status === 501)) r = await fetchChain(l, "GET");
    else await r.res?.body?.cancel();
    linkStatus.set(l, { status: r.hops.at(-1)?.status ?? 0, finalUrl: r.hops.at(-1)?.url ?? l, error: r.error });
  }),
);

// Asset checks: HEAD own-host assets (rosegriffon.fr + cdn), record size; third-party only counted.
const allAssets = new Set<string>();
for (const p of pages.values()) for (const a of [...p.assets, ...p.srcsetCandidates]) allAssets.add(a);
const assetInfo = new Map<string, { status: number; bytes: number | null; type: string | null }>();
const ownAssets = [...allAssets].filter(a => isOwnHost(new URL(a).host));
console.log(`assets: ${allAssets.size} unique, HEAD ${ownAssets.length} own-host`);
await Promise.all(
  ownAssets.map(async a => {
    const r = await fetchChain(a, "HEAD");
    const res = r.res;
    // Text assets are served compressed on GET; HEAD length is then unreliable, so measure them.
    const textual = /text|javascript|json|svg|xml/.test(res?.headers.get("content-type") ?? "");
    let bytes = res && !textual ? Number(res.headers.get("content-length") ?? NaN) : NaN;
    let status = r.hops.at(-1)?.status ?? 0;
    await res?.body?.cancel();
    if (res && (status === 405 || (status < 400 && !Number.isFinite(bytes)))) {
      // Compressed transfer size via GET without decoding.
      const g = await gate.run(() =>
        fetch(r.hops.at(-1)!.url, {
          headers: { "user-agent": UA, "accept-encoding": "br, gzip" },
          decompress: false,
        } as RequestInit).catch(() => null),
      );
      if (g) {
        status = g.status;
        bytes = (await g.arrayBuffer()).byteLength;
      }
    }
    assetInfo.set(a, {
      status,
      bytes: Number.isFinite(bytes) ? bytes : null,
      type: res?.headers.get("content-type") ?? null,
    });
  }),
);

for (const p of pages.values()) {
  p.weightBytes = p.htmlBytes + p.assets.reduce((s, a) => s + (assetInfo.get(a)?.bytes ?? 0), 0);
  p.requestCount = 1 + p.assets.length;
  p.missingAssets = [...p.assets, ...p.srcsetCandidates]
    .map(a => ({ url: a, status: assetInfo.get(a)?.status ?? -1 }))
    .filter(x => x.status >= 400 || x.status === 0);
}

const brokenLinks: Array<{ url: string; status: number; error?: string; from: string[] }> = [];
for (const [l, s] of linkStatus)
  if (s.status >= 400 || s.status === 0)
    brokenLinks.push({ url: l, status: s.status, error: s.error, from: [...(linkSources.get(l) ?? [])].slice(0, 10) });

await writeJson("pages.json", [...pages.values()]);
await writeJson("links.json", {
  checked: Object.fromEntries(linkStatus),
  uncheckedCount: unchecked.length - toCheck.length,
  broken: brokenLinks,
});
await writeJson("assets.json", Object.fromEntries(assetInfo));
await writeJson("meta.json", {
  at: new Date().toISOString(),
  seeds: seeds.length,
  pages: pages.size,
  maxDepth: MAX_DEPTH,
  internalLinks: linkSources.size,
  assets: allAssets.size,
});
console.log(`done: ${pages.size} pages, ${brokenLinks.length} broken internal links`);
