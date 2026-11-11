---
name: nie-studio
description: Unified studio suite for Inazuma Eleven Victory Road (NIE) covering Save Editor, Mod Manager, CPK Explorer, 3D Character Morphing, FilmCraft/Remotion Cinematic Timeline, and Multimodal RAG Dataset Ingestion.
---

# NIE Studio Suite & Headless Pipeline

The `@aphrody/nie-ui/studio` package and `aphrody-nie-headless` binary provide the cross-platform GUI and headless automation suite for Inazuma Eleven: Victory Road (`nie.exe` Level-5 "Lives" engine).

## Architecture Overview

```
                                NIE STUDIO SUITE
+--------------------------------------------------------------------------------+
|  Save Editor       |  Mod Manager      |  CPK Explorer     |  3D Chara Editor  |
|  - CRC32 Checksum  |  - VFS Overlays   |  - G4TX / G4MD    |  - Morphology     |
|  - Stream XOR Keys |  - Load Order     |  - Criware Audio  |  - Palette Swap   |
+--------------------+-------------------+-------------------+-------------------+
|  FilmCraft & Remotion Cinematic Studio |  Multimodal RAG Dataset Pipeline      |
|  - Multi-track NLE Timeline            |  - Zero-Download HyperFrames Range    |
|  - Razor Cuts & SMPTE Timecodes        |  - SigLIP 768-dim Visual Embeddings   |
+--------------------------------------------------------------------------------+
```

## CLI Usage: `aphrody-nie-headless`

The release binary is located at `~/.local/bin/aphrody-nie-headless.exe` (or in `target/release`).

```bash
# 1. Edit a save file headlessly
aphrody-nie-headless save-edit --slot 002AB8F4-USERDATALIVE --level 99 --coins 999999 --out edited_save.bin

# 2. Capture menu screens as PNG sequence and timeline.json
aphrody-nie-headless capture-menus --out-dir var/capture_frames --width 1280 --height 720 --frames-per-menu 10 --fps 30

# 3. Dump memory layout and raw binary core of nie.exe / SaveManager
aphrody-nie-headless memory-dump --out-bin var/nie_core.bin --out-json var/nie_map.json

# 4. Run full pipeline (save edit + memory dump + menu captures)
aphrody-nie-headless pipeline --out-dir var/headless_run
```

## TypeScript / Bun API: `@aphrody/nie-ui/studio`

```typescript
import { NieStudioEngine, type ModManifest } from "@aphrody/nie-ui/studio";

const studio = new NieStudioEngine();

// Save Editor
const saveResult = await studio.runHeadlessSaveEdit({
  slot: "002AB8F4-USERDATALIVE",
  level: 99,
  coins: 999999,
});

// Mod Manager VFS Resolution
studio.registerMod({
  id: "raimon-hd",
  name: "Raimon Uniforms HD",
  version: "1.0.0",
  author: "Modder",
  targetVersion: "1.4.8",
  overrides: [
    {
      vfsPath: "data/chara/texture/raimon.g4tx",
      localPath: "/mods/raimon-hd/raimon.g4tx",
      fileType: "g4tx",
    },
  ],
});
const resolvedVfs = studio.resolveVfsPath("data/chara/texture/raimon.g4tx");

// 3D Character Recipe & Morphology
const chara = studio.createDefaultCharaRecipe(7, "Endou Mamoru");
const modified = studio.applyMorphology(chara, {
  height: 1.1,
  muscleRatio: 0.75,
});

// FilmCraft Timeline
studio.addCinematicCut({
  id: "clip-01",
  name: "God Hand",
  trackId: "v1",
  sourceUrl: "r2://rosegriffon/ievr/cutscenes/god_hand.mp4",
  startFrame: 0,
  durationFrames: 120,
  sourceInFrame: 0,
  sourceOutFrame: 120,
  speed: 1.0,
  volume: 1.0,
  opacity: 1.0,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
});

// Multimodal RAG Ingestion
studio.indexCinematicRag({
  clipId: "rag-01",
  hissatsuName: "Fire Tornado",
  characterId: 10,
  startTimecode: 0.0,
  endTimecode: 4.5,
  frameWidth: 1920,
  frameHeight: 1080,
  telemetryMarkers: [],
});
const results = studio.searchCinematicRag({ hissatsuName: "tornado" });
```
