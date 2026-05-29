/**
 * @file vfs/index.ts
 * @description Streaming des assets IEVR depuis les CPKs natifs via bun:ffi.
 *
 * Pipeline natif (libiecode.so) :
 *   1. Charge un index VFS (path → cpk) genere par `iecode vfs export-index`
 *   2. Resolution path → cpk (O(1) via Map)
 *   3. `CpkHandle.open(cpkPath)` ouvre le CPK (handle cache LRU)
 *   4. `cpk.readFile(internalPath)` extrait + dechiffre + decompresse en memoire
 *   5. cfg.bin : `parseCfgBinNative(bytes)` retourne JSON direct (FFI)
 *   6. G4TX → WebP : `G4txHandle.parse(bytes).encodeWebp(idx, q, lossless)` in-memory
 *   7. Caches LRU memoire (bytes, cfg.bin parsed, images)
 *
 * Pas de subprocess, pas de tmpdir, pas de tmpfile. Ouverture CPK 1x puis
 * extractions O(1) tant que le handle reste cache.
 *
 * Migration depuis l'ancien pipeline `Bun.spawn(iecode CLI)` :
 *   - Suppression complete de `node:os/tmpdir`, `mkdtemp`, `rm` recursive
 *   - Suppression de `Bun.spawn` + tmpfile output
 *   - Suppression du flag `iecodeBin` dans VfsConfig (toujours dispo via FFI)
 *
 * @example
 * ```ts
 * import { createVfs } from "@rosegriffon/inagle/vfs";
 * const vfs = await createVfs();
 * const bytes = await vfs.readAsset("data/common/gamedata/character/chara_base_1.03.98.00.cfg.bin");
 * const json = await vfs.readCfgBin("data/common/gamedata/character/chara_base_1.03.98.00.cfg.bin");
 * const img = await vfs.readImage("data/dx11/menu/200_icon/10_icon_chr/aura_soul/a000010_l.g4tx");
 * ```
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ByteLru, CountLru } from "./lru.js";
import { resolveVfsConfig } from "./config.js";
import { CpkHandle, G4txHandle, ffiVersion, parseCfgBinNative } from "./ffi.js";
import type { VfsConfig, VfsIndex, VfsResolvedAsset } from "./types.js";

export type { VfsConfig, VfsResolvedAsset } from "./types.js";

export type ImageFormat = "webp" | "png";

export interface ImageBytes {
  bytes: Uint8Array;
  format: ImageFormat;
  contentType: string;
}

export interface ImageOptions {
  /** Index de texture si le G4TX en contient plusieurs (defaut 0). */
  index?: number;
  /**
   * Qualité WebP 0..100 (ignoré si format=png ou lossless=true).
   * Defaut 100.
   */
  quality?: number;
  /**
   * WebP lossless (defaut true). false = lossy → compression plus forte
   * mais perte de pixels visibles sur sprites avec alpha fin.
   */
  lossless?: boolean;
}

export class IevrVfs {
  private resolveMap = new Map<string, VfsResolvedAsset>();
  private readonly bytesCache: ByteLru<Uint8Array>;
  private readonly cfgBinCache: CountLru<unknown>;
  private readonly imageCache: ByteLru<Uint8Array>;
  private readonly cpkHandles = new Map<string, CpkHandle>();
  private inflight = new Map<string, Promise<Uint8Array>>();
  private inflightImg = new Map<string, Promise<Uint8Array>>();

  private constructor(public readonly config: VfsConfig) {
    this.bytesCache = new ByteLru<Uint8Array>(config.cacheBytesMax);
    this.cfgBinCache = new CountLru<unknown>(config.cacheCfgBinMax);
    this.imageCache = new ByteLru<Uint8Array>(config.cacheBytesMax);
  }

  static async create(overrides?: Partial<VfsConfig>): Promise<IevrVfs> {
    const cfg = resolveVfsConfig(overrides);
    const vfs = new IevrVfs(cfg);
    await vfs.loadIndex();
    return vfs;
  }

  private async loadIndex(): Promise<void> {
    const index = (await Bun.file(this.config.indexPath).json()) as VfsIndex;
    for (const [cpkFile, entries] of Object.entries(index.cpks)) {
      for (const e of entries) {
        this.resolveMap.set(e.p, {
          cpk: cpkFile,
          internalPath: e.p,
          size: e.s,
        });
      }
    }
  }

  get assetCount(): number {
    return this.resolveMap.size;
  }

  get ffiVersion(): string {
    return ffiVersion();
  }

  get cacheStats(): {
    bytes: number;
    bytesCount: number;
    cfgBinCount: number;
    imageBytes: number;
    imageCount: number;
    openCpks: number;
  } {
    return {
      bytes: this.bytesCache.bytes,
      bytesCount: this.bytesCache.count,
      cfgBinCount: this.cfgBinCache.count,
      imageBytes: this.imageCache.bytes,
      imageCount: this.imageCache.count,
      openCpks: this.cpkHandles.size,
    };
  }

  resolve(path: string): VfsResolvedAsset | null {
    return this.resolveMap.get(path) ?? null;
  }

  *list(globPattern?: string): IterableIterator<VfsResolvedAsset> {
    const re = globPattern ? globToRegex(globPattern) : null;
    for (const v of this.resolveMap.values()) {
      if (!re || re.test(v.internalPath)) yield v;
    }
  }

  async readAsset(path: string): Promise<Uint8Array> {
    const cached = this.bytesCache.get(path);
    if (cached) return cached;
    const pending = this.inflight.get(path);
    if (pending) return pending;
    const p = Promise.resolve().then(() => {
      const bytes = this.extractFromCpkSync(path);
      this.bytesCache.set(path, bytes);
      this.inflight.delete(path);
      return bytes;
    });
    this.inflight.set(path, p);
    return p;
  }

  async readCfgBin<T = unknown>(path: string): Promise<T> {
    const cached = this.cfgBinCache.get(path);
    if (cached !== undefined) return cached as T;
    const bytes = await this.readAsset(path);
    const json = parseCfgBinNative(bytes);
    this.cfgBinCache.set(path, json);
    return json as T;
  }

  /**
   * Decode une image (G4TX a l'interieur du CPK) en PNG ou WebP.
   * Pipeline 100% FFI :
   *   - extract bytes du CPK via `CpkHandle.readFile`
   *   - parse G4TX via `G4txHandle.parse`
   *   - WebP : `encodeWebp(idx, q, lossless)` in-memory
   *   - PNG  : `exportPng(idx, tmpfile)` puis `Bun.file().bytes()` (fallback tmpfile,
   *           libwebp n'expose pas d'API in-memory pour PNG)
   *
   * Cache LRU bytes (memoire) sur la cle `path|format|q-lossless`. Inflight
   * dedup pour eviter 2 decodes concurrents sur le meme asset.
   */
  async readImage(
    path: string,
    format: ImageFormat = "webp",
    opts: ImageOptions = {},
  ): Promise<ImageBytes> {
    const index = opts.index ?? 0;
    const quality = opts.quality ?? 100;
    const lossless = opts.lossless ?? true;
    const lossKey = format === "webp" ? `${quality}-${lossless ? "ll" : "ly"}` : "";
    const key = `${path}|${format}|${index}|${lossKey}`;
    const cached = this.imageCache.get(key);
    if (cached) return { bytes: cached, format, contentType: ctOf(format) };
    const pending = this.inflightImg.get(key);
    if (pending) {
      const bytes = await pending;
      return { bytes, format, contentType: ctOf(format) };
    }
    const p = Promise.resolve().then(async () => {
      const bytes = await this.decodeImageFfi(path, format, index, quality, lossless);
      this.imageCache.set(key, bytes);
      this.inflightImg.delete(key);
      return bytes;
    });
    this.inflightImg.set(key, p);
    const bytes = await p;
    return { bytes, format, contentType: ctOf(format) };
  }

  /** Ouvre un CPK et le cache. Re-ouverture O(1) via la Map. */
  private getCpk(cpkFile: string): CpkHandle {
    let h = this.cpkHandles.get(cpkFile);
    if (h) return h;
    h = CpkHandle.open(join(this.config.cpksDir, cpkFile));
    this.cpkHandles.set(cpkFile, h);
    return h;
  }

  private extractFromCpkSync(internalPath: string): Uint8Array {
    const resolved = this.resolveMap.get(internalPath);
    if (!resolved) throw new Error(`vfs: asset introuvable '${internalPath}'`);
    const cpk = this.getCpk(resolved.cpk);
    return cpk.readFile(internalPath);
  }

  private async decodeImageFfi(
    internalPath: string,
    format: ImageFormat,
    index: number,
    quality: number,
    lossless: boolean,
  ): Promise<Uint8Array> {
    const g4Bytes = await this.readAsset(internalPath);
    const tex = G4txHandle.parse(g4Bytes);
    try {
      if (format === "webp") {
        return tex.encodeWebp(index, quality, lossless);
      }
      // PNG fallback : exportPng → tmpfile → read bytes
      const tmp = await mkdtemp(join(tmpdir(), "inagle-png-"));
      const outPath = join(tmp, `tex_${index}.png`);
      try {
        const ok = tex.exportPng(index, outPath);
        if (!ok) throw new Error(`g4tx exportPng echec ${internalPath}#${index}`);
        return await Bun.file(outPath).bytes();
      } finally {
        await rm(tmp, { recursive: true, force: true });
      }
    } finally {
      tex.close();
    }
  }

  /** Ferme tous les CPK handles (cleanup). */
  close(): void {
    for (const h of this.cpkHandles.values()) {
      try {
        h.close();
      } catch {
        /* ignore */
      }
    }
    this.cpkHandles.clear();
  }
}

export async function createVfs(overrides?: Partial<VfsConfig>): Promise<IevrVfs> {
  return IevrVfs.create(overrides);
}

let singleton: Promise<IevrVfs> | null = null;
export function getVfs(): Promise<IevrVfs> {
  if (!singleton) singleton = IevrVfs.create();
  return singleton;
}

function ctOf(format: ImageFormat): string {
  return format === "webp" ? "image/webp" : "image/png";
}

function globToRegex(glob: string): RegExp {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i] as string;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (".+^$()|{}[]\\".includes(c)) re += `\\${c}`;
    else re += c;
  }
  return new RegExp(`${re}$`);
}
