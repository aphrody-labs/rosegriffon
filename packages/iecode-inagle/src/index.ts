/**
 * @rose-griffon/iecode-inagle — accès Bun au **vrai inagle** (`@rose-griffon/inagle`).
 *
 * Game Data API IEVR : parse les vrais fichiers du jeu (cfg.bin/CPK/G4TX, lua,
 * zukan) et expose characters, skills, items, teams, quests, drops, basara,
 * menu, search, images, parsers (gallery/capsules/costumes/expTable/…),
 * evolution. Les données sont lues depuis `DATA_PATH` (défaut `/home/ubuntu/niers/data`).
 *
 * @example
 *   import { getInagle } from "@rose-griffon/iecode-inagle";
 *   const inagle = await getInagle();
 *   inagle.characters.all();   // 6000+ persos, typés
 *   inagle.skills.all();
 *   await inagle.parsers.gallery();
 */

// Types complets du vrai inagle (re-export type-only : aucune éval runtime, donc
// n'enclenche pas la résolution de DATA_ROOT avant que DATA_PATH soit posé).
export type * from "@rose-griffon/inagle";

import type { InagleService } from "@rose-griffon/inagle";

/** Racine des données jeu par défaut (override via `DATA_PATH`). */
export const DEFAULT_DATA_PATH = "/home/ubuntu/niers/data";

let _service: Promise<InagleService> | undefined;

/**
 * Service inagle (mémoïsé). Pose `DATA_PATH` **avant** d'importer le paquet —
 * `@rose-griffon/inagle` résout `DATA_ROOT` au chargement du module, d'où
 * l'import dynamique après avoir fixé l'env.
 */
export function getInagle(): Promise<InagleService> {
	if (!_service) {
		process.env["DATA_PATH"] ??= DEFAULT_DATA_PATH;
		_service = import("@rose-griffon/inagle").then((m) => m.createInagleService());
	}
	return _service;
}

/** Réinitialise le service mémoïsé (utile en test). */
export function resetInagle(): void {
	_service = undefined;
}

let _app: Promise<unknown> | undefined;

/**
 * Application HTTP Hono d'inagle (API REST + OpenAPI des données jeu/images),
 * servable headless sur n'importe quel runtime (Bun.serve, Node, Workers…).
 * Pose `DATA_PATH` avant l'import (même contrainte que {@link getInagle}).
 *
 * @example
 *   const app = await getInagleApp();
 *   Bun.serve({ port: 3000, fetch: app.fetch });
 */
export function getInagleApp(): Promise<{ fetch: (req: Request) => Response | Promise<Response> }> {
	if (!_app) {
		process.env["DATA_PATH"] ??= DEFAULT_DATA_PATH;
		_app = import("@rose-griffon/inagle").then((m) => m.createInagleAppAsync());
	}
	return _app as Promise<{ fetch: (req: Request) => Response | Promise<Response> }>;
}
