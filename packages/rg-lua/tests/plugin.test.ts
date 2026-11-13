// SPDX-License-Identifier: Apache-2.0
import { expect, test, describe } from "bun:test";
import { bunPluginLua } from "../src/bun";
import { withLua } from "../src/next";
import { Lua52VM } from "../src/vm";
import {
  auditLua52Bytecode,
  isLua52Bytecode,
  transcodeLua52Bytecode,
} from "../src/bytecode";
import { analyzeLua52Source } from "../src/ast";
import { Lua52LanguageServer } from "../src/lsp";
import { transformLuaToModule } from "../src/loader";

describe("@rosegriffon/lua-plugin Sovereign Suite", () => {
  test("bunPluginLua returns a valid Bun plugin spec for .lua and .lua.bin", () => {
    const plugin = bunPluginLua({ mode: "source" });
    expect(plugin.name).toBe("rosegriffon-bun-plugin-lua");
    expect(typeof plugin.setup).toBe("function");

    const filters: RegExp[] = [];
    plugin.setup({
      onLoad(config: { filter: RegExp }) {
        filters.push(config.filter);
      },
    });

    expect(filters.length).toBe(2);
    expect(filters.some((f) => f.test("script.lua"))).toBeTrue();
    expect(filters.some((f) => f.test("quest.lua.bin"))).toBeTrue();
    expect(filters.some((f) => f.test("compiled.luac"))).toBeTrue();
  });

  test("withLua configures both Turbopack rules and Webpack 5 module rules", () => {
    const baseConfig = { reactStrictMode: true };
    const extended = withLua(baseConfig, {
      includeBytecode: true,
      mode: "module",
    });

    // 1. Turbopack rules (Next.js 15 & 16)
    expect(extended.turbopack?.rules?.["*.lua"]).toBeDefined();
    expect(extended.turbopack?.rules?.["*.luac"]).toBeDefined();
    expect(extended.turbopack?.rules?.["*.lua.bin"]).toBeDefined();
    expect(extended.experimental?.turbo?.rules?.["*.lua"]).toBeDefined();

    // 2. Webpack 5 rules
    const mockWebpackConfig = { module: { rules: [] as any[] } };
    const finalConfig = extended.webpack(mockWebpackConfig, {});
    expect(finalConfig.module.rules.length).toBeGreaterThanOrEqual(2);
    expect(
      finalConfig.module.rules.some((r: any) => r.test?.test("script.lua")),
    ).toBeTrue();
    expect(
      finalConfig.module.rules.some((r: any) => r.test?.test("quest.lua.bin")),
    ).toBeTrue();
  });

  test("Lua52VM executes Lua 5.2 code, _ENV, 1-based indexing, bit32, and table.pack", () => {
    const vm = new Lua52VM();

    // 1. Bit32 & Math
    const res1 = vm.execute("return bit32.bxor(10, 42)");
    expect(res1.success).toBeTrue();
    expect(res1.returnValue).toBe(32);

    // 2. Table pack & unpack
    const res2 = vm.execute("return table.pack('alpha', 'beta', 'gamma').n");
    expect(res2.success).toBeTrue();
    expect(res2.returnValue).toBe(3);

    // 3. String byte and concat
    const res3 = vm.execute("return string.byte('Lua', 1)");
    expect(res3.success).toBeTrue();
    expect(res3.returnValue).toBe(76); // 'L'

    // 4. Safe pcall
    const res4 = vm.execute("return pcall(function() return 42 end)[0]");
    expect(res4.success).toBeTrue();
    expect(res4.returnValue).toBe(true);

    const res5 = vm.execute("return pcall(function() return 42 end)[1]");
    expect(res5.success).toBeTrue();
    expect(res5.returnValue).toBe(42);
  });

  test("Lua 5.2 Bytecode parser, REA disassembly and wasm32 transcoding", () => {
    // Construct valid PUC-Rio Lua 5.2 18-byte chunk
    const chunk: number[] = [
      0x1b,
      0x4c,
      0x75,
      0x61, // \x1bLua
      0x52, // version 5.2
      0x00, // official format
      0x01, // little endian
      0x04, // sizeof(int) = 4
      0x08, // sizeof(size_t) = 8
      0x04, // sizeof(Instruction) = 4
      0x08, // sizeof(lua_Number) = 8
      0x00, // integral flag = 0
      0x19,
      0x93,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // LUAC_TAIL
    ];

    // Main proto: line 0..0, 0 params, vararg=1, stack=2
    chunk.push(0, 0, 0, 0); // lineDefined
    chunk.push(0, 0, 0, 0); // lastLine
    chunk.push(0); // numParams
    chunk.push(1); // isVararg
    chunk.push(2); // maxStackSize

    // Instructions: 1 RETURN instruction
    // OP_RETURN = 31, A=0, B=1 -> 31 | (1 << 23)
    const rawInstr = 31 | (1 << 23);
    chunk.push(1, 0, 0, 0); // codeLen = 1
    chunk.push(
      rawInstr & 0xff,
      (rawInstr >>> 8) & 0xff,
      (rawInstr >>> 16) & 0xff,
      (rawInstr >>> 24) & 0xff,
    );

    // Constants: 0
    chunk.push(0, 0, 0, 0);
    // Sub-prototypes: 0
    chunk.push(0, 0, 0, 0);
    // Upvalues: 1 (_ENV)
    chunk.push(1, 0, 0, 0);
    chunk.push(1, 0); // in_stack=1, idx=0

    const bytes = new Uint8Array(chunk);
    expect(isLua52Bytecode(bytes)).toBeTrue();

    const audit = auditLua52Bytecode(bytes);
    expect(audit.header.version).toBe("5.2");
    expect(audit.header.sizeSizeT).toBe(8);
    expect(audit.totalInstructions).toBe(1);
    expect(audit.mainPrototype.instructions[0].opcode).toBe("RETURN");

    // Transcode x64 (size_t=8) -> wasm32 (size_t=4)
    const wasm32Bytes = transcodeLua52Bytecode(bytes, 4, 4);
    const wasmAudit = auditLua52Bytecode(wasm32Bytes);
    expect(wasmAudit.header.sizeSizeT).toBe(4);
    expect(wasmAudit.totalInstructions).toBe(1);
    expect(wasmAudit.mainPrototype.instructions[0].opcode).toBe("RETURN");
  });

  test("analyzeLua52Source extracts symbols, ::labels::, and detects Lua 5.1 deprecations", () => {
    const code = `
-- Sovereign Lua 5.2 Header
local _ENV = _ENV
local M = {}

function M:calculate_power(base)
  if base ~= 0 then
    goto finish
  end
  ::finish::
  return base * 2
end

local function legacy_test()
  local a, b = unpack({ 1, 2 })
end
`;

    const ast = analyzeLua52Source("test.lua", code);
    expect(ast.symbols.some((s) => s.name === "_ENV")).toBeTrue();
    expect(ast.symbols.some((s) => s.name === "M:calculate_power")).toBeTrue();
    expect(ast.symbols.some((s) => s.name === "legacy_test")).toBeTrue();
    expect(ast.labels).toContain("finish");

    // Linter should detect unpack() deprecation
    expect(
      ast.findings.some((f) => f.ruleId === "LUA52-TABLE-UNPACK"),
    ).toBeTrue();
  });

  test("Lua52LanguageServer provides diagnostics, symbols and completions", () => {
    const lsp = new Lua52LanguageServer();
    const uri = "file:///project/main.lua";
    const src = `
local _ENV = _ENV
local function add(a, b)
  return bit32.bxor(a, b)
end
`;

    const diags = lsp.openDocument(uri, src);
    expect(Array.isArray(diags)).toBeTrue();

    const symbols = lsp.getSymbols(uri);
    expect(symbols.some((s) => s.name === "add")).toBeTrue();

    const completions = lsp.getCompletions(uri, { line: 3, character: 2 });
    expect(completions.some((c) => c.label === "bit32")).toBeTrue();
    expect(completions.some((c) => c.label === "table.pack")).toBeTrue();

    const luarc = Lua52LanguageServer.generateLuarcConfig();
    expect(luarc).toContain('"runtime.version": "Lua 5.2"');
    expect(luarc).toContain('"bit32": "enable"');
  });

  test("transformLuaToModule generates valid ES module source with AST and runner", () => {
    const src = "local x = 42\nreturn x";
    const mod = transformLuaToModule("sample.lua", src);
    expect(mod).toContain("export const rawSource");
    expect(mod).toContain("export const ast");
    expect(mod).toContain("export function createRunner");
  });
});
