// SPDX-License-Identifier: Apache-2.0
// Rose Griffon Cloudflare Edge Worker: R2 CDN gateway + edge health.

interface Env {
  CDN_BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" || url.pathname === "/") {
      return Response.json(
        {
          ok: true,
          service: "rosegriffon-edge",
          runtime: "cloudflare-workers",
          bucket: "rosegriffon-cdn",
        },
        {
          headers: { "cache-control": "no-store" },
        },
      );
    }

    if (url.pathname === "/fetch") {
      const target = url.searchParams.get("url");
      if (!target) {
        return new Response("Missing url", { status: 400 });
      }
      let parsed: URL;
      try {
        parsed = new URL(target);
      } catch {
        return new Response("Invalid url", { status: 400 });
      }
      if (
        (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
        /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?|.*\.local$)/i.test(
          parsed.hostname,
        )
      ) {
        return new Response("Forbidden target", { status: 403 });
      }
      const upstream = await fetch(parsed.toString(), {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        },
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "content-type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
          "cache-control": "public, max-age=300",
          "access-control-allow-origin": "*",
        },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const key = url.pathname.replace(/^\/+/, "");
    const object = await env.CDN_BUCKET.get(key);
    if (!object) {
      return new Response("Not Found", {
        status: 404,
        headers: { "cache-control": "no-store" },
      });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    if (!headers.has("cache-control")) {
      headers.set("cache-control", "public, max-age=3600, stale-while-revalidate=86400");
    }
    headers.set("access-control-allow-origin", "*");

    return new Response(request.method === "HEAD" ? null : object.body, {
      headers,
    });
  },
};
