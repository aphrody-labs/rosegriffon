// Serves the legacy Angular build with SPA fallback and proxies /api to prod.
const root = process.env.LEGACY_DIST ?? "C:/tmp/lgb/web/dist/achillea-web/browser";
const port = Number(process.argv[2] ?? 4300);
Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io")) {
      const target = "https://ranked.rosegriffon.fr" + url.pathname + url.search;
      const headers = new Headers(req.headers); headers.delete("host"); headers.delete("origin");
      try {
        const r = await fetch(target, { method: req.method, headers, body: req.method === "GET" ? undefined : await req.arrayBuffer() });
        const h = new Headers(r.headers); h.delete("content-encoding"); h.delete("content-length");
        return new Response(await r.arrayBuffer(), { status: r.status, headers: h });
      } catch { return new Response("upstream", { status: 502 }); }
    }
    const f = Bun.file(root + decodeURIComponent(url.pathname));
    if (url.pathname !== "/" && (await f.exists())) return new Response(f);
    return new Response(Bun.file(root + "/index.html"), { headers: { "content-type": "text/html" } });
  },
});
console.log("legacy on", port);
