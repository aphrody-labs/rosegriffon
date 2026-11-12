import { describe, expect, test } from "bun:test";
import {
  buildFusionDataset,
  calculateCharacterStats,
  fuseZukanCharacter,
  fuseZukanItem,
  fuseZukanSkill,
  getRefreshedGameIcons,
  queryFusedCharacters,
  REFRESHED_GAME_ICON_ATLASES,
  REFRESHED_GAME_ICONS,
  resolveCharacterFaceUrl,
  resolveCharacterModelUrl,
  resolveCharacterVfsFace,
  resolveCharacterVfsModel,
  resolveCharacterVoiceVfs,
  resolveSkillCutinVfs,
} from "../src/zukan/zukan-vfs-fusion.js";

describe("Zukan & CPK VFS Fusion Engine", () => {
  test("resolves VFS paths deterministically from model IDs and event IDs", () => {
    const facePath = resolveCharacterVfsFace("c01000010");
    expect(facePath).toBe("data/dx11/menu/001_chara/c01000010_l.g4tx");

    const modelPath = resolveCharacterVfsModel("c01000010");
    expect(modelPath).toBe("data/dx11/model/c01000010.g4md");

    const voiceDir = resolveCharacterVoiceVfs("c01000010");
    expect(voiceDir).toBe("data/sound/voice/chara/c01000010/");

    const cutin = resolveSkillCutinVfs("ev60_00030");
    expect(cutin.eventIdName).toBe("ev60_00030");
    expect(cutin.modelG4md).toBe("data/dx11/model/cutin/ev60_00030.g4md");
    expect(cutin.soundCfg).toBe("data/sound/hissatsu/ev60_00030.acb");
    expect(cutin.telopByLang.fr).toBe("data/dx11/telop/ev60_00030_fr.g4tx");
    expect(cutin.telopByLang.ja).toBe("data/dx11/telop/ev60_00030_ja.g4tx");
  });

  test("calculates 7-axis stats and sum total", () => {
    const stats = calculateCharacterStats({
      kick: 90,
      control: 97,
      technique: 91,
      pressure: 98,
      physical: 105,
      agility: 111,
      intelligence: 97,
    });
    expect(stats).toBeDefined();
    expect(stats?.kick).toBe(90);
    expect(stats?.total).toBe(689);
  });

  test("fuses individual Zukan character with VFS assets", () => {
    const fused = fuseZukanCharacter({
      id: "0x000CCA62",
      name: "Mark Evans",
      nickname: "Evans",
      position: "GK",
      element: "Mountain",
      code: "c01000010",
      stats: {
        kick: 90,
        control: 97,
        technique: 91,
        pressure: 98,
        physical: 105,
        agility: 111,
        intelligence: 97,
      },
      game: "Inazuma Eleven",
    });

    expect(fused.name).toBe("Mark Evans");
    expect(fused.position).toBe("GK");
    expect(fused.element).toBe("Mountain");
    expect(fused.modelId).toBe("c01000010");
    expect(fused.vfsFacePath).toBe("data/dx11/menu/001_chara/c01000010_l.g4tx");
    expect(fused.vfsModelPath).toBe("data/dx11/model/c01000010.g4md");
    expect(fused.voiceVfsDir).toBe("data/sound/voice/chara/c01000010/");
    expect(fused.stats?.total).toBe(689);

    // Official Zukan hash resolved from fallback map
    expect(fused.zukanHash).toBe("k/b/b/bbg9_haxlx8");
    expect(fused.faceCdnUrl).toContain("bbg9_haxlx8");
  });

  test("fuses individual skill with cut-in assets and video variants", () => {
    const fused = fuseZukanSkill({
      id: "fire_tornado",
      internalCode: "whs00030",
      eventIdName: "ev60_00030",
      name: "Fire Tornado",
      type: "Shoot",
      element: "Fire",
      videos: [
        {
          label: "Shot",
          position: 0,
          videoUrl: "https://dxi4wb638ujep.cloudfront.net/1/m/s/msb8o6v1p4w.webm",
          posterUrl: "https://dxi4wb638ujep.cloudfront.net/1/m/s/msb8o6v1p4w.jpg",
        },
      ],
    });

    expect(fused.name).toBe("Fire Tornado");
    expect(fused.type).toBe("Shoot");
    expect(fused.videoUrl).toContain("msb8o6v1p4w.webm");
    expect(fused.cutin).toBeDefined();
    expect(fused.cutin?.modelG4md).toBe("data/dx11/model/cutin/ev60_00030.g4md");
    expect(fused.vfsTelopPath).toBe("data/dx11/telop/ev60_00030_fr.g4tx");
    expect(fused.vfsIconPath).toBe("data/dx11/menu/010_skill/whs00030.g4tx");
  });

  test("fuses items with inventory icon atlases and FR localization", () => {
    const fusedShoes = fuseZukanItem({
      id: "inazuma_boots",
      name: "Inazuma Boots",
      category: "shoes",
    });

    expect(fusedShoes.category).toBe("shoes");
    expect(fusedShoes.categoryLabelFr).toBe("Chaussures");
    expect(fusedShoes.atlas).toBe("category");
    expect(fusedShoes.atlasCoords).toEqual({ x: 260, y: 0, w: 256, h: 200 });

    const fusedStadium = fuseZukanItem({
      id: "raimon_stadium",
      name: "Raimon Stadium",
      category: "stadium",
    });

    expect(fusedStadium.category).toBe("stadium");
    expect(fusedStadium.atlas).toBe("category2");
    expect(fusedStadium.atlasCoords).toEqual({ x: 0, y: 124, w: 192, h: 120 });
  });

  test("builds complete fusion dataset with over 5,000 characters and high Zukan hash coverage", () => {
    const dataset = buildFusionDataset();

    expect(dataset.characters.length).toBeGreaterThan(5000);
    expect(dataset.metrics.totalCharacters).toBeGreaterThan(5000);
    expect(dataset.metrics.zukanHashCoverage).toBeGreaterThan(5000);
    expect(dataset.metrics.zukanHashPercent).toBeGreaterThan(95);

    expect(dataset.skills.length).toBeGreaterThanOrEqual(3);
    expect(dataset.items.length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(dataset.icons).length).toBe(19);
  });

  test("queries fused characters with composite filtering", () => {
    // Search Mark Evans
    const markResults = queryFusedCharacters({ search: "Mark Evans" });
    expect(markResults.length).toBeGreaterThan(0);
    expect(markResults[0].name).toBe("Mark Evans");
    expect(markResults[0].position).toBe("GK");
    expect(markResults[0].element).toBe("Mountain");

    // Filter FW Fire characters
    const fireFw = queryFusedCharacters({ position: "FW", element: "Fire", limit: 5 });
    expect(fireFw.length).toBe(5);
    for (const char of fireFw) {
      expect(char.position).toBe("FW");
      expect(char.element).toBe("Fire");
    }

    // Filter by Game
    const ie1Chars = queryFusedCharacters({ game: "Inazuma Eleven", limit: 10 });
    expect(ie1Chars.length).toBe(10);
    for (const char of ie1Chars) {
      expect(char.game).toBe("Inazuma Eleven");
    }
  });

  test("exposes refreshed game icons and atlases with exact dimensions", () => {
    const icons = getRefreshedGameIcons();
    expect(Object.keys(icons)).toHaveLength(19);

    expect(REFRESHED_GAME_ICON_ATLASES.category.sheetW).toBe(776);
    expect(REFRESHED_GAME_ICON_ATLASES.category.sheetH).toBe(812);
    expect(REFRESHED_GAME_ICON_ATLASES.category2.sheetW).toBe(388);
    expect(REFRESHED_GAME_ICON_ATLASES.category2.sheetH).toBe(492);

    expect(icons.uniform.atlas).toBe("category");
    expect(icons.uniform.w).toBe(256);
    expect(icons.uniform.h).toBe(200);

    expect(icons.house.atlas).toBe("category2");
    expect(icons.house.w).toBe(192);
    expect(icons.house.h).toBe(120);
  });
});
