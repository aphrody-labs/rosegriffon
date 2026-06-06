// Helpers du rendu serveur (PNG Rust) des écrans de menu IEVR.
//
// Le compositeur Rust `nie-model-serve` rend chaque écran de menu LIVE depuis les CPK
// et le sert en PNG immuable sur `cdn.rosegriffon.fr/menu-render/<screen>.png`. C'est le
// rendu robuste par défaut de `/menu/<screen>` (le WebGPU client reste dispo en option).
//
// Module pur, client-safe (aucun import Node/bun:sqlite) : importable dans un îlot
// `"use client"` comme dans un Server Component.

/** Base CDN du rendu PNG serveur des écrans de menu (nie-model-serve → nginx /menu-render). */
const MENU_RENDER_BASE = "https://cdn.rosegriffon.fr/menu-render";

// Version du compositeur de menu : les PNG sont servis `Cache-Control: immutable` → sans
// cache-buster, le navigateur garde l'ancien rendu après une amélioration du compositeur.
// Bumper à CHAQUE évolution du rendu serveur (cf. MODEL_FULL_VERSION pour les GLB).
// v1 = exporteur de layouts corrigé (PickBestPoseForSprite) + composite alpha-aware.
const MENU_RENDER_VERSION = "1";

/** Résout l'URL du PNG rendu serveur d'un écran de menu (immuable, cache-busté par version). */
export function menuRenderPngUrl(screen: string): string {
	return `${MENU_RENDER_BASE}/${screen}.png?v=${MENU_RENDER_VERSION}`;
}

// Écrans dont le rendu serveur est honnêtement vide : leur contenu est instancié au RUNTIME
// dans le jeu (écrans purement texte, templates de list-items, ou unique sprite hors-canvas
// dans la bind pose). Ce ne sont PAS des régressions — le compositeur fonctionne, mais il
// n'y a rien à composer statiquement. On les affiche avec une note explicite.
export const MENU_RUNTIME_EMPTY_SCREENS: ReadonlySet<string> = new Set([
	"106_info",
	"109_system",
	"110_playguide",
	"112_gallery",
	"122_opponent",
	"51_save",
]);

/** Indique si un écran est rendu vide côté serveur (contenu purement runtime in-game). */
export function isMenuScreenRuntimeEmpty(screen: string): boolean {
	return MENU_RUNTIME_EMPTY_SCREENS.has(screen);
}
