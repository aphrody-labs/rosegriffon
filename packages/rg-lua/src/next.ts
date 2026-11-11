// SPDX-License-Identifier: Apache-2.0
// Next.js plugin for Lua 5.2 source and bytecode loading

export interface NextLuaPluginOptions {
  includeBytecode?: boolean;
}

export function withLua(nextConfig: any = {}, pluginOptions: NextLuaPluginOptions = {}) {
  const includeBytecode = pluginOptions.includeBytecode ?? true;

  return {
    ...nextConfig,
    webpack(config: any, options: any) {
      config.module ??= {};
      config.module.rules ??= [];

      // 1. Webpack 5 Asset Source rule for .lua files (zero-dependency raw loader)
      config.module.rules.push({
        test: /\.lua$/,
        type: "asset/source",
      });

      // 2. Binary buffer loader rule for .lua.bin or .luac files
      if (includeBytecode) {
        config.module.rules.push({
          test: /\.(lua\.bin|luac)$/,
          type: "asset/resource",
          generator: {
            filename: "static/chunks/[hash][ext][query]",
          },
        });
      }

      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, options);
      }

      return config;
    },
  };
}
