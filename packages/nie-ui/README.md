# @aphrody/nie-ui

Unified Inazuma Eleven: Victory Road (NIE) UI, design system, emulator frontend, and studio suite.

## Packages and Modules

- `@aphrody/nie-ui/studio` (`src/studio/`) : Full cross-platform studio engine uniting:
  - **Save Editor**: Stream XOR cipher, CRC32 recalculation, level and coin manipulation.
  - **Mod Manager**: VFS overlays, load order resolution, mod manifests (`ModManifest`).
  - **CPK Explorer**: Magic header inspection (`CPK `, `G4TX`, `G4MD`, `RDBN`).
  - **3D Character Editor**: Morphological scaling, palette swaps, and mesh recipes.
  - **FilmCraft & Remotion**: Multi-track timeline, razor cuts, and SMPTE timecodes.
  - **Capture Ingestion & RAG**: Zero-download ISOBMFF parsing via `@aphrody/hyperframes` and multimodal telemetry indexing.
- `@aphrody/nie-ui/ui` (`src/ui/`) : Browser UI of the emulator frontend (file store, touch controls, input).
- `src/streamer/` : Real rendered Steam game frame streaming to the VPS bridge.
- `src/styles/` : Less styles and design token definitions.

## Installation & Tests

```bash
bun install
bun test packages/nie-ui/test
bun check packages/nie-ui/src/studio/index.ts
```
