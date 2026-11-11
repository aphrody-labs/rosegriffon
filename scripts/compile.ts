#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * `bun run compile` — links `apps/rg-bot/src/core.ts` into single-file `rg-core` executables.
 *
 *   bun run compile                          host target
 *   bun run compile --target linux-x64 --target windows-x64
 *   bun run compile --outdir dist
 */
import { mkdirSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const BOT_APP = join(ROOT, "apps/rg-bot");

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
  let outdir = join(ROOT, "dist");
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const value = (name: string) => (arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[++i] ?? "");
    if (arg.startsWith("--target")) targets.push(...value("--target").split(",").filter(Boolean));
    else if (arg.startsWith("--outdir")) outdir = resolve(value("--outdir"));
    else if (arg.startsWith("--site")) continue; // Compatibility no-op
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (targets.includes("all")) targets.splice(0, targets.length, "linux-x64", "windows-x64");
  if (targets.length === 0) targets.push(hostTarget());
  for (const target of targets) if (!TARGETS[target]) throw new Error(`unknown target ${target} (${Object.keys(TARGETS).join(", ")})`);
  return { targets, outdir };
}

const { targets, outdir } = parseArgs(process.argv.slice(2));
mkdirSync(outdir, { recursive: true });

for (const target of targets) {
  const outfile = join(outdir, `rg-core-${target}${target.startsWith("windows") ? ".exe" : ""}`);
  rmSync(outfile, { force: true });
  const result = await Bun.build({
    entrypoints: [join(BOT_APP, "src/core.ts")],
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
  console.log(`[compile] ${relative(ROOT, outfile)} ${(size / 1048576).toFixed(1)} MiB`);
}
