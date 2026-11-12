// SPDX-License-Identifier: Apache-2.0
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CACHE_CONTROL,
  contentType,
  isPublishable,
  syncTarget,
  targetsFromEnv,
  type Target,
} from "./sync";

/** Minimal path-style S3 mock: PUT/GET/HEAD, records headers and checks a SigV4 query is present. */
const objects = new Map<
  string,
  { body: Uint8Array; type: string | null; cache: string | null }
>();
let puts = 0;
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const key = decodeURIComponent(url.pathname);
    const signed =
      url.searchParams.has("X-Amz-Signature") ||
      (req.headers.get("authorization") ?? "").startsWith("AWS4-HMAC-SHA256");
    if (!signed) return new Response("unsigned", { status: 403 });
    if (req.method === "PUT") {
      puts++;
      objects.set(key, {
        body: new Uint8Array(await req.arrayBuffer()),
        type: req.headers.get("content-type"),
        cache: req.headers.get("cache-control"),
      });
      return new Response("", { status: 200, headers: { ETag: '"x"' } });
    }
    const o = objects.get(key);
    if (!o)
      return new Response("<Error><Code>NoSuchKey</Code></Error>", {
        status: 404,
      });
    const headers = {
      "Content-Length": String(o.body.length),
      "Content-Type": o.type ?? "",
      ETag: '"x"',
    };
    return new Response(req.method === "HEAD" ? null : o.body, { headers });
  },
});

let source = "";
const target: Target = {
  name: "mock",
  endpoint: `http://127.0.0.1:${server.port}`,
  bucket: "cdn",
  region: "auto",
  accessKeyId: "test",
  secretAccessKey: "test",
};

beforeAll(async () => {
  source = await mkdtemp(join(tmpdir(), "cdn-sync-"));
  await mkdir(join(source, "nie/tex"), { recursive: true });
  await mkdir(join(source, "vfs"), { recursive: true });
  await writeFile(
    join(source, "nie/tex/a.png"),
    new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
  );
  await writeFile(join(source, "nie/index.json"), '{"ok":true}');
  await writeFile(join(source, "nie/index.json.br"), "compressed");
  await writeFile(join(source, "vfs/secret.bin"), "private");
  await writeFile(join(source, "data.cpk"), "raw");
});

afterAll(async () => {
  server.stop(true);
  await rm(source, { recursive: true, force: true });
});

test("publishability filter keeps raw game data private", () => {
  expect(isPublishable("nie/tex/a.png")).toBe(true);
  expect(isPublishable("vfs/x.png")).toBe(false);
  expect(isPublishable("a/raw/b.g4cm")).toBe(false);
  expect(isPublishable("packs/x.CPK")).toBe(false);
  expect(isPublishable("../etc/passwd")).toBe(false);
  expect(isPublishable("nie/index.json.gz")).toBe(false);
  expect(contentType("x/y.webp")).toBe("image/webp");
});

test("targets from env: r2 account id and missing keys", () => {
  const [r2] = targetsFromEnv({
    CDN_SYNC_TARGETS: "r2",
    R2_ACCOUNT_ID: "abc",
    R2_BUCKET: "b",
    R2_ACCESS_KEY_ID: "k",
    R2_SECRET_ACCESS_KEY: "s",
  });
  expect(r2.endpoint).toBe("https://abc.r2.cloudflarestorage.com");
  expect(r2.region).toBe("auto");
  expect(() =>
    targetsFromEnv({ CDN_SYNC_TARGETS: "s3", S3_BUCKET: "b" }),
  ).toThrow(/S3_ENDPOINT/);
});

test("uploads public files with immutable headers, then skips unchanged", async () => {
  const log = () => {};
  const first = await syncTarget(target, { source, prefix: "static/", log });
  expect(first.uploaded).toBe(2);
  const png = objects.get("/cdn/static/nie/tex/a.png");
  expect(png?.cache).toBe(CACHE_CONTROL);
  expect(png?.type).toBe("image/png");
  expect(
    [...objects.keys()].some(
      (k) => k.includes("vfs") || k.endsWith(".cpk") || k.endsWith(".br"),
    ),
  ).toBe(false);
  expect(objects.get("/cdn/static/.cdn-sync-manifest.json")?.cache).toBe(
    "no-store",
  );

  const before = puts;
  const second = await syncTarget(target, { source, prefix: "static/", log });
  expect(second).toMatchObject({ uploaded: 0, skipped: 2 });
  expect(puts - before).toBe(1); // manifest only

  await writeFile(join(source, "nie/index.json"), '{"ok":false}');
  const third = await syncTarget(target, { source, prefix: "static/", log });
  expect(third).toMatchObject({ uploaded: 1, skipped: 1 });
});
