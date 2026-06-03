/**
 * Serveur HTTP headless du CDN menu azalee (Bun.serve).
 *
 * - `GET /dx11/menu/<path>.g4tx`        → octets NATIFS bruts (défaut, lossless, pixel-perfect).
 * - `GET /dx11/menu/<path>.png`         → 404 par défaut (les PNG ne sont pas stockés tels quels)…
 * - `GET /dx11/menu/<path>.png?format=png` → décodage G4TX→PNG **lossless** à la demande (azalee).
 *
 * Le PNG est OPT-IN : on ne convertit jamais implicitement. Aucune écriture disque, aucune prod.
 * `Cache-Control: immutable` + ETag (assets figés pour un buildid).
 */
import { openMenuCdn, type MenuCdn } from "./index.ts";

export interface ServeOptions {
	gamePath?: string;
	port?: number;
	hostname?: string;
}

export function serveMenuCdn(opts: ServeOptions = {}): { stop: () => void; port: number; url: string } {
	const cdn: MenuCdn = openMenuCdn(opts.gamePath);
	const port = opts.port ?? 8788;
	const hostname = opts.hostname ?? "127.0.0.1";

	const server = Bun.serve({
		port,
		hostname,
		async fetch(req) {
			const url = new URL(req.url);
			// nginx-style : tout sous /dx11/menu/ ; on accepte aussi un préfixe data/.
			let logical = decodeURIComponent(url.pathname).replace(/^\/+/, "");
			if (!logical.startsWith("dx11/menu/") && !logical.startsWith("data/dx11/menu/")) {
				return new Response("not found", { status: 404 });
			}
			const wantPng = url.searchParams.get("format") === "png" || logical.endsWith(".png");

			try {
				if (wantPng && logical.endsWith(".png")) {
					const m = await cdn.render(logical);
					if (!m) return new Response("not found", { status: 404 });
					return new Response(m.bytes, {
						headers: {
							"content-type": "image/png",
							"content-length": String(m.bytes.length),
							"cache-control": "public, max-age=31536000, immutable",
							etag: m.etag,
							"x-image-dimensions": `${m.width}x${m.height}`,
						},
					});
				}
				return new Response("use ?format=png for PNG, or request a raw .g4tx path", { status: 404 });
			} catch (err) {
				return new Response(`error: ${(err as Error).message}`, { status: 500 });
			}
		},
	});

	const boundPort = server.port ?? port;
	return {
		stop: () => {
			server.stop(true);
			cdn.dispose();
		},
		port: boundPort,
		url: `http://${hostname}:${boundPort}`,
	};
}
