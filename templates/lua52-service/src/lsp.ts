// SPDX-License-Identifier: Apache-2.0
// Lightweight Language Server Protocol (LSP) Server for Lua 5.2

import { getLuaAst, type LuaAstReport } from "./ast";

export interface Diagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: 1 | 2 | 3 | 4; // 1: Error, 2: Warning, 3: Info, 4: Hint
  message: string;
  source: string;
}

export class Lua52LanguageServer {
  private documents = new Map<string, string>();
  private astCache = new Map<string, LuaAstReport>();

  public onDocumentOpen(uri: string, text: string): Diagnostic[] {
    this.documents.set(uri, text);
    const ast = getLuaAst(uri, text);
    this.astCache.set(uri, ast);
    return this.validateLua52(text);
  }

  public onDocumentChange(uri: string, text: string): Diagnostic[] {
    return this.onDocumentOpen(uri, text);
  }

  public getDocumentSymbols(uri: string) {
    const ast = this.astCache.get(uri);
    if (!ast) return [];
    return ast.symbols.map((sym) => ({
      name: sym.name,
      kind: sym.kind === "Method" ? 6 : 12, // LSP SymbolKind.Method : SymbolKind.Function
      range: {
        start: { line: sym.span.start_line - 1, character: sym.span.start_col },
        end: { line: sym.span.end_line - 1, character: sym.span.end_col },
      },
      selectionRange: {
        start: { line: sym.span.start_line - 1, character: sym.span.start_col },
        end: { line: sym.span.end_line - 1, character: sym.span.end_col },
      },
    }));
  }

  public getHover(uri: string, line: number, character: number) {
    const text = this.documents.get(uri) || "";
    const lines = text.split("\n");
    const targetLine = lines[line] || "";

    if (targetLine.includes("_ENV")) {
      return {
        contents: {
          kind: "markdown",
          value:
            "**Lua 5.2 `_ENV`**: The first upvalue of any chunk or function, replacing `setfenv`/`getfenv`. Any free name `x` is syntactic sugar for `_ENV.x`.",
        },
      };
    }

    if (targetLine.includes("goto") || targetLine.includes("::")) {
      return {
        contents: {
          kind: "markdown",
          value:
            "**Lua 5.2 `goto` statement**: Jumps to label `::name::`. Cannot jump into local scope or inside another function.",
        },
      };
    }

    if (targetLine.includes("bit32")) {
      return {
        contents: {
          kind: "markdown",
          value:
            "**Lua 5.2 `bit32` Library**: Official 32-bit bitwise library (`band`, `bor`, `bxor`, `bnot`, `lshift`, `rshift`, `arshift`).",
        },
      };
    }

    return null;
  }

  public validateLua52(text: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Deprecated 5.1 globals
      if (line.includes("setfenv(")) {
        diagnostics.push({
          range: {
            start: { line: i, character: line.indexOf("setfenv") },
            end: { line: i, character: line.indexOf("setfenv") + 7 },
          },
          severity: 1,
          message:
            "setfenv is removed in Lua 5.2. Use lexical '_ENV' scoping instead.",
          source: "lua52-lsp",
        });
      }

      if (line.includes("getfenv(")) {
        diagnostics.push({
          range: {
            start: { line: i, character: line.indexOf("getfenv") },
            end: { line: i, character: line.indexOf("getfenv") + 7 },
          },
          severity: 1,
          message: "getfenv is removed in Lua 5.2. Use '_ENV' table instead.",
          source: "lua52-lsp",
        });
      }

      if (line.includes("unpack(") && !line.includes("table.unpack(")) {
        diagnostics.push({
          range: {
            start: { line: i, character: line.indexOf("unpack") },
            end: { line: i, character: line.indexOf("unpack") + 6 },
          },
          severity: 2,
          message:
            "Global 'unpack' is deprecated in Lua 5.2. Use 'table.unpack' instead.",
          source: "lua52-lsp",
        });
      }

      if (line.includes("module(")) {
        diagnostics.push({
          range: {
            start: { line: i, character: line.indexOf("module") },
            end: { line: i, character: line.indexOf("module") + 6 },
          },
          severity: 1,
          message:
            "'module()' is removed in Lua 5.2. Return a table directly from your module.",
          source: "lua52-lsp",
        });
      }
    }

    return diagnostics;
  }
}

// Standalone LSP stdio runner if executed as CLI
if (import.meta.main) {
  const server = new Lua52LanguageServer();
  const sampleUri = "file:///sample.lua";
  const sampleCode = `
local function old_code()
    local x = unpack({1, 2, 3})
    return x
end
`;
  const diags = server.onDocumentOpen(sampleUri, sampleCode);
  console.log("Lua 5.2 LSP Diagnostics sample:", diags);
}
