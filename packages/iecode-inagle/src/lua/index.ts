/**
 * Module `@rose-griffon/iecode-inagle/lua` — parseur + désassembleur + runtime Lua 5.2 IEVR.
 *
 * Usage — parse/disasm :
 * ```ts
 * import { parseLua52, disassemble, isLua52 } from "@rose-griffon/iecode-inagle/src/lua/index.ts";
 *
 * const data = await Bun.file("menu.lua.bin").bytes();
 * const chunk = parseLua52(data);
 * console.log(disassemble(chunk));
 * ```
 *
 * Usage — runtime (Bun + navigateur via fengari) :
 * ```ts
 * import { runLuaScript, DefaultLuaHost, loadHashDictionary } from "@rose-griffon/iecode-inagle/src/lua/index.ts";
 *
 * const host = new DefaultLuaHost();
 * const state = await runLuaScript(await Bun.file("qrcode_menu.lua.bin").bytes(), host);
 * console.log(state?.calls);
 * ```
 */

export { isLua52, parseLua52, decodeInstruction, LuaParseError } from "./parser.js";
export { disassemble, formatInstruction, summarize } from "./disassembler.js";
export { Opcode, OPCODE_NAMES, opcodeName } from "./constants.js";
export type {
	LuaChunk,
	LuaConstant,
	LuaHeader,
	LuaInstruction,
	LuaLocal,
	LuaProto,
	LuaUpvalue,
} from "./model.js";

// ── Runtime ───────────────────────────────────────────────────────────────────
export {
	DefaultLuaHost,
	LuaRuntimeError,
	LuaDecompileError,
	runLuaScript,
	runLuaSource,
	loadHashDictionary,
	resolveHash,
	UNLUAC_JAR_PATH,
} from "./runtime.js";
export type {
	LuaGameHost,
	LuaLayerState,
	LuaCallRecord,
	LayerInfo,
	RunLuaOptions,
} from "./runtime.js";
