// SPDX-License-Identifier: Apache-2.0
// Lua 5.2 REA (Runtime Execution Analysis) Inspector

import { dlopen, FFIType, CString } from "bun:ffi";
import { existsSync } from "node:fs";

export interface LuaBytecodeAuditReport {
  path: string;
  is_lua_bytecode: boolean;
  lua_bytecode?: {
    header: {
      version: string;
      is_official_format: boolean;
      is_little_endian: boolean;
      size_int: number;
      size_size_t: number;
      size_instruction: number;
    };
    main_prototype: {
      instruction_count: number;
      instructions: Array<{
        pc: number;
        opcode: string;
        formatted: string;
      }>;
      constants: string[];
    };
    total_prototypes: number;
    total_instructions: number;
  };
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

let ffiAudit: any = null;

export function auditLuaBytecode(filePath: string): LuaBytecodeAuditReport | null {
  const dllPath = findDll();
  if (dllPath && !ffiAudit) {
    try {
      const lib = dlopen(dllPath, {
        depot_re_audit_json: {
          args: [FFIType.cstring],
          returns: FFIType.ptr,
        },
        depot_free_string: {
          args: [FFIType.ptr],
          returns: FFIType.void,
        },
      });
      ffiAudit = lib.symbols;
    } catch {}
  }

  if (ffiAudit) {
    const pPath = Buffer.from(filePath + "\0", "utf8");
    const ptr = ffiAudit.depot_re_audit_json(pPath);
    if (ptr) {
      const jsonStr = new CString(ptr).toString();
      ffiAudit.depot_free_string(ptr);
      try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed.error) return parsed as LuaBytecodeAuditReport;
      } catch {}
    }
  }

  return null;
}
