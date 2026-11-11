// SPDX-License-Identifier: Apache-2.0
// Universal Webpack 5 & Next.js 16 Turbopack Loader for Lua 5.2 files (.lua, .luac, .lua.bin)

import { analyzeLua52Source } from "./ast";
import { auditLua52Bytecode, isLua52Bytecode } from "./bytecode";

export function transformLuaToModule(filePath: string, content: string | Buffer | Uint8Array): string {
  const isBinary =
    typeof content !== "string" && (content instanceof Uint8Array || Buffer.isBuffer(content));

  if (isBinary) {
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
    if (isLua52Bytecode(bytes)) {
      const audit = auditLua52Bytecode(bytes);
      return `// Lua 5.2 Compiled Bytecode Module
export const isBytecode = true;
export const header = ${JSON.stringify(audit.header)};
export const totalInstructions = ${audit.totalInstructions};
export const totalPrototypes = ${audit.totalPrototypes};
export const globalAccesses = ${JSON.stringify(audit.globalAccesses)};
export const mainPrototype = ${JSON.stringify(audit.mainPrototype)};
export default {
  header,
  totalInstructions,
  totalPrototypes,
  globalAccesses,
  mainPrototype,
};
`;
    }
  }

  const source = typeof content === "string" ? content : new TextDecoder().decode(content);
  const ast = analyzeLua52Source(filePath, source);

  return `// Lua 5.2 Source Module
export const rawSource = ${JSON.stringify(source)};
export const ast = ${JSON.stringify(ast)};
export const isBytecode = false;

export function createRunner(customEnv = {}) {
  const { Lua52VM } = require("@rosegriffon/lua-plugin/vm");
  const vm = new Lua52VM(customEnv);
  return {
    vm,
    execute: () => vm.execute(rawSource),
  };
}

export default rawSource;
`;
}

// CJS export for Webpack and Turbopack loader runner
export default function webpackLoader(this: any, content: string | Buffer): string {
  const filePath = this?.resourcePath || "script.lua";
  return transformLuaToModule(filePath, content);
}
