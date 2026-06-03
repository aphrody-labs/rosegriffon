/**
 * Runtime Lua 5.2 IEVR — exécution des scripts menu via fengari.
 *
 * Flux : bytecode(.lua.bin) → décompilation unluac → source Lua → fengari (5.3).
 * Le source décompilé est compatible 5.3 : pas de `goto`, pas de <const>, pas
 * d'integer division (//) dans les scripts IEVR.
 *
 * Surface publique :
 *   - `LuaGameHost`        interface à implémenter par l'appelant
 *   - `DefaultLuaHost`     stub qui logge chaque appel (utile pour tracer)
 *   - `runLuaScript()`     point d'entrée principal
 *   - `LuaLayerState`      état observable (layers/commandes) pour azalee
 *
 * Compatible Bun + navigateur (fengari est du JS pur).
 */

import fengari from "fengari";
import type { LuaState } from "fengari";
import { isLua52 } from "./parser";

const { lua, lauxlib, lualib, to_luastring } = fengari;

// ── Réexport du type LuaState (pour la voie browser) ─────────────────────────
export type { LuaState };

// ── Types enregistrements ─────────────────────────────────────────────────────

/** Un appel loggé à une fonction C du jeu. */
export interface LuaCallRecord {
	readonly fn: string;
	readonly args: readonly unknown[];
	readonly result: unknown;
}

/** Couche de menu ouverte (layer). */
export interface LayerInfo {
	readonly layerId: number;
	readonly layerName: string | null;
}

/**
 * État observable d'un script après exécution.
 * Azalee consomme ce snapshot pour rendre le menu interactif.
 */
export interface LuaLayerState {
	/** Journal de tous les appels funcLua* dans l'ordre d'exécution. */
	readonly calls: readonly LuaCallRecord[];
	/** Layers ouverts (issus des appels OnSetupLayer/OnOpenLayer). */
	readonly layers: readonly LayerInfo[];
}

// ── Interface host ────────────────────────────────────────────────────────────

/**
 * Contrat que le host doit implémenter pour exécuter un script de menu IEVR.
 * Correspond à `ILuaGameHost` du HOST-CONTRACT.md.
 */
export interface LuaGameHost {
	/** Fournit le source Lua (string) d'un script d'include par nom. */
	include(name: string): string;

	/**
	 * Dispatch funcLuaMenuCommand(cmdId, layerId, ...args).
	 * Retourne une valeur Lua (number | boolean | string | null).
	 */
	menuCommand(cmdId: number, layerId: number, ...args: unknown[]): unknown;

	/** Dispatch funcLuaCommand(cmdId, ...args). */
	command(cmdId: number, ...args: unknown[]): unknown;

	/** Dispatch funcLuaActionCommand(...args). */
	actionCommand(...args: unknown[]): unknown;

	/** Dispatch funcLuaCameraCommand(...args). */
	cameraCommand(...args: unknown[]): unknown;

	/** Dispatch funcLuaSpTacticsCommand(...args). */
	spTacticsCommand(...args: unknown[]): unknown;

	/** NameSettingBegin(layerId, arg) — initialise un contexte de nommage. */
	nameSettingBegin(layerId: number, arg: unknown): void;

	/** AddNames(pattern, formatStr, count, start) — ajoute des noms d'objets. */
	addNames(pattern: string, formatStr: string, count: number, start: number): void;

	/** NameSettingEnd() — finalise le contexte de nommage. */
	nameSettingEnd(): void;

	/** IsCloseEndListLayer() → bool */
	isCloseEndListLayer(): boolean;

	/** SetGuideStatusToLua(...args) */
	setGuideStatusToLua(...args: unknown[]): void;

	/** Hook optionnel : appeléchaque fois qu'un appel funcLua* est journalisé. */
	onCall?(record: LuaCallRecord): void;
}

// ── Dictionnaire de hashes CRC32 ─────────────────────────────────────────────

/**
 * Résout un hash CRC32 en nom lisible depuis le dictionnaire IEVR.
 * Charge le dictionnaire une seule fois (lazy, synchrone via Bun.fileSync).
 */
let _hashDict: Map<number, string> | null = null;

export function loadHashDictionary(entries: Record<string, string>): void {
	_hashDict = new Map<number, string>();
	for (const [hexKey, name] of Object.entries(entries)) {
		const n = parseInt(hexKey, 16);
		if (!Number.isNaN(n)) _hashDict.set(n >>> 0, name);
	}
}

export function resolveHash(hash: number): string {
	if (_hashDict === null) return `#${(hash >>> 0).toString(16).toUpperCase()}`;
	const name = _hashDict.get(hash >>> 0);
	return name ?? `#${(hash >>> 0).toString(16).toUpperCase()}`;
}

// ── DefaultLuaHost ─────────────────────────────────────────────────────────────

/**
 * Implémentation stub : logge chaque appel funcLua*, retourne des valeurs
 * neutres (0 / false / null). Suffisant pour exécuter TOUT script sans crash.
 */
export class DefaultLuaHost implements LuaGameHost {
	private readonly _calls: LuaCallRecord[] = [];
	private readonly _layers: LayerInfo[] = [];

	get state(): LuaLayerState {
		return { calls: this._calls, layers: this._layers };
	}

	private _record(fn: string, args: readonly unknown[], result: unknown): void {
		const record: LuaCallRecord = { fn, args, result };
		this._calls.push(record);
		this.onCall?.(record);
	}

	onCall?: (record: LuaCallRecord) => void;

	include(name: string): string {
		// Stub : retourne un script vide — les includes complexes peuvent être
		// surchargés par une sous-classe qui fournit les fichiers réels.
		this._record("INCLUDE", [name], null);
		return "";
	}

	menuCommand(cmdId: number, layerId: number, ...args: unknown[]): unknown {
		const result = 0;
		const cmdName = resolveHash(cmdId);
		const layerName = resolveHash(layerId);
		this._record("funcLuaMenuCommand", [cmdName, layerName, ...args], result);
		this._trackLayer(layerId, layerName);
		return result;
	}

	command(cmdId: number, ...args: unknown[]): unknown {
		// Le vrai retour de funcLuaCommand est PAR-COMMANDE (handlers C de nie.exe). Aucune valeur de
		// stub n'est universelle : certains scripts l'utilisent en arithmétique (besoin numérique →
		// `false` throw en Lua), d'autres en `if not funcLuaCommand()` (besoin falsy). Divergence
		// connue avec le host C# (qui renvoie `false` pour ses scripts) : ce host TS renvoie `0` car
		// ses scripts réels de test l'utilisent numériquement. Non résoluble sans reverser chaque handler.
		const result = 0;
		this._record("funcLuaCommand", [resolveHash(cmdId), ...args], result);
		return result;
	}

	actionCommand(...args: unknown[]): unknown {
		const result = 0;
		this._record("funcLuaActionCommand", args, result);
		return result;
	}

	cameraCommand(...args: unknown[]): unknown {
		const result = 0;
		this._record("funcLuaCameraCommand", args, result);
		return result;
	}

	spTacticsCommand(...args: unknown[]): unknown {
		const result = 0;
		this._record("funcLuaSpTacticsCommand", args, result);
		return result;
	}

	nameSettingBegin(layerId: number, arg: unknown): void {
		this._record("NameSettingBegin", [resolveHash(layerId), arg], null);
	}

	addNames(pattern: string, formatStr: string, count: number, start: number): void {
		this._record("AddNames", [pattern, formatStr, count, start], null);
	}

	nameSettingEnd(): void {
		this._record("NameSettingEnd", [], null);
	}

	isCloseEndListLayer(): boolean {
		this._record("IsCloseEndListLayer", [], false);
		return false;
	}

	setGuideStatusToLua(...args: unknown[]): void {
		this._record("SetGuideStatusToLua", args, null);
	}

	private _trackLayer(layerId: number, layerName: string): void {
		if (!this._layers.some((l) => l.layerId === layerId)) {
			this._layers.push({ layerId, layerName });
		}
	}
}

// ── Décompilation bytecode → source ──────────────────────────────────────────

/** Erreur de décompilation Lua. */
export class LuaDecompileError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LuaDecompileError";
	}
}

/**
 * Chemin absolu vers unluac.jar.
 * Peut être surchargé par l'appelant si le jar est ailleurs.
 */
export let UNLUAC_JAR_PATH = new URL("../../../../re/lua/unluac.jar", import.meta.url).pathname;

/**
 * Décompile un bytecode Lua 5.2 → source Lua via `unluac.jar`.
 * Nécessite Java (JRE ≥ 8) dans le PATH. Bun.spawn seulement (pas navigateur).
 *
 * @throws {LuaDecompileError} si la décompilation échoue.
 */
export async function decompileLua52(bytecode: Uint8Array): Promise<string> {
	if (typeof Bun === "undefined") {
		throw new LuaDecompileError("decompileLua52 nécessite Bun (non disponible dans le navigateur)");
	}

	// Écriture dans un fichier temporaire (stdin de unluac ne marche pas)
	const tmpPath = `/tmp/iecode_lua_${Date.now()}_${Math.random().toString(36).slice(2)}.lua.bin`;
	await Bun.write(tmpPath, bytecode);

	try {
		const proc = Bun.spawn(["java", "-jar", UNLUAC_JAR_PATH, tmpPath], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);

		if (exitCode !== 0) {
			throw new LuaDecompileError(
				`unluac a échoué (exit ${exitCode}): ${stderr.trim() || "(aucune sortie d'erreur)"}`,
			);
		}

		return stdout;
	} finally {
		// Nettoyage fichier temporaire
		try {
			await Bun.write(tmpPath, ""); // vide avant delete
			const { unlinkSync } = await import("node:fs");
			unlinkSync(tmpPath);
		} catch {
			// Pas grave si le nettoyage échoue
		}
	}
}

// ── Injection des globals dans l'état Lua ────────────────────────────────────

/**
 * Extrait les arguments JS depuis la stack Lua (du bas vers le haut, à partir
 * de l'index 1). Convertit number/boolean/string ; les autres types → null.
 */
function pullArgs(L: LuaState, count: number): unknown[] {
	const args: unknown[] = [];
	for (let i = 1; i <= count; i++) {
		const t = lua.lua_type(L, i);
		if (t === 3 /* LUA_TNUMBER */) {
			args.push(lua.lua_tonumber(L, i));
		} else if (t === 1 /* LUA_TBOOLEAN */) {
			args.push(Boolean(lua.lua_toboolean(L, i)));
		} else if (t === 4 /* LUA_TSTRING */) {
			args.push(lua.lua_tojsstring(L, i));
		} else {
			args.push(null);
		}
	}
	return args;
}

/**
 * Pousse une valeur JS sur la stack Lua.
 * number → lua_pushnumber, boolean → lua_pushboolean, sinon nil.
 * Retourne le nombre de valeurs poussées (1 ou 0).
 */
function pushResult(L: LuaState, val: unknown): number {
	if (typeof val === "number") {
		lua.lua_pushnumber(L, val);
		return 1;
	}
	if (typeof val === "boolean") {
		lua.lua_pushboolean(L, val);
		return 1;
	}
	if (typeof val === "string") {
		lua.lua_pushstring(L, to_luastring(val));
		return 1;
	}
	// nil / null / undefined
	lua.lua_pushnil(L);
	return 1;
}

/**
 * Injecte tous les globals IEVR dans un état Lua existant.
 * Appelé avant `luaL_loadstring`.
 */
function injectHostGlobals(L: LuaState, host: LuaGameHost): void {
	const reg = (name: string, fn: (L: LuaState) => number) => {
		lua.lua_pushjsfunction(L, fn);
		lua.lua_setglobal(L, to_luastring(name));
	};

	// INCLUDE(name)
	reg("INCLUDE", (L) => {
		const n = lua.lua_gettop(L);
		const args = pullArgs(L, n);
		const name = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
		const src = host.include(name);
		if (src) {
			// Charge et exécute le source d'include dans le même état Lua.
			// En cas d'échec, luaL_dostring laisse le message d'erreur (une STRING) en haut de
			// pile : surtout NE PAS lua_pcall dessus (tenterait d'appeler une string → double
			// faute). On dépile l'erreur et on continue, comme le host C# (`INCLUDE` catch+continue).
			const status = lauxlib.luaL_dostring(L, to_luastring(src));
			if (status !== lua.LUA_OK) {
				lua.lua_pop(L, 1);
			}
		}
		return 0;
	});

	// funcLuaMenuCommand(cmdId, layerId, ...args) → value
	reg("funcLuaMenuCommand", (L) => {
		const n = lua.lua_gettop(L);
		const args = pullArgs(L, n);
		const cmdId = (args[0] as number) >>> 0;
		const layerId = (args[1] as number) >>> 0;
		const rest = args.slice(2);
		const result = host.menuCommand(cmdId, layerId, ...rest);
		return pushResult(L, result);
	});

	// funcLuaCommand(cmdId, ...args) → value
	reg("funcLuaCommand", (L) => {
		const n = lua.lua_gettop(L);
		const args = pullArgs(L, n);
		const cmdId = (args[0] as number) >>> 0;
		const rest = args.slice(1);
		const result = host.command(cmdId, ...rest);
		return pushResult(L, result);
	});

	// funcLuaActionCommand(...args)
	reg("funcLuaActionCommand", (L) => {
		const n = lua.lua_gettop(L);
		const args = pullArgs(L, n);
		const result = host.actionCommand(...args);
		return pushResult(L, result);
	});

	// funcLuaCameraCommand(...args)
	reg("funcLuaCameraCommand", (L) => {
		const n = lua.lua_gettop(L);
		const args = pullArgs(L, n);
		const result = host.cameraCommand(...args);
		return pushResult(L, result);
	});

	// funcLuaSpTacticsCommand(...args)
	reg("funcLuaSpTacticsCommand", (L) => {
		const n = lua.lua_gettop(L);
		const args = pullArgs(L, n);
		const result = host.spTacticsCommand(...args);
		return pushResult(L, result);
	});

	// NameSettingBegin(layerId, arg)
	reg("NameSettingBegin", (L) => {
		const n = lua.lua_gettop(L);
		const args = pullArgs(L, n);
		host.nameSettingBegin((args[0] as number) >>> 0, args[1]);
		return 0;
	});

	// AddNames(pattern, formatStr, count, start)
	reg("AddNames", (L) => {
		const n = lua.lua_gettop(L);
		const args = pullArgs(L, n);
		host.addNames(
			String(args[0] ?? ""),
			String(args[1] ?? ""),
			Number(args[2] ?? 0),
			Number(args[3] ?? 0),
		);
		return 0;
	});

	// NameSettingEnd()
	reg("NameSettingEnd", (_L) => {
		host.nameSettingEnd();
		return 0;
	});

	// IsCloseEndListLayer() → bool
	reg("IsCloseEndListLayer", (L) => {
		const result = host.isCloseEndListLayer();
		lua.lua_pushboolean(L, result);
		return 1;
	});

	// SetGuideStatusToLua(...args)
	reg("SetGuideStatusToLua", (L) => {
		const n = lua.lua_gettop(L);
		const args = pullArgs(L, n);
		host.setGuideStatusToLua(...args);
		return 0;
	});
}

// ── Appel des callbacks du script ─────────────────────────────────────────────

/**
 * Appelle une fonction Lua globale (par ex. OnSetupLayer) si elle existe.
 * Ignore silencieusement si la fonction n'est pas définie.
 *
 * @param layerId   id numérique de la couche (uint32)
 * @param arg       second argument (souvent 0 ou 1)
 */
function callLayerCallback(L: LuaState, name: string, layerId: number, arg: number): void {
	lua.lua_getglobal(L, to_luastring(name));
	if (!lua.lua_isfunction(L, -1)) {
		lua.lua_pop(L, 1);
		return;
	}
	lua.lua_pushnumber(L, layerId);
	lua.lua_pushnumber(L, arg);
	const status = lua.lua_pcall(L, 2, 0, 0);
	if (status !== lua.LUA_OK) {
		const msg = lua.lua_tojsstring(L, -1);
		lua.lua_pop(L, 1);
		throw new LuaRuntimeError(`${name} a échoué: ${msg}`);
	}
}

// ── Erreur d'exécution ────────────────────────────────────────────────────────

export class LuaRuntimeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LuaRuntimeError";
	}
}

// ── runLuaScript ──────────────────────────────────────────────────────────────

/** Options de `runLuaScript`. */
export interface RunLuaOptions {
	/**
	 * ID de layer à passer à OnSetupLayer et OnOpenLayer.
	 * Passer plusieurs IDs pour simuler l'ouverture de plusieurs couches.
	 * Par défaut : [0]
	 */
	layerIds?: readonly number[];

	/** Argument `arg` passé à chaque callback. Par défaut : 0 */
	layerArg?: number;

	/**
	 * Chemin vers `unluac.jar` (si différent du défaut `re/lua/unluac.jar`).
	 * Ignoré si `bytecodeOrSource` est déjà une string (source Lua).
	 */
	unluacJarPath?: string;
}

/**
 * Exécute un script Lua de menu IEVR via fengari.
 *
 * Accepte :
 * - Un `Uint8Array` bytecode Lua 5.2 (`.lua.bin`) → décompile via unluac
 * - Une `string` source Lua → exécute directement
 *
 * Injecte les globals IEVR (`funcLuaMenuCommand`, etc.) depuis `host`,
 * puis appelle `OnSetupLayer` et `OnOpenLayer` pour chaque `layerId`.
 *
 * @returns `LuaLayerState` si `host` est un `DefaultLuaHost`, sinon undefined.
 * @throws {LuaDecompileError} si la décompilation bytecode échoue.
 * @throws {LuaRuntimeError}   si l'exécution Lua lève une erreur.
 */
export async function runLuaScript(
	bytecodeOrSource: Uint8Array | string,
	host: LuaGameHost,
	options: RunLuaOptions = {},
): Promise<LuaLayerState | undefined> {
	// ── 1. Résolution du source Lua ──────────────────────────────────────────
	let source: string;
	if (typeof bytecodeOrSource === "string") {
		source = bytecodeOrSource;
	} else if (isLua52(bytecodeOrSource)) {
		if (options.unluacJarPath) UNLUAC_JAR_PATH = options.unluacJarPath;
		source = await decompileLua52(bytecodeOrSource);
	} else {
		// Pas du bytecode Lua 5.2 — on suppose que c'est du source direct
		source = new TextDecoder().decode(bytecodeOrSource);
	}

	// ── 2. Création de l'état Lua ────────────────────────────────────────────
	const L = lauxlib.luaL_newstate();
	lualib.luaL_openlibs(L);

	// ── 3. Injection des globals host ─────────────────────────────────────────
	injectHostGlobals(L, host);

	// ── 4. Chargement et exécution du script ──────────────────────────────────
	const loadStatus = lauxlib.luaL_loadstring(L, to_luastring(source));
	if (loadStatus !== lua.LUA_OK) {
		const msg = lua.lua_tojsstring(L, -1);
		throw new LuaRuntimeError(`Erreur de chargement Lua: ${msg}`);
	}

	const runStatus = lua.lua_pcall(L, 0, 0, 0);
	if (runStatus !== lua.LUA_OK) {
		const msg = lua.lua_tojsstring(L, -1);
		throw new LuaRuntimeError(`Erreur d'exécution Lua: ${msg}`);
	}

	// ── 5. Appel des callbacks ─────────────────────────────────────────────────
	const layerIds = options.layerIds ?? [0];
	const layerArg = options.layerArg ?? 0;

	for (const layerId of layerIds) {
		callLayerCallback(L, "OnSetupLayer", layerId, layerArg);
		callLayerCallback(L, "OnOpenLayer", layerId, layerArg);
	}

	// ── 6. Retour de l'état ────────────────────────────────────────────────────
	if (host instanceof DefaultLuaHost) {
		return host.state;
	}
	return undefined;
}

// ── runLuaSource (version synchrone, utile navigateur) ───────────────────────

/**
 * Version SYNCHRONE de `runLuaScript` qui accepte uniquement du source Lua
 * (string). Ne dépend pas de `Bun.spawn` — fonctionnel dans le navigateur.
 *
 * @throws {LuaRuntimeError} si l'exécution Lua lève une erreur.
 */
export function runLuaSource(
	source: string,
	host: LuaGameHost,
	options: Omit<RunLuaOptions, "unluacJarPath"> = {},
): LuaLayerState | undefined {
	const L = lauxlib.luaL_newstate();
	lualib.luaL_openlibs(L);
	injectHostGlobals(L, host);

	const loadStatus = lauxlib.luaL_loadstring(L, to_luastring(source));
	if (loadStatus !== lua.LUA_OK) {
		const msg = lua.lua_tojsstring(L, -1);
		throw new LuaRuntimeError(`Erreur de chargement Lua: ${msg}`);
	}

	const runStatus = lua.lua_pcall(L, 0, 0, 0);
	if (runStatus !== lua.LUA_OK) {
		const msg = lua.lua_tojsstring(L, -1);
		throw new LuaRuntimeError(`Erreur d'exécution Lua: ${msg}`);
	}

	const layerIds = options.layerIds ?? [0];
	const layerArg = options.layerArg ?? 0;

	for (const layerId of layerIds) {
		callLayerCallback(L, "OnSetupLayer", layerId, layerArg);
		callLayerCallback(L, "OnOpenLayer", layerId, layerArg);
	}

	if (host instanceof DefaultLuaHost) {
		return host.state;
	}
	return undefined;
}
