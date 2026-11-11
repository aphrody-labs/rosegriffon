// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  NieStudioEngine,
  type ModManifest,
  type Chara3DRecipe,
  type CinematicRagEntry,
} from "../src/studio";

describe("NieStudioEngine Suite", () => {
  test("instantiates studio engine with default film project", () => {
    const studio = new NieStudioEngine();
    const proj = studio.getFilmProject();
    expect(proj).toBeDefined();
    expect(proj.title).toBe("NIE Cinematic Studio");
  });

  test("runs save editor operations and returns checksum valid result", async () => {
    const studio = new NieStudioEngine();
    const result = await studio.runHeadlessSaveEdit({
      slot: "002AB8F4-USERDATALIVE",
      level: 99,
      coins: 999999,
    });

    expect(result.success).toBe(true);
    expect(result.checksumValid).toBe(true);
    expect(result.coins).toBe(999999);
  });

  test("manages mods and resolves VFS overlay paths", () => {
    const studio = new NieStudioEngine();
    const modA: ModManifest = {
      id: "mod-raimon-hd",
      name: "Raimon Uniforms HD",
      version: "1.0.0",
      author: "ModderA",
      targetVersion: "1.4.8",
      overrides: [
        {
          vfsPath: "data/chara/texture/raimon_uniform.g4tx",
          localPath: "/mods/mod-raimon-hd/raimon_uniform.g4tx",
          fileType: "g4tx",
        },
      ],
    };

    studio.registerMod(modA);
    expect(studio.getInstalledMods().length).toBe(1);

    const resolved = studio.resolveVfsPath("data/chara/texture/raimon_uniform.g4tx");
    expect(resolved).toBe("/mods/mod-raimon-hd/raimon_uniform.g4tx");

    const unknown = studio.resolveVfsPath("data/chara/texture/unknown.g4tx");
    expect(unknown).toBeNull();
  });

  test("inspects asset binary headers for CPK, G4TX, G4MD, RDBN", () => {
    const studio = new NieStudioEngine();

    const cpkHeader = new Uint8Array([0x43, 0x50, 0x4b, 0x20]); // "CPK "
    expect(studio.inspectAssetHeader(cpkHeader).isCpk).toBe(true);

    const g4txHeader = new Uint8Array([0x47, 0x34, 0x54, 0x58]); // "G4TX"
    expect(studio.inspectAssetHeader(g4txHeader).isG4tx).toBe(true);

    const g4mdHeader = new Uint8Array([0x47, 0x34, 0x4d, 0x44]); // "G4MD"
    expect(studio.inspectAssetHeader(g4mdHeader).isG4md).toBe(true);

    const rdbnHeader = new Uint8Array([0x52, 0x44, 0x42, 0x4e]); // "RDBN"
    expect(studio.inspectAssetHeader(rdbnHeader).isRdbn).toBe(true);
  });

  test("creates and modifies 3D character editor recipe and morphology", () => {
    const studio = new NieStudioEngine();
    const recipe = studio.createDefaultCharaRecipe(7, "Endou Mamoru");

    expect(recipe.characterId).toBe(7);
    expect(recipe.name).toBe("Endou Mamoru");
    expect(recipe.morphology.height).toBe(1.0);

    const modified = studio.applyMorphology(recipe, {
      height: 1.15,
      muscleRatio: 0.8,
    });

    expect(modified.morphology.height).toBe(1.15);
    expect(modified.morphology.muscleRatio).toBe(0.8);
    expect(modified.morphology.jawWidth).toBe(1.0);
  });

  test("adds cinematic clips to FilmCraft timeline", () => {
    const studio = new NieStudioEngine();
    studio.addCinematicCut({
      id: "clip-god-hand-01",
      name: "God Hand Climax",
      trackId: "v1",
      sourceUrl: "r2://rosegriffon/ievr/cutscenes/god_hand.mp4",
      startFrame: 0,
      durationFrames: 120,
      sourceInFrame: 120,
      sourceOutFrame: 240,
      speed: 1.0,
      volume: 1.0,
      opacity: 1.0,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    });

    const project = studio.getFilmProject();
    const v1Track = project.tracks.find((t) => t.id === "v1");
    expect(v1Track?.clips.length).toBe(1);
    expect(v1Track?.clips[0].name).toBe("God Hand Climax");
  });

  test("indexes and retrieves multimodal cinematic RAG metadata", () => {
    const studio = new NieStudioEngine();
    const ragEntry: CinematicRagEntry = {
      clipId: "rag-fire-tornado-001",
      hissatsuName: "Fire Tornado",
      characterId: 10,
      startTimecode: 4.25,
      endTimecode: 8.5,
      frameWidth: 1920,
      frameHeight: 1080,
      telemetryMarkers: [
        {
          frame: 100,
          ballCoords: [0.0, 1.5, 12.0],
          cameraMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 5, 1],
        },
      ],
    };

    studio.indexCinematicRag(ragEntry);

    const foundByChar = studio.searchCinematicRag({ characterId: 10 });
    expect(foundByChar.length).toBe(1);
    expect(foundByChar[0].hissatsuName).toBe("Fire Tornado");

    const foundByName = studio.searchCinematicRag({ hissatsuName: "tornado" });
    expect(foundByName.length).toBe(1);

    const notFound = studio.searchCinematicRag({ hissatsuName: "majingod" });
    expect(notFound.length).toBe(0);
  });

  test("runs full headless pipeline simulation", async () => {
    const studio = new NieStudioEngine();
    const result = await studio.runFullHeadlessPipeline("var/test_studio_out");
    expect(result.outputDir).toBe("var/test_studio_out");
    expect(result.filesGenerated.length).toBe(4);
  });
});
