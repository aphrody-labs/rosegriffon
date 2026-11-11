// SPDX-License-Identifier: Apache-2.0
import { rmSync, mkdirSync } from "node:fs";

try {
  rmSync("./dist", { recursive: true, force: true });
} catch {}
mkdirSync("./dist", { recursive: true });

// Build index, bun, next, vm, bytecode, ast, lsp, loader
const result = await Bun.build({
  entrypoints: [
    "./src/index.ts",
    "./src/bun.ts",
    "./src/next.ts",
    "./src/vm.ts",
    "./src/bytecode.ts",
    "./src/ast.ts",
    "./src/lsp.ts",
    "./src/loader.ts",
  ],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  minify: false,
  sourcemap: "external",
});

if (!result.success) {
  console.error("Build failed:", result.logs);
  process.exit(1);
}

// Generate type declaration files
const declIndex = `// SPDX-License-Identifier: Apache-2.0
export * from "./ast";
export * from "./bytecode";
export * from "./bun";
export * from "./next";
export * from "./vm";
export * from "./lsp";
export * from "./loader";
`;

const declBun = `// SPDX-License-Identifier: Apache-2.0
export interface BunPluginLuaOptions {
  mode?: "source" | "ast" | "bytecode" | "eval";
  sandbox?: Record<string, any>;
}
export declare function bunPluginLua(options?: BunPluginLuaOptions): {
  name: string;
  setup(build: any): void;
};
export declare function registerBunLuaPlugin(options?: BunPluginLuaOptions): void;
`;

const declNext = `// SPDX-License-Identifier: Apache-2.0
export interface NextLuaPluginOptions {
  includeBytecode?: boolean;
  mode?: "raw" | "module";
}
export declare function withLua(nextConfig?: any, pluginOptions?: NextLuaPluginOptions): any;
`;

const declVm = `// SPDX-License-Identifier: Apache-2.0
export interface Lua52RunResult {
  success: boolean;
  returnValue?: any;
  error?: string;
  output: string[];
}
export declare class Lua52VM {
  constructor(customEnv?: Record<string, any>);
  getEnvironment(): Record<string, any>;
  execute(luaCode: string): Lua52RunResult;
}
`;

const declBytecode = `// SPDX-License-Identifier: Apache-2.0
export interface LuaBytecodeHeader {
  version: string;
  isOfficialFormat: boolean;
  isLittleEndian: boolean;
  sizeInt: number;
  sizeSizeT: number;
  sizeInstruction: number;
  sizeLuaNumber: number;
  isIntegralNumber: boolean;
}
export interface LuaDisassembledInstruction {
  pc: number;
  raw: number;
  opcode: string;
  a: number;
  b?: number;
  c?: number;
  bx?: number;
  sbx?: number;
  ax?: number;
  formatted: string;
}
export interface LuaGlobalAccess {
  pc: number;
  kind: "read" | "write";
  symbol: string;
  protoPath: string;
}
export interface Lua52BytecodeAudit {
  header: LuaBytecodeHeader;
  totalInstructions: number;
  totalPrototypes: number;
  globalAccesses: LuaGlobalAccess[];
  mainPrototype: any;
}
export declare function isLua52Bytecode(bytes: Uint8Array): boolean;
export declare function auditLua52Bytecode(bytes: Uint8Array): Lua52BytecodeAudit;
export declare function transcodeLua52Bytecode(sourceBytes: Uint8Array, targetIntSize?: number, targetSizeTSize?: number): Uint8Array;
`;

const declAst = `// SPDX-License-Identifier: Apache-2.0
export interface AstSpan {
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
}
export interface LuaSymbol {
  name: string;
  kind: string;
  isLocal: boolean;
  span: AstSpan;
  signature?: string;
}
export interface Lua52AstSummary {
  path: string;
  lineCount: number;
  symbols: LuaSymbol[];
  imports: any[];
  labels: string[];
  findings: any[];
}
export declare function analyzeLua52Source(filePath: string, source: string): Lua52AstSummary;
`;

const declLsp = `// SPDX-License-Identifier: Apache-2.0
export declare class Lua52LanguageServer {
  openDocument(uri: string, text: string): any[];
  changeDocument(uri: string, text: string): any[];
  getSymbols(uri: string): any[];
  getCompletions(uri: string, position: any): any[];
  getHover(uri: string, position: any): any;
  static generateLuarcConfig(): string;
}
`;

const declLoader = `// SPDX-License-Identifier: Apache-2.0
export declare function transformLuaToModule(filePath: string, content: string | Buffer | Uint8Array): string;
export default function webpackLoader(content: string | Buffer): string;
`;

await Bun.write("./dist/index.d.ts", declIndex);
await Bun.write("./dist/bun.d.ts", declBun);
await Bun.write("./dist/next.d.ts", declNext);
await Bun.write("./dist/vm.d.ts", declVm);
await Bun.write("./dist/bytecode.d.ts", declBytecode);
await Bun.write("./dist/ast.d.ts", declAst);
await Bun.write("./dist/lsp.d.ts", declLsp);
await Bun.write("./dist/loader.d.ts", declLoader);

console.log("Successfully compiled @rosegriffon/lua-plugin to ./dist");
