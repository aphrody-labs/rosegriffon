/**
 * Tests du parseur .objbin — port TypeScript du ObjbParser.cs C#.
 * Validés contre les vrais fichiers /home/ubuntu/data/common/gamedata/menu/obj/
 */

import { expect, test, describe } from "bun:test";
import { isObjb, ObjbParseError, parseObjb, parseObjbFile } from "./objb.js";
import type { AnimationComponent, MeshVisibleComponent, PrimitiveComponent, RenderComponent, TextComponent } from "./model.js";

const OBJ_DIR = "/home/ubuntu/data/common/gamedata/menu/obj";
const hasFiles = await Bun.file(`${OBJ_DIR}/title00_09_version.objbin`).exists();

function objFile(name: string) {
	return `${OBJ_DIR}/${name}`;
}

// ── isObjb ────────────────────────────────────────────────────────────────────

describe("isObjb", () => {
	test("retourne true pour un buffer avec le footer cfg.bin", () => {
		const data = new Uint8Array(64);
		data[60] = 0x01; data[61] = 0x74; data[62] = 0x32; data[63] = 0x62;
		expect(isObjb(data)).toBe(true);
	});

	test("retourne false pour un buffer vide", () => {
		expect(isObjb(new Uint8Array(0))).toBe(false);
	});

	test("retourne false pour des données invalides", () => {
		expect(isObjb(new Uint8Array(32))).toBe(false);
	});
});

// ── parseObjb — erreurs ──────────────────────────────────────────────────────

describe("parseObjb — erreurs", () => {
	test("lève ObjbParseError sur buffer trop petit", () => {
		expect(() => parseObjb(new Uint8Array(4))).toThrow(ObjbParseError);
	});

	test("lève ObjbParseError sur footer absent", () => {
		expect(() => parseObjb(new Uint8Array(32))).toThrow(ObjbParseError);
	});
});

// ── title00_09_version.objbin ─────────────────────────────────────────────────

describe("title00_09_version.objbin", () => {
	test.skipIf(!hasFiles)("name = 'title00_09_version'", async () => {
		const obj = await parseObjbFile(objFile("title00_09_version.objbin"));
		expect(obj.name).toBe("title00_09_version");
	});

	test.skipIf(!hasFiles)("engineType = 'gmdMenuObj'", async () => {
		const obj = await parseObjbFile(objFile("title00_09_version.objbin"));
		expect(obj.engineType).toBe("gmdMenuObj");
	});

	test.skipIf(!hasFiles)("g4pkmPath contient title00_09.g4pkm", async () => {
		const obj = await parseObjbFile(objFile("title00_09_version.objbin"));
		expect(obj.g4pkmPath).not.toBeNull();
		expect(obj.g4pkmPath).toContain("title00_09.g4pkm");
		expect(obj.g4pkmPath).toContain("50_title");
	});

	test.skipIf(!hasFiles)("g4txPath normalisé en dx11/", async () => {
		const obj = await parseObjbFile(objFile("title00_09_version.objbin"));
		expect(obj.g4txPath).not.toBeNull();
		expect(obj.g4txPath!.startsWith("dx11/")).toBe(true);
		expect(obj.g4txPath).toContain("title00_09.g4tx");
		expect(obj.g4txPath).toContain("<LG>");
	});

	test.skipIf(!hasFiles)("RenderComponent présent avec drawPriority > 0", async () => {
		const obj    = await parseObjbFile(objFile("title00_09_version.objbin"));
		const render = obj.components.find((c): c is RenderComponent => c.kind === "render");
		expect(render).toBeDefined();
		expect(render!.typeName).toBe("CMenuRenderComponent");
		expect(render!.drawPriority).toBeGreaterThan(0);
	});

	test.skipIf(!hasFiles)("PrimitiveComponent avec NumberSettingHashes", async () => {
		const obj  = await parseObjbFile(objFile("title00_09_version.objbin"));
		const prim = obj.components.find((c): c is PrimitiveComponent => c.kind === "primitive");
		expect(prim).toBeDefined();
		expect(prim!.numberSettingHashes.length).toBeGreaterThan(0);
	});

	test.skipIf(!hasFiles)("≥3 composants", async () => {
		const obj = await parseObjbFile(objFile("title00_09_version.objbin"));
		expect(obj.components.length).toBeGreaterThanOrEqual(3);
	});
});

// ── win01_21_select_button.objbin ─────────────────────────────────────────────

describe("win01_21_select_button.objbin", () => {
	test.skipIf(!hasFiles)("name contient 'cmn_button_s'", async () => {
		const obj = await parseObjbFile(objFile("win01_21_select_button.objbin"));
		expect(obj.name).toContain("cmn_button_s");
	});

	test.skipIf(!hasFiles)("g4pkmPath contient win01_21.g4pkm", async () => {
		const obj = await parseObjbFile(objFile("win01_21_select_button.objbin"));
		expect(obj.g4pkmPath).toContain("win01_21.g4pkm");
	});

	test.skipIf(!hasFiles)("RenderComponent drawPriority = 300", async () => {
		const obj    = await parseObjbFile(objFile("win01_21_select_button.objbin"));
		const render = obj.components.find((c): c is RenderComponent => c.kind === "render");
		expect(render).toBeDefined();
		expect(render!.drawPriority).toBe(300);
	});

	test.skipIf(!hasFiles)("AnimationComponent avec motOpenHash != 0", async () => {
		const obj  = await parseObjbFile(objFile("win01_21_select_button.objbin"));
		const anim = obj.components.find((c): c is AnimationComponent => c.kind === "animation");
		expect(anim).toBeDefined();
		expect(anim!.motOpenHash).not.toBe(0);
	});

	test.skipIf(!hasFiles)("TextComponent avec _text_choice01_on et _text_choice01_off", async () => {
		const obj  = await parseObjbFile(objFile("win01_21_select_button.objbin"));
		const text = obj.components.find((c): c is TextComponent => c.kind === "text");
		expect(text).toBeDefined();
		expect(text!.entries.length).toBeGreaterThanOrEqual(2);
		expect(text!.entries.some((e) => e.key === "_text_choice01_on")).toBe(true);
		expect(text!.entries.some((e) => e.key === "_text_choice01_off")).toBe(true);
	});
});

// ── save01_04_savedata_detail_window.objbin ───────────────────────────────────

describe("save01_04_savedata_detail_window.objbin", () => {
	test.skipIf(!hasFiles)("name = 'save01_04_savedata_detail_window'", async () => {
		const obj = await parseObjbFile(objFile("save01_04_savedata_detail_window.objbin"));
		expect(obj.name).toBe("save01_04_savedata_detail_window");
	});

	test.skipIf(!hasFiles)("g4pkmPath contient save01_04.g4pkm", async () => {
		const obj = await parseObjbFile(objFile("save01_04_savedata_detail_window.objbin"));
		expect(obj.g4pkmPath).toContain("save01_04.g4pkm");
	});

	test.skipIf(!hasFiles)("TextComponent avec ≥10 clés texte", async () => {
		const obj  = await parseObjbFile(objFile("save01_04_savedata_detail_window.objbin"));
		const text = obj.components.find((c): c is TextComponent => c.kind === "text");
		expect(text).toBeDefined();
		expect(text!.entries.length).toBeGreaterThanOrEqual(10);
		expect(text!.entries.some((e) => e.key.startsWith("_text_save_info_title"))).toBe(true);
		expect(text!.entries.some((e) => e.key.startsWith("_text_category_title"))).toBe(true);
	});

	test.skipIf(!hasFiles)("MeshVisibleComponent avec 4 params", async () => {
		const obj  = await parseObjbFile(objFile("save01_04_savedata_detail_window.objbin"));
		const mesh = obj.components.find((c): c is MeshVisibleComponent => c.kind === "meshVisible");
		expect(mesh).toBeDefined();
		expect(mesh!.params.length).toBe(4);
	});

	test.skipIf(!hasFiles)("PrimitiveComponent avec ≥10 DispMaxValues", async () => {
		const obj  = await parseObjbFile(objFile("save01_04_savedata_detail_window.objbin"));
		const prim = obj.components.find((c): c is PrimitiveComponent => c.kind === "primitive");
		expect(prim).toBeDefined();
		expect(prim!.dispMaxValues.length).toBeGreaterThanOrEqual(10);
	});

	test.skipIf(!hasFiles)("≥5 composants", async () => {
		const obj = await parseObjbFile(objFile("save01_04_savedata_detail_window.objbin"));
		expect(obj.components.length).toBeGreaterThanOrEqual(5);
	});
});

// ── Batch ─────────────────────────────────────────────────────────────────────

describe("Batch — tous les .objbin", () => {
	test.skipIf(!hasFiles)("parse tous les fichiers sans exception", async () => {
		const glob = new Bun.Glob("*.objbin");
		const files = [...glob.scanSync(OBJ_DIR)];
		expect(files.length).toBeGreaterThan(0);

		const errors: string[] = [];
		for (const file of files) {
			try {
				const obj = await parseObjbFile(`${OBJ_DIR}/${file}`);
				expect(obj.name).toBeDefined();
				expect(obj.engineType).toBe("gmdMenuObj");
			} catch (err) {
				errors.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
			}
		}

		if (errors.length > 0) {
			throw new Error(
				`${errors.length}/${files.length} fichiers en erreur :\n${errors.slice(0, 10).join("\n")}`,
			);
		}
	});
});
