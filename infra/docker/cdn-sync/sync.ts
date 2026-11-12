// SPDX-License-Identifier: Apache-2.0
/**
 * cdn-sync: publishes the derived public CDN tree (/srv/rosegriffon/cdn/static, mounted
 * read-only at CDN_SYNC_SOURCE) to one or more S3-compatible buckets (Cloudflare R2, AWS S3,
 * MinIO, ...), with immutable cache headers. Raw game data never leaves the host: CPK, AWB/ACB,
 * the /vfs and /raw trees and anything outside the source root are refused.
 *
 * Signing uses Bun's built-in S3 client (`Bun.S3Client.presign`); the upload itself is a plain
 * PUT on the presigned URL so `Cache-Control` and `Content-Type` are stored on the object
 * (Bun's `write()` has no Cache-Control option). R2 and S3 then serve HTTP Range requests natively.
 *
 * Incremental: a manifest object (`<prefix>.cdn-sync-manifest.json`) records size and SHA-256
 * per key; unchanged files are skipped, so re-runs only upload what changed.
 *
 * Targets come from CDN_SYNC_TARGETS (comma list, e.g. `r2,s3`); each target NAME reads
 * NAME_ENDPOINT, NAME_BUCKET, NAME_ACCESS_KEY_ID, NAME_SECRET_ACCESS_KEY, NAME_REGION.
 * `r2` also accepts R2_ACCOUNT_ID instead of R2_ENDPOINT. See .env.example section CDN.
 */
import { Glob, S3Client } from "bun";
import { join, sep } from "node:path";
import { stat } from "node:fs/promises";

export type Target = {
  name: string;
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type ManifestEntry = { size: number; sha256: string };
export type Manifest = Record<string, ManifestEntry>;

export const CACHE_CONTROL = "public, max-age=31536000, immutable";
const MANIFEST_NAME = ".cdn-sync-manifest.json";

/** Paths that must stay private, relative to the source root. */
const PRIVATE = [
  /(^|\/)vfs(\/|$)/i,
  /(^|\/)raw(\/|$)/i,
  /\.(cpk|awb|acb|usm|exe|dll|pak|sav)$/i,
  /(^|\/)\./,
];
/** Precompressed siblings are for nginx `gzip_static`; the CDN compresses on its own. */
const SKIP = [/\.(gz|br)$/i];

export function isPublishable(rel: string): boolean {
  const p = rel.split(sep).join("/");
  if (p.startsWith("/") || p.split("/").includes("..")) return false;
  return !PRIVATE.some((r) => r.test(p)) && !SKIP.some((r) => r.test(p));
}

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  json: "application/json",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml",
  webmanifest: "application/manifest+json",
  wasm: "application/wasm",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  mp4: "video/mp4",
  webm: "video/webm",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  ktx2: "image/ktx2",
  bin: "application/octet-stream",
};

export function contentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}

export function targetsFromEnv(
  env: Record<string, string | undefined> = process.env,
): Target[] {
  const names = (env.CDN_SYNC_TARGETS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return names.map((name) => {
    const P = name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const get = (k: string) => env[`${P}_${k}`]?.trim() || undefined;
    let endpoint = get("ENDPOINT");
    if (!endpoint && P === "R2" && get("ACCOUNT_ID"))
      endpoint = `https://${get("ACCOUNT_ID")}.r2.cloudflarestorage.com`;
    const t = {
      name,
      endpoint,
      bucket: get("BUCKET"),
      region: get("REGION") ?? (P === "R2" ? "auto" : "us-east-1"),
      accessKeyId: get("ACCESS_KEY_ID"),
      secretAccessKey: get("SECRET_ACCESS_KEY"),
    };
    const missing = Object.entries(t)
      .filter(([, v]) => !v)
      .map(
        ([k]) => `${P}_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`,
      );
    if (missing.length)
      throw new Error(`cdn-sync target ${name}: missing ${missing.join(", ")}`);
    return t as Target;
  });
}

export async function scan(
  root: string,
): Promise<{ rel: string; size: number }[]> {
  const out: { rel: string; size: number }[] = [];
  for await (const rel of new Glob("**/*").scan({
    cwd: root,
    onlyFiles: true,
    dot: true,
    followSymlinks: false,
  })) {
    if (!isPublishable(rel)) continue;
    const s = await stat(join(root, rel));
    out.push({ rel: rel.split(sep).join("/"), size: s.size });
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

async function sha256(path: string): Promise<string> {
  const h = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) h.update(chunk);
  return h.digest("hex");
}

export type SyncOptions = {
  source: string;
  prefix: string;
  dryRun?: boolean;
  concurrency?: number;
  log?: (line: string) => void;
};

export type SyncReport = {
  target: string;
  uploaded: number;
  skipped: number;
  bytes: number;
};

export async function syncTarget(
  t: Target,
  opts: SyncOptions,
): Promise<SyncReport> {
  const log = opts.log ?? console.log;
  const client = new S3Client({
    endpoint: t.endpoint,
    bucket: t.bucket,
    region: t.region,
    accessKeyId: t.accessKeyId,
    secretAccessKey: t.secretAccessKey,
  });
  const prefix = opts.prefix.replace(/^\/+/, "");
  const manifestKey = `${prefix}${MANIFEST_NAME}`;
  const remote = client.file(manifestKey);
  const previous: Manifest = (await remote.exists()) ? await remote.json() : {};
  const next: Manifest = {};

  const files = await scan(opts.source);
  const report: SyncReport = {
    target: t.name,
    uploaded: 0,
    skipped: 0,
    bytes: 0,
  };
  const queue = [...files];
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const key = `${prefix}${f.rel}`;
      const path = join(opts.source, f.rel);
      const digest = await sha256(path);
      next[key] = { size: f.size, sha256: digest };
      const prev = previous[key];
      if (prev && prev.size === f.size && prev.sha256 === digest) {
        report.skipped++;
        continue;
      }
      if (!opts.dryRun)
        await put(client, key, Bun.file(path), contentType(key), CACHE_CONTROL);
      report.uploaded++;
      report.bytes += f.size;
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, opts.concurrency ?? 16) }, worker),
  );

  if (!opts.dryRun) {
    await put(
      client,
      manifestKey,
      JSON.stringify(next),
      "application/json",
      "no-store",
    );
  }
  log(
    `cdn-sync target=${t.name} bucket=${t.bucket} uploaded=${report.uploaded} skipped=${report.skipped} bytes=${report.bytes}${opts.dryRun ? " dry-run" : ""}`,
  );
  return report;
}

async function put(
  client: S3Client,
  key: string,
  body: Blob | string,
  type: string,
  cacheControl: string,
) {
  const url = client.presign(key, { method: "PUT", expiresIn: 900 });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "PUT",
      body,
      headers: { "Content-Type": type, "Cache-Control": cacheControl },
    });
    if (res.ok) return;
    if (attempt >= 4 || (res.status < 500 && res.status !== 429)) {
      throw new Error(
        `PUT ${key}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`,
      );
    }
    await Bun.sleep(250 * 2 ** attempt);
  }
}

if (import.meta.main) {
  const source = process.env.CDN_SYNC_SOURCE ?? "/data/cdn/static";
  const prefix = process.env.CDN_SYNC_PREFIX ?? "static/";
  const dryRun =
    process.argv.includes("--dry-run") || process.env.CDN_SYNC_DRY_RUN === "1";
  const concurrency = Number(process.env.CDN_SYNC_CONCURRENCY ?? 16);
  const targets = targetsFromEnv();
  if (!targets.length) {
    console.error("cdn-sync: CDN_SYNC_TARGETS is empty (e.g. r2 or r2,s3)");
    process.exit(64);
  }
  let failed = false;
  for (const t of targets) {
    try {
      await syncTarget(t, { source, prefix, dryRun, concurrency });
    } catch (e) {
      failed = true;
      console.error(`cdn-sync target=${t.name}: ${(e as Error).message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
