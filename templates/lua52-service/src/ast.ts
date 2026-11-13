// SPDX-License-Identifier: Apache-2.0
// Lua 5.2 AST extraction using depot native Rust FFI

import { dlopen, FFIType, CString } from "bun:ffi";
import { existsSync } from "node:fs";

export interface LuaSymbol {
  name: string;
  kind: string;
  span: {
    start_line: number;
    end_line: number;
    start_col: number;
    end_col: number;
  };
}

export interface LuaAstReport {
  path: string;
  language: string;
  symbols: LuaSymbol[];
  calls: Array<{ callee: string; caller_scope?: string }>;
  imports: Array<{ source_module: string }>;
  parse_errors: number;
  line_count: number;
}

const DLL_PATHS = [
  "C:/Users/aphro/.local/bin/depot_ffi.dll",
  "C:/src/crates/depot/target/release/depot_ffi.dll",
];

function findDll(): string | null {
  for (const p of DLL_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

let ffiSymbols: any = null;

export function getLuaAst(filePath: string, content: string): LuaAstReport {
  const dllPath = findDll();
  if (dllPath && !ffiSymbols) {
    try {
      const lib = dlopen(dllPath, {
        depot_treesitter_symbols_json: {
          args: [FFIType.cstring, FFIType.cstring],
          returns: FFIType.ptr,
        },
        depot_free_string: {
          args: [FFIType.ptr],
          returns: FFIType.void,
        },
      });
      ffiSymbols = lib.symbols;
    } catch {
      // Fallback
    }
  }

  if (ffiSymbols) {
    const pPath = Buffer.from(filePath + "\0", "utf8");
    const pContent = Buffer.from(content + "\0", "utf8");
    const ptr = ffiSymbols.depot_treesitter_symbols_json(pPath, pContent);
    if (ptr) {
      const jsonStr = new CString(ptr).toString();
      ffiSymbols.depot_free_string(ptr);
      try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed.error) return parsed as LuaAstReport;
      } catch {}
    }
  }

  // Fast pure-TypeScript fallback parser
  const lines = content.split("\n");
  const symbols: LuaSymbol[] = [];
  const calls: Array<{ callee: string }> = [];
  const imports: Array<{ source_module: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Function declarations
    const fnMatch = line.match(
      /^(?:local\s+)?function\s+([a-zA-Z0-9_.:]+)\s*\(/,
    );
    if (fnMatch) {
      symbols.push({
        name: fnMatch[1],
        kind: fnMatch[1].includes(":") ? "Method" : "Function",
        span: {
          start_line: i + 1,
          end_line: i + 1,
          start_col: 0,
          end_col: line.length,
        },
      });
    }
    // Requires
    const reqMatch = line.match(/require\s*\(?["']([^"']+)["']\)?/);
    if (reqMatch) {
      imports.push({ source_module: reqMatch[1] });
    }
    // Calls
    const callMatch = line.match(/([a-zA-Z0-9_]+)\s*\(/);
    if (
      callMatch &&
      callMatch[1] !== "function" &&
      callMatch[1] !== "if" &&
      callMatch[1] !== "for"
    ) {
      calls.push({ callee: callMatch[1] });
    }
  }

  return {
    path: filePath,
    language: "lua",
    symbols,
    calls,
    imports,
    parse_errors: 0,
    line_count: lines.length,
  };
}

if (import.meta.main) {
  const target = process.argv[2] || "src/main.lua";
  const file = Bun.file(target);
  file.text().then((code) => {
    const report = getLuaAst(target, code);
    console.log(JSON.stringify(report, null, 2));
  });
}
