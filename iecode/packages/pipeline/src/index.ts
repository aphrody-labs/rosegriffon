/**
 * @rose-griffon/iecode-pipeline — flow IEVR headless unifié.
 *
 * Unifie l'**acquisition** (`@rose-griffon/iecode-steam-sync` : download Steam natif + extraction
 * CPK, sans steamcmd) et le **parsing/serving** (`@rose-griffon/iecode-inagle` : API données jeu
 * complète + serveur HTTP Hono) en un flow headless, gardé par le buildid Steam :
 *
 *   accumulate() → check build → (download + dump) si update → export corpus complet
 *   serve()      → API HTTP inagle headless (REST + OpenAPI + images)
 *   exportCorpus() → tous les domaines inagle → JSON versionné
 *
 * @example
 *   import { accumulate, serve } from "@rose-griffon/iecode-pipeline";
 *   await accumulate({ corpusOut: "~/iecode-corpus" }); // creds via env STEAM_*
 *   await serve({ dataPath: "~/iecode-dump", port: 3000 });
 */
export type * from "./types.ts";
export { exportCorpus } from "./corpus.ts";
export {
	exportDataPath,
	stripDataPrefix,
	type DataPathExportOptions,
	type DataPathExportResult,
} from "./datapath.ts";
export { serve, type ServeOptions, type RunningServer } from "./serve.ts";
export { accumulate } from "./accumulate.ts";
export { getRemoteBuildId, readSnapshot, writeSnapshot } from "./version.ts";
