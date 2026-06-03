export { GameMenu } from "./game-menu.js";
export type { GameMenuProps, MenuObjectOverride } from "./game-menu.js";
export type {
	MenuLayout,
	MenuObject,
	MenuTransform,
	MenuSprite,
	MenuText,
	MenuAnim,
	MenuPrimitive,
	MenuCanvas,
} from "./types.js";

// ── Runtime Lua (navigateur + Bun) ────────────────────────────────────────────
export {
	LuaScreenHost,
	GameScreenHost,
	runMenuScreen,
	runMenuScreenState,
	menuStateToOverrides,
} from "./lua-host.js";
export type {
	LuaGameHost,
	LuaLayerState,
	LuaCallRecord,
	LayerInfo,
	RunMenuScreenOptions,
	RunMenuStateOptions,
	MenuState,
	MenuObjectState,
} from "./lua-host.js";
export { useLuaScreen, useLuaMenu } from "./use-lua-screen.js";
export type { UseLuaScreenResult, UseLuaMenuResult } from "./use-lua-screen.js";
