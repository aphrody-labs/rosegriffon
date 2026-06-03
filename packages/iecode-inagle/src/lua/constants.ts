/**
 * Constantes du format bytecode Lua 5.2 (lundump.h / lopcodes.h).
 * Port TypeScript du parseur C# IECODE.Core.Formats.Lua.
 */

/** Signature header : "\x1bLua" */
export const LUA_SIGNATURE = new Uint8Array([0x1b, 0x4c, 0x75, 0x61]);

/** Version Lua 5.2 */
export const LUA_VERSION_52 = 0x52;

/** LUAC_TAIL (6 octets de contrôle d'intégrité) */
export const LUAC_TAIL = new Uint8Array([0x19, 0x93, 0x0d, 0x0a, 0x1a, 0x0a]);

// ── Biais sBx ───────────────────────────────────────────────────────────────
/** Biais sBx = (2^18-1)/2 = 131071 */
export const SBIAS = 131071;

// ── Les 40 opcodes Lua 5.2 ──────────────────────────────────────────────────
export const enum Opcode {
	MOVE      = 0,
	LOADK     = 1,
	LOADKX    = 2,
	LOADBOOL  = 3,
	LOADNIL   = 4,
	GETUPVAL  = 5,
	GETTABUP  = 6,
	GETTABLE  = 7,
	SETTABUP  = 8,
	SETUPVAL  = 9,
	SETTABLE  = 10,
	NEWTABLE  = 11,
	SELF      = 12,
	ADD       = 13,
	SUB       = 14,
	MUL       = 15,
	DIV       = 16,
	MOD       = 17,
	POW       = 18,
	UNM       = 19,
	NOT       = 20,
	LEN       = 21,
	CONCAT    = 22,
	JMP       = 23,
	EQ        = 24,
	LT        = 25,
	LE        = 26,
	TEST      = 27,
	TESTSET   = 28,
	CALL      = 29,
	TAILCALL  = 30,
	RETURN    = 31,
	FORLOOP   = 32,
	FORPREP   = 33,
	TFORCALL  = 34,
	TFORLOOP  = 35,
	SETLIST   = 36,
	CLOSURE   = 37,
	VARARG    = 38,
	EXTRAARG  = 39,
}

/** Nom lisible d'un opcode (index → string). */
export const OPCODE_NAMES: Readonly<string[]> = [
	"MOVE", "LOADK", "LOADKX", "LOADBOOL", "LOADNIL",
	"GETUPVAL", "GETTABUP", "GETTABLE", "SETTABUP", "SETUPVAL",
	"SETTABLE", "NEWTABLE", "SELF", "ADD", "SUB",
	"MUL", "DIV", "MOD", "POW", "UNM",
	"NOT", "LEN", "CONCAT", "JMP", "EQ",
	"LT", "LE", "TEST", "TESTSET", "CALL",
	"TAILCALL", "RETURN", "FORLOOP", "FORPREP", "TFORCALL",
	"TFORLOOP", "SETLIST", "CLOSURE", "VARARG", "EXTRAARG",
] as const;

export function opcodeName(op: number): string {
	return OPCODE_NAMES[op] ?? `[OPCODE_${op}]`;
}
