export { GameMenu } from "./game-menu.tsx";
export type { GameMenuProps, MenuObjectOverride } from "./game-menu.tsx";
export type {
	MenuLayout,
	MenuObject,
	MenuTransform,
	MenuSprite,
	MenuText,
	MenuAnim,
	MenuPrimitive,
	MenuCanvas,
} from "./types.ts";

// ── Runtime Lua : SERVER-ONLY (Node : child_process/fs/unluac.jar) ─────────────
// NE PAS ré-exporter ici : ce barrel est bundlé côté navigateur (azalee). Importer
// le runtime Lua via le sous-chemin `@rose-griffon/menu-render/lua-host` /
// `/use-lua-screen` (cf. exports package.json) depuis du code serveur uniquement.
