/**
 * Pont navigateur vers les **parseurs natifs** de fichiers de jeu IEVR (wasm `nie-wasm`).
 *
 * Décode les `cfg.bin` (RDBN + T2B) en structures de jeu TYPÉES **côté client**, sans
 * dépendre de la route serveur `/typed` de nie-model-serve : on télécharge les octets
 * bruts (`/raw`) puis on parse dans le module WebAssembly (mêmes parseurs Rust que le jeu).
 *
 * Module wasm vendoré (`lib/nie-wasm-web/`, build `wasm-bindgen --target web`), binaire
 * servi same-origin depuis `/wasm/nie_wasm_bg.wasm` (`public/`). Instancié une fois.
 */
import init, { cfgbin_typed_json, init_panic_hook } from "./nie-wasm-web/nie_wasm.js";

/** URL same-origin du binaire wasm. */
const WASM_URL = "/wasm/nie_wasm_bg.wasm";

let initPromise: Promise<void> | null = null;

/** Instancie le module wasm une seule fois (idempotent). */
async function ensureWasm(): Promise<void> {
	if (initPromise === null) {
		initPromise = (async () => {
			await init({ module_or_path: fetch(WASM_URL) });
			init_panic_hook();
		})();
	}
	return initPromise;
}

/** Réponse du décodage typé d'un `cfg.bin` (forme identique à la route serveur `/typed`). */
export interface CpkTypedDecoded {
	/** Famille de jeu reconnue (`"formation"`, `"item"`…) ou `null` si non typée. */
	family: string | null;
	/** Données typées de la famille (si `family` non nul). */
	data?: unknown;
	/** Clé de fichier dérivée (si `family` nul). */
	key?: string;
	/** RDBN/T2B brut (forme iecode) si aucune famille typée. */
	generic?: unknown;
}

/**
 * Décode un `cfg.bin` (octets bruts) en structure de jeu typée, **dans le navigateur**.
 *
 * @param bytes octets bruts du `cfg.bin` (décompressés du CPK, ex. via `/raw`).
 * @param filename nom de fichier (dérive la clé de famille, ex. `formation_config_0.02.16.cfg.bin`).
 * @throws si le module wasm échoue à charger, ou si les octets ne sont ni RDBN ni T2B.
 */
export async function cfgbinTyped(bytes: Uint8Array, filename: string): Promise<CpkTypedDecoded> {
	await ensureWasm();
	const json = cfgbin_typed_json(bytes, filename);
	return JSON.parse(json) as CpkTypedDecoded;
}
