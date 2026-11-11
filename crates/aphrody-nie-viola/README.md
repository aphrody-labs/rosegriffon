# aphrody-nie-viola

Local Rust port of the static Inazuma Eleven modding operations used by the Viola workflow.

It provides deterministic CPK dump and merge operations, patch/manifest handling, CPK-list and cfg.bin repacking, CRIWARE XOR crypt helpers, and verification against the game's virtual file system. It depends on `aphrody-nie-formats` for the CPK, cfg.bin and VFS formats; it does not launch the game or include emulator, WASM, or WGPU code.

Build the library with `cargo check -p aphrody-nie-viola`. For simple standalone CPK listing, extraction and packing, REA exposes `bun run re ie-format cpk-list|cpk-extract|cpk-extract-all|cpk-pack ...` through the native `bunre formats` dispatcher.

The upstream licensing notice is preserved in `LICENSE`.
