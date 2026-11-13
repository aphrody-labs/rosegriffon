# Inazuma Eleven reverse-engineering tools

Executable tooling migrated from `bun-os/packages/iecode-scripts`. This directory contains offline PE/RTTI analysis, Ghidra headless scripts, and binary layout reports. It does not include emulator code (`audit/uemu`, `ruzu`) or WASM/WGPU projects.

## Migrated host packages

| Path                          | Contents                                                                                                           | Notes                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inagle/`                     | TypeScript game-data API, parsers, VFS, database/CLI, text, formats, and Zukan modules                             | Original MIT license and package metadata retained; workspace-only dependency aliases still need resolution for standalone builds. Tests are omitted from this migration copy. |
| `inagle-cross/`, `inagle-ui/` | Inazuma Cross schemas/data exports and the Inagle UI adapter                                                       | Upstream packages mark these `UNLICENSED`.                                                                                                                                     |
| `iecode-scripts/`             | Host-side game-data setup, storage/VFS staging, and validation scripts                                             | Unicorn (`audit/uemu`) and emulator/WASM build scripts are intentionally excluded. The upstream checkout had no standalone license file.                                       |
| `nie-web/`                    | Host-side VFS staging, precompression, and desktop state tools                                                     | The browser engine/game wrappers and audio/WASM smoke code are excluded; upstream marks the package `UNLICENSED`.                                                              |
| `iecode-homebrew/`            | Bun CLI wrapper for DS/DSi and 3DS homebrew tooling                                                                | Depends on the separate `aphrody-homebrew` binary/crate.                                                                                                                       |
| `iecode-cpp/`                 | C/C++ parser/converter/decompilation suite and the Strikers 2013 Xtreme mod source                                 | Build files and third-party sources are retained. The upstream repository has no standalone license file.                                                                      |
| `iecode-dotnet/`              | .NET 10 core, CLI, FFI, asset viewers, save editor, map tools, and IEVR mod manager                                | `bin/` and `obj/` outputs are omitted; original commercial license text and game-format fixtures are preserved.                                                                |
| `ieverse/`                    | Canonical Inazuma Eleven media catalogue, source URLs, navigation/player contracts, and Rust runtime-link metadata | Host-side metadata only; upstream marks it `UNLICENSED`.                                                                                                                       |

The Blender add-on, `niepy` bridge, Ghidra scripts, and IEVR Ultimate Team tool are documented in their sections below. `apps/iecode-web` and browser UI sources remain with the emulator/WASM/WGPU implementation; the `nie-ui` package is explicitly the emulator frontend.

## Offline PE analysis

All Python tools accept explicit input paths; no game executable or save is bundled.

| Tool                              | Purpose                                                                                              | Example                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `re/extent.py`                    | Follow contiguous `.pdata` ranges to recover a complete split function body                          | `python tools/ie/re/extent.py --exe nie.exe 0x140542B80 --json`    |
| `re/vtable.py`                    | Read an MSVC RTTI vtable from a named PE                                                             | `python tools/ie/re/vtable.py --exe nie.exe --class CMenuListView` |
| `re/xref.py`                      | Find candidate references to an address/string in an x86-64 PE32+ image; confirm hits by disassembly | `python tools/ie/re/xref.py --help`                                |
| `re/extract_save_editor_hooks.py` | Extract save-editor hook/config evidence                                                             | `python tools/ie/re/extract_save_editor_hooks.py --help`           |
| `re/ievr_ultimate_team.py`        | Encrypt/decrypt UTLauncher teams; inspect UTMOD2 and save headers                                    | `python tools/ie/re/ievr_ultimate_team.py --help`                  |
| `forge/analyse_rdata.py`          | Classify PE `.rdata` content by data-directory structure                                             | `python tools/ie/forge/analyse_rdata.py nie.exe`                   |
| `forge/analyse_padding.py`        | Measure PE section padding                                                                           | `python tools/ie/forge/analyse_padding.py --help`                  |
| `forge/analyse_invalides.py`      | Report malformed or unsupported PE structures                                                        | `python tools/ie/forge/analyse_invalides.py --help`                |
| `forge/analyse_loadconfig.py`     | Inspect the PE load configuration                                                                    | `python tools/ie/forge/analyse_loadconfig.py --help`               |
| `forge/mesure_decodable.py`       | Measure decodable function coverage                                                                  | `python tools/ie/forge/mesure_decodable.py --help`                 |
| `forge/verif_vtables.py`          | Validate vtable evidence                                                                             | `python tools/ie/forge/verif_vtables.py --help`                    |
| `audit/audit-serving-assets.py`   | Audit serving asset files                                                                            | `python tools/ie/audit/audit-serving-assets.py --help`             |

Run migrated Python scripts through the canonical yolo-re uv environment: `uv sync --project src/py --locked --extra ie`, then `uv run --project src/py --locked --extra ie python tools/ie/re/vtable.py --help`. The `ie` profile supplies `pefile` for PE structure reports, `iced-x86` for instruction-level function coverage, and `dnfile` for managed assemblies; the remaining Python scripts use the standard library.

## IEVR Ultimate Team import/export

`re/ievr_ultimate_team.py` reads and writes the public UTLauncher team-export format, inspects UTMOD2 headers, and derives the save's header CRC value without claiming full key recovery or container verification. Run it through uv so the `ie` profile supplies `cryptography`:

```powershell
uv sync --project src/py --locked --extra ie
uv run --project src/py --locked --extra ie python tools/ie/re/ievr_ultimate_team.py --help
uv run --project src/py --locked --extra ie python tools/ie/re/ievr_ultimate_team.py team-decrypt .\team-export.json
uv run --project src/py --locked --extra ie python tools/ie/re/ievr_ultimate_team.py team-encrypt .\team.json .\team-encrypted.json
uv run --project src/py --locked --extra ie python tools/ie/re/ievr_ultimate_team.py utmod-info .\mod.utmod
uv run --project src/py --locked --extra ie python tools/ie/re/ievr_ultimate_team.py save-info .\USERDATALIVE
```

An override passphrase is read from `IEVR_UT_EXPORT_PASSPHRASE`; it is never written to the project database or passed as a command-line argument. Without that variable, the script uses the public default observed in the UTLauncher export implementation.

## Python game-data bridge

`niepy/` is the upstream Python bridge for the native IE/nie engine. It exposes VFS access, shared Rust format decoders, scene/story data and rendering through the native FFI. Build that native library from its Rust crate before using the bridge; it is not a pure-Python parser fallback. Its match simulator is included as upstream code but is a game runtime feature, not a RE analyzer. Upstream tests and package metadata are retained in `niepy/`.

## Ghidra headless scripts

`ghidra/ExportDecompiled.java`, `ExportSingleFunction.java`, `ExportSymbols.java`, and `IECODEAnalyzer.java` are Ghidra `GhidraScript` entry points. Configure Ghidra with `pwsh tools/ie/iecode-scripts/dev/setup_ghidra.ps1`, then pass `-scriptPath tools/ie/ghidra` to `analyzeHeadless`; see the source headers for each script's arguments. These scripts require a local Ghidra installation and an analyzed input binary.

The vtable validation report is `tools/ie/forge/verif_vtables.py`.

## Provenance

Source: `C:\src\bun-os\packages\iecode-scripts\{re,forge,ghidra,audit}`. The migrated scripts retain their upstream notices. IEVR Ultimate Team tooling lives under this directory's `re/` folder.

## Blender format workbench

`blender/` is the upstream Blender add-on and command-line tooling for Level-5 G4 model, skeleton, animation, event, camera, lip-sync, and texture inspection/export. It requires Blender's Python runtime for add-on operations; standalone probes and round-trip helpers run with Python where noted by their source. The add-on patches legally obtained source assets and does not include game content. Upstream tests and lookup data are kept beside the tools.
Additional sources: `C:\src\bun-os\packages\niepy` and `C:\src\bun-os\packages\nie-blender`. `niepy` requires the Rust FFI library; the Blender add-on uses the Blender Python host.
