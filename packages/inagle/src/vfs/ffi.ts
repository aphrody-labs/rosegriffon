/**
 * @file vfs/ffi.ts
 * @description Binding bun:ffi natif minimal vers libiecode.so pour le VFS IEVR.
 *
 * Expose uniquement les symbols dont le VFS inagle a besoin :
 *   - CPK r/o (open_file, read_file, count, filename, find_entry, free)
 *   - cfg.bin parser (parse, result_json, result_free, free)
 *   - G4TX → PNG/WebP (parse, count, info, export_png, export_webp_ex, free)
 *   - Compression Level-5 (decompress auto-detect, free)
 *
 * Avantages vs Bun.spawn(iecode CLI) :
 *   - Pas de fork/exec : ~ms vs 50ms par appel
 *   - Pas de tmpdir/tmpfile : tout en mémoire
 *   - Bytes CPK extraits directement en Uint8Array via toArrayBuffer
 *   - Parse cfg.bin retourne le JSON sans serialiser→fs→deserialiser
 *
 * Layout :
 *   La lib partagee `libiecode.so` est buildée par `cmake --build --preset
 *   linux-vps-gcc --target iecode_ffi`. Le path est resolu via env
 *   `IECODE_LIB_PATH`, sinon auto-detect dans `cli/build/linux-vps-gcc/ffi/`.
 *
 * Memoire :
 *   - Les buffers retournes par C++ doivent etre liberes via `iecode_free()`.
 *   - `toArrayBuffer(ptr, 0, size, finalizer)` permet de transferer la propriete
 *     a la GC JS : Bun appellera `iecode_free(ptr)` quand le buffer est ramasse.
 */

import {
  dlopen,
  FFIType,
  JSCallback,
  ptr,
  read,
  suffix,
  toArrayBuffer,
  type Pointer,
} from "bun:ffi";
import { existsSync } from "node:fs";
import { join } from "node:path";

const T = FFIType;

function resolveLibPath(): string {
  const env = Bun.env.IECODE_LIB_PATH;
  if (env && existsSync(env)) return env;
  // Layout VPS : packages/inagle → packages/iecode/cli/build/...
  const root = "/home/ubuntu/vps/packages/iecode/cli/build";
  const candidates = [
    `${root}/linux-vps-gcc/ffi/libiecode.${suffix}`,
    `${root}/release/ffi/libiecode.${suffix}`,
    `${root}/debug/ffi/libiecode.${suffix}`,
  ];
  const found = candidates.find(existsSync);
  if (!found) {
    throw new Error(
      `inagle/vfs/ffi: libiecode.${suffix} introuvable. Tentes :\n  ${candidates.join("\n  ")}\n` +
        `Build via 'cmake --build --preset linux-vps-gcc --target iecode_ffi'.`,
    );
  }
  return found;
}

let lib: any = null;
let S: any = null;

function ensureLib() {
  if (!lib) {
    lib = dlopen(resolveLibPath(), {
      // Lifecycle
      iecode_version: { args: [], returns: T.cstring },
      iecode_free: { args: [T.ptr], returns: T.void },

      // CPK reader
      iecode_cpk_open_file: { args: [T.cstring], returns: T.ptr },
      iecode_cpk_count: { args: [T.ptr], returns: T.u32 },
      iecode_cpk_filename: { args: [T.ptr, T.u32], returns: T.cstring },
      iecode_cpk_find_entry: { args: [T.ptr, T.cstring], returns: T.i32 },
      iecode_cpk_entry_size: { args: [T.ptr, T.u32], returns: T.u32 },
      iecode_cpk_entry_extract_size: { args: [T.ptr, T.u32], returns: T.u32 },
      iecode_cpk_read_file: { args: [T.ptr, T.cstring, T.ptr], returns: T.ptr },
      iecode_cpk_extract: { args: [T.ptr, T.i32, T.ptr], returns: T.ptr },
      iecode_cpk_entry_directory: { args: [T.ptr, T.i32], returns: T.cstring },
      iecode_cpk_free: { args: [T.ptr], returns: T.void },

      // cfg.bin parser
      iecode_cfgbin_parse: { args: [T.ptr, T.u32], returns: T.ptr },
      iecode_result_json: { args: [T.ptr], returns: T.cstring },
      iecode_result_free: { args: [T.ptr], returns: T.void },

      // G4TX texture
      iecode_g4tx_parse: { args: [T.ptr, T.u32], returns: T.ptr },
      iecode_g4tx_count: { args: [T.ptr], returns: T.i32 },
      iecode_g4tx_info: { args: [T.ptr, T.i32], returns: T.cstring },
      iecode_g4tx_export_png: {
        args: [T.ptr, T.i32, T.cstring],
        returns: T.i32,
      },
      iecode_g4tx_export_webp_ex: {
        args: [T.ptr, T.i32, T.cstring, T.i32, T.i32],
        returns: T.i32,
      },
      iecode_g4tx_encode_webp: {
        args: [T.ptr, T.i32, T.i32, T.i32, T.ptr],
        returns: T.ptr,
      },
      iecode_g4tx_encode_webp_resize: {
        args: [T.ptr, T.i32, T.i32, T.i32, T.i32, T.ptr],
        returns: T.ptr,
      },
      iecode_g4tx_decode_rgba: {
        args: [T.ptr, T.i32, T.ptr, T.ptr],
        returns: T.ptr,
      },
      iecode_g4tx_free: { args: [T.ptr], returns: T.void },

      // Decompression Level-5 auto-detect (optionnel pour data brutes compressees)
      iecode_level5_decompress: {
        args: [T.ptr, T.u32, T.ptr],
        returns: T.ptr,
      },
    });
    S = lib.symbols;
  }
  return S;
}

const enc = new TextEncoder();

function cstr(s: string): Uint8Array {
  const bytes = enc.encode(s);
  const buf = new Uint8Array(bytes.length + 1);
  buf.set(bytes);
  return buf;
}

/** Convertit un pointeur C alloué par C++ en Uint8Array détenu par JS.
 *  Copie les bytes (size) puis libère le buffer source via `iecode_free`.
 *  Note : le finalizer-mode de `toArrayBuffer` produit un buffer vide
 *  silencieusement avec ce build de Bun → on prefere la copie + free explicite. */
function takeOwnedBytes(p: Pointer | null, size: number): Uint8Array {
  if (!p) throw new Error("iecode FFI: pointeur null");
  if (size === 0) return new Uint8Array(0);
  // Vue temporaire sur la mémoire C, sans transfert de propriete.
  const view = new Uint8Array(toArrayBuffer(p, 0, size));
  // Copie pour devenir indépendant de la libération en aval.
  const owned = new Uint8Array(size);
  owned.set(view);
  ensureLib().iecode_free(p);
  return owned;
}

/** Lit l'u32 a une adresse (pour out_size paramètres). */
function readU32At(buf: Uint8Array): number {
  return new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0, true);
}

// ── API publique ──────────────────────────────────────────────────────

export function ffiVersion(): string {
  const cs = ensureLib().iecode_version();
  return cs ? String(cs) : "?";
}

export class CpkHandle {
  private h: Pointer;
  constructor(handle: Pointer) {
    this.h = handle;
  }
  static open(path: string): CpkHandle {
    const h = ensureLib().iecode_cpk_open_file(cstr(path)) as Pointer | null;
    if (!h) throw new Error(`cpk_open_file echec: ${path}`);
    return new CpkHandle(h);
  }
  get count(): number {
    return Number(ensureLib().iecode_cpk_count(this.h));
  }
  filename(i: number): string {
    const cs = ensureLib().iecode_cpk_filename(this.h, i);
    return cs ? String(cs) : "";
  }
  directory(i: number): string {
    const cs = ensureLib().iecode_cpk_entry_directory(this.h, i);
    return cs ? String(cs) : "";
  }
  /** Chemin interne complet (directory/filename) — utilisable avec readFile/findEntry. */
  fullPath(i: number): string {
    const dir = this.directory(i);
    const name = this.filename(i);
    return dir ? `${dir}/${name}` : name;
  }
  findEntry(internalPath: string): number {
    return Number(ensureLib().iecode_cpk_find_entry(this.h, cstr(internalPath)));
  }
  /** Extrait un fichier interne du CPK et retourne ses bytes (deja decompresse/dechiffre). */
  readFile(internalPath: string): Uint8Array {
    const sizeBuf = new Uint8Array(4);
    const p = ensureLib().iecode_cpk_read_file(this.h, cstr(internalPath), ptr(sizeBuf)) as Pointer | null;
    const size = readU32At(sizeBuf);
    if (!p || size === 0) throw new Error(`cpk_read_file vide: ${internalPath}`);
    return takeOwnedBytes(p, size);
  }
  /** Variante par index direct (evite la double resolution path → idx). */
  extract(idx: number): Uint8Array {
    const sizeBuf = new Uint8Array(4);
    const p = ensureLib().iecode_cpk_extract(this.h, idx, ptr(sizeBuf)) as Pointer | null;
    const size = readU32At(sizeBuf);
    if (!p || size === 0) throw new Error(`cpk_extract(${idx}) vide`);
    return takeOwnedBytes(p, size);
  }
  close(): void {
    ensureLib().iecode_cpk_free(this.h);
  }
}

/** Parse un cfg.bin et retourne le JSON. */
export function parseCfgBinNative(data: Uint8Array): unknown {
  const handle = ensureLib().iecode_cfgbin_parse(ptr(data), data.byteLength) as Pointer | null;
  if (!handle) throw new Error("cfgbin_parse echec");
  try {
    const cs = ensureLib().iecode_result_json(handle);
    if (!cs) throw new Error("cfgbin_parse: result_json null");
    return JSON.parse(String(cs));
  } finally {
    ensureLib().iecode_result_free(handle);
  }
}

export class G4txHandle {
  constructor(private h: Pointer) {}
  static parse(data: Uint8Array): G4txHandle {
    const h = ensureLib().iecode_g4tx_parse(ptr(data), data.byteLength) as Pointer | null;
    if (!h) throw new Error("g4tx_parse echec");
    return new G4txHandle(h);
  }
  get count(): number {
    return Number(ensureLib().iecode_g4tx_count(this.h));
  }
  info(idx: number): { width: number; height: number; format: string } {
    const cs = ensureLib().iecode_g4tx_info(this.h, idx);
    return cs ? JSON.parse(String(cs)) : { width: 0, height: 0, format: "?" };
  }
  /** Ecrit la texture sur disque en PNG (lossless). Retourne true si OK. */
  exportPng(idx: number, outPath: string): boolean {
    return Number(ensureLib().iecode_g4tx_export_png(this.h, idx, cstr(outPath))) !== 0;
  }
  /** Ecrit la texture sur disque en WebP. lossless=true → preserve tous les pixels. */
  exportWebp(idx: number, outPath: string, quality = 100, lossless = true): boolean {
    return (
      Number(
        ensureLib().iecode_g4tx_export_webp_ex(this.h, idx, cstr(outPath), quality, lossless ? 1 : 0),
      ) !== 0
    );
  }
  /** Encode la texture en WebP entierement en memoire (sans tmpfile). */
  encodeWebp(idx: number, quality = 100, lossless = true): Uint8Array {
    const sizeBuf = new Uint8Array(4);
    const p = ensureLib().iecode_g4tx_encode_webp(
      this.h,
      idx,
      quality,
      lossless ? 1 : 0,
      ptr(sizeBuf),
    ) as Pointer | null;
    const size = readU32At(sizeBuf);
    if (!p || size === 0) throw new Error(`g4tx_encode_webp(${idx}) echec`);
    return takeOwnedBytes(p, size);
  }

  /**
   * Encode WebP avec resize (downscale a `targetWidth`, aspect ratio preserve).
   * Si `targetWidth <= 0` ou >= width source, comportement equivalent a `encodeWebp`.
   * Resize via WebPPictureRescale (box filter, qualite preservee).
   */
  encodeWebpResize(idx: number, targetWidth: number, quality = 100, lossless = true): Uint8Array {
    const sizeBuf = new Uint8Array(4);
    const p = ensureLib().iecode_g4tx_encode_webp_resize(
      this.h,
      idx,
      targetWidth,
      quality,
      lossless ? 1 : 0,
      ptr(sizeBuf),
    ) as Pointer | null;
    const size = readU32At(sizeBuf);
    if (!p || size === 0)
      throw new Error(`g4tx_encode_webp_resize(${idx}, w=${targetWidth}) echec`);
    return takeOwnedBytes(p, size);
  }

  /** Decode la texture en RGBA8 brut (width*height*4 bytes). */
  decodeRgba(idx: number): { rgba: Uint8Array; width: number; height: number } {
    const wBuf = new Uint8Array(4);
    const hBuf = new Uint8Array(4);
    const p = ensureLib().iecode_g4tx_decode_rgba(this.h, idx, ptr(wBuf), ptr(hBuf)) as Pointer | null;
    const width = readU32At(wBuf);
    const height = readU32At(hBuf);
    const size = width * height * 4;
    if (!p || size === 0) throw new Error("g4tx_decode_rgba echec");
    const rgba = takeOwnedBytes(p, size);
    return { rgba, width, height };
  }
  close(): void {
    ensureLib().iecode_g4tx_free(this.h);
  }
}

/** Decompresse des bytes Level-5 (auto-detect LZ10/LZ4/CRILAYLA/Huffman/RLE/ZLib). */
export function decompressLevel5Native(data: Uint8Array): Uint8Array {
  const sizeBuf = new Uint8Array(4);
  const p = ensureLib().iecode_level5_decompress(ptr(data), data.byteLength, ptr(sizeBuf)) as Pointer | null;
  const size = readU32At(sizeBuf);
  if (!p || size === 0) throw new Error("decompress_level5 echec");
  return takeOwnedBytes(p, size);
}

export const iecodeFfi = {
  version: ffiVersion,
  openCpkFile: CpkHandle.open,
  parseCfgBin: parseCfgBinNative,
  parseG4tx: G4txHandle.parse,
  decompress: decompressLevel5Native,
};
