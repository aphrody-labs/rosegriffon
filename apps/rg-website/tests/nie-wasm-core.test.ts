// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  NieWasmEngine,
  getNieWasmInstance,
} from "../src/lib/wasm/nie-wasm-core";

describe("NieWasmEngine Suite (WebAssembly in Next.js + Bun)", () => {
  const engine = new NieWasmEngine([
    "data/dx11/menu/001_chara/c01000010.g4tx",
    "data/dx11/menu/001_chara/c01000020.g4tx",
    "data/dx11/menu/002_emblem/emb_raimon.g4tx",
    "data/dx11/model/c01000010.g4md",
    "data/dx11/model/c01000010.g4mg",
    "data/sound/bgm/bgm_match_01.hca",
  ]);

  test("instancie le module WebAssembly avec succès", async () => {
    const wasm = await getNieWasmInstance();
    expect(wasm).toBeDefined();
    expect(typeof wasm.exports.calculate_power).toBe("function");
    expect(typeof wasm.exports.elemental_affinity).toBe("function");
  });

  test("calcule la puissance des techniques via WebAssembly (avec et sans STAB)", async () => {
    // Base 100, Level 50, same element bonus
    // (100 * (100 + 50 * 2) * 120) / 10000 = (100 * 200 * 120) / 10000 = 240
    const powerWithBonus = await engine.calculateTechniquePower(100, 50, true);
    expect(powerWithBonus).toBe(240);

    // Without same element bonus (multiplier 100)
    // (100 * 200 * 100) / 10000 = 200
    const powerNeutral = await engine.calculateTechniquePower(100, 50, false);
    expect(powerNeutral).toBe(200);
  });

  test("évalue les multiplicateurs d'affinité élémentaire en WebAssembly", async () => {
    // Wind (1) vs Mountain (4) -> (1 - 4 + 4) % 4 = 1 => Advantage (1.5x)
    const adv = await engine.getElementalMultiplier(1, 4);
    expect(adv).toBe(1.5);

    // Mountain (4) vs Wind (1) -> (4 - 1 + 4) % 4 = 7 % 4 = 3 => Disadvantage (0.7x)
    const disadv = await engine.getElementalMultiplier(4, 1);
    expect(disadv).toBe(0.7);

    // Same element -> Neutral (1.0x)
    const neutral = await engine.getElementalMultiplier(2, 2);
    expect(neutral).toBe(1.0);
  });

  test("calcule le CRC32 IEEE 802.3 ultra-rapide", () => {
    const text = new TextEncoder().encode("IEVR_CPK_CHECK_SUM_2026");
    const crc = engine.crc32(text);
    expect(typeof crc).toBe("number");
    expect(crc).toBeGreaterThan(0);

    // Identical data produces identical CRC
    const crc2 = engine.crc32(text);
    expect(crc2).toBe(crc);
  });

  test("recherche et filtre les chemins VFS sans latence serveur", () => {
    const resultsChara = engine.queryVfs("c01000010");
    expect(resultsChara).toHaveLength(3);
    expect(resultsChara).toContain("data/dx11/menu/001_chara/c01000010.g4tx");
    expect(resultsChara).toContain("data/dx11/model/c01000010.g4md");

    const resultsEmblem = engine.queryVfs("emblem");
    expect(resultsEmblem).toHaveLength(1);
    expect(resultsEmblem[0]).toBe("data/dx11/menu/002_emblem/emb_raimon.g4tx");
  });

  test("valide les en-têtes de sauvegarde du jeu", () => {
    // 1. RDBN database file
    const rdbnBytes = new Uint8Array([
      0x52, 0x44, 0x42, 0x4e, 0x00, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(engine.verifySaveHeader(rdbnBytes).headerType).toBe("RDBN");

    // 2. Mock 8KB save data
    const saveBytes = new Uint8Array(8192);
    expect(engine.verifySaveHeader(saveBytes).headerType).toBe("USERDATALIVE");

    // 3. Invalid short data
    const shortBytes = new Uint8Array([1, 2, 3]);
    expect(engine.verifySaveHeader(shortBytes).isValid).toBe(false);
  });
});
