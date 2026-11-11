// SPDX-License-Identifier: Apache-2.0
import { rmSync, mkdirSync } from "node:fs";

try {
  rmSync("./dist", { recursive: true, force: true });
} catch {}
mkdirSync("./dist", { recursive: true });

// Build index, bun, next, vm
const result = await Bun.build({
  entrypoints: [
    "./src/index.ts",
    "./src/bun.ts",
    "./src/next.ts",
    "./src/vm.ts",
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
export * from "./bun";
export * from "./next";
export * from "./vm";
`;

const declBun = `// SPDX-License-Identifier: Apache-2.0
export interface BunPluginLuaOptions {
  mode?: "source" | "ast" | "eval";
  sandbox?: Record<string, any>;
}
export declare function bunPluginLua(options?: BunPluginLuaOptions): {
  name: string;
  setup(build: any): void;
};
`;

const declNext = `// SPDX-License-Identifier: Apache-2.0
export interface NextLuaPluginOptions {
  includeBytecode?: boolean;
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
  execute(code: string): Lua52RunResult;
}
`;

await Bun.write("./dist/index.d.ts", declIndex);
await Bun.write("./dist/bun.d.ts", declBun);
await Bun.write("./dist/next.d.ts", declNext);
await Bun.write("./dist/vm.d.ts", declVm);

console.log("Successfully compiled @rosegriffon/lua-plugin to ./dist");
