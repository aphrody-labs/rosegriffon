#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * Publishes every public `@rosegriffon/*` workspace package whose version is not on npm yet.
 *
 * `bun pm pack` resolves `workspace:` and `catalog:` specifiers into the tarball manifest;
 * `npm publish <tarball> --provenance` then signs it with the GitHub Actions OIDC identity.
 * Packages owned by bun-os (`@rosegriffon/inagle*`) are never published from here.
 *
 *   bun scripts/publish.ts            publish (CI, needs NPM_TOKEN or ~/.npmrc)
 *   bun scripts/publish.ts --dry-run  list what would be published
 */
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const DRY = process.argv.includes("--dry-run");
const PROVENANCE = process.env.GITHUB_ACTIONS === "true" && process.env.NPM_PROVENANCE !== "0";
const SKIP = /^@rosegriffon\/inagle(-|$)/;
const OUT = join(ROOT, "dist", "npm");

type Manifest = { name: string; version: string; private?: boolean };

async function published(name: string, version: string): Promise<boolean> {
  const response = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2f")}/${version}`);
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`registry lookup ${name}@${version}: HTTP ${response.status}`);
  return true;
}

function run(cmd: string[], cwd: string): string {
  const proc = Bun.spawnSync({ cmd, cwd, stdout: "pipe", stderr: "inherit", env: process.env });
  if (proc.exitCode !== 0) throw new Error(`${cmd.join(" ")} exited with ${proc.exitCode}`);
  return proc.stdout.toString();
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const pending: { dir: string; manifest: Manifest }[] = [];
for await (const file of new Bun.Glob("{apps,packages}/*/package.json").scan(ROOT)) {
  const dir = join(ROOT, file, "..");
  const manifest = (await Bun.file(join(ROOT, file)).json()) as Manifest;
  if (manifest.private || !manifest.name.startsWith("@rosegriffon/") || SKIP.test(manifest.name)) continue;
  if (await published(manifest.name, manifest.version)) continue;
  pending.push({ dir, manifest });
}
pending.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
if (pending.length === 0) console.log("Every public @rosegriffon package is already published.");

for (const { dir, manifest } of pending) {
  const id = `${manifest.name}@${manifest.version}`;
  if (DRY) {
    console.log(`would publish ${id}`);
    continue;
  }
  run([process.execPath, "pm", "pack", "--destination", OUT, "--quiet"], dir);
  const tarball = join(OUT, `${manifest.name.slice(1).replace("/", "-")}-${manifest.version}.tgz`);
  const tag = manifest.version.includes("-") ? ["--tag", "next"] : [];
  run(["npm", "publish", tarball, "--access", "public", ...(PROVENANCE ? ["--provenance"] : []), ...tag], dir);
  console.log(`published ${id}`);
  // Changesets reads these lines to tag the release.
  console.log(`New tag: ${id}`);
}
