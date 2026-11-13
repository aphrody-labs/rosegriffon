// SPDX-License-Identifier: Apache-2.0
import { expect, test, describe } from "bun:test";
import { getLuaAst } from "../src/ast";
import { Lua52LanguageServer } from "../src/lsp";
import { auditLuaBytecode } from "../src/rea";

describe("Lua 5.2 Service Template Tests", () => {
  const luaCode = `
local bit32 = require("bit32")

local function calculate_bonus(score)
    local val = bit32.band(score, 0xFFFF)
    return val * 2
end

function Player:on_save()
    self.bonus = calculate_bonus(self.score)
end
`;

  test("AST extraction finds functions, methods and modules", () => {
    const ast = getLuaAst("test.lua", luaCode);
    expect(ast.language).toBe("lua");
    expect(ast.symbols.length).toBeGreaterThanOrEqual(2);
    expect(ast.symbols.some((s) => s.name === "calculate_bonus")).toBeTrue();
    expect(ast.symbols.some((s) => s.name === "Player:on_save")).toBeTrue();
    expect(ast.imports.some((i) => i.source_module === "bit32")).toBeTrue();
  });

  test("LSP Diagnostics flags deprecated Lua 5.1 constructs", () => {
    const legacyCode = `
local function legacy()
    setfenv(1, {})
    local x = unpack({10, 20})
    return x
end
`;
    const lsp = new Lua52LanguageServer();
    const diags = lsp.onDocumentOpen("file:///legacy.lua", legacyCode);
    expect(diags.length).toBeGreaterThanOrEqual(2);
    expect(
      diags.some((d) => d.message.includes("setfenv is removed")),
    ).toBeTrue();
    expect(
      diags.some((d) => d.message.includes("Global 'unpack' is deprecated")),
    ).toBeTrue();
  });

  test("LSP Hover provides Lua 5.2 context for _ENV, goto, bit32", () => {
    const lsp = new Lua52LanguageServer();
    lsp.onDocumentOpen(
      "file:///sample.lua",
      "local _ENV = {}\ngoto my_label\nlocal b = bit32.band(1, 2)",
    );
    const hoverEnv = lsp.getHover("file:///sample.lua", 0, 8);
    expect(hoverEnv).not.toBeNull();
    expect(hoverEnv?.contents.value).toContain("_ENV");

    const hoverGoto = lsp.getHover("file:///sample.lua", 1, 2);
    expect(hoverGoto).not.toBeNull();
    expect(hoverGoto?.contents.value).toContain("goto");
  });

  test("Bevy game script extracts lifecycle hooks and validates without deprecations", async () => {
    const scriptPath = `${import.meta.dir}/../src/game_script.lua`;
    const scriptCode = await Bun.file(scriptPath).text();
    const ast = getLuaAst("game_script.lua", scriptCode);

    expect(ast.symbols.some((s) => s.name === "on_init")).toBeTrue();
    expect(ast.symbols.some((s) => s.name === "on_update")).toBeTrue();
    expect(ast.symbols.some((s) => s.name === "on_collision")).toBeTrue();

    const lsp = new Lua52LanguageServer();
    const diags = lsp.onDocumentOpen("file:///game_script.lua", scriptCode);
    expect(diags.length).toBe(0);
  });

  test("auditLuaBytecode audits Lua 5.2 compiled bytecode via depot_ffi.dll", async () => {
    const fixturePath = `${import.meta.dir}/fixture.luac`;
    const chunk = new Uint8Array([
      0x1b, 0x4c, 0x75, 0x61, 0x52, 0x00, 0x01, 0x04, 0x08, 0x04, 0x08, 0x00,
      0x19, 0x93, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0,
      0, 0, 31, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    await Bun.write(fixturePath, chunk);

    const report = auditLuaBytecode(fixturePath);
    expect(report).not.toBeNull();
    expect(report?.is_lua_bytecode).toBe(true);
    expect(report?.lua_bytecode?.header.version).toBe("5.2");
    expect(report?.lua_bytecode?.total_instructions).toBe(1);

    try {
      await (await import("node:fs/promises")).unlink(fixturePath);
    } catch {}
  });
});
