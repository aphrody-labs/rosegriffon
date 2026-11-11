// SPDX-License-Identifier: MIT
/**
 * Checkout roots shared by the inagle/azalee CLIs and maintenance scripts.
 *
 * The API and bundled data live in this package; shared Rust libraries and
 * workspace tools resolve from the yolo-re monorepo root.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function firstEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return path.resolve(value);
  }
  return undefined;
}

function moduleDir(): string {
  return typeof import.meta.dir === "string"
    ? import.meta.dir
    : path.dirname(fileURLToPath(import.meta.url));
}

/** Inagle package root (`tools/ie/inagle`). */
export function inagleRoot(): string {
  return path.resolve(moduleDir(), "../..");
}

function isYoloReRoot(candidate: string): boolean {
  return (
    existsSync(path.join(candidate, "AGENTS.md")) &&
    existsSync(path.join(candidate, "crates", "yolo-re-core", "Cargo.toml"))
  );
}

/** Find the owning yolo-re workspace, independent of the package's nesting depth. */
export function iecodeRoot(): string {
  const override = firstEnv(["YOLO_RE_ROOT"]);
  if (override && isYoloReRoot(override)) return override;

  let current = moduleDir();
  for (;;) {
    if (isYoloReRoot(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // An installed inagle package can be used without the source workspace checkout.
  return inagleRoot();
}

/** Path inside the yolo-re workspace. */
export function iecodePath(...parts: string[]): string {
  return path.join(iecodeRoot(), ...parts);
}

/** Inagle's bundled game data root, relocatable independently of the source checkout. */
export function iecodeDataRoot(): string {
  return (
    firstEnv(["DATA_ROOT", "DATA_PATH", "NIE_DATA_ROOT"]) ??
    path.join(inagleRoot(), "data")
  );
}

/** Path inside the IECODE game data root. */
export function iecodeDataPath(...parts: string[]): string {
  return path.join(iecodeDataRoot(), ...parts);
}

/** Source workspace containing this migrated package. */
export function sourceRoot(): string {
  return iecodeRoot();
}

/** Optional web-app data checkout; override with WEB_APP_ROOT. */
export function webAppRoot(): string {
  return firstEnv(["WEB_APP_ROOT"]) ?? path.join(sourceRoot(), "apps", "web");
}

/** Path inside the web app root. */
export function webAppPath(...parts: string[]): string {
  return path.join(webAppRoot(), ...parts);
}

/** Current user's home directory, without assuming a host account name. */
export function userHome(): string {
  return (
    process.env.HOME?.trim() || process.env.USERPROFILE?.trim() || homedir()
  );
}
