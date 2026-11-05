// Usage: bun mesure.ts <base> <label> <path...>
// For each path: HTML TTFB/total/size, scripts referenced (count, raw bytes, gzip bytes), hero img.
const [base, label, ...paths] = Bun.argv.slice(2);
const seen = new Map<string, { raw: number; gz: number; text: string }>();
async function asset(u: string) {
  if (seen.has(u)) return seen.get(u)!;
  const r = await fetch(u);
  const b = new Uint8Array(await r.arrayBuffer());
  const v = { raw: b.length, gz: Bun.gzipSync(b).length, text: new TextDecoder().decode(b) };
  seen.set(u, v);
  return v;
}
const out: any[] = [];
for (const p of paths) {
  const t0 = performance.now();
  const r = await fetch(base + p, { headers: { "user-agent": "perf-vague3" } });
  const reader = r.body!.getReader();
  let first = 0, size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!first) first = performance.now() - t0;
    size += value.length;
    chunks.push(value);
  }
  const total = performance.now() - t0;
  const html = new TextDecoder().decode(Bun.concatArrayBuffers(chunks));
  const srcs = [...new Set([...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)].filter(m => !/nomodule/i.test(m[0])).map(m => m[1]!))];
  let raw = 0, gz = 0;
  const markers: Record<string, boolean> = { fr_json_hex: false, zod: false, achillea_client: false };
  for (const s of srcs) {
    const a = await asset(new URL(s, base).href);
    raw += a.raw; gz += a.gz;
    if (a.text.includes("0xA92A06C6")) markers.fr_json_hex = true;
    if (a.text.includes("ZodError") || a.text.includes("invalid_type")) markers.zod = true;
    if (a.text.includes("/clans/role") || a.text.includes("achillea_token")) markers.achillea_client = true;
    if (a.text.includes("X-Client-Info")) markers.supabase = true;
    if (a.text.includes("recharts")) markers.recharts = true;
  }
  const hero = html.match(/<img[^>]*fetchPriority="high"[^>]*>/i)?.[0]?.match(/src="([^"]+)"/)?.[1] ?? null;
  out.push({ label, path: p, status: r.status, ttfbMs: Math.round(first), totalMs: Math.round(total), htmlBytes: size, scripts: srcs.length, jsRaw: raw, jsGz: gz, ...markers, heroImg: hero });
}
console.log(JSON.stringify(out, null, 1));
