/**
 * Sert l'API HTTP inagle (REST + OpenAPI : données jeu + images) en headless,
 * via Bun.serve. C'est le « api endpoint » du flow unifié.
 */
import { getInagleApp } from "@rose-griffon/iecode-inagle";

export interface ServeOptions {
	/** DATA_PATH inagle (défaut: env DATA_PATH puis défaut inagle). */
	dataPath?: string;
	/** Port d'écoute (défaut 3000). */
	port?: number;
	onLog?: (msg: string) => void;
}

export interface RunningServer {
	port: number;
	url: string;
	stop: () => void;
}

/**
 * Démarre le serveur HTTP inagle. Renvoie le port effectif et un `stop()`.
 *
 * @example
 *   const s = await serve({ dataPath: "~/iecode-dump", port: 3000 });
 *   // GET http://localhost:3000/...   (routes inagle + OpenAPI)
 */
export async function serve(opts: ServeOptions = {}): Promise<RunningServer> {
	if (opts.dataPath) process.env["DATA_PATH"] = opts.dataPath;
	const log = opts.onLog ?? ((m: string) => console.info(m));

	const app = await getInagleApp();
	const port = opts.port ?? 3000;
	const server = Bun.serve({
		port,
		fetch: (req) => app.fetch(req),
	});

	const url = `http://localhost:${server.port}`;
	log(`▸ API inagle headless sur ${url}`);
	return { port: server.port ?? port, url, stop: () => server.stop() };
}
