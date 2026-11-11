// SPDX-License-Identifier: Apache-2.0
import { expect, test, describe } from "bun:test";
import { getLuaAst } from "../src/ast";
import { Lua52LanguageServer } from "../src/lsp";

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
    expect(diags.some((d) => d.message.includes("setfenv is removed"))).toBeTrue();
    expect(diags.some((d) => d.message.includes("Global 'unpack' is deprecated"))).toBeTrue();
  });

  test("LSP Hover provides Lua 5.2 context for _ENV, goto, bit32", () => {
    const lsp = new Lua52LanguageServer();
    lsp.onDocumentOpen("file:///sample.lua", "local _ENV = {}\ngoto my_label\nlocal b = bit32.band(1, 2)");
    const hoverEnv = lsp.getHover("file:///sample.lua", 0, 8);
    expect(hoverEnv).not.toBeNull();
    expect(hoverEnv?.contents.value).toContain("_ENV");

    const hoverGoto = lsp.getHover("file:///sample.lua", 1, 2);
    expect(hoverGoto).not.toBeNull();
    expect(hoverGoto?.contents.value).toContain("goto");
  });
});
