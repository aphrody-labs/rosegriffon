/**
 * @file nie-bridge.test.ts
 * @description Verifies Azalee CPK nie-bridge buffer validation.
 */

import { describe, expect, it } from "bun:test";
import { CPK_MAGIC, SECTOR_SIZE, UTF_MAGIC, verifyCpkBuffer } from "../src/cpk/nie-bridge.js";

describe("azalee cpk nie-bridge", () => {
  it("detects valid CPK archive header with @UTF descriptor", () => {
    const buf = new Uint8Array(SECTOR_SIZE);
    const view = new DataView(buf.buffer);

    // CPK magic
    view.setUint32(0, CPK_MAGIC, true);
    // @UTF magic at offset 16
    view.setUint32(16, UTF_MAGIC, false);

    const result = verifyCpkBuffer(buf);
    expect(result.isValid).toBe(true);
    expect(result.magic).toBe(CPK_MAGIC);
    expect(result.sectorSize).toBe(0x800);
    expect(result.utfOffset).toBe(16);
  });

  it("rejects undersized buffers or non-CPK magics", () => {
    const smallBuf = new Uint8Array(100);
    expect(verifyCpkBuffer(smallBuf).isValid).toBe(false);

    const invalidBuf = new Uint8Array(SECTOR_SIZE);
    expect(verifyCpkBuffer(invalidBuf).isValid).toBe(false);
  });
});
