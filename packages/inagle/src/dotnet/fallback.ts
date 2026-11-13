/**
 * @file fallback.ts
 * @description High-fidelity pure-JS fallback for IECODE .NET operations when native binary is absent.
 */

import {
  computeLevel5Crc32 as fallbackCrc32,
  decompressCrilayla as fallbackDecompress,
  decryptCpkBlock as fallbackDecrypt,
  isCrilayla as fallbackIsCrilayla,
} from "../nie-bridge/index.js";
import {
  FORMAT_ID_MAP,
  type DetectedFormat,
  type DotnetBridgeStatus,
  type IDotnetBridge,
} from "./types.js";

// Magic values read little-endian, kept in sync with IECODE.Core.FormatDetector.
const MAGIC_FORMAT_IDS = new Map<number, number>([
  [0x58543447, 1],
  [0x444d3447, 2],
  [0x474d3447, 3],
  [0x544d3447, 4],
  [0x4b533447, 5],
  [0x4b503447, 6],
  [0x41523447, 7],
  [0x4147492e, 8],
  [0x6f626a62, 9],
  [0x5058434c, 10],
  [0x4e424452, 11],
  [0x41534658, 12],
  [0x4b435058, 13],
  [0x204b5043, 14],
  [0x32534641, 15],
  [0x00465455, 19],
  [0x46545540, 19],
  [0x46544140, 20],
  [0x20534444, 22],
  [0x474e5089, 23],
  [0x46464952, 24],
  [0x04034b50, 26],
  [0xfd2fb528, 28],
]);

export class FallbackDotnetBridge implements IDotnetBridge {
  private readonly _status: DotnetBridgeStatus = {
    available: false,
    mode: "fallback",
    version: "2.0.5-fallback",
    schema: "iecode.ffi/v1",
    libraryPath: null,
  };

  public get status(): DotnetBridgeStatus {
    return this._status;
  }

  public isAvailable(): boolean {
    return false;
  }

  public computeLevel5Crc32(data: Uint8Array | string): number {
    return fallbackCrc32(data);
  }

  public detectFormat(data: Uint8Array): DetectedFormat {
    if (data.length === 0) {
      return { format: "Unknown", formatId: 0, name: "Empty", extension: "" };
    }
    let formatId = 0;
    if (data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b) {
      formatId = 27;
    } else if (data.length >= 4) {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      formatId =
        MAGIC_FORMAT_IDS.get(view.getUint32(0, true)) ??
        MAGIC_FORMAT_IDS.get(view.getUint32(0, false)) ??
        0;
      if (
        formatId === 0 &&
        data.length >= 8 &&
        data[0] === 0x4e &&
        data[1] === 0x58 &&
        data[2] === 0x54 &&
        data[3] === 0x43 &&
        data[4] === 0x48
      ) {
        formatId = 25;
      }
    }
    return { ...FORMAT_ID_MAP[formatId]!, formatId };
  }

  public isCrilayla(data: Uint8Array): boolean {
    return fallbackIsCrilayla(data);
  }

  public decompressCrilayla(data: Uint8Array): Uint8Array {
    return fallbackDecompress(data);
  }

  public compressCrilayla(data: Uint8Array): Uint8Array {
    if (data.length < 0x100 || data.length > 256 * 1024 * 1024) {
      throw new RangeError(
        "CRILAYLA input must contain between 256 and 268435456 bytes",
      );
    }
    const rawBlockSize = Math.min(data.length, 0x100);
    const uncompressedPayloadSize =
      data.length > 0x100 ? data.length - 0x100 : 0;

    // Each payload byte is a zero literal flag followed by eight data bits.
    // Pack directly into the reversed stream rather than allocating one JS
    // number per bit (which can exhaust memory for ordinary game assets).
    const headerOffset = Math.ceil((uncompressedPayloadSize * 9) / 8);
    const totalSize = 16 + headerOffset + 0x100;
    const out = new Uint8Array(totalSize);

    // Header "CRILAYLA"
    new TextEncoder().encodeInto("CRILAYLA", out.subarray(0, 8));
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    view.setUint32(8, uncompressedPayloadSize, true);
    view.setUint32(12, headerOffset, true);

    let bitIndex = 0;
    for (let i = data.length - 1; i >= 0x100; i--) {
      bitIndex++; // The zero literal flag is already present in the output.
      const byte = data[i]!;
      for (let bit = 7; bit >= 0; bit--, bitIndex++) {
        if ((byte & (1 << bit)) !== 0) {
          const outputIndex = 16 + headerOffset - 1 - Math.floor(bitIndex / 8);
          out[outputIndex] |= 1 << (7 - (bitIndex % 8));
        }
      }
    }

    // Raw block
    const rawDst = 16 + headerOffset;
    out.fill(0, rawDst, rawDst + 0x100);
    if (rawBlockSize > 0) {
      out.set(data.subarray(0, rawBlockSize), rawDst);
    }

    return out;
  }

  public decryptCpkBlock(
    data: Uint8Array,
    offset: bigint | number = 0n,
    key: bigint | number = 0x1717e18en,
  ): Uint8Array {
    const copy = new Uint8Array(data.length);
    copy.set(data);
    // The ABI accepts uint64 values; the cipher uses the low 32 bits. Keep
    // bigint precision until after truncation, including for large file offsets.
    const abiKey = BigInt.asUintN(64, BigInt(key));
    const numKey =
      abiKey === 0n ? 0x1717e18e : Number(BigInt.asUintN(32, abiKey));
    const numOffset = Number(BigInt.asUintN(32, BigInt(offset)));
    fallbackDecrypt(copy, numKey, numOffset);
    return copy;
  }

  public isRdbn(data: Uint8Array): boolean {
    // Match the native ABI, which requires a complete minimum-size RDBN header.
    if (data.length < 0x50) return false;
    return (
      data[0] === 0x52 && // R
      data[1] === 0x44 && // D
      data[2] === 0x42 && // B
      data[3] === 0x4e // N
    );
  }
}
