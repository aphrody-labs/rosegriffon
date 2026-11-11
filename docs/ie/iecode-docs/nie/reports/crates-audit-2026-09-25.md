# Crate audit — 2026-09-25

Scope: all 48 `Cargo.toml` under `crates/` (25 engine, 9 forge, 12 tools, 2 archive), explored
read-only by four parallel sub-agents. LOC = `wc -l` over `src/**/*.rs` (comments included);
tests = `#[test]`/`#[tokio::test]` across the crate including `tests/`. Nothing was built or run.

## Totals

| Group                       | Crates | LOC (approx.) | Tests  | TODO/todo!/unimplemented! |
| --------------------------- | ------ | ------------- | ------ | ------------------------- |
| engine (A: aphrody…lua-web) | 13     | ~150 000      | ~2 780 | 2                         |
| engine (B: net…wasm)        | 12     | ~40 000       | ~390   | 0                         |
| forge                       | 9      | ~32 200       | 337    | 0                         |
| tools                       | 12     | ~99 900       | ~690   | 0                         |
| archive (outside workspace) | 2      | ~17 700       | 298    | 75 (all in `nie-rs`)      |

Workspace members are `crates/{forge,engine,tools}/*` + `apps/inacord/src-tauri`.
`archive/nie-engine` is explicitly `exclude`d (porting reference); `archive/nie-rs` is an orphan
with its own `Cargo.lock`.

## Engine

| Crate                  | Kind                  | LOC    | Tests | nie-* deps                                                    | Role                                                        |
| ---------------------- | --------------------- | ------ | ----- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| nie-aphrody            | lib + 4 bins          | 6 063  | 61    | data, formats                                                 | Aphrody character dossier + 2D pet runtime                  |
| aphrody-nie-app        | lib                   | 5 304  | 51    | core, data, explore, formats, geom, render, render3d, runtime | Screen state machine, `GameState`, `Renderer`/`CpuRenderer` |
| aphrody-nie-bevy       | lib                   | 1 029  | 13    | formats                                                       | Bevy loaders for G4TX/G4MD/G4MG                             |
| aphrody-nie-camera     | lib + bin `nie-cam`   | 5 446  | 40    | data, formats, index, trace                                   | Camera model, `.g4cm` codec, live R/W, SQLite index         |
| aphrody-nie-core       | lib                   | 18 996 | 388   | data, geom                                                    | Gameplay port (ball, match FSM, keeper, AI, growth, auras)  |
| aphrody-nie-data       | lib `no_std` + 3 bins | 36 930 | 1 472 | —                                                             | ~118 game data models, ~25 golden test targets              |
| aphrody-nie-explore    | lib                   | 9 420  | 83    | data, formats, lua, sql                                       | VFS preview/describe engine (CLI + desktop)                 |
| aphrody-nie-ffi        | cdylib `iecode`       | 2 072  | 13    | core, data, emu, formats, runtime, wiki                       | C ABI for Bun, 49 exports in one file                       |
| aphrody-nie-formats    | lib                   | 47 150 | 518   | lua                                                           | Level-5/Criware parsers (CPK, cfg.bin, G4*, USM…)           |
| aphrody-nie-game       | bin                   | 5 404  | 32    | app, data, formats, lua, render, runtime                      | Native wgpu host, PNG capture, CPU/GPU check                |
| aphrody-nie-headless   | lib + bin             | 476    | 21    | core, data, formats                                           | Format detection → JSON                                     |
| aphrody-nie-lua        | lib                   | 12 077 | 144   | data, formats                                                 | Lua 5.2.4 VM (mlua), menu host/runtime, static analysis     |
| aphrody-nie-lua-web    | cdylib (emscripten)   | 418    | 2     | data, formats, lua                                            | Browser wrapper over `menu_runtime::replay`                 |
| aphrody-nie-net        | lib                   | 6 402  | 34    | runtime, core, geom                                           | Multiplayer: Inacode rooms, rollback, lobby, ranked, clans  |
| aphrody-nie-ocgen      | lib + bin             | 3 169  | 16    | data, formats                                                 | Original character → CHARA_EDIT_PARAM → 3D assembly plan    |
| aphrody-nie-pg         | lib + bin             | 788    | 4     | formats                                                       | cfg.bin → PostgreSQL schema `nie` via binary COPY           |
| aphrody-nie-play       | bin                   | 240    | 0     | app, formats, core, runtime                                   | Scripted headless playthrough → PNG/MP4                     |
| aphrody-nie-render     | lib                   | 161    | 0     | formats, render3d, runtime                                    | Thin render contract (`Limits`, `Frame`, `Layer`)           |
| aphrody-nie-render3d   | lib + bin             | 9 182  | 93    | core, formats, video (opt.)                                   | CPU z-buffer + wgpu/WebGL, picking, gizmo, scene doc        |
| aphrody-nie-runtime    | lib + 2 bins          | 2 130  | 19    | core, formats, render3d, video, geom                          | Deterministic headless loop, top-down render                |
| aphrody-nie-save       | lib                   | 3 714  | 60    | formats                                                       | Lives save decrypt/parse/edit                               |
| nie-ui                 | lib + bin             | 4 053  | 35    | formats, aphrody                                              | Design tokens → `game-screens.css`                          |
| aphrody-nie-viewer-web | cdylib                | 253    | 0     | render3d (webgl)                                              | WebGL 2 fallback viewer module                              |
| aphrody-nie-viola      | lib                   | 3 693  | 51    | formats                                                       | Viola modding port (dump/pack/merge/crypt)                  |
| aphrody-nie-wasm       | cdylib                | 6 470  | 83    | ~30 crates                                                    | Browser bindings, team_* logic, web viewer                  |

## Forge

| Crate             | Kind         | LOC   | Tests | nie-* deps                | Role                                                         |
| ----------------- | ------------ | ----- | ----- | ------------------------- | ------------------------------------------------------------ |
| aphrody-nie-asm   | lib          | 4 365 | 29    | —                         | x86-64 MSVC-dialect encoder + text parser                    |
| aphrody-nie-dump  | lib          | 1 049 | 10    | —                         | Minidump reader + AOB scan                                   |
| aphrody-nie-forge | lib + bin    | 4 666 | 36    | pe, asm                   | `split/build/verify/report/match/unit/cc/lift/kb/candidates` |
| aphrody-nie-index | lib          | 3 514 | 19    | —                         | In-memory/host indexes, atlas SQL schemas                    |
| aphrody-nie-pe    | lib          | 2 436 | 24    | —                         | Byte-exact PE64 read/write, units, pdata                     |
| aphrody-nie-queue | lib          | 451   | 5     | —                         | Bounded dedup BFS frontiers                                  |
| aphrody-nie-re    | lib          | 7 036 | 77    | index (opt.), dump (opt.) | RTTI, disasm, vtables, label propagation                     |
| aphrody-nie-seed  | lib          | 2 337 | 29    | index (opt.), formats     | Imports Ghidra/RTTI/inagle knowledge as anchors              |
| aphrody-nie-trace | lib + 2 bins | 6 344 | 108   | —                         | Live memory R/W (Wine `process_vm_readv` / Win32)            |

Pipeline: _analysis_ `aphrody-nie-seed` → `aphrody-nie-re` (scheduled by `aphrody-nie-queue`, stored in `aphrody-nie-index`,
runtime evidence from `aphrody-nie-dump`/`aphrody-nie-trace`); _production_ `aphrody-nie-pe` splits → `aphrody-nie-asm`
re-encodes → `aphrody-nie-forge` rebuilds, verifies byte-for-byte and reports coverage. `aphrody-nie-forge` links
only `aphrody-nie-pe` + `aphrody-nie-asm`; analysis results reach it through the KB.

## Tools

| Crate                    | Kind      | LOC    | Tests | nie-* deps             | Surface                                                     |
| ------------------------ | --------- | ------ | ----- | ---------------------- | ----------------------------------------------------------- |
| ievr-tools               | lib + bin | 1 392  | 8     | —                      | CRI/PE inventory RE                                         |
| aphrody-nie-bench        | lib + bin | 322    | 3     | formats                | Cross-language hot-path benchmark samples                   |
| aphrody-nie-cli (`nie`)  | bin       | 20 466 | 41    | 22 crates              | ~46 subcommands, ~47 `cli_*` MCP tools                      |
| aphrody-nie-computer-use | lib       | 932    | 15    | index, re, trace       | Bounded Computer Use probes                                 |
| aphrody-nie-editor       | lib + bin | 924    | 13    | render                 | Native 3D editor viewport                                   |
| aphrody-nie-launcher     | lib + bin | 10 293 | 9     | formats, save          | Launcher, save editor, mod packages                         |
| aphrody-nie-mcp          | bin       | 5      | 2     | cli, pe                | Delegates to `aphrody_nie_cli::main_entry_with` (`nie mcp`) |
| aphrody-nie-model-serve  | lib + bin | 8 973  | 29    | data, explore, formats | GLB/menu HTTP, ~30 hand-matched paths                       |
| nie-site                 | lib + bin | 34 982 | 390   | 15 crates              | Axum: bundle, `/api/v1`, GraphQL, OpenAPI, `/f` `/b`        |
| aphrody-nie-steam        | lib + bin | 3 504  | 41    | net                    | Pure-Rust depot download (SteamKit2 port)                   |
| aphrody-nie-wiki         | lib       | 14 125 | 84    | —                      | Read-only SQLite mirror queries                             |
| aphrody-nie-zukan        | lib + bin | 3 943  | 56    | —                      | Inagle encyclopedia ingest/match                            |

## Findings (prioritised)

1. **Duplicated logic** — growth/exp/skill/aura/menu_setting in both `aphrody-nie-core` and `aphrody-nie-data`;
   G4CM in `aphrody-nie-camera` and `aphrody-nie-formats`; format detection in `aphrody-nie-headless`, `aphrody-nie-ffi`
   (`nie_detect`) and `aphrody-nie-explore`; `pdata` in `aphrody-nie-re` and `aphrody-nie-pe`; web viewer in
   `aphrody-nie-viewer-web` and `aphrody-nie-wasm/src/web_viewer.rs` (the module split is intentional for size,
   but the code path should be shared).
2. **God crates** — `aphrody-nie-wasm` (~30 internal deps, including forge/trace/steam/bench/editor),
   `aphrody-nie-cli` (22), `nie-site` (15). `aphrody-nie-mcp` inherits all of `aphrody-nie-cli`. The cost is build time
   and wasm size; check which `aphrody-nie-wasm` deps are reachable from exported bindings.
3. **Game logic in a bindings crate** — `aphrody-nie-wasm::team_{code,generator,rules}` goes against
   "extract before you bind"; move it to `aphrody-nie-core`/`aphrody-nie-data`.
4. **Oversized single files** — `aphrody-nie-game/src/main.rs` (5 219 lines), `aphrody-nie-ffi/src/lib.rs`
   (~2 000 lines, 49 exports), `aphrody-nie-cli/src/mcp.rs` (1 233).
5. **Thin tests on large crates** — `aphrody-nie-launcher` 9 tests / 10.3 k LOC, `aphrody-nie-cli` 41 / 20.5 k,
   `aphrody-nie-pg` 4; `aphrody-nie-play`, `aphrody-nie-render`, `aphrody-nie-viewer-web` have 0.
6. **`aphrody-nie-model-serve` has no router** — ~30 `if path ==`/`strip_prefix` checks, while
   `nie-site` already uses Axum.
7. **Stale docs** — `aphrody-nie-data` cites `/home/ubuntu/...` paths and lists 9 of ~118 modules;
   `aphrody-nie-core` lists ~16 of ~40; `aphrody-nie-lua` 2 of 10; `aphrody-nie-app` names different front-ends in
   `Cargo.toml` vs `lib.rs`; `aphrody-nie-formats` claims "no_std-friendly" while using
   `std::io::Cursor`; `nie-aphrody/src/gisement.rs:111` links a non-existent `crate::growth`;
   `aphrody-nie-wasm` docs mention only `aphrody-nie-formats`; `aphrody-nie-explore` calls the app `nie-explorer` (now
   `apps/inacord`).
8. **Dead weight** — `archive/nie-rs` (62 Ghidra stub files, 75 TODO markers, orphan) is a
   deletion candidate (needs confirmation). `archive/nie-engine` (15 k LOC, 434 `// EXTERN:`) is
   a kept reference; map its overlap with `aphrody-nie-formats`/`aphrody-nie-runtime`/`aphrody-nie-net` before porting
   from it. `aphrody-nie-render` (161 LOC) adds little over `aphrody-nie-render3d`.
9. **`unwrap()` density** — `aphrody-nie-wiki` 269, `nie-site` 210 (test vs production not separated).
10. **Language mix** — some Cargo descriptions and identifiers (`lancement`, `recette`,
    `Manifeste::ordonner`) are French, against the English naming contract; existing debt, to be
    renamed only in dedicated batches.

## Open TODOs in code

- `crates/nie/nie-aphrody/src/gisement.rs:111` — `TODO(growth)`, dangling link.
- `crates/nie/aphrody-nie-game/src/main.rs:1989` — expose `--locale`.
