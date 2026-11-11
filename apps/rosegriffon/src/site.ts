// SPDX-License-Identifier: Apache-2.0
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { SITE_ARCHIVE, SITE_HASH } from "./embedded";

/** Relative path of the Next server inside an `output: "standalone"` tree. */
export const SITE_SERVER = "apps/rg-website/server.js";

function cacheRoot(): string {
  if (process.env.RG_CACHE_DIR) return resolve(process.env.RG_CACHE_DIR);
  if (process.platform === "win32") return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "rosegriffon");
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "rosegriffon");
}

/** Extracts the embedded standalone archive once per build hash, atomically. */
async function extractEmbedded(archive: string, hash: string): Promise<string> {
  const target = join(cacheRoot(), `site-${hash.slice(0, 16)}`);
  if (existsSync(join(target, SITE_SERVER))) return target;
  mkdirSync(dirname(target), { recursive: true });
  const staging = `${target}.tmp-${process.pid}`;
  rmSync(staging, { recursive: true, force: true });
  console.info(`[site] extracting the embedded site to ${target}`);
  await new Bun.Archive(Bun.file(archive)).extract(staging);
  try {
    renameSync(staging, target);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    if (!existsSync(join(target, SITE_SERVER))) throw error;
  }
  return target;
}

/** Standalone tree to serve: `RG_SITE_DIR`, the embedded archive, or the local build. */
export async function resolveSiteDir(): Promise<string | null> {
  if (process.env.RG_SITE_DIR) return resolve(process.env.RG_SITE_DIR);
  if (SITE_ARCHIVE && SITE_HASH) return extractEmbedded(SITE_ARCHIVE, SITE_HASH);
  const local = resolve(import.meta.dir, "../../rg-website/.next/standalone");
  return existsSync(join(local, SITE_SERVER)) ? local : null;
}

/** Runs the Next standalone server in this process (`PORT`/`HOSTNAME`, default 127.0.0.1:3100). */
export async function serveSite(): Promise<void> {
  const dir = await resolveSiteDir();
  if (!dir) {
    throw new Error(
      "no site build: this executable was compiled without the site, and neither RG_SITE_DIR nor apps/rg-website/.next/standalone exists",
    );
  }
  const server = join(dir, SITE_SERVER);
  if (!existsSync(server)) throw new Error(`Next standalone server missing: ${server}`);
  process.env.PORT = process.env.RG_SITE_PORT ?? process.env.PORT ?? "3100";
  process.env.HOSTNAME = process.env.RG_SITE_HOST ?? "127.0.0.1";
  process.env.NODE_ENV = "production";
  process.env.NEXT_TELEMETRY_DISABLED ??= "1";
  process.chdir(dirname(server));
  await import(server);
}
