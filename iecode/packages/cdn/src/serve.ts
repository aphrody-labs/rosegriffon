/**
 * Serveur HTTP headless du CDN IEVR (Bun.serve).
 *
 * Surfaces servies :
 *
 * - `GET /dx11/menu/<path>.png`             → décodage G4TX→PNG lossless (MenuPngService).
 * - `GET /dx11/<path>` (tout autre fichier) → octets NATIFS bruts depuis le CPK (CdnFileService).
 *
 * Utilisé comme fallback live par nginx (try_files $uri @cpk_live) : si un asset est absent
 * du dump pré-extrait, nginx proxy la requête ici. Le décodage est effectué à la demande,
 * sans écriture disque, sans dump préalable.
 *
 * `Cache-Control: immutable` + ETag (assets figés pour un buildid).
 */
import { openMenuCdn, type MenuCdn } from "./index.ts";

export interface ServeOptions {
	gamePath?: string;
	port?: number;
	hostname?: string;
}

/** En-têtes de sécurité/cache communs à toutes les réponses CDN. */
function cdnHeaders(extra: Record<string, string> = {}): Record<string, string> {
	return {
		"cache-control": "public, max-age=31536000, immutable",
		"access-control-allow-origin": "*",
		"cross-origin-resource-policy": "cross-origin",
		"x-content-type-options": "nosniff",
		...extra,
	};
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
			// Chemin logique : retire le slash initial → "dx11/menu/..." ou "dx11/..."
			const logical = decodeURIComponent(url.pathname).replace(/^\/+/, "");

			// Seuls les chemins sous dx11/ sont servis.
			if (!logical.startsWith("dx11/")) {
				return new Response("not found", { status: 404 });
			}

			// ── Chemin menu PNG → décodage G4TX→PNG via MenuPngService ──────────
			const isMenuPng =
				logical.startsWith("dx11/menu/") &&
				logical.endsWith(".png");

			if (isMenuPng) {
				try {
					const m = await cdn.render(logical);
					if (!m) return new Response("not found", { status: 404 });
					return new Response(m.bytes, {
						headers: cdnHeaders({
							"content-type": "image/png",
							"content-length": String(m.bytes.length),
							etag: m.etag,
							"x-image-dimensions": `${m.width}x${m.height}`,
						}),
					});
				} catch (err) {
					// KeyNotFoundException = conteneur connu mais texture absente → 404 propre.
					const msg = (err as Error).message ?? "";
					if (msg.includes("absente du conteneur") || msg.includes("KeyNotFoundException")) {
						return new Response("not found", { status: 404 });
					}
					return new Response(`error: ${msg}`, { status: 500 });
				}
			}

			// ── Tout autre fichier dx11/ → octets bruts depuis le CPK ────────────
			// nginx nous passe le chemin sous la forme /dx11/<path> ; le chemin
			// logique CPK est data/dx11/<path> (les CPK stockent le préfixe "data/").
			const cpkPath = `data/${logical}`;
			try {
				const raw = await cdn.readRaw(cpkPath);
				if (!raw) {
					// Essai sans préfixe "data/" (certains chemins sont dans des CPK sans
					// ce préfixe — rare mais possible selon la cpk_list du build).
					const rawAlt = await cdn.readRaw(logical);
					if (!rawAlt) return new Response("not found", { status: 404 });
					return new Response(rawAlt.bytes, {
						headers: cdnHeaders({
							"content-type": rawAlt.mediaType,
							"content-length": String(rawAlt.bytes.length),
							etag: rawAlt.etag,
						}),
					});
				}
				return new Response(raw.bytes, {
					headers: cdnHeaders({
						"content-type": raw.mediaType,
						"content-length": String(raw.bytes.length),
						etag: raw.etag,
					}),
				});
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
