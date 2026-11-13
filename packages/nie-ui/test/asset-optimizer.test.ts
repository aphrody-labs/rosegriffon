// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { NieAssetOptimizer } from "../src/assets/asset-optimizer";

describe("NieAssetOptimizer Suite", () => {
  const optimizer = new NieAssetOptimizer("https://cdn.rosegriffon.fr");

  test("résout les textures G4TX vers les endpoints CDN optimisés WebP/PNG", () => {
    const webpUrl = optimizer.resolveOptimizedTextureUrl(
      "data/dx11/menu/001_chara/c01000010.g4tx",
      "webp",
    );
    expect(webpUrl).toBe(
      "https://cdn.rosegriffon.fr/dx11/menu/001_chara/c01000010.webp",
    );

    const pngUrl = optimizer.resolveOptimizedTextureUrl(
      "data/dx11/menu/002_emblem/emb_001.g4tx",
      "png",
    );
    expect(pngUrl).toBe(
      "https://cdn.rosegriffon.fr/dx11/menu/002_emblem/emb_001.png",
    );
  });

  test("résout les modèles 3D vers le format GLB assemblé", () => {
    const modelUrl = optimizer.resolveOptimizedModelUrl("c01000010");
    expect(modelUrl).toBe(
      "https://cdn.rosegriffon.fr/model-full/c01000010.glb",
    );
  });

  test("génère un atlas CSS Sprite pour l'exploitation sans requête réseau multiple", () => {
    const atlas = optimizer.buildSpriteAtlas(
      "https://cdn.rosegriffon.fr/dx11/menu/sprites/items_atlas.png",
      512,
      512,
      [
        {
          id: "boots_01",
          name: "Crampons Foudre",
          category: "item",
          col: 0,
          row: 0,
          size: 64,
        },
        {
          id: "glove_01",
          name: "Gants Majin",
          category: "item",
          col: 1,
          row: 0,
          size: 64,
        },
        {
          id: "chara_endou",
          name: "Endou Mamoru",
          category: "character",
          col: 0,
          row: 1,
          size: 64,
        },
      ],
    );

    expect(atlas.entries.size).toBe(3);
    const boots = atlas.entries.get("boots_01");
    expect(boots?.x).toBe(0);
    expect(boots?.y).toBe(0);
    expect(boots?.cssStyle.backgroundPosition).toBe("-0px -0px");
    expect(boots?.cssStyle.width).toBe("64px");

    const gloves = atlas.entries.get("glove_01");
    expect(gloves?.x).toBe(64);
    expect(gloves?.y).toBe(0);
    expect(gloves?.cssStyle.backgroundPosition).toBe("-64px -0px");

    const endou = atlas.entries.get("chara_endou");
    expect(endou?.x).toBe(0);
    expect(endou?.y).toBe(64);
    expect(endou?.cssStyle.backgroundPosition).toBe("-0px -64px");
  });

  test("fournit les fonds d'écran et décors de stade pour l'interface immersive", () => {
    const wallpapers = optimizer.getCuratedWallpapers();
    expect(wallpapers.length).toBeGreaterThanOrEqual(4);
    expect(wallpapers.some((w) => w.id === "nagumohara-coast")).toBe(true);
    expect(wallpapers.some((w) => w.id === "odaiba-arena-night")).toBe(true);
  });
});
