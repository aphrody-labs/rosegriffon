#!/usr/bin/env bun
/**
 * Derive the static boot assets requested by `NieClientRuntime` (crates/aphrody-nie-wasm) from a
 * game install, into `<static>/nie/boot/`:
 *
 *   SplashScreen.png  <- <game>/EasyAntiCheat/SplashScreen.png (copied as is)
 *   L5logo.mp4        <- <game>/data/dx11/movie/L5logo.usm
 *   IE_15th.mp4       <- <game>/data/dx11/movie/IE_15th.usm
 *
 *   bun infra/scripts/derive-nie-boot.ts --game /srv/rosegriffon/game/ievr \
 *       --static /srv/rosegriffon/cdn/static [--ffmpeg ffmpeg]
 *
 * The two boot logos are USM (CRI Sofdec2) containers carrying MPEG-2 video, which no browser
 * decodes; on disk they are wrapped in the CRI position XOR keyed by the file name (see
 * crates/aphrody-nie-formats/src/usm.rs `demuxer_nomme`), undone first. The `@SFV` data blocks are demuxed here (layout documented in
 * crates/aphrody-nie-formats/src/usm.rs), the `@SFA` channel 0 blocks give the HCA soundtrack,
 * and ffmpeg encodes H.264 yuv420p + AAC in a fast-start MP4. Without a decodable soundtrack the
 * MP4 is video only. A `manifest.json` lists every output with its size and SHA-256.
 * Outputs are written to a temporary name and renamed, so a running nginx never serves a partial
 * file. Nothing is written outside `<static>/nie/boot/`.
 */
import { mkdir, readdir, copyFile, rename, rm, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";

export const BOOT_VIDEOS = ["L5logo", "IE_15th"] as const;
const MOVIE_DIRS = ["data/dx11/movie", "data/common/movie"];

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

/** Standard CRC-32 of the file base name: the key of the CRI position XOR (cpk.rs `key_from_filename`). */
export function keyFromFilename(name: string): number {
  let crc = 0xffffffff;
  for (const b of new TextEncoder().encode(name))
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ b) & 0xff]!;
  return ~crc >>> 0;
}

/**
 * In-place CRI position XOR, port of cpk.rs `decrypt_block` with `file_offset = 0` (involutive).
 * The two loose boot logos are wrapped in it; their plaintext starts with `CRID`.
 */
export function criDecrypt(buf: Uint8Array, key: number): void {
  const k = [
    key & 0xff,
    (key >>> 8) & 0xff,
    (key >>> 16) & 0xff,
    (key >>> 24) & 0xff,
  ];
  for (let base = 0; base < buf.length; base += 4) {
    let crc = ~base >>> 0;
    for (let j = 0; j < 4; j++)
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc & 0xff) ^ k[j]!]!;
    crc = ~crc >>> 0;
    for (let p = 0; p < 4 && base + p < buf.length; p++) {
      const s = p * 2;
      let r = (crc >>> (s + 8)) & 3;
      r |= (((crc >>> s) & 0xff) << 2) & 0xff;
      r = ((r << 2) & 0xff) | ((crc >>> (s + 16)) & 3);
      r = ((r << 2) & 0xff) | ((crc >>> (s + 24)) & 3);
      buf[base + p]! ^= r;
    }
  }
}

const isCrid = (b: Uint8Array) =>
  b.length >= 4 &&
  b[0] === 0x43 &&
  b[1] === 0x52 &&
  b[2] === 0x49 &&
  b[3] === 0x44;

/** USM bytes in clear: as is when they start with `CRID`, else unwrapped with the name key. */
export function usmPlaintext(data: Uint8Array, fileName: string): Uint8Array {
  if (isCrid(data)) return data;
  const clear = data.slice();
  criDecrypt(clear, keyFromFilename(fileName));
  if (!isCrid(clear))
    throw new Error(`${fileName}: not a USM (no CRID, even decrypted)`);
  return clear;
}

/** Elementary streams of a USM container: video (`@SFV`) and audio channel 0 (`@SFA`). */
export function demuxUsm(data: Uint8Array): {
  video: Uint8Array;
  audio: Uint8Array;
} {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const parts: Record<"@SFV" | "@SFA", Uint8Array[]> = {
    "@SFV": [],
    "@SFA": [],
  };
  let pos = 0;
  while (pos + 0x20 <= data.length) {
    const stmid = String.fromCharCode(
      data[pos]!,
      data[pos + 1]!,
      data[pos + 2]!,
      data[pos + 3]!,
    );
    const size = dv.getUint32(pos + 4);
    const total = size + 8;
    if (size < 0x18 || pos + total > data.length) break;
    const dataOffset = data[pos + 0x09]!;
    const padding = dv.getUint16(pos + 0x0a);
    const channel = data[pos + 0x0c]!;
    const blockType = data[pos + 0x0f]!;
    if (
      (stmid === "@SFV" || stmid === "@SFA") &&
      blockType === 0 &&
      channel === 0
    ) {
      const start = pos + 8 + dataOffset;
      const len = size - dataOffset - padding;
      if (len > 0) parts[stmid].push(data.subarray(start, start + len));
    }
    pos += total;
  }
  const cat = (xs: Uint8Array[]) => {
    const out = new Uint8Array(xs.reduce((n, x) => n + x.length, 0));
    let o = 0;
    for (const x of xs) {
      out.set(x, o);
      o += x.length;
    }
    return out;
  };
  return { video: cat(parts["@SFV"]), audio: cat(parts["@SFA"]) };
}

/** Case-insensitive lookup of `rel` (slash separated) under `root`. */
async function findCi(root: string, rel: string): Promise<string | null> {
  let dir = root;
  for (const seg of rel.split("/")) {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return null;
    }
    const hit = entries.find((e) => e.toLowerCase() === seg.toLowerCase());
    if (!hit) return null;
    dir = join(dir, hit);
  }
  return dir;
}

async function sha256(path: string): Promise<string> {
  const h = new Bun.CryptoHasher("sha256");
  h.update(new Uint8Array(await Bun.file(path).arrayBuffer()));
  return h.digest("hex");
}

async function ffmpeg(bin: string, args: string[]): Promise<boolean> {
  const p = Bun.spawn(
    [bin, "-hide_banner", "-loglevel", "error", "-y", ...args],
    {
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  return (await p.exited) === 0;
}

async function transcode(
  bin: string,
  usm: string,
  out: string,
  work: string,
): Promise<{ audio: boolean }> {
  const raw = new Uint8Array(await Bun.file(usm).arrayBuffer());
  const { video, audio } = demuxUsm(usmPlaintext(raw, basename(usm)));
  if (video.length === 0) throw new Error(`${usm}: no @SFV video blocks`);
  const m2v = join(work, "v.m2v");
  const hca = join(work, "a.hca");
  await Bun.write(m2v, video);
  const vArgs = [
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
  ];
  const tail = ["-movflags", "+faststart", "-f", "mp4", out];
  if (audio.length > 0) {
    await Bun.write(hca, audio);
    const ok = await ffmpeg(bin, [
      "-f",
      "mpegvideo",
      "-i",
      m2v,
      "-f",
      "hca",
      "-i",
      hca,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      ...vArgs,
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-shortest",
      ...tail,
    ]);
    if (ok) return { audio: true };
    console.error(`${usm}: soundtrack not decodable, writing video only`);
  }
  if (
    !(await ffmpeg(bin, [
      "-f",
      "mpegvideo",
      "-i",
      m2v,
      "-map",
      "0:v:0",
      ...vArgs,
      "-an",
      ...tail,
    ]))
  ) {
    throw new Error(`${usm}: ffmpeg failed`);
  }
  return { audio: false };
}

export async function deriveBoot(
  game: string,
  staticDir: string,
  ffmpegBin = "ffmpeg",
) {
  const outDir = join(staticDir, "nie", "boot");
  await mkdir(outDir, { recursive: true });
  const work = join(tmpdir(), `nie-boot-${process.pid}`);
  await mkdir(work, { recursive: true });
  const files: {
    name: string;
    source: string;
    bytes: number;
    sha256: string;
    audio?: boolean;
  }[] = [];
  const missing: string[] = [];
  try {
    const splash = await findCi(game, "EasyAntiCheat/SplashScreen.png");
    if (splash) {
      const tmp = join(outDir, ".SplashScreen.png.tmp");
      await copyFile(splash, tmp);
      await rename(tmp, join(outDir, "SplashScreen.png"));
      files.push({
        name: "SplashScreen.png",
        source: splash,
        bytes: 0,
        sha256: "",
      });
    } else missing.push("EasyAntiCheat/SplashScreen.png");

    for (const name of BOOT_VIDEOS) {
      let usm: string | null = null;
      for (const d of MOVIE_DIRS)
        usm ??= await findCi(game, `${d}/${name}.usm`);
      if (!usm) {
        missing.push(`${MOVIE_DIRS[0]}/${name}.usm`);
        continue;
      }
      const tmp = join(outDir, `.${name}.mp4.tmp`);
      const { audio } = await transcode(ffmpegBin, usm, tmp, work);
      await rename(tmp, join(outDir, `${name}.mp4`));
      files.push({
        name: `${name}.mp4`,
        source: usm,
        bytes: 0,
        sha256: "",
        audio,
      });
    }
    for (const f of files) {
      const p = join(outDir, f.name);
      f.bytes = (await stat(p)).size;
      f.sha256 = await sha256(p);
    }
    const manifest = { files: files.map(({ source: _s, ...f }) => f), missing };
    await Bun.write(
      join(outDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    return { outDir, files, missing };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      game: { type: "string" },
      static: { type: "string" },
      ffmpeg: { type: "string", default: "ffmpeg" },
    },
  });
  if (!values.game || !values.static) {
    console.error(
      "usage: derive-nie-boot.ts --game <install dir> --static <cdn static dir> [--ffmpeg <bin>]",
    );
    process.exit(2);
  }
  const r = await deriveBoot(
    resolve(values.game),
    resolve(values.static),
    values.ffmpeg,
  );
  console.log(JSON.stringify(r, null, 2));
  if (r.missing.length > 0) process.exit(1);
}
