// SPDX-License-Identifier: Apache-2.0
/**
 * Shared SQLite mirror discovery and PostgREST/SQLite row normalization
 * driven by `contract/stack.yml` (`STACK_CONTRACT.database.mirror`).
 */

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isUsableEnvValue, STACK_CONTRACT } from "@rosegriffon/config/contract";

export interface ResolveMirrorSqliteOptions {
  /** Explicit caller path override (checked first). */
  explicit?: string | null;
  /** Additional base directories where `defaultRelPath` should be probed. */
  baseDirs?: readonly (string | undefined)[];
  /**
   * When true, checks all configured env vars (`SQLITE_DB_PATH`, `NIERS_MIRROR`, etc.).
   * Otherwise restricts to specific env vars passed via `envVars`.
   */
  envVars?: readonly string[];
  /**
   * Return the resolved explicit/SQLITE_DB_PATH path directly even if not yet
   * checked on disk (matching `azalee`'s `SQLITE_DB_PATH` behavior) vs verifying `statSync`.
   */
  requireNonEmptyFile?: boolean;
  /** Throw if an explicit path or configured env var points to a missing/empty file. */
  strictExplicit?: boolean;
}

function isNonEmptyFile(filePath: string): boolean {
  try {
    const info = statSync(filePath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

/**
 * Resolves the canonical SQLite mirror path (`var/mirror.sqlite`) using a single
 * contract-driven priority order across `inagle`, `azalee`, and `rg-bot`.
 */
export function resolveMirrorSqlitePath(
  options: ResolveMirrorSqliteOptions = {},
): string | null {
  const mirror = STACK_CONTRACT.database.mirror;
  const requireNonEmpty = options.requireNonEmptyFile ?? true;
  const isAvailable = (p: string): boolean =>
    requireNonEmpty ? isNonEmptyFile(p) : existsSync(p);

  const explicitPath = options.explicit?.trim();
  if (explicitPath) {
    const abs = resolve(explicitPath);
    if (isAvailable(abs)) return abs;
    if (options.strictExplicit) {
      throw new Error(`The explicitly selected SQLite mirror is unavailable: ${abs}`);
    }
  }

  const envVars = options.envVars ?? mirror.envVars;
  for (const name of envVars) {
    const raw = process.env[name];
    if (!isUsableEnvValue(raw)) continue;
    const abs = resolve(raw.trim());
    if (name === "SQLITE_DB_PATH" && !requireNonEmpty) return abs;
    if (isAvailable(abs)) return abs;
    if (options.strictExplicit) {
      throw new Error(`SQLite mirror from ${name} is unavailable: ${abs}`);
    }
  }

  const bases = [
    ...(options.baseDirs ?? []),
    process.env.IECODE_ROOT,
    process.cwd(),
    process.env.IECODE_DATA_DIR ? resolve(process.env.IECODE_DATA_DIR, "..") : undefined,
  ]
    .map((b) => b?.trim())
    .filter((b): b is string => Boolean(b));

  for (const base of bases) {
    const candidate = resolve(base, mirror.defaultRelPath);
    if (isAvailable(candidate)) return candidate;
  }

  return null;
}

/** Canonical PostgreSQL COPY/dump null-sentinel check (`\N` or `\\N`). */
export function estMarqueurNul(valeur: unknown): boolean {
  return valeur === "\\N" || valeur === "\\\\N";
}
