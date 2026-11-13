// SPDX-License-Identifier: Apache-2.0
// Bun runtime & bundler plugin for importing Lua 5.2 files (.lua, .luac, .lua.bin)

import { analyzeLua52Source } from "./ast";
import { auditLua52Bytecode, isLua52Bytecode } from "./bytecode";

export interface BunPluginLuaOptions {
  mode?: "source" | "ast" | "bytecode" | "eval";
  sandbox?: Record<string, any>;
}

export function bunPluginLua(options: BunPluginLuaOptions = {}) {
  const mode = options.mode || "source";

  return {
    name: "rosegriffon-bun-plugin-lua",
    setup(build: any) {
      // 1. Text .lua files
      build.onLoad({ filter: /\.lua$/ }, async (args: { path: string }) => {
        const file = (globalThis as any).Bun?.file(args.path);
        const source = file
          ? await file.text()
          : await (
              await import("node:fs/promises")
            ).readFile(args.path, "utf8");

        let exportedContent = "";

        if (mode === "source") {
          exportedContent = `export default ${JSON.stringify(source)};\nexport const rawSource = ${JSON.stringify(source)};`;
        } else if (mode === "ast") {
          const ast = analyzeLua52Source(args.path, source);
          exportedContent = `export default ${JSON.stringify(ast)};\nexport const rawSource = ${JSON.stringify(source)};`;
        } else if (mode === "eval") {
          exportedContent = `
import { Lua52VM } from "@rosegriffon/lua-plugin/vm";
const vm = new Lua52VM(${JSON.stringify(options.sandbox || {})});
const result = vm.execute(${JSON.stringify(source)});
export default result;
export const rawSource = ${JSON.stringify(source)};
`;
        } else {
          exportedContent = `export default { source: ${JSON.stringify(source)}, path: ${JSON.stringify(args.path)} };`;
        }

        return {
          contents: exportedContent,
          loader: "js",
        };
      });

      // 2. Binary compiled bytecode (.luac and Level-5 .lua.bin)
      build.onLoad(
        { filter: /\.(lua\.bin|luac)$/ },
        async (args: { path: string }) => {
          const file = (globalThis as any).Bun?.file(args.path);
          const buffer = file
            ? new Uint8Array(await file.arrayBuffer())
            : new Uint8Array(
                await (await import("node:fs/promises")).readFile(args.path),
              );

          if (isLua52Bytecode(buffer)) {
            const audit = auditLua52Bytecode(buffer);
            return {
              contents: `export default ${JSON.stringify(audit)};\nexport const isLua52 = true;`,
              loader: "js",
            };
          }

          return {
            contents: `export default new Uint8Array(${JSON.stringify(Array.from(buffer))});`,
            loader: "js",
          };
        },
      );
    },
  };
}

export function registerBunLuaPlugin(options: BunPluginLuaOptions = {}) {
  const Bun = (globalThis as any).Bun;
  if (Bun && typeof Bun.plugin === "function") {
    Bun.plugin(bunPluginLua(options));
  }
}
