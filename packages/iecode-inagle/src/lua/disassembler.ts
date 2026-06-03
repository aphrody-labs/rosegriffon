/**
 * Désassembleur bytecode Lua 5.2 — listing type `luac -l`.
 * Port du LuaDisassembler.cs C# (IECODE.Core.Formats.Lua).
 */

import { opcodeName, Opcode } from "./constants.js";
import type { LuaChunk, LuaConstant, LuaInstruction, LuaProto } from "./model.js";

// ── Format d'une instruction ─────────────────────────────────────────────────
/**
 * Retourne la représentation lisible d'une instruction (colonnes opcode + opérandes).
 */
export function formatInstruction(instr: LuaInstruction): string {
	const name = opcodeName(instr.opcode);
	const { a, b, c, bx, sbx, ax } = instr;

	switch (instr.opcode) {
		// iA
		case Opcode.LOADKX:
			return `${name}\t${a}`;
		// iABx
		case Opcode.LOADK:
		case Opcode.CLOSURE:
			return `${name}\t${a}\t${bx}`;
		// iAsBx
		case Opcode.JMP:
		case Opcode.FORLOOP:
		case Opcode.FORPREP:
		case Opcode.TFORLOOP:
			return `${name}\t${a}\t${sbx}`;
		// iABC — B seul
		case Opcode.MOVE:
		case Opcode.LOADNIL:
		case Opcode.GETUPVAL:
		case Opcode.SETUPVAL:
		case Opcode.UNM:
		case Opcode.NOT:
		case Opcode.LEN:
		case Opcode.RETURN:
		case Opcode.VARARG:
			return `${name}\t${a}\t${b}`;
		// iAC seul
		case Opcode.TEST:
		case Opcode.TFORCALL:
			return `${name}\t${a}\t${c}`;
		// iABC complet
		case Opcode.LOADBOOL:
		case Opcode.GETTABUP:
		case Opcode.SETTABUP:
		case Opcode.GETTABLE:
		case Opcode.SETTABLE:
		case Opcode.NEWTABLE:
		case Opcode.SELF:
		case Opcode.ADD:
		case Opcode.SUB:
		case Opcode.MUL:
		case Opcode.DIV:
		case Opcode.MOD:
		case Opcode.POW:
		case Opcode.CONCAT:
		case Opcode.EQ:
		case Opcode.LT:
		case Opcode.LE:
		case Opcode.TESTSET:
		case Opcode.CALL:
		case Opcode.TAILCALL:
		case Opcode.SETLIST:
			return `${name}\t${a}\t${b}\t${c}`;
		// Ax
		case Opcode.EXTRAARG:
			return `${name}\t${ax}`;
		default:
			return `${name}\t${a}\t${b}\t${c}`;
	}
}

// ── Annotation constante RK ──────────────────────────────────────────────────
function rkHint(rk: number, consts: readonly LuaConstant[]): string {
	if (rk & 0x100) {
		const idx = rk & 0xff;
		const c = consts[idx];
		if (idx < consts.length && c !== undefined) return `K(${idx}) = ${constToString(c)}`;
	}
	return "";
}

export function constToString(c: LuaConstant): string {
	switch (c.kind) {
		case "nil":
			return "nil";
		case "bool":
			return c.value ? "true" : "false";
		case "number":
			return String(c.value);
		case "string":
			return `"${c.value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
	}
}

// ── Désassemblage d'un chunk ─────────────────────────────────────────────────
/**
 * Désassemble un chunk complet (proto principal + sous-protos récursifs).
 * Retourne un string multi-lignes type `luac -l`.
 */
export function disassemble(chunk: LuaChunk): string {
	const lines: string[] = [];
	disassembleProto(lines, chunk.main, 0);
	return lines.join("\n");
}

function disassembleProto(out: string[], proto: LuaProto, depth: number): void {
	const indent = "  ".repeat(depth);
	const src = proto.source ?? "(?)";
	out.push(`${indent}function <${src}:${proto.lineDefined},${proto.lastLineDefined}> (${proto.code.length} instructions at 0x?)`);
	out.push(`${indent}${proto.numParams} param(s), ${proto.isVararg} is_vararg, ${proto.maxStackSize} slots`);

	for (let i = 0; i < proto.code.length; i++) {
		const instr: LuaInstruction = proto.code[i]!;
		const lineVal = proto.lineInfo.length > i ? proto.lineInfo[i] : 0;
		const lineStr = lineVal ? `[${String(lineVal).padStart(4)}]` : "[   ?]";
		const asm = formatInstruction(instr);

		const hints: string[] = [];
		switch (instr.opcode) {
			case Opcode.GETTABUP:
			case Opcode.SETTABUP:
			case Opcode.GETTABLE:
			case Opcode.SETTABLE:
			case Opcode.ADD:
			case Opcode.SUB:
			case Opcode.MUL:
			case Opcode.DIV:
			case Opcode.MOD:
			case Opcode.POW:
			case Opcode.EQ:
			case Opcode.LT:
			case Opcode.LE: {
				const hb = rkHint(instr.b, proto.constants);
				const hc = rkHint(instr.c, proto.constants);
				if (hb) hints.push(hb);
				if (hc) hints.push(hc);
				break;
			}
			case Opcode.LOADK: {
				const kc = proto.constants[instr.bx];
				if (instr.bx < proto.constants.length && kc !== undefined) hints.push(constToString(kc));
				break;
			}
			case Opcode.CLOSURE:
				if (instr.bx < proto.protos.length) hints.push(`proto[${instr.bx}]`);
				break;
		}

		const hint = hints.length > 0 ? `\t; ${hints.join(", ")}` : "";
		out.push(`${indent}\t${String(i + 1).padStart(4)}\t${lineStr}\t${asm}${hint}`);
	}

	out.push(`${indent}constants (${proto.constants.length}) for 0x?:`);
	for (let i = 0; i < proto.constants.length; i++) {
		const kc: LuaConstant = proto.constants[i]!;
		out.push(`${indent}\t${i + 1}\t${constToString(kc)}`);
	}

	out.push(`${indent}locals (${proto.locVars.length}) for 0x?:`);
	for (let i = 0; i < proto.locVars.length; i++) {
		const lv = proto.locVars[i]!;
		out.push(`${indent}\t${i}\t${lv.name}\t${lv.pcStart + 1}\t${lv.pcEnd + 1}`);
	}

	out.push(`${indent}upvalues (${proto.upvalues.length}) for 0x?:`);
	for (let i = 0; i < proto.upvalues.length; i++) {
		const uv = proto.upvalues[i]!;
		out.push(`${indent}\t${i}\t${uv.name ?? "(unnamed)"}\t${uv.inStack ? 1 : 0}\t${uv.idx}`);
	}

	for (const child of proto.protos) {
		out.push("");
		disassembleProto(out, child, depth);
	}
}

// ── Résumé compact ────────────────────────────────────────────────────────────
/**
 * Résumé compact d'un chunk (pour logging ou `inagle lua info`).
 */
export function summarize(chunk: LuaChunk): string {
	const lines: string[] = [];
	const h = chunk.header;
	lines.push(`Lua 5.2 chunk | endian=${h.isLittleEndian ? "LE" : "BE"} int=${h.intSize} size_t=${h.sizeTSize} num=${h.numberSize} float=${h.isFloat}`);
	function walk(p: LuaProto, depth: number): void {
		const indent = "  ".repeat(depth);
		const src = p.source ?? "(stripped)";
		lines.push(`${indent}proto [${src}:${p.lineDefined}] — ${p.code.length} instrs, ${p.constants.length} consts, ${p.upvalues.length} upvals, ${p.protos.length} protos`);
		for (const child of p.protos) walk(child, depth + 1);
	}
	walk(chunk.main, 0);
	return lines.join("\n");
}
