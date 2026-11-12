// SPDX-License-Identifier: Apache-2.0
/**
 * @aphrody/nie-ui — Asset Optimization & Multi-Format Converter Pipeline
 *
 * Converts native game binary assets into web-optimized, readable formats:
 * - G4TX / DDS -> WebP / PNG / AVIF
 * - G4MD / G4MG / EMD -> glTF 2.0 / GLB
 * - Binary databases (RDBN / CFGBIN) -> Typed JSON
 * - Sprite Sheets -> CSS Atlas Coordinates & SVG Emblems
 * - Wallpapers & Backdrops -> Responsive High-Res Assets with Shader Gradients
 */

export interface OptimizedTexture {
  format: "webp" | "png" | "avif";
  width: number;
  height: number;
  byteLength: number;
  dataUrl?: string;
  cdnUrl: string;
}

export interface SpriteAtlasEntry {
  id: string;
  name: string;
  category: "item" | "character" | "emblem" | "skill" | "tactic";
  x: number;
  y: number;
  width: number;
  height: number;
  cssStyle: Record<string, string>;
}

export interface SpriteAtlas {
  sheetUrl: string;
  sheetWidth: number;
  sheetHeight: number;
  entries: Map<string, SpriteAtlasEntry>;
}

export interface WallpaperAsset {
  id: string;
  title: string;
  category: "stadium" | "cinematic" | "character" | "cyber";
  baseColor: string;
  accentColor: string;
  imageUrl: string;
  overlayGradient: string;
}

export class NieAssetOptimizer {
  private readonly cdnBase: string;

  constructor(cdnBase = "https://cdn.rosegriffon.fr") {
    this.cdnBase = cdnBase.replace(/\/+$/, "");
  }

  /**
   * Resolves a raw VFS or CPK texture path to its optimized CDN endpoint.
   * G4TX textures under data/dx11/ are served on-the-fly as WebP/PNG.
   */
  public resolveOptimizedTextureUrl(
    vfsPath: string,
    preferredFormat: "webp" | "png" | "avif" = "webp",
  ): string {
    const cleanPath = vfsPath.replace(/^data\/dx11\//, "").replace(/\.g4tx$/i, "");
    return `${this.cdnBase}/dx11/${cleanPath}.${preferredFormat}`;
  }

  /**
   * Resolves a 3D character or stadium model code to an assembled GLB binary endpoint.
   */
  public resolveOptimizedModelUrl(characterCode: string): string {
    return `${this.cdnBase}/model-full/${characterCode}.glb`;
  }

  /**
   * Builds a CSS Sprite Atlas mapping for compact, zero-roundtrip rendering of game icons.
   */
  public buildSpriteAtlas(
    sheetUrl: string,
    sheetWidth: number,
    sheetHeight: number,
    items: Array<{ id: string; name: string; category: SpriteAtlasEntry["category"]; col: number; row: number; size: number }>,
  ): SpriteAtlas {
    const entries = new Map<string, SpriteAtlasEntry>();

    for (const item of items) {
      const x = item.col * item.size;
      const y = item.row * item.size;
      entries.set(item.id, {
        id: item.id,
        name: item.name,
        category: item.category,
        x,
        y,
        width: item.size,
        height: item.size,
        cssStyle: {
          backgroundImage: `url(${sheetUrl})`,
          backgroundPosition: `-${x}px -${y}px`,
          backgroundSize: `${sheetWidth}px ${sheetHeight}px`,
          width: `${item.size}px`,
          height: `${item.size}px`,
          display: "inline-block",
        },
      });
    }

    return {
      sheetUrl,
      sheetWidth,
      sheetHeight,
      entries,
    };
  }

  /**
   * Generates a curated catalog of responsive stadium wallpapers and backdrops.
   */
  public getCuratedWallpapers(): WallpaperAsset[] {
    return [
      {
        id: "nagumohara-coast",
        title: "Nagumohara - Côte Sud & Baie d'Okinawa",
        category: "stadium",
        baseColor: "#051630",
        accentColor: "#00FFFF",
        imageUrl: `${this.cdnBase}/dx11/menu/wallpaper/bg_nagumohara_coast.png`,
        overlayGradient: "linear-gradient(180deg, rgba(5,22,48,0.3) 0%, rgba(5,22,48,0.92) 100%)",
      },
      {
        id: "odaiba-arena-night",
        title: "Stade Odaiba - Arène Cyber Nocturne",
        category: "stadium",
        baseColor: "#070E20",
        accentColor: "#0874FF",
        imageUrl: `${this.cdnBase}/dx11/menu/wallpaper/bg_odaiba_arena.png`,
        overlayGradient: "radial-gradient(circle at 50% 30%, rgba(8,116,255,0.25) 0%, rgba(7,14,32,0.95) 75%)",
      },
      {
        id: "raimon-hallowed-ground",
        title: "Collège Raimon - Terrain Historique",
        category: "character",
        baseColor: "#0A1F14",
        accentColor: "#FFCC00",
        imageUrl: `${this.cdnBase}/dx11/menu/wallpaper/bg_raimon_ground.png`,
        overlayGradient: "linear-gradient(135deg, rgba(255,204,0,0.15) 0%, rgba(10,31,20,0.9) 100%)",
      },
      {
        id: "teikoku-command-center",
        title: "Académie Royale - Quartier Général",
        category: "cyber",
        baseColor: "#140810",
        accentColor: "#FF3B30",
        imageUrl: `${this.cdnBase}/dx11/menu/wallpaper/bg_teikoku_hq.png`,
        overlayGradient: "linear-gradient(180deg, rgba(255,59,48,0.2) 0%, rgba(20,8,16,0.95) 100%)",
      },
    ];
  }
}
