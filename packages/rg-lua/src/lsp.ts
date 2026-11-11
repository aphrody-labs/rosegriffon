// SPDX-License-Identifier: Apache-2.0
// Embedded Lua 5.2 Language Server Protocol (LSP) Engine & Diagnostics for RoseGriffon

import { analyzeLua52Source, type Lua52AstSummary, type LuaSymbol } from "./ast";

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspDiagnostic {
  range: LspRange;
  severity: 1 | 2 | 3 | 4; // 1: Error, 2: Warning, 3: Info, 4: Hint
  source: string;
  message: string;
}

export interface LspCompletionItem {
  label: string;
  kind: number; // 3: Function, 6: Variable, 7: Class, 9: Module, 14: Keyword
  detail?: string;
  documentation?: string;
}

export interface LspHover {
  contents: {
    kind: "markdown" | "plaintext";
    value: string;
  };
}

export class Lua52LanguageServer {
  private documents = new Map<string, string>();
  private astCache = new Map<string, Lua52AstSummary>();

  public openDocument(uri: string, text: string): LspDiagnostic[] {
    this.documents.set(uri, text);
    const ast = analyzeLua52Source(uri, text);
    this.astCache.set(uri, ast);
    return this.getDiagnostics(ast);
  }

  public changeDocument(uri: string, text: string): LspDiagnostic[] {
    return this.openDocument(uri, text);
  }

  public getDiagnostics(ast: Lua52AstSummary): LspDiagnostic[] {
    return ast.findings.map((f) => ({
      range: {
        start: { line: f.line - 1, character: 0 },
        end: { line: f.line - 1, character: 80 },
      },
      severity: f.severity === "error" ? 1 : f.severity === "warn" ? 2 : 3,
      source: "Lua52-LSP",
      message: f.message,
    }));
  }

  public getSymbols(uri: string): LuaSymbol[] {
    return this.astCache.get(uri)?.symbols || [];
  }

  public getCompletions(uri: string, _position: LspPosition): LspCompletionItem[] {
    const ast = this.astCache.get(uri);
    const items: LspCompletionItem[] = [
      // Lua 5.2 Keywords
      { label: "local", kind: 14, detail: "keyword" },
      { label: "function", kind: 14, detail: "keyword" },
      { label: "return", kind: 14, detail: "keyword" },
      { label: "goto", kind: 14, detail: "keyword" },
      { label: "then", kind: 14, detail: "keyword" },
      { label: "end", kind: 14, detail: "keyword" },
      // Lua 5.2 Standard Libraries
      { label: "bit32", kind: 9, detail: "PUC-Rio Lua 5.2 32-bit bitwise library" },
      { label: "bit32.band", kind: 3, detail: "bit32.band(...): number" },
      { label: "bit32.bxor", kind: 3, detail: "bit32.bxor(...): number" },
      { label: "bit32.bor", kind: 3, detail: "bit32.bor(...): number" },
      { label: "bit32.bnot", kind: 3, detail: "bit32.bnot(x): number" },
      { label: "table.pack", kind: 3, detail: "table.pack(...): table" },
      { label: "table.unpack", kind: 3, detail: "table.unpack(list [, i [, j]]): ..." },
      { label: "_ENV", kind: 6, detail: "Lexical environment table" },
    ];

    if (ast) {
      for (const sym of ast.symbols) {
        items.push({
          label: sym.name,
          kind: sym.kind === "function" || sym.kind === "method" ? 3 : sym.kind === "module" ? 9 : 6,
          detail: sym.signature || `${sym.kind} ${sym.name}`,
        });
      }
    }

    return items;
  }

  public getHover(uri: string, position: LspPosition): LspHover | null {
    const text = this.documents.get(uri);
    if (!text) return null;

    const lines = text.split(/\r?\n/);
    const line = lines[position.line];
    if (!line) return null;

    const wordMatch = line.match(/\b([A-Za-z_][A-Za-z0-9_.]*)\b/g);
    if (!wordMatch) return null;

    for (const w of wordMatch) {
      if (w === "bit32") {
        return {
          contents: {
            kind: "markdown",
            value: "### `bit32`\nStandard PUC-Rio Lua 5.2 bitwise manipulation library operating on unsigned 32-bit integers.",
          },
        };
      }
      if (w === "table.pack") {
        return {
          contents: {
            kind: "markdown",
            value: "### `table.pack(...)`\nReturns a new table with all arguments stored into keys 1, 2, etc. and with a field `n` with the total number of arguments.",
          },
        };
      }
      if (w === "_ENV") {
        return {
          contents: {
            kind: "markdown",
            value: "### `_ENV`\nLexical environment table introduced in Lua 5.2 to replace global tables and `setfenv`/`getfenv`.",
          },
        };
      }
    }

    return null;
  }

  public static generateLuarcConfig(): string {
    return JSON.stringify(
      {
        $schema: "https://raw.githubusercontent.com/LuaLS/vscode-lua/master/setting/schema.json",
        "runtime.version": "Lua 5.2",
        "runtime.builtin": {
          bit32: "enable",
          utf8: "disable",
        },
        "diagnostics.globals": ["_ENV"],
        "workspace.checkThirdParty": false,
      },
      null,
      2
    );
  }
}
