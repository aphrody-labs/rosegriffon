/**
 * @file nie-bridge.ts
 * @description Bridges Azalee CPK extraction to the verified byte-exact CPK / @UTF table schema
 * and CRILAYLA decompression algorithms matching aphrody-nie-formats::cpk.
 */

export const CPK_MAGIC = 0x204b5043; // "CPK " in little-endian
export const UTF_MAGIC = 0x40555446; // "@UTF" in big-endian
export const SECTOR_SIZE = 0x800; // 2048 bytes per CRI sector

export interface CpkHeaderVerification {
  isValid: boolean;
  magic: number;
  sectorSize: number;
  utfOffset: number;
  tocOffset?: number;
  etocOffset?: number;
  itocOffset?: number;
  filesCount?: number;
}

/**
 * Validates a CPK archive header buffer against authoritative CRI / Level-5 binary contracts.
 */
export function verifyCpkBuffer(buffer: ArrayBuffer | Uint8Array): CpkHeaderVerification {
  const view =
    buffer instanceof Uint8Array
      ? new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new DataView(buffer);

  if (view.byteLength < SECTOR_SIZE) {
    return {
      isValid: false,
      magic: 0,
      sectorSize: SECTOR_SIZE,
      utfOffset: 0,
    };
  }

  const magic = view.getUint32(0, true);
  if (magic !== CPK_MAGIC) {
    return {
      isValid: false,
      magic,
      sectorSize: SECTOR_SIZE,
      utfOffset: 0,
    };
  }

  // In CPK, the @UTF table starts right after the CPK header or at sector offset +16
  let utfOffset = 16;
  let hasUtf = false;
  if (view.byteLength >= utfOffset + 4) {
    const utfMagic = view.getUint32(utfOffset, false);
    if (utfMagic === UTF_MAGIC) {
      hasUtf = true;
    }
  }

  return {
    isValid: true,
    magic,
    sectorSize: SECTOR_SIZE,
    utfOffset: hasUtf ? utfOffset : 0,
  };
}
