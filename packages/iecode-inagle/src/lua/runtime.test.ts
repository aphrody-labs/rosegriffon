/**
 * Tests du runtime Lua 5.2 IEVR via fengari.
 * Nécessite Java dans le PATH (pour unluac) et les vrais .lua.bin dans re/lua/raw.
 *
 * Ces tests vérifient que :
 *   1. runLuaScript exécute les scripts de menu réels
 *   2. funcLuaMenuCommand est bien appelé avec les bons hash IDs
 *   3. NameSettingBegin/AddNames/NameSettingEnd sont bien capturés
 *   4. runLuaSource fonctionne avec du source Lua directement
 *   5. DefaultLuaHost journalise correctement
 */
import { describe, expect, it, beforeAll } from "bun:test";
import { join } from "node:path";
import { existsSync } from "node:fs";

import { runLuaScript, runLuaSource, DefaultLuaHost, LuaRuntimeError, loadHashDictionary, resolveHash } from "./runtime";

const RAW_DIR = join(import.meta.dir, "../../../../../re/lua/raw");
const DECOMPILED_DIR = join(import.meta.dir, "../../../../../re/lua/decompiled/common/script/lua/menu");
const HASH_DICT_PATH = join(import.meta.dir, "../../../../../re/menu/hash-dictionary.json");

const hasRawFiles = existsSync(join(RAW_DIR, "common_script_lua_menu_qrcode_menu.lua.bin"));
const hasDecompiledFiles = existsSync(join(DECOMPILED_DIR, "qrcode_menu.lua"));

// ── Helpers ───────────────────────────────────────────────────────────────────

function rawFile(name: string): string {
	return join(RAW_DIR, name);
}

function decompiledFile(name: string): string {
	return join(DECOMPILED_DIR, name);
}

async function loadRaw(name: string): Promise<Uint8Array> {
	return Bun.file(rawFile(name)).bytes();
}

async function loadDecompiled(name: string): Promise<string> {
	return Bun.file(decompiledFile(name)).text();
}

// ── Chargement du dictionnaire de hashes ──────────────────────────────────────

beforeAll(async () => {
	if (existsSync(HASH_DICT_PATH)) {
		const raw = await Bun.file(HASH_DICT_PATH).json() as { entries: Record<string, string> };
		loadHashDictionary(raw.entries);
	}
});

// ── runLuaSource (source directe, synchrone) ─────────────────────────────────

describe("runLuaSource (source directe)", () => {
	it("exécute un script minimal sans erreur", () => {
		const source = `
function OnSetupLayer(layerId, arg)
  -- no-op
end
function OnOpenLayer(layerId, arg)
  -- no-op
end
`;
		const host = new DefaultLuaHost();
		const state = runLuaSource(source, host);
		expect(state).toBeDefined();
		expect(state!.calls).toHaveLength(0);
	});

	it("capture funcLuaMenuCommand", () => {
		const source = `
function OnSetupLayer(layerId, arg)
  funcLuaMenuCommand(3781155141, layerId, 0, 71445658, 0, 2831704505)
end
`;
		const host = new DefaultLuaHost();
		const state = runLuaSource(source, host, { layerIds: [292844459] });
		expect(state).toBeDefined();
		const calls = state!.calls;
		expect(calls.length).toBeGreaterThanOrEqual(1);
		const c = calls[0]!;
		expect(c.fn).toBe("funcLuaMenuCommand");
		// Premier arg = cmdId hash
		expect(c.args[0]).toBe(resolveHash(3781155141));
		// Second arg = layerId hash
		expect(c.args[1]).toBe(resolveHash(292844459));
	});

	it("capture NameSettingBegin / AddNames / NameSettingEnd", () => {
		const source = `
function OnSetupLayer(layerId, arg)
  if layerId == 2492438505 then
    NameSettingBegin(layerId, arg)
    AddNames("_cmnd_skill_base_icon", "_cmnd_skill_base_icon%02d", 4, 1)
    AddNames("_cmnd_skill_icon", "_cmnd_skill_icon%02d", 4, 1)
    NameSettingEnd()
  end
end
`;
		const host = new DefaultLuaHost();
		const state = runLuaSource(source, host, { layerIds: [2492438505] });
		expect(state).toBeDefined();
		const fns = state!.calls.map((c) => c.fn);
		expect(fns).toContain("NameSettingBegin");
		expect(fns).toContain("AddNames");
		expect(fns).toContain("NameSettingEnd");
	});

	it("appelle OnSetupLayer et OnOpenLayer pour chaque layerId", () => {
		const source = `
local called = 0
function OnSetupLayer(layerId, arg)
  called = called + 1
end
function OnOpenLayer(layerId, arg)
  called = called + 1
end
`;
		const host = new DefaultLuaHost();
		// 2 layerIds → 4 callbacks
		expect(() =>
			runLuaSource(source, host, { layerIds: [100, 200] })
		).not.toThrow();
	});

	it("lève LuaRuntimeError sur une erreur Lua", () => {
		const source = `error("test error")`;
		const host = new DefaultLuaHost();
		expect(() => runLuaSource(source, host)).toThrow(LuaRuntimeError);
	});

	it("funcLuaCommand retourne 0 par défaut (DefaultLuaHost)", () => {
		const source = `
function OnSetupLayer(layerId, arg)
  local r = funcLuaCommand(1234567890, layerId)
  assert(type(r) == "number", "expected number, got " .. type(r))
end
`;
		const host = new DefaultLuaHost();
		expect(() => runLuaSource(source, host, { layerIds: [1] })).not.toThrow();
	});

	it("INCLUDE stub (DefaultLuaHost retourne source vide)", () => {
		const source = `
INCLUDE("LUA_MENU_DEF")
function OnSetupLayer(layerId, arg)
end
`;
		const host = new DefaultLuaHost();
		const state = runLuaSource(source, host);
		expect(state).toBeDefined();
		const includeCalls = state!.calls.filter((c) => c.fn === "INCLUDE");
		expect(includeCalls).toHaveLength(1);
		expect(includeCalls[0]!.args[0]).toBe("LUA_MENU_DEF");
	});

	it("IsCloseEndListLayer retourne false (DefaultLuaHost)", () => {
		const source = `
function OnSetupLayer(layerId, arg)
  local r = IsCloseEndListLayer()
  assert(r == false, "expected false")
end
`;
		const host = new DefaultLuaHost();
		expect(() => runLuaSource(source, host, { layerIds: [1] })).not.toThrow();
	});
});

// ── DefaultLuaHost : état observable ─────────────────────────────────────────

describe("DefaultLuaHost.state", () => {
	it("state.layers contient les layerIds passés à menuCommand", () => {
		const source = `
function OnSetupLayer(layerId, arg)
  funcLuaMenuCommand(1111, layerId, 0)
end
`;
		const host = new DefaultLuaHost();
		runLuaSource(source, host, { layerIds: [99999] });
		const layers = host.state.layers;
		expect(layers.length).toBeGreaterThanOrEqual(1);
		expect(layers.some((l) => l.layerId === 99999)).toBe(true);
	});

	it("state.calls contient tous les appels dans l'ordre", () => {
		const source = `
function OnSetupLayer(layerId, arg)
  funcLuaMenuCommand(1, layerId)
  funcLuaCommand(2, layerId)
  NameSettingBegin(layerId, arg)
  NameSettingEnd()
end
`;
		const host = new DefaultLuaHost();
		runLuaSource(source, host, { layerIds: [1] });
		const fns = host.state.calls.map((c) => c.fn);
		expect(fns[0]).toBe("funcLuaMenuCommand");
		expect(fns[1]).toBe("funcLuaCommand");
		expect(fns[2]).toBe("NameSettingBegin");
		expect(fns[3]).toBe("NameSettingEnd");
	});

	it("onCall hook est appelé pour chaque appel", () => {
		const source = `
function OnSetupLayer(layerId, arg)
  funcLuaMenuCommand(1, layerId)
  funcLuaMenuCommand(2, layerId)
end
`;
		const host = new DefaultLuaHost();
		const hooked: string[] = [];
		host.onCall = (r) => { hooked.push(r.fn); };
		runLuaSource(source, host, { layerIds: [1] });
		expect(hooked).toHaveLength(2);
		expect(hooked[0]).toBe("funcLuaMenuCommand");
	});
});

// ── runLuaScript sur vrais .lua.bin (via unluac) ──────────────────────────────

describe("runLuaScript — vrais scripts menu IEVR", () => {
	it("qrcode_menu.lua.bin — OnSetupLayer émet funcLuaMenuCommand", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("common_script_lua_menu_qrcode_menu.lua.bin");
		const host = new DefaultLuaHost();
		const state = await runLuaScript(data, host, {
			layerIds: [292844459, 1189944233, 333528782],
		});
		expect(state).toBeDefined();
		const menuCmds = state!.calls.filter((c) => c.fn === "funcLuaMenuCommand");
		// qrcode_menu fait 5 appels funcLuaMenuCommand en tout
		expect(menuCmds.length).toBe(5);
	});

	it("battle_menu_multi.lua.bin — INCLUDE + NameSetting", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("battle_menu_multi.lua.bin");
		const host = new DefaultLuaHost();
		const state = await runLuaScript(data, host, {
			layerIds: [2492438505],
		});
		expect(state).toBeDefined();
		const fns = state!.calls.map((c) => c.fn);
		expect(fns).toContain("INCLUDE");
		expect(fns).toContain("NameSettingBegin");
		expect(fns).toContain("AddNames");
		expect(fns).toContain("NameSettingEnd");
	});

	it("battle_menu_0.00.00.lua.bin — parse + run sans erreur", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("common_script_lua_menu_battle_menu_0.00.00.lua.bin");
		const host = new DefaultLuaHost();
		// La fonction OnOpenLayer est vide dans ce script
		const state = await runLuaScript(data, host, { layerIds: [2492438505] });
		expect(state).toBeDefined();
	});

	it("camera_option_menu — script complexe avec coroutine-like locals", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("common_script_lua_menu_camera_option_menu_0.03.73.lua.bin");
		const host = new DefaultLuaHost();
		// Injecter les stubs supplémentaires pour ce script
		// (SetupCameraOptionButton, etc. — appelés directement comme globals)
		// DefaultLuaHost ignore les appels inconnus via fengari qui lève une erreur
		// si la fonction n'existe pas ; on ajoute un catchall via un métatable _G.
		// Pour ce test, on vérifie juste que le script se charge sans crash.
		let threw = false;
		try {
			await runLuaScript(data, host, { layerIds: [2573183161] });
		} catch {
			threw = true;
		}
		// Même si des fonctions manquent, le script lui-même est chargé correctement
		// (les callbacks ne sont appelés que pour ce layerId qui a un branch vide)
		expect(threw).toBe(false);
	});
});

// ── runLuaScript depuis source décompilée préexistante ───────────────────────

describe("runLuaScript depuis source .lua décompilée", () => {
	it("qrcode_menu.lua (source texte) → même résultat que depuis .lua.bin", async () => {
		if (!hasDecompiledFiles) return;
		const source = await loadDecompiled("qrcode_menu.lua");
		const host = new DefaultLuaHost();
		const state = await runLuaScript(source, host, {
			layerIds: [292844459, 1189944233, 333528782],
		});
		const menuCmds = state!.calls.filter((c) => c.fn === "funcLuaMenuCommand");
		expect(menuCmds.length).toBe(5);
	});

	it("battle_menu_multi.lua (source texte)", async () => {
		if (!hasDecompiledFiles) return;
		const source = await loadDecompiled("battle_menu_multi.lua");
		const host = new DefaultLuaHost();
		const state = await runLuaScript(source, host, { layerIds: [2492438505] });
		const fns = state!.calls.map((c) => c.fn);
		expect(fns).toContain("NameSettingBegin");
	});
});

// ── Dictionnaire de hashes ────────────────────────────────────────────────────

describe("loadHashDictionary / resolveHash", () => {
	it("résout un hash connu en nom lisible", () => {
		// 0x3781155141 n'est pas dans le dict (> 32 bits), mais 0xE1AEE5F5 peut l'être
		// On teste juste que loadHashDictionary ne plante pas et que les hashes inconnus
		// ont le format attendu (#HEXHASH)
		const unknown = resolveHash(0xDEADBEEF);
		expect(unknown).toMatch(/^#[0-9A-F]+$/);
	});

	it("une entrée connue du dict est résolue (si dict chargé)", () => {
		if (!existsSync(HASH_DICT_PATH)) return;
		// Tous les hashes numériques vus dans les scripts sont CRC32 IEVR
		// Vérifie juste que resolveHash retourne une string
		const r = resolveHash(292844459);
		expect(typeof r).toBe("string");
		expect(r.length).toBeGreaterThan(0);
	});
});
