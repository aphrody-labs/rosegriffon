// SPDX-License-Identifier: Apache-2.0
// Next.js 15/16 Plugin for Lua 5.2 — Supporting both Turbopack & Webpack 5.

import { resolve } from "node:path";

export interface NextLuaPluginOptions {
  includeBytecode?: boolean;
  mode?: "raw" | "module";
}

export function withLua(nextConfig: any = {}, pluginOptions: NextLuaPluginOptions = {}) {
  const includeBytecode = pluginOptions.includeBytecode ?? true;
  const mode = pluginOptions.mode ?? "module";

  // Resolve custom loader for Webpack and Turbopack
  const loaderPath = resolve(__dirname, "loader.js");

  const configuredConfig = {
    ...nextConfig,

    // Turbopack rules (Next.js 15 and Next.js 16)
    turbopack: {
      ...nextConfig.turbopack,
      rules: {
        ...nextConfig.turbopack?.rules,
        "*.lua": {
          loaders: mode === "module" ? [loaderPath] : ["raw-loader"],
          as: "*.js",
        },
        ...(includeBytecode
          ? {
              "*.luac": {
                loaders: [loaderPath],
                as: "*.js",
              },
              "*.lua.bin": {
                loaders: [loaderPath],
                as: "*.js",
              },
            }
          : {}),
      },
    },

    // Next.js experimental.turbo fallback for earlier canary releases
    experimental: {
      ...nextConfig.experimental,
      turbo: {
        ...nextConfig.experimental?.turbo,
        rules: {
          ...nextConfig.experimental?.turbo?.rules,
          "*.lua": {
            loaders: mode === "module" ? [loaderPath] : ["raw-loader"],
            as: "*.js",
          },
          ...(includeBytecode
            ? {
                "*.luac": {
                  loaders: [loaderPath],
                  as: "*.js",
                },
                "*.lua.bin": {
                  loaders: [loaderPath],
                  as: "*.js",
                },
              }
            : {}),
        },
      },
    },

    webpack(config: any, options: any) {
      config.module ??= {};
      config.module.rules ??= [];

      if (mode === "module") {
        config.module.rules.push({
          test: /\.lua$/,
          use: [
            {
              loader: loaderPath,
            },
          ],
        });
      } else {
        config.module.rules.push({
          test: /\.lua$/,
          type: "asset/source",
        });
      }

      if (includeBytecode) {
        config.module.rules.push({
          test: /\.(lua\.bin|luac)$/,
          use: [
            {
              loader: loaderPath,
            },
          ],
        });
      }

      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, options);
      }

      return config;
    },
  };

  return configuredConfig;
}
