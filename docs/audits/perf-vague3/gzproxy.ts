// Gzip front for the local prod server, as nginx does in prod (next.config: compress: false).
const upstream = process.argv[2] ?? "http://localhost:3340";
Bun.serve({
  port: Number(process.argv[3] ?? 3341),
  idleTimeout: 120,
  async fetch(req) {
    const u = new URL(req.url);
    const h = new Headers(req.headers); h.delete("accept-encoding"); h.set("host", new URL(upstream).host);
    const r = await fetch(upstream + u.pathname + u.search, { method: req.method, headers: h, body: req.body, redirect: "manual", decompress: false } as any);
    const ct = r.headers.get("content-type") ?? "";
    const headers = new Headers(r.headers);
    if (r.body && /text|javascript|json|svg|xml|css/.test(ct) && !(req.headers.get("accept-encoding") ?? "").includes("identity")) {
      headers.delete("content-length"); headers.set("content-encoding", "gzip");
      return new Response(r.body.pipeThrough(new CompressionStream("gzip")), { status: r.status, headers });
    }
    return new Response(r.body, { status: r.status, headers });
  },
});
console.log("gzproxy ready");
