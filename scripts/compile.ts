#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * `bun run compile` — links `apps/rosegriffon` into single-file `rosegriffon` executables.
 *
 *   bun run compile                          host target, site embedded (built if missing)
 *   bun run compile --target linux-x64 --target windows-x64
 *   bun run compile --site=skip              no site (serve it with RG_SITE_DIR at runtime)
 *   bun run compile --site=build             rebuild apps/rg-website before embedding
 *   bun run compile --site-dir <standalone>  embed a prebuilt `.next/standalone` tree (CI artifact)
 *
 * The site is the Next.js `output: "standalone"` tree of apps/rg-website, packed as a
 * gzip tarball and embedded as a file asset; `rosegriffon site` extracts it once per
 * build hash. Its node_modules carry native addons of the build host (sharp), so the
 * site is embedded only into executables for the host platform; CI builds each target
 * on its own runner.
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const APP = join(ROOT, "apps/rosegriffon");
const SITE_APP = join(ROOT, "apps/rg-website");
const STANDALONE = join(SITE_APP, ".next/standalone");
const EMBEDDED = join(APP, "src/embedded.ts");

type SiteMode = "auto" | "build" | "skip";
const TARGETS: Record<string, string> = {
  "linux-x64": "bun-linux-x64",
  "linux-x64-musl": "bun-linux-x64-musl",
  "linux-arm64": "bun-linux-arm64",
  "windows-x64": "bun-windows-x64",
  "darwin-arm64": "bun-darwin-arm64",
};

function hostTarget(): string {
  const os = process.platform === "win32" ? "windows" : process.platform;
  return `${os}-${process.arch}`;
}

function parseArgs(args: string[]) {
  const targets: string[] = [];
  let site: SiteMode = "auto";
  let outdir = join(ROOT, "dist");
  let siteDir = STANDALONE;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const value = (name: string) => (arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[++i] ?? "");
    if (arg.startsWith("--target")) targets.push(...value("--target").split(",").filter(Boolean));
    else if (arg.startsWith("--outdir")) outdir = resolve(value("--outdir"));
    else if (arg.startsWith("--site-dir")) siteDir = resolve(value("--site-dir"));
    else if (arg.startsWith("--site")) site = value("--site") as SiteMode;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!["auto", "build", "skip"].includes(site)) throw new Error(`--site must be auto, build or skip (got ${site})`);
  if (targets.includes("all")) targets.splice(0, targets.length, "linux-x64", "windows-x64");
  if (targets.length === 0) targets.push(hostTarget());
  for (const target of targets) if (!TARGETS[target]) throw new Error(`unknown target ${target} (${Object.keys(TARGETS).join(", ")})`);
  return { targets, site, outdir, siteDir };
}

async function run(cmd: string[], cwd: string, env: Record<string, string | undefined> = process.env): Promise<void> {
  const proc = Bun.spawn({ cmd, cwd, env, stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`${cmd.join(" ")} exited with ${code}`);
}

/**
 * Builds (if needed) and packs a standalone tree; returns the archive path and hash.
 * `next build` leaves `.next/static` and `public/` to the deployer: they are added to the
 * archive from the app directory (`<standalone>/../..`) without touching the tree.
 */
async function packSite(mode: SiteMode, outdir: string, standalone: string): Promise<{ archive: string; hash: string } | null> {
  if (mode === "skip") return null;
  const server = join(standalone, "apps/rg-website/server.js");
  if (standalone === STANDALONE && (mode === "build" || !existsSync(server))) {
    console.log("[compile] building apps/rg-website (output: standalone)");
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
    delete env.VERCEL;
    await run([process.execPath, "run", "build"], SITE_APP, env);
    try {
      const { flattenStandalone } = (await import("@aphrody/next-bun/standalone")) as typeof import("@aphrody/next-bun/standalone");
      flattenStandalone(STANDALONE);
    } catch (error) {
      console.warn("[compile] flattenStandalone skipped:", error instanceof Error ? error.message : error);
    }
  }
  if (!existsSync(server)) throw new Error(`Next standalone server missing: ${server}`);
  const app = resolve(standalone, "../..");

  const files: Record<string, Uint8Array> = {};
  const add = async (cwd: string, prefix: string) => {
    if (!existsSync(cwd)) return;
    for await (const file of new Bun.Glob("**/*").scan({ cwd, onlyFiles: true, dot: true, followSymlinks: true })) {
      files[prefix + file.replaceAll("\\", "/")] = await Bun.file(join(cwd, file)).bytes();
    }
  };
  await add(standalone, "");
  await add(join(app, ".next/static"), "apps/rg-website/.next/static/");
  await add(join(app, "public"), "apps/rg-website/public/");
  mkdirSync(outdir, { recursive: true });
  const archive = join(outdir, "site.tar.gz");
  await Bun.Archive.write(archive, files, { compress: "gzip" });
  const hash = new Bun.CryptoHasher("sha256").update(await Bun.file(archive).arrayBuffer()).digest("hex");
  const count = Object.keys(files).length;
  console.log(`[compile] site: ${count} files, ${(Bun.file(archive).size / 1048576).toFixed(1)} MiB, sha256 ${hash.slice(0, 16)}`);
  return { archive, hash };
}

function embeddedSource(site: { archive: string; hash: string } | null, version: string): string {
  const lines = ["// Generated by scripts/compile.ts. Restored after linking.", ""];
  if (site) {
    lines.push(`import siteArchive from ${JSON.stringify(site.archive.replaceAll("\\", "/"))} with { type: "file" };`, "");
    lines.push("export const SITE_ARCHIVE: string | null = siteArchive;");
    lines.push(`export const SITE_HASH: string | null = ${JSON.stringify(site.hash)};`);
  } else {
    lines.push("export const SITE_ARCHIVE: string | null = null;", "export const SITE_HASH: string | null = null;");
  }
  lines.push(`export const BUILD_VERSION: string | null = ${JSON.stringify(version)};`, "");
  return lines.join("\n");
}

const { targets, site: siteMode, outdir, siteDir } = parseArgs(process.argv.slice(2));
const version = ((await Bun.file(join(APP, "package.json")).json()) as { version: string }).version;
const host = hostTarget();
const site = targets.includes(host) ? await packSite(siteMode, outdir, siteDir) : null;
const original = await Bun.file(EMBEDDED).text();
mkdirSync(outdir, { recursive: true });
try {
  for (const target of targets) {
    const withSite = target === host ? site : null;
    await Bun.write(EMBEDDED, embeddedSource(withSite, version));
    const outfile = join(outdir, `rosegriffon-${target}${target.startsWith("windows") ? ".exe" : ""}`);
    rmSync(outfile, { force: true });
    const result = await Bun.build({
      entrypoints: [join(APP, "src/main.ts")],
      compile: { target: TARGETS[target] as Bun.Build.CompileTarget, outfile },
      format: "esm",
      minify: true,
      sourcemap: "linked",
      bytecode: true,
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
    });
    if (!result.success) {
      for (const log of result.logs) console.error(log);
      throw new Error(`compile failed for ${target}`);
    }
    const size = Bun.file(outfile).size;
    console.log(`[compile] ${relative(ROOT, outfile)} ${(size / 1048576).toFixed(1)} MiB${withSite ? " (site embedded)" : ""}`);
  }
} finally {
  await Bun.write(EMBEDDED, original);
}
