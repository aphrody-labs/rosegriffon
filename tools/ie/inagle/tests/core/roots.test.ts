import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "bun:test";
import {
  iecodeDataRoot,
  iecodePath,
  iecodeRoot,
  inagleRoot,
} from "../../src/core/roots.ts";

test("finds the yolo-re workspace from the migrated package depth", () => {
  const root = iecodeRoot();
  expect(existsSync(join(root, "AGENTS.md"))).toBe(true);
  expect(existsSync(iecodePath("crates", "yolo-re-core", "Cargo.toml"))).toBe(
    true,
  );
  expect(
    existsSync(iecodePath("apps", "iecode-dotnet", "Ffi", "IECODE.Ffi.csproj")),
  ).toBe(true);
  expect(iecodePath("tools", "ie", "inagle")).toBe(inagleRoot());
});

test("defaults game data to the package-local data directory", () => {
  const override =
    process.env.DATA_ROOT ?? process.env.DATA_PATH ?? process.env.NIE_DATA_ROOT;
  const expected = override ? resolve(override) : join(inagleRoot(), "data");
  expect(iecodeDataRoot()).toBe(expected);
});
