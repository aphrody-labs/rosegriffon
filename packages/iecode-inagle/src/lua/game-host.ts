/**
 * Host Lua **fidèle** (TS) — miroir de `GameLuaHost` C#.
 *
 * Interprète les commandes `funcLuaMenuCommand` reversées (`re/lua/funclua-cmdids.json`) en
 * mutations d'un `MenuState` : l'équivalent inagle de l'état que nie.exe construit en mémoire quand
 * un script de menu tourne. Azalee (`@rose-griffon/menu-render`) consomme ce `menuState` pour rendre un
 * menu INTERACTIF piloté par la vraie logique Lua, et non un layout statique.
 *
 * Compatible Bun + navigateur (étend `DefaultLuaHost`, qui est pur JS via fengari).
 */

import { DefaultLuaHost, resolveHash } from "./runtime.ts";

// ── Modèle d'état (miroir de MenuState.cs) ───────────────────────────────────

/** État d'un objet (widget) d'un layer, muté par les funcLuaMenuCommand. */
export interface MenuObjectState {
	id: number;
	name: string | null;
	visible: boolean;
	active: boolean;
	spriteTextureHash?: number | undefined;
	frame?: number | undefined;
	colorHash?: number | undefined;
	colorRgba?: number | undefined;
	text?: string | undefined;
	number?: number | undefined;
	scrollIndex?: number;
	scale?: number;
	badge?: number;
	progress?: number;
}

/** État d'un layer de menu. */
export interface MenuLayerState {
	id: number;
	name: string | null;
	visible: boolean;
	enabled: boolean;
	focus?: number;
	currentItem?: number;
	objects: Map<number, MenuObjectState>;
}

/** État de menu complet reconstruit par l'exécution Lua. */
export interface MenuState {
	layers: Map<number, MenuLayerState>;
	groups: Map<number, boolean>;
}

// ── Table sémantique funcLua* (cmdId → nom inféré) ───────────────────────────

/**
 * Charge la map `cmdId → nom inféré` de `funcLuaMenuCommand` depuis le JSON parsé de
 * `re/lua/funclua-cmdids.json`. Les noms sont INFÉRÉS (pas le préimage CRC) → couche séparée.
 */
export function loadMenuCommandNames(funcluaJson: unknown): Map<number, string> {
	const map = new Map<number, string>();
	const root = funcluaJson as Record<string, unknown>;
	const fam = root["funcLuaMenuCommand"] as Record<string, unknown> | undefined;
	const cmds = fam?.["commands"] as Record<string, { inferred_name?: string }> | undefined;
	if (!cmds) return map;
	for (const [hex, info] of Object.entries(cmds)) {
		const id = parseInt(hex, 16) >>> 0;
		if (!Number.isNaN(id) && info?.inferred_name) map.set(id, info.inferred_name);
	}
	return map;
}

// ── GameLuaHost ──────────────────────────────────────────────────────────────

/** Host fidèle : construit un MenuState à partir des commandes Lua. */
export class GameLuaHost extends DefaultLuaHost {
	readonly menuState: MenuState = { layers: new Map(), groups: new Map() };

	/** (hash texte) → texte affiché. Optionnel ; sinon résolution via le dico de hash. */
	textResolver?: (hash: number) => string | null;

	private readonly _names: Map<number, string>;

	/** @param menuCommandNames map cmdId→nom (cf. {@link loadMenuCommandNames}). */
	constructor(menuCommandNames: Map<number, string> = new Map()) {
		super();
		this._names = menuCommandNames;
	}

	override menuCommand(cmdId: number, layerId: number, ...args: unknown[]): unknown {
		// Journalise + track via la base (trace inchangée).
		super.menuCommand(cmdId, layerId, ...args);

		const name = this._names.get(cmdId >>> 0);
		if (name === undefined) return 0; // commande non reversée : trace seulement

		// SetGroupVisible : le 1er arg est un groupId, PAS un layerId — traité avant la création
		// du layer pour ne pas insérer un MenuLayerState fantôme keyé par le groupId.
		if (name === "SetGroupVisible") {
			this.menuState.groups.set(layerId >>> 0, bool(args[0], true));
			return 0;
		}

		const layer = this._layer(layerId);

		switch (name) {
			// ── Layer ──────────────────────────────────────────────────────
			case "SetLayerVisible": layer.visible = bool(args[0], true); break;
			case "SetLayerEnabled": layer.enabled = bool(args[0], true); break;
			case "SetFocus":        layer.focus = int(args[0]); break;
			case "SetCurrentItem":  layer.currentItem = int(args[0]); break;
			case "ClearLayer":      layer.objects.clear(); break;

			// ── Objet : visibilité / état ───────────────────────────────────
			case "SetObjectVisible": this._obj(layer, args[0]).visible = bool(args[1], true); break;
			case "SetObjectActive":  this._obj(layer, args[0]).active = bool(args[1], true); break;
			case "SetObjectFlag":    this._obj(layer, args[0]).visible = bool(args[1], true); break;
			case "SetButtonEnabled": this._obj(layer, args[0]).active = bool(args[1], true); break;

			// ── Objet : sprite / couleur / icône ────────────────────────────
			case "SetSprite": {
				const o = this._obj(layer, args[0]);
				o.spriteTextureHash = uint(args[1]);
				o.frame = int(args[2]);
				o.colorHash = uintOrUndef(args[3]);
				break;
			}
			case "SetIconTexture": this._obj(layer, args[0]).spriteTextureHash = uint(args[1]); break;
			case "SetColorTint":   this._obj(layer, args[0]).colorHash = uint(args[1]); break;
			case "SetObjectColorRGBA":
				this._obj(layer, args[0]).colorRgba =
					((uint(args[1]) << 24) | (uint(args[2]) << 16) | (uint(args[3]) << 8) | uint(args[4])) >>> 0;
				break;

			// ── Objet : texte / nombre ──────────────────────────────────────
			case "SetText":           this._obj(layer, args[0]).text = this._text(args[1]); break;
			case "SetTextMulti":      this._obj(layer, args[0]).text = this._text(args[1]); break;
			case "SetNumericDisplay": this._obj(layer, args[0]).number = int(args[1]); break;
			case "SetObjectNum":      this._obj(layer, args[0]).number = int(args[1]); break;
			case "SetBadge":          this._obj(layer, args[0]).badge = int(args[1]); break;
			case "SetProgressBar":    this._obj(layer, args[0]).progress = num(args[1]); break;

			// ── Objet : transform / liste ───────────────────────────────────
			case "SetObjectScale":  this._obj(layer, args[0]).scale = num(args[1]); break;
			case "SetScrollIndex":  this._obj(layer, args[0]).scrollIndex = int(args[1]); break;

			// Autres : journalisées seulement.
			default: break;
		}
		return 0;
	}

	private _layer(layerId: number): MenuLayerState {
		const id = layerId >>> 0;
		let l = this.menuState.layers.get(id);
		if (l === undefined) {
			l = { id, name: nameOrNull(id), visible: true, enabled: true, objects: new Map() };
			this.menuState.layers.set(id, l);
		}
		return l;
	}

	private _obj(layer: MenuLayerState, objArg: unknown): MenuObjectState {
		const id = uint(objArg);
		let o = layer.objects.get(id);
		if (o === undefined) {
			o = { id, name: nameOrNull(id), visible: true, active: true };
			layer.objects.set(id, o);
		}
		return o;
	}

	private _text(arg: unknown): string | undefined {
		if (typeof arg === "string") return arg;
		if (typeof arg === "number") {
			const h = arg >>> 0;
			const t = this.textResolver?.(h) ?? nameOrNull(h);
			return t ?? `0x${h.toString(16).toUpperCase()}`;
		}
		return undefined;
	}
}

// ── Helpers d'arguments (les nombres Lua arrivent en number) ──────────────────

function uint(v: unknown): number { return typeof v === "number" ? v >>> 0 : 0; }
function uintOrUndef(v: unknown): number | undefined { return typeof v === "number" ? v >>> 0 : undefined; }
function int(v: unknown): number { return typeof v === "number" ? Math.trunc(v) : 0; }
function num(v: unknown): number { return typeof v === "number" ? v : 0; }
function bool(v: unknown, dflt: boolean): boolean {
	if (typeof v === "boolean") return v;
	if (typeof v === "number") return v !== 0;
	return dflt;
}

/** Nom résolu via le dico, ou null si non présent (resolveHash renvoie `#HEX` sinon). */
function nameOrNull(hash: number): string | null {
	const n = resolveHash(hash);
	return n.startsWith("#") ? null : n;
}
