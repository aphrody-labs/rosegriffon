/**
 * Tests du host Lua fidèle inagle (GameLuaHost) — miroir TS de GameLuaHostTests.cs.
 * Vérifie que l'exécution d'un script de menu reconstruit un MenuState (layers/objets mutés).
 *
 * Le test d'intégration utilise la SOURCE décompilée (synchrone, pas besoin de Java/unluac).
 */
import { describe, expect, it, beforeAll } from "bun:test";
import { join } from "node:path";
import { existsSync } from "node:fs";

import { runLuaSource, loadHashDictionary } from "./runtime.ts";
import { GameLuaHost, loadMenuCommandNames } from "./game-host.ts";

const ROOT = join(import.meta.dir, "../../../../..");
const DECOMPILED = join(ROOT, "re/lua/decompiled/common/script/lua/menu/qrcode_menu.lua");
const HASH_DICT = join(ROOT, "re/menu/hash-dictionary.json");
const CMDIDS = join(ROOT, "re/lua/funclua-cmdids.json");

const GENERAL_WIN = 292844459;

const hasCmdIds = existsSync(CMDIDS);
const hasDecompiled = existsSync(DECOMPILED);

let names: Map<number, string> = new Map();

beforeAll(async () => {
	if (hasCmdIds) names = loadMenuCommandNames(await Bun.file(CMDIDS).json());
	if (existsSync(HASH_DICT)) {
		const raw = (await Bun.file(HASH_DICT).json()) as { entries: Record<string, string> };
		loadHashDictionary(raw.entries);
	}
});

describe("loadMenuCommandNames", () => {
	it("charge les commandes reversées", () => {
		if (!hasCmdIds) return;
		expect(names.get(0xe15fd945)).toBe("SetSprite");
		expect(names.get(0x2a64b198)).toBe("SetObjectVisible");
		expect(names.size).toBeGreaterThanOrEqual(20);
	});
});

describe("GameLuaHost — commandes synthétiques", () => {
	it("SetObjectVisible bascule la visibilité", () => {
		if (!hasCmdIds) return;
		const host = new GameLuaHost(names);
		host.menuCommand(0x2a64b198, 10, 42, false); // (layer=10, obj=42, visible=false)
		expect(host.menuState.layers.get(10)?.objects.get(42)?.visible).toBe(false);
	});

	it("SetSprite renseigne la texture", () => {
		if (!hasCmdIds) return;
		const host = new GameLuaHost(names);
		host.menuCommand(0xe15fd945, 1, 7, 0x1234, 0, 0x5678); // (layer,obj,tex,frame,color)
		const o = host.menuState.layers.get(1)?.objects.get(7);
		expect(o?.spriteTextureHash).toBe(0x1234);
		expect(o?.colorHash).toBe(0x5678);
	});

	it("SetText avec textResolver", () => {
		if (!hasCmdIds) return;
		const host = new GameLuaHost(names);
		host.textResolver = () => "Bonjour";
		host.menuCommand(0x4096e67e, 1, 7, 0x1234); // SetText(layer,obj,hash)
		expect(host.menuState.layers.get(1)?.objects.get(7)?.text).toBe("Bonjour");
	});
});

describe("GameLuaHost — script réel (source décompilée)", () => {
	it("qrcode_menu reconstruit un MenuState avec sprite", async () => {
		if (!hasCmdIds || !hasDecompiled) return;
		const source = await Bun.file(DECOMPILED).text();
		const host = new GameLuaHost(names);
		runLuaSource(source, host, { layerIds: [GENERAL_WIN] });

		const layer = host.menuState.layers.get(GENERAL_WIN);
		expect(layer).toBeDefined();
		expect([...(layer?.objects.values() ?? [])].some((o) => (o.spriteTextureHash ?? 0) > 0)).toBe(true);
	});
});
