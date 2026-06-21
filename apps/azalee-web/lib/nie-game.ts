/**
 * Pont navigateur vers le **JEU jouable** niers (`nie-app` : machine à états + rendu CPU), via le
 * binaire wasm `nie-wasm` (`/wasm/nie_wasm_bg.wasm`). Expose `WasmGame` : la FSM GameState
 * (Title → MainMenu → Match → Story) rendue en framebuffer RGBA8 que l'on peint sur un `<canvas>`.
 *
 * 100 % Rust côté logique/rendu ; ce module ne fait que charger le wasm, fetcher les octets de la
 * police (assets CPK réels servis par le CDN) et adapter les framebuffers en `ImageData`.
 *
 * ⚠ Navigateur uniquement (wasm + fetch). À n'importer que depuis des composants `"use client"`.
 */
import init, { WasmGame } from "./nie-wasm-web/nie_wasm.js";

const WASM_URL = "/wasm/nie_wasm_bg.wasm";
const CDN = "https://cdn.rosegriffon.fr";

/** Police réelle du jeu (octets bruts CPK) — métriques + atlas de glyphes, parsés par nie-app. */
const FONT_CFG_URL = `${CDN}/raw/common/font/font/font_def/font.cfg.bin`;
const FONT_G4TX_URL = `${CDN}/raw/dx11/font/font_def/font.g4tx`;

let initPromise: Promise<void> | null = null;
async function ensureWasm(): Promise<void> {
	if (initPromise === null) {
		initPromise = (async () => {
			await init({ module_or_path: fetch(WASM_URL) });
		})();
	}
	return initPromise;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
	return new Uint8Array(await res.arrayBuffer());
}

/** Poignée de jeu prête à rendre : dimensions + rendu d'un écran en `ImageData` pour `putImageData`. */
export interface GameHandle {
	/** Largeur du framebuffer (px). */
	readonly width: number;
	/** Hauteur du framebuffer (px). */
	readonly height: number;
	/** Nombre de frames du playthrough scripté (boucle). */
	readonly totalFrames: number;
	/** Rend la frame `idx` du playthrough (Title→Menu→Match→Story→…). */
	renderFrame(idx: number): ImageData;
	/** Rend le menu principal avec l'option `sel` surlignée (navigation interactive). */
	renderMenu(sel: number): ImageData;
}

/**
 * Charge le moteur de jeu wasm + la police réelle, et renvoie une poignée prête à rendre.
 * Idempotent pour l'init wasm (singleton du module glue). À appeler côté client.
 */
export async function loadGame(): Promise<GameHandle> {
	await ensureWasm();
	const [cfg, g4tx] = await Promise.all([fetchBytes(FONT_CFG_URL), fetchBytes(FONT_G4TX_URL)]);
	const game = new WasmGame(cfg, g4tx);
	const width = game.width;
	const height = game.height;
	const toImage = (rgba: Uint8Array): ImageData => new ImageData(new Uint8ClampedArray(rgba), width, height);
	return {
		width,
		height,
		totalFrames: game.total_frames,
		renderFrame: (idx) => toImage(game.render_frame(idx >>> 0)),
		renderMenu: (sel) => toImage(game.render_menu(Math.max(0, sel))),
	};
}
