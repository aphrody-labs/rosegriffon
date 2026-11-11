// SPDX-License-Identifier: Apache-2.0
import { expect, test, describe } from "bun:test";
import { bunPluginLua } from "../src/bun";
import { withLua } from "../src/next";
import { Lua52VM } from "../src/vm";

describe("@rosegriffon/lua-plugin Test Suite", () => {
  test("bunPluginLua returns a valid Bun plugin spec", () => {
    const plugin = bunPluginLua({ mode: "source" });
    expect(plugin.name).toBe("rosegriffon-bun-plugin-lua");
    expect(typeof plugin.setup).toBe("function");

    let registeredFilter: RegExp | null = null;
    let registeredCallback: Function | null = null;

    plugin.setup({
      onLoad(config: { filter: RegExp }, cb: Function) {
        registeredFilter = config.filter;
        registeredCallback = cb;
      },
    });

    expect(registeredFilter).not.toBeNull();
    expect(registeredFilter?.test("script.lua")).toBeTrue();
    expect(registeredFilter?.test("script.ts")).toBeFalse();
  });

  test("withLua extends Next.js webpack config with raw and binary loaders", () => {
    const baseConfig = { reactStrictMode: true };
    const extended = withLua(baseConfig, { includeBytecode: true });
    expect(extended.reactStrictMode).toBeTrue();
    expect(typeof extended.webpack).toBe("function");

    const mockWebpackConfig = {
      module: {
        rules: [] as any[],
      },
    };

    const finalConfig = extended.webpack(mockWebpackConfig, {});
    expect(finalConfig.module.rules.length).toBeGreaterThanOrEqual(2);
    expect(finalConfig.module.rules.some((r: any) => r.test.test("logic.lua"))).toBeTrue();
    expect(finalConfig.module.rules.some((r: any) => r.test.test("data.lua.bin"))).toBeTrue();
  });

  test("Lua52VM executes math and bit32 expressions", () => {
    const vm = new Lua52VM();
    const res = vm.execute("return bit32.bxor(10, 42)");
    expect(res.success).toBeTrue();
    expect(res.returnValue).toBe(32);
  });

  test("Lua52VM table.pack and unpack", () => {
    const vm = new Lua52VM();
    const res = vm.execute("return table.pack(1, 2, 3, 4)");
    expect(res.success).toBeTrue();
    expect(res.returnValue.n).toBe(4);
    expect(res.returnValue[0]).toBe(1);
  });
});
