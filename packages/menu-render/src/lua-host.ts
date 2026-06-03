/**
 * Module runtime Lua pour azalee (navigateur).
 *
 * Ce module est un addtif pur — il n'importe rien de `game-menu.tsx` ni
 * de `types.ts`. Il expose :
 *   - `LuaScreenHost`    : host IEVR spécialisé navigateur (journalise + expose état)
 *   - `runMenuScreen()`  : point d'entrée synchrone pour exécuter un script de menu
 *     en navigateur via fengari (requiert le source Lua décompilé, pas le bytecode)
 *
 * Voie d'intégration azalee :
 * ```tsx
 * import { runMenuScreen, LuaScreenHost } from "@rose-griffon/menu-render/src/lua-host.ts";
 * import { useLuaScreen } from "@rose-griffon/menu-render/src/use-lua-screen.ts";
 *
 * // Dans un composant React :
 * const { layerState, isReady } = useLuaScreen(luaSource, { layerIds: [...] });
 * // → layerState.calls contient tous les funcLuaMenuCommand émis
 * // → layer.layers contient les layers ouverts
 * ```
 *
 * Pas de Bun.spawn : `runMenuScreen` est synchrone et fonctionnel en navigateur.
 */

import {
	DefaultLuaHost,
	runLuaSource,
	loadHashDictionary,
	type LuaGameHost,
	type LuaLayerState,
	type LuaCallRecord,
	type LayerInfo,
	type RunLuaOptions,
} from "@rose-griffon/iecode-inagle/lua/runtime.ts";
import {
	GameLuaHost,
	loadMenuCommandNames,
	type MenuState,
	type MenuObjectState,
} from "@rose-griffon/iecode-inagle/lua/game-host.ts";

export type { LuaGameHost, LuaLayerState, LuaCallRecord, LayerInfo, MenuState, MenuObjectState };

// ── LuaScreenHost ─────────────────────────────────────────────────────────────

/**
 * Host IEVR étendu pour azalee.
 * Étend `DefaultLuaHost` avec :
 *   - un registre de scripts d'include (pour INCLUDE("LUA_MENU_DEF") etc.)
 *   - des callbacks optionnels pour réagir en temps réel aux commandes
 */
export class LuaScreenHost extends DefaultLuaHost {
	private readonly _includes: Map<string, string> = new Map();

	/**
	 * Enregistre un script d'include par nom.
	 * @example
	 *   host.registerInclude("LUA_MENU_DEF", luaMenuDefSource);
	 */
	registerInclude(name: string, source: string): this {
		this._includes.set(name, source);
		return this;
	}

	override include(name: string): string {
		const src = this._includes.get(name);
		if (src !== undefined) return src;
		// Stub vide si l'include n'est pas enregistré — log l'appel
		super.include(name);
		return "";
	}
}

// ── runMenuScreen ─────────────────────────────────────────────────────────────

/** Options de `runMenuScreen`. */
export interface RunMenuScreenOptions extends Omit<RunLuaOptions, "unluacJarPath"> {
	/**
	 * Map nom → source Lua des scripts d'include.
	 * Ex : `{ "LUA_MENU_DEF": luaMenuDefSource }`
	 */
	includes?: Record<string, string>;

	/**
	 * Entrées du dictionnaire de hashes CRC32 IEVR.
	 * Si fourni, `resolveHash()` retourne des noms lisibles.
	 * Format : `{ "0xABCDEF01": "nom_de_commande", ... }`
	 */
	hashEntries?: Record<string, string>;
}

/**
 * Exécute un script Lua de menu IEVR dans le navigateur (synchrone, via fengari).
 *
 * @param source   Source Lua décompilé (string). Ne prend PAS de bytecode
 *                 (la décompilation via unluac nécessite Bun.spawn).
 * @param options  Optionnel : layerIds, layerArg, includes, hashEntries.
 * @returns `LuaLayerState` — journal des appels + layers ouverts.
 *
 * @example
 * ```ts
 * const state = runMenuScreen(qrcodeMenuLuaSource, {
 *   layerIds: [292844459, 1189944233, 333528782],
 * });
 * console.log(state.calls); // toutes les funcLuaMenuCommand tracées
 * ```
 */
export function runMenuScreen(
	source: string,
	options: RunMenuScreenOptions = {},
): LuaLayerState {
	const { includes, hashEntries, ...runOptions } = options;

	if (hashEntries) loadHashDictionary(hashEntries);

	const host = new LuaScreenHost();
	if (includes) {
		for (const [name, src] of Object.entries(includes)) {
			host.registerInclude(name, src);
		}
	}

	const state = runLuaSource(source, host, runOptions);
	return state ?? host.state;
}

// ── GameScreenHost (host fidèle navigateur) ──────────────────────────────────

/**
 * Host fidèle pour azalee : combine le registre d'includes de {@link LuaScreenHost}
 * et l'interprétation des commandes de {@link GameLuaHost} (→ {@link MenuState}).
 */
export class GameScreenHost extends GameLuaHost {
	private readonly _includes: Map<string, string> = new Map();

	registerInclude(name: string, source: string): this {
		this._includes.set(name, source);
		return this;
	}

	override include(name: string): string {
		const src = this._includes.get(name);
		if (src !== undefined) return src;
		super.include(name);
		return "";
	}
}

/** Override appliqué à un objet de layout par l'état Lua (par nom d'objet). */
export interface MenuObjectOverride {
	/** Visibilité pilotée par SetObjectVisible/SetLayerVisible. */
	visible?: boolean | undefined;
	/** Texte piloté par SetText. */
	text?: string | undefined;
	/** Nombre piloté par SetNumericDisplay/SetObjectNum (rendu comme texte). */
	number?: number | undefined;
}

/** Options de `runMenuScreenState`. */
export interface RunMenuStateOptions extends RunMenuScreenOptions {
	/** Map `cmdId → nom inféré` ; sinon dérivée de `funcluaJson`. */
	menuCommandNames?: Map<number, string>;
	/** JSON parsé de `re/lua/funclua-cmdids.json` (alternative à `menuCommandNames`). */
	funcluaJson?: unknown;
}

/**
 * Exécute un script de menu et reconstruit l'état du jeu via {@link GameScreenHost}.
 * Retourne le journal d'appels ET le {@link MenuState} (layers/objets mutés).
 */
export function runMenuScreenState(
	source: string,
	options: RunMenuStateOptions = {},
): { layerState: LuaLayerState; menuState: MenuState } {
	const { includes, hashEntries, menuCommandNames, funcluaJson, ...runOptions } = options;

	if (hashEntries) loadHashDictionary(hashEntries);

	const names = menuCommandNames ?? (funcluaJson ? loadMenuCommandNames(funcluaJson) : new Map());
	const host = new GameScreenHost(names);
	if (includes) {
		for (const [name, src] of Object.entries(includes)) host.registerInclude(name, src);
	}

	const layerState = runLuaSource(source, host, runOptions) ?? host.state;
	return { layerState, menuState: host.menuState };
}

/**
 * Aplatit un {@link MenuState} en overrides indexés par NOM d'objet — la clé que
 * `<GameMenu>` (layout statique) utilise. Combine la visibilité du layer et de l'objet.
 */
export function menuStateToOverrides(menuState: MenuState): Record<string, MenuObjectOverride> {
	const out: Record<string, MenuObjectOverride> = {};
	for (const layer of menuState.layers.values()) {
		const layerVisible = layer.visible;
		for (const obj of layer.objects.values()) {
			if (obj.name === null) continue;
			out[obj.name] = {
				visible: layerVisible && obj.visible,
				text: obj.text,
				number: obj.number,
			};
		}
	}
	return out;
}
