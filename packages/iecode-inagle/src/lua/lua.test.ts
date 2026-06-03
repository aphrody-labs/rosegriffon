/**
 * Tests du parseur Lua 5.2 TypeScript.
 * Validés contre les vrais fichiers .lua.bin d'IEVR.
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";

import { isLua52, parseLua52, LuaParseError, decodeInstruction } from "./parser";
import { disassemble, summarize } from "./disassembler";
import { Opcode, SBIAS } from "./constants";
import type { LuaConstant } from "./model";

const RAW_DIR = join(import.meta.dir, "../../../../../re/lua/raw");
const hasRawFiles = existsSync(join(RAW_DIR, "qrcode_menu.lua.bin"));

function rawFile(name: string): string {
	return join(RAW_DIR, name);
}

async function loadRaw(name: string): Promise<Uint8Array> {
	return Bun.file(rawFile(name)).bytes();
}

function* allConstants(proto: ReturnType<typeof parseLua52>["main"]): Generator<LuaConstant> {
	yield* proto.constants;
	for (const child of proto.protos) yield* allConstants(child);
}

// ── isLua52 ───────────────────────────────────────────────────────────────────
describe("isLua52", () => {
	it("détecte un header Lua 5.2 valide", () => {
		const buf = new Uint8Array([0x1b, 0x4c, 0x75, 0x61, 0x52]);
		expect(isLua52(buf)).toBe(true);
	});

	it("rejette Lua 5.1", () => {
		const buf = new Uint8Array([0x1b, 0x4c, 0x75, 0x61, 0x51]);
		expect(isLua52(buf)).toBe(false);
	});

	it("rejette un buffer vide", () => {
		expect(isLua52(new Uint8Array([]))).toBe(false);
	});

	it("rejette une mauvaise signature", () => {
		const buf = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x52]);
		expect(isLua52(buf)).toBe(false);
	});
});

// ── decodeInstruction ────────────────────────────────────────────────────────
describe("decodeInstruction", () => {
	it("décode RETURN 1 0 correctement", () => {
		// opcode=31, A=1, B=0
		const raw = Opcode.RETURN | (1 << 6);
		const instr = decodeInstruction(raw >>> 0);
		expect(instr.opcode).toBe(Opcode.RETURN);
		expect(instr.a).toBe(1);
		expect(instr.b).toBe(0);
	});

	it("décode le biais sBx pour JMP sBx=0", () => {
		const raw = (Opcode.JMP | (SBIAS << 14)) >>> 0;
		const instr = decodeInstruction(raw);
		expect(instr.opcode).toBe(Opcode.JMP);
		expect(instr.sbx).toBe(0);
	});

	it("décode correctement les champs A, B, C d'un CALL", () => {
		// CALL A=2 B=5 C=1
		const raw = (Opcode.CALL | (2 << 6) | (1 << 14) | (5 << 23)) >>> 0;
		const instr = decodeInstruction(raw);
		expect(instr.opcode).toBe(Opcode.CALL);
		expect(instr.a).toBe(2);
		expect(instr.b).toBe(5);
		expect(instr.c).toBe(1);
	});
});

// ── parse en-tête IEVR ───────────────────────────────────────────────────────
describe("header IEVR", () => {
	it("champs header corrects sur qrcode_menu", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("qrcode_menu.lua.bin");
		const chunk = parseLua52(data);
		const h = chunk.header;
		expect(h.version).toBe(0x52);
		expect(h.format).toBe(0);
		expect(h.isLittleEndian).toBe(true);
		expect(h.intSize).toBe(4);
		expect(h.sizeTSize).toBe(8);
		expect(h.instructionSize).toBe(4);
		expect(h.numberSize).toBe(8);
		expect(h.isFloat).toBe(true);
	});
});

// ── qrcode_menu.lua.bin ───────────────────────────────────────────────────────
describe("qrcode_menu.lua.bin", () => {
	it("possède 3 sous-protos (OnSetupLayer / OnOpenLayer / OnCloseLayer)", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("qrcode_menu.lua.bin");
		const chunk = parseLua52(data);
		expect(chunk.main.protos).toHaveLength(3);
	});

	it("proto principal a des instructions", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("qrcode_menu.lua.bin");
		const chunk = parseLua52(data);
		expect(chunk.main.code.length).toBeGreaterThan(0);
	});

	it("sous-proto 0 (OnSetupLayer) a des constantes numériques (IDs hashés)", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("qrcode_menu.lua.bin");
		const chunk = parseLua52(data);
		const sub0 = chunk.main.protos[0]!;
		const hasNumbers = sub0.constants.some((c) => c.kind === "number");
		expect(hasNumbers).toBe(true);
	});
});

// ── battle_menu_multi.lua.bin ────────────────────────────────────────────────
describe("battle_menu_multi.lua.bin", () => {
	it("parse sans erreur", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("battle_menu_multi.lua.bin");
		const chunk = parseLua52(data);
		expect(chunk.main.code.length).toBeGreaterThan(0);
	});

	it("contient des constantes string", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("battle_menu_multi.lua.bin");
		const chunk = parseLua52(data);
		const hasStrings = [...allConstants(chunk.main)].some((c) => c.kind === "string");
		expect(hasStrings).toBe(true);
	});
});

// ── Batch : tous les .lua.bin ────────────────────────────────────────────────
it("tous les .lua.bin parsent sans exception", async () => {
	if (!hasRawFiles) return;
	const files = readdirSync(RAW_DIR).filter((f) => f.endsWith(".lua.bin"));
	expect(files.length).toBeGreaterThan(0);

	const errors: string[] = [];
	for (const f of files) {
		try {
			const data = await Bun.file(join(RAW_DIR, f)).bytes();
			parseLua52(data);
		} catch (e) {
			errors.push(`${f}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
	expect(errors).toHaveLength(0);
});

// ── Désassemblage ────────────────────────────────────────────────────────────
describe("disassemble", () => {
	it("qrcode_menu contient GETTABUP", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("qrcode_menu.lua.bin");
		const chunk = parseLua52(data);
		const asm = disassemble(chunk);
		expect(asm).toContain("GETTABUP");
	});

	it("qrcode_menu contient CALL", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("qrcode_menu.lua.bin");
		const chunk = parseLua52(data);
		const asm = disassemble(chunk);
		expect(asm).toContain("CALL");
	});

	it("qrcode_menu contient EQ (if A0==...)", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("qrcode_menu.lua.bin");
		const chunk = parseLua52(data);
		const asm = disassemble(chunk);
		expect(asm).toContain("EQ");
	});

	it("summarize retourne un résumé correct", async () => {
		if (!hasRawFiles) return;
		const data = await loadRaw("qrcode_menu.lua.bin");
		const chunk = parseLua52(data);
		const summary = summarize(chunk);
		expect(summary).toContain("Lua 5.2");
		expect(summary).toContain("3 protos");
	});
});

// ── LuaParseError ─────────────────────────────────────────────────────────────
it("lève LuaParseError sur un fichier invalide", () => {
	const invalid = new Uint8Array([0x00, 0x01, 0x02]);
	expect(() => parseLua52(invalid)).toThrow(LuaParseError);
});
