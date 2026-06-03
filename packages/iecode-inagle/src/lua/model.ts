/**
 * Modèle objet du bytecode Lua 5.2.
 * Conforme au résultat de LuaParser.cs (C# IECODE.Core).
 */

// ── En-tête ──────────────────────────────────────────────────────────────────
export interface LuaHeader {
	readonly version: number;
	readonly format: number;
	readonly isLittleEndian: boolean;
	readonly intSize: number;
	readonly sizeTSize: number;
	readonly instructionSize: number;
	readonly numberSize: number;
	readonly isFloat: boolean;
}

// ── Instruction ──────────────────────────────────────────────────────────────
export interface LuaInstruction {
	/** Valeur brute 32 bits (little-endian). */
	readonly raw: number;
	readonly opcode: number;
	readonly a: number;
	readonly b: number;
	readonly c: number;
	readonly bx: number;
	/** sBx = Bx - 131071 */
	readonly sbx: number;
	/** Ax = raw >> 6 (pour EXTRAARG) */
	readonly ax: number;
}

// ── Constante ─────────────────────────────────────────────────────────────────
export type LuaConstant =
	| { readonly kind: "nil" }
	| { readonly kind: "bool"; readonly value: boolean }
	| { readonly kind: "number"; readonly value: number }
	| { readonly kind: "string"; readonly value: string };

// ── Upvalue ───────────────────────────────────────────────────────────────────
export interface LuaUpvalue {
	readonly inStack: boolean;
	readonly idx: number;
	readonly name?: string | undefined;
}

// ── Variable locale ───────────────────────────────────────────────────────────
export interface LuaLocal {
	readonly name: string;
	readonly pcStart: number;
	readonly pcEnd: number;
}

// ── Proto ─────────────────────────────────────────────────────────────────────
export interface LuaProto {
	readonly source: string | null;
	readonly lineDefined: number;
	readonly lastLineDefined: number;
	readonly numParams: number;
	readonly isVararg: number;
	readonly maxStackSize: number;
	readonly code: readonly LuaInstruction[];
	readonly constants: readonly LuaConstant[];
	readonly upvalues: readonly LuaUpvalue[];
	readonly protos: readonly LuaProto[];
	readonly lineInfo: readonly number[];
	readonly locVars: readonly LuaLocal[];
}

// ── Chunk ─────────────────────────────────────────────────────────────────────
export interface LuaChunk {
	readonly header: LuaHeader;
	readonly main: LuaProto;
}
