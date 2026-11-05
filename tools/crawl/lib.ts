// Shared helpers for the read-only Rose Griffon crawl audit (Bun only, no deps).

export const UA = "RoseGriffonAudit/1.0 (+https://rosegriffon.fr)";
export const ORIGIN = "https://rosegriffon.fr";
export const OUT_DIR = new URL("../../var/crawl/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

export const isOwnHost = (host: string) => host === "rosegriffon.fr" || host.endsWith(".rosegriffon.fr");

/** Global politeness gate: at most `max` requests in flight, plus a small gap between starts. */
export class Gate {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(
    private max = 2,
    private gapMs = 120,
  ) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>(r => this.queue.push(r));
    this.active++;
    try {
      return await fn();
    } finally {
      await Bun.sleep(this.gapMs);
      this.active--;
      this.queue.shift()?.();
    }
  }
}

export const gate = new Gate(2);

export interface Robots {
  allow: string[];
  disallow: string[];
}

export async function loadRobots(): Promise<Robots> {
  const res = await gate.run(() => fetch(`${ORIGIN}/robots.txt`, { headers: { "user-agent": UA } }));
  const text = res.ok ? await res.text() : "";
  const rules: Robots = { allow: [], disallow: [] };
  let inStar = false;
  let sawRule = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const val = m[2]!.trim();
    if (key === "user-agent") {
      if (sawRule) inStar = false;
      sawRule = false;
      if (val === "*") inStar = true;
    } else if (key === "allow" || key === "disallow") {
      sawRule = true;
      if (inStar && val) rules[key].push(val);
    }
  }
  return rules;
}

/** Longest-match robots evaluation (RFC 9309), ignoring wildcards beyond prefix. */
export function robotsAllowed(r: Robots, path: string): boolean {
  let best = -1;
  let allowed = true;
  for (const p of r.allow) if (path.startsWith(p) && p.length >= best) ((best = p.length), (allowed = true));
  for (const p of r.disallow) if (path.startsWith(p) && p.length > best) ((best = p.length), (allowed = false));
  return allowed;
}

export interface Hop {
  url: string;
  status: number;
  location?: string;
}

/** Fetch following redirects manually so the chain is recorded. */
export async function fetchChain(
  url: string,
  method: "GET" | "HEAD" = "GET",
  max = 10,
): Promise<{ hops: Hop[]; res: Response | null; error?: string; ms: number }> {
  const hops: Hop[] = [];
  let current = url;
  const t0 = performance.now();
  for (let i = 0; i <= max; i++) {
    let res: Response;
    try {
      res = await gate.run(() =>
        fetch(current, {
          method,
          redirect: "manual",
          headers: { "user-agent": UA, accept: method === "GET" ? "text/html,*/*;q=0.8" : "*/*" },
          signal: AbortSignal.timeout(30_000),
        }),
      );
    } catch (e) {
      return { hops, res: null, error: String((e as Error).message ?? e), ms: performance.now() - t0 };
    }
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      hops.push({ url: current, status: res.status, location: loc });
      await res.body?.cancel();
      current = new URL(loc, current).href;
      continue;
    }
    hops.push({ url: current, status: res.status });
    return { hops, res, ms: performance.now() - t0 };
  }
  return { hops, res: null, error: "redirect loop", ms: performance.now() - t0 };
}

// HTMLRewriter exposes raw attribute values, so character references must be decoded here.
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : (ENTITIES[e.toLowerCase()] ?? m),
  );

export function normalize(href: string, base: string): string | null {
  try {
    const u = new URL(decodeEntities(href.trim()), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

export async function writeJson(name: string, data: unknown) {
  await Bun.write(`${OUT_DIR}${name}`, JSON.stringify(data, null, 2));
}

export async function readJson<T>(name: string): Promise<T> {
  return (await Bun.file(`${OUT_DIR}${name}`).json()) as T;
}
