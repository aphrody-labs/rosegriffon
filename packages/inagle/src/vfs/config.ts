/**
 * @file vfs/config.ts
 * @description Resolution de la configuration VFS depuis l'environnement et iecode_config.json.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { VfsConfig } from "./types.js";

const DEFAULT_GAME_PATH = "/home/ubuntu/.local/share/Steam/steamcmd/inazuma";
const IECODE_PROJECT = "/home/ubuntu/vps/packages/iecode";

function readGamePathFromConfig(): string | null {
  // Sync read kept (sync API path), Bun.file().text() est async donc on garde
  // existsSync + Bun.file readSync via Buffer? Non — resolveVfsConfig est appele
  // au boot uniquement, on bascule en lecture differee si besoin. Ici on conserve
  // readFileSync via require dynamique pour eviter d'introduire de l'async.
  const cfg = join(IECODE_PROJECT, "iecode_config.json");
  if (!existsSync(cfg)) return null;
  try {
    // Bun supporte Bun.file(...).text() en async ; resolveVfsConfig etant sync
    // on retombe sur readFileSync de node:fs (compat layer Bun, pas un goulot).
    const fs = require("node:fs") as typeof import("node:fs");
    const j = JSON.parse(fs.readFileSync(cfg, "utf8")) as {
      game_path?: string;
    };
    return j.game_path ?? null;
  } catch {
    return null;
  }
}

function findIecodeBin(): string {
  const env = process.env.IECODE_BIN;
  if (env && existsSync(env)) return env;
  const candidates = [
    join(IECODE_PROJECT, "cli/build/linux-vps-gcc/cli/iecode"),
    join(IECODE_PROJECT, "cli/build/release/cli/iecode"),
    join(IECODE_PROJECT, "cli/build/debug/cli/iecode"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "iecode";
}

function findIndexPath(gameDataDir: string): string {
  const env = process.env.IEVR_VFS_INDEX;
  if (env && existsSync(env)) return env;
  const cached = join(homedir(), "data/cache/cpk_index.json");
  if (existsSync(cached)) return cached;
  return resolve(dirname(gameDataDir), "cache/cpk_index.json");
}

export function resolveVfsConfig(overrides?: Partial<VfsConfig>): VfsConfig {
  const gamePath =
    overrides?.gameDataDir ??
    process.env.IEVR_GAME_PATH ??
    readGamePathFromConfig() ??
    DEFAULT_GAME_PATH;
  const gameDataDir = join(gamePath, "data");
  const cpksDir = join(gameDataDir, "packs");
  return {
    gameDataDir,
    cpksDir: overrides?.cpksDir ?? cpksDir,
    indexPath: overrides?.indexPath ?? findIndexPath(gameDataDir),
    iecodeBin: overrides?.iecodeBin ?? findIecodeBin(),
    cacheBytesMax: overrides?.cacheBytesMax ?? 256 * 1024 * 1024,
    cacheCfgBinMax: overrides?.cacheCfgBinMax ?? 512,
  };
}
