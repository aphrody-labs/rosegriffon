// SPDX-License-Identifier: Apache-2.0
// Pure-TypeScript Lua 5.2 AST, Symbol Extraction & Static Analyzer

export interface AstSpan {
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
}

export type LuaSymbolKind =
  "function" | "method" | "variable" | "label" | "module" | "constant";

export interface LuaSymbol {
  name: string;
  kind: LuaSymbolKind;
  isLocal: boolean;
  span: AstSpan;
  signature?: string;
  parentScope?: string;
}

export interface LuaImport {
  module: string;
  type: "require" | "dofile" | "loadfile" | "include";
  line: number;
  raw: string;
}

export interface LuaFinding {
  ruleId: string;
  severity: "error" | "warn" | "info";
  message: string;
  line: number;
}

export interface Lua52AstSummary {
  path: string;
  lineCount: number;
  symbols: LuaSymbol[];
  imports: LuaImport[];
  labels: string[];
  findings: LuaFinding[];
}

export function analyzeLua52Source(
  filePath: string,
  source: string,
): Lua52AstSummary {
  const lines = source.split(/\r?\n/);
  const symbols: LuaSymbol[] = [];
  const imports: LuaImport[] = [];
  const labels: string[] = [];
  const findings: LuaFinding[] = [];

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    let line = lines[i];

    if (inBlockComment) {
      if (line.includes("]]")) {
        inBlockComment = false;
        line = line.substring(line.indexOf("]]") + 2);
      } else {
        continue;
      }
    }

    if (line.includes("--[[")) {
      inBlockComment = true;
      line = line.substring(0, line.indexOf("--[["));
    } else if (line.includes("--")) {
      line = line.substring(0, line.indexOf("--"));
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    // 1. Labels: ::label_name::
    const labelMatches = trimmed.matchAll(/::([A-Za-z_][A-Za-z0-9_]*)::/g);
    for (const m of labelMatches) {
      const name = m[1];
      labels.push(name);
      symbols.push({
        name,
        kind: "label",
        isLocal: true,
        span: {
          startLine: lineNum,
          endLine: lineNum,
          startCol: 1,
          endCol: line.length,
        },
      });
    }

    // 2. Goto detection
    if (/\bgoto\s+([A-Za-z_][A-Za-z0-9_]*)/.test(trimmed)) {
      // Valid Lua 5.2 goto
    }

    // 3. Local function: local function name(args)
    const localFnMatch = trimmed.match(
      /^local\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/,
    );
    if (localFnMatch) {
      symbols.push({
        name: localFnMatch[1],
        kind: "function",
        isLocal: true,
        span: {
          startLine: lineNum,
          endLine: lineNum,
          startCol: 1,
          endCol: line.length,
        },
        signature: `local function ${localFnMatch[1]}(${localFnMatch[2]})`,
      });
    }

    // 4. Global function or method: function Object:method(args) or function Object.method(args)
    const fnMatch = trimmed.match(
      /^function\s+([A-Za-z_][A-Za-z0-9_]*(?:[.:][A-Za-z_][A-Za-z0-9_]*)?)\s*\(([^)]*)\)/,
    );
    if (fnMatch) {
      const fullName = fnMatch[1];
      const isMethod = fullName.includes(":");
      symbols.push({
        name: fullName,
        kind: isMethod ? "method" : "function",
        isLocal: false,
        span: {
          startLine: lineNum,
          endLine: lineNum,
          startCol: 1,
          endCol: line.length,
        },
        signature: `function ${fullName}(${fnMatch[2]})`,
      });
    }

    // 5. Module table declaration: local M = {} or local Module = {}
    const modMatch = trimmed.match(
      /^local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{\s*\}/,
    );
    if (modMatch) {
      symbols.push({
        name: modMatch[1],
        kind: "module",
        isLocal: true,
        span: {
          startLine: lineNum,
          endLine: lineNum,
          startCol: 1,
          endCol: line.length,
        },
      });
    }

    // 6. _ENV lexical scope declaration: local _ENV = ...
    const envMatch = trimmed.match(/^local\s+_ENV\b/);
    if (envMatch) {
      symbols.push({
        name: "_ENV",
        kind: "variable",
        isLocal: true,
        span: {
          startLine: lineNum,
          endLine: lineNum,
          startCol: 1,
          endCol: line.length,
        },
        signature: "local _ENV (Lua 5.2 lexical environment)",
      });
    }

    // 7. Imports: require("..."), include("..."), dofile("...")
    const reqMatches = trimmed.matchAll(
      /\b(require|include|dofile|loadfile)\s*(?:\(\s*["']([^"']+)["']\s*\)|["']([^"']+)["'])/g,
    );
    for (const rm of reqMatches) {
      const impType = rm[1] as any;
      const modName = rm[2] || rm[3];
      imports.push({
        module: modName,
        type: impType,
        line: lineNum,
        raw: rm[0],
      });
    }

    // 8. Lua 5.1 Deprecation Linter
    if (/\bsetfenv\s*\(/.test(trimmed)) {
      findings.push({
        ruleId: "LUA52-NO-SETFENV",
        severity: "error",
        message:
          "setfenv() was removed in Lua 5.2; use lexical _ENV or debug.setupvalue instead.",
        line: lineNum,
      });
    }
    if (/\bgetfenv\s*\(/.test(trimmed)) {
      findings.push({
        ruleId: "LUA52-NO-GETFENV",
        severity: "error",
        message:
          "getfenv() was removed in Lua 5.2; inspect _ENV directly or use debug.getupvalue.",
        line: lineNum,
      });
    }
    if (/\bmodule\s*\(/.test(trimmed)) {
      findings.push({
        ruleId: "LUA52-NO-MODULE",
        severity: "error",
        message:
          "module() was deprecated/removed; return a local table 'return M' instead.",
        line: lineNum,
      });
    }
    if (/(?:^|[^a-zA-Z0-9_:.])unpack\s*\(/.test(trimmed)) {
      findings.push({
        ruleId: "LUA52-TABLE-UNPACK",
        severity: "warn",
        message:
          "Global unpack() is deprecated in Lua 5.2; use table.unpack().",
        line: lineNum,
      });
    }
  }

  return {
    path: filePath,
    lineCount: lines.length,
    symbols,
    imports,
    labels,
    findings,
  };
}
