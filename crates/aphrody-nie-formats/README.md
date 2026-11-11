# NIE / Inazuma Eleven format parsers

This crate is the migrated Level-5 and Criware format-analysis library from `bun-os/crates/aphrody-nie-formats`. It contains parsers, decoders, encoders, and bounded archive/VFS readers used for RE of IE assets: CPK/@UTF, cfg.bin/T2B, CRILAYLA, G4* model/texture/animation formats, NXTCH, NAVM, USM, and related structures.

The UI-only `sprite_sheet` adapter and its dependency were excluded. No emulator, WASM binding, or WGPU renderer is part of this crate. The parser code itself remains portable Rust and keeps its `no_std`-oriented feature boundary where the upstream implementation provides one.

## Features

- `std` (default): file-backed parsers, archive assembly, and host VFS helpers.
- `serde` (default): serialization needed by format-report and JSON decode surfaces.
- `textures`: decode DDS/BCn G4TX texture payloads with `image_dds`.
- `textures-encode`: encode BCn texture payloads; may require a native toolchain through `image_dds`.
- `images`: encode RGBA images into supported exchange formats.
- `audio-decode`: decode Criware audio using `cridecoder`.
- `lua` (default): parse and disassemble Lua 5.2 bytecode through the separate, static `aphrody-nie-lua` crate. It never executes chunks.
- `real-fixtures`: opt in to tests using locally supplied game fixtures.

Game dumps and real binary fixtures are intentionally not copied into this crate. Tests that depend on those ignored local files need the operator's own legally obtained game data.

The upstream remote HTTP/SFTP VFS transport is not enabled in this workspace because it depends on the separate `aphrody-ssh` transport crate. Local CPK and filesystem VFS code is present. Lua VM execution, menu host runtime, WebAssembly bindings, WGPU rendering, and emulator integrations are outside this RE parser crate.
