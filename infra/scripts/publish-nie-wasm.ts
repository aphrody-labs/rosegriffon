#!/usr/bin/env bun
/**
 * Publish the `aphrody-nie-wasm` package (wasm-bindgen `--target web` output) into the CDN static
 * tree under a content-addressed directory, and record that directory in the website.
 *
 *   bun infra/scripts/publish-nie-wasm.ts --pkg crates/aphrody-nie-wasm/pkg \
 *       --static /srv/rosegriffon/cdn/static [--release apps/rg-website/src/lib/nie-wasm-release.json]
 *
 * Layout: `<static>/nie/wasm/<hash>/aphrody_nie_wasm.js` and `aphrody_nie_wasm_bg.wasm`, served
 * by nginx `location ^~ /static/` (`Cache-Control: public, max-age=31536000, immutable`,
 * `Access-Control-Allow-Origin: *`). `<hash>` is the first 16 hex digits of the SHA-256 of the
 * JS glue followed by the wasm, so a new build always lands in a new directory and an old
 * directory never changes. The website only commits the small release JSON naming the hash;
 * the binary never enters git. Old directories are kept (pages already loaded keep working).
 */
import { mkdir, copyFile, rename, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const JS = "aphrody_nie_wasm.js";
const WASM = "aphrody_nie_wasm_bg.wasm";

export async function releaseHash(pkg: string): Promise<string> {
  const h = new Bun.CryptoHasher("sha256");
  for (const f of [JS, WASM])
    h.update(new Uint8Array(await Bun.file(join(pkg, f)).arrayBuffer()));
  return h.digest("hex").slice(0, 16);
}

export async function publish(
  pkg: string,
  staticDir: string,
  releaseFile?: string,
) {
  const hash = await releaseHash(pkg);
  const rel = `nie/wasm/${hash}`;
  const dest = join(staticDir, rel);
  await mkdir(dest, { recursive: true });
  for (const f of [JS, WASM]) {
    // Copy then rename: nginx never serves a half-written file.
    const tmp = join(dest, `.${f}.tmp`);
    await copyFile(join(pkg, f), tmp);
    await rename(tmp, join(dest, f));
  }
  const release = {
    dir: rel,
    js: JS,
    wasm: WASM,
    wasmBytes: (await stat(join(dest, WASM))).size,
  };
  if (releaseFile)
    await Bun.write(releaseFile, `${JSON.stringify(release, null, 2)}\n`);
  return release;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      pkg: { type: "string", default: "crates/aphrody-nie-wasm/pkg" },
      static: { type: "string" },
      release: { type: "string" },
    },
  });
  if (!values.static) {
    console.error(
      "usage: publish-nie-wasm.ts --pkg <dir> --static <cdn static dir> [--release <json>]",
    );
    process.exit(2);
  }
  const r = await publish(
    resolve(values.pkg!),
    resolve(values.static),
    values.release && resolve(values.release),
  );
  console.log(JSON.stringify(r));
}
