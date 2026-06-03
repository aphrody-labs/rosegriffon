/**
 * Parseur bytecode Lua 5.2 natif TypeScript (Bun-native, aucune dépendance externe).
 * Port exact du LuaParser.cs C# (IECODE.Core.Formats.Lua).
 *
 * Format Lua 5.2 (little-endian, x64) :
 *   En-tête 18 octets + Proto principal récursif.
 *   Ordre des champs : code, constants, sub-protos, upvalues, debug.
 */

import { LUA_SIGNATURE, LUA_VERSION_52, LUAC_TAIL, SBIAS } from "./constants.js";
import type { LuaChunk, LuaConstant, LuaHeader, LuaInstruction, LuaLocal, LuaProto, LuaUpvalue } from "./model.js";

// ── Erreur ────────────────────────────────────────────────────────────────────
export class LuaParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LuaParseError";
	}
}

// ── Vérification rapide ───────────────────────────────────────────────────────
/**
 * Retourne true si les 5 premiers octets indiquent un chunk Lua 5.2.
 */
export function isLua52(data: Uint8Array): boolean {
	if (data.length < 5) return false;
	return (
		data[0] === 0x1b &&
		data[1] === 0x4c &&
		data[2] === 0x75 &&
		data[3] === 0x61 &&
		data[4] === LUA_VERSION_52
	);
}

// ── Point d'entrée ────────────────────────────────────────────────────────────
/**
 * Parse un chunk Lua 5.2 depuis un Buffer ou Uint8Array.
 * @throws {LuaParseError} Si le format est invalide.
 */
export function parseLua52(data: Uint8Array | ArrayBuffer): LuaChunk {
	const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
	const reader = new DataReader(buf);

	const header = parseHeader(reader);
	const main = parseProto(reader);

	return { header, main };
}

// ── En-tête ───────────────────────────────────────────────────────────────────
function parseHeader(r: DataReader): LuaHeader {
	// Signature \x1bLua
	for (const b of LUA_SIGNATURE) {
		if (r.readByte() !== b) throw new LuaParseError("Signature Lua invalide.");
	}
	const version = r.readByte();
	if (version !== LUA_VERSION_52) throw new LuaParseError(`Version non supportée : 0x${version.toString(16)} (attendu 0x52).`);

	const format = r.readByte();
	if (format !== 0) throw new LuaParseError(`Format non standard : ${format}.`);

	const endian = r.readByte();
	const isLittleEndian = endian === 1;

	const intSize = r.readByte();
	const sizeTSize = r.readByte();
	const instructionSize = r.readByte();
	const numberSize = r.readByte();
	const integralFlag = r.readByte();

	// LUAC_TAIL
	for (const b of LUAC_TAIL) {
		if (r.readByte() !== b) throw new LuaParseError("LUAC_TAIL invalide ou fichier corrompu.");
	}

	return {
		version,
		format,
		isLittleEndian,
		intSize,
		sizeTSize,
		instructionSize,
		numberSize,
		isFloat: integralFlag === 0,
	};
}

// ── Proto ─────────────────────────────────────────────────────────────────────
function parseProto(r: DataReader): LuaProto {
	const lineDefined = r.readInt32();
	const lastLineDefined = r.readInt32();
	const numParams = r.readByte();
	const isVararg = r.readByte();
	const maxStackSize = r.readByte();

	const code = parseCode(r);
	const constants = parseConstants(r);
	const protos = parseSubProtos(r);
	const upvalues = parseUpvalues(r);
	const { source, lineInfo, locVars, upvalueNames } = parseDebug(r);

	// Patch upvalue names
	const namedUpvalues: LuaUpvalue[] = upvalues.map((uv, i) => ({
		inStack: uv.inStack,
		idx: uv.idx,
		name: i < upvalueNames.length ? upvalueNames[i] : uv.name,
	}));

	// Convention Lua 5.2 : première upvalue sans nom = _ENV
	if (namedUpvalues.length >= 1 && !namedUpvalues[0]!.name) {
		const first = namedUpvalues[0]!;
		namedUpvalues[0] = { inStack: first.inStack, idx: first.idx, name: "_ENV" };
	}

	return {
		source,
		lineDefined,
		lastLineDefined,
		numParams,
		isVararg,
		maxStackSize,
		code,
		constants,
		upvalues: namedUpvalues,
		protos,
		lineInfo,
		locVars,
	};
}

// ── Code ──────────────────────────────────────────────────────────────────────
function parseCode(r: DataReader): LuaInstruction[] {
	const count = r.readInt32();
	const list: LuaInstruction[] = [];
	for (let i = 0; i < count; i++) {
		list.push(decodeInstruction(r.readUInt32()));
	}
	return list;
}

/** Décode un uint32 en instruction Lua 5.2. */
export function decodeInstruction(raw: number): LuaInstruction {
	const opcode = raw & 0x3f;
	const a = (raw >>> 6) & 0xff;
	const c = (raw >>> 14) & 0x1ff;
	const b = (raw >>> 23) & 0x1ff;
	const bx = (b << 9) | c;
	const sbx = bx - SBIAS;
	const ax = raw >>> 6;
	return { raw, opcode, a, b, c, bx, sbx, ax };
}

// ── Constantes ────────────────────────────────────────────────────────────────
function parseConstants(r: DataReader): LuaConstant[] {
	const count = r.readInt32();
	const list: LuaConstant[] = [];
	for (let i = 0; i < count; i++) {
		list.push(parseOneConstant(r));
	}
	return list;
}

function parseOneConstant(r: DataReader): LuaConstant {
	const type = r.readByte();
	switch (type) {
		case 0: return { kind: "nil" };
		case 1: return { kind: "bool", value: r.readByte() !== 0 };
		case 3: return { kind: "number", value: r.readDouble() };
		case 4: return { kind: "string", value: readLuaString(r) };
		default: throw new LuaParseError(`Type de constante inconnu : ${type}.`);
	}
}

// ── Upvalues ──────────────────────────────────────────────────────────────────
function parseUpvalues(r: DataReader): LuaUpvalue[] {
	const count = r.readInt32();
	const list: LuaUpvalue[] = [];
	for (let i = 0; i < count; i++) {
		const inStack = r.readByte() !== 0;
		const idx = r.readByte();
		list.push({ inStack, idx });
	}
	return list;
}

// ── Sub-protos ────────────────────────────────────────────────────────────────
function parseSubProtos(r: DataReader): LuaProto[] {
	const count = r.readInt32();
	const list: LuaProto[] = [];
	for (let i = 0; i < count; i++) {
		list.push(parseProto(r));
	}
	return list;
}

// ── Section debug ─────────────────────────────────────────────────────────────
function parseDebug(r: DataReader): {
	source: string | null;
	lineInfo: number[];
	locVars: LuaLocal[];
	upvalueNames: string[];
} {
	const source = readLuaStringNullable(r);

	const lineCount = r.readInt32();
	const lineInfo: number[] = [];
	for (let i = 0; i < lineCount; i++) lineInfo.push(r.readInt32());

	const locCount = r.readInt32();
	const locVars: LuaLocal[] = [];
	for (let i = 0; i < locCount; i++) {
		const name = readLuaString(r);
		const pcStart = r.readInt32();
		const pcEnd = r.readInt32();
		locVars.push({ name, pcStart, pcEnd });
	}

	const uvNameCount = r.readInt32();
	const upvalueNames: string[] = [];
	for (let i = 0; i < uvNameCount; i++) {
		upvalueNames.push(readLuaString(r));
	}

	return { source, lineInfo, locVars, upvalueNames };
}

// ── Lecture chaîne Lua (size_t = 8 octets, LE, inclut le \0) ─────────────────
function readLuaString(r: DataReader): string {
	const size = r.readBigInt64();
	if (size === 0n) return "";
	const bytes = r.readBytes(Number(size));
	// Exclure le \0 terminal
	return new TextDecoder("windows-1252").decode(bytes.slice(0, Number(size) - 1));
}

function readLuaStringNullable(r: DataReader): string | null {
	const size = r.readBigInt64();
	if (size === 0n) return null;
	const bytes = r.readBytes(Number(size));
	return new TextDecoder("windows-1252").decode(bytes.slice(0, Number(size) - 1));
}

// ── Lecteur de DataView ───────────────────────────────────────────────────────
class DataReader {
	private readonly view: DataView;
	private pos = 0;

	constructor(data: Uint8Array) {
		this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	}

	get position(): number {
		return this.pos;
	}

	readByte(): number {
		this.ensureAvailable(1);
		return this.view.getUint8(this.pos++);
	}

	readInt32(): number {
		this.ensureAvailable(4);
		const v = this.view.getInt32(this.pos, true);
		this.pos += 4;
		return v;
	}

	readUInt32(): number {
		this.ensureAvailable(4);
		const v = this.view.getUint32(this.pos, true);
		this.pos += 4;
		return v;
	}

	readBigInt64(): bigint {
		this.ensureAvailable(8);
		const v = this.view.getBigInt64(this.pos, true);
		this.pos += 8;
		return v;
	}

	readDouble(): number {
		this.ensureAvailable(8);
		const v = this.view.getFloat64(this.pos, true);
		this.pos += 8;
		return v;
	}

	readBytes(count: number): Uint8Array {
		this.ensureAvailable(count);
		const slice = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, count);
		this.pos += count;
		return slice;
	}

	private ensureAvailable(n: number): void {
		if (this.pos + n > this.view.byteLength) {
			throw new LuaParseError(
				`Fin de fichier inattendue à l'offset 0x${this.pos.toString(16)} (besoin de ${n} octets).`,
			);
		}
	}
}
