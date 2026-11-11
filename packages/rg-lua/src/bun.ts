// SPDX-License-Identifier: Apache-2.0
// Bun runtime & bundler plugin for importing .lua files

export interface BunPluginLuaOptions {
  mode?: "source" | "ast" | "eval";
  sandbox?: Record<string, any>;
}

export function bunPluginLua(options: BunPluginLuaOptions = {}) {
  const mode = options.mode || "source";

  return {
    name: "rosegriffon-bun-plugin-lua",
    setup(build: any) {
      build.onLoad({ filter: /\.lua$/ }, async (args: { path: string }) => {
        const file = (globalThis as any).Bun?.file(args.path);
        const source = file ? await file.text() : await (await import("node:fs/promises")).readFile(args.path, "utf8");

        let exportedContent = "";

        if (mode === "source") {
          exportedContent = `export default ${JSON.stringify(source)};\nexport const rawSource = ${JSON.stringify(source)};`;
        } else if (mode === "eval") {
          exportedContent = `
import { Lua52VM } from "@rosegriffon/lua-plugin/vm";
const vm = new Lua52VM();
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
    },
  };
}
