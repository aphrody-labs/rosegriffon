# aphrody-nie-forge

Static RE utilities for reconstructing and comparing `nie.exe` and other x64 PE images. The port retains binary coverage/splitting, assembly-source parsing, bounded instruction lifting, registries and reports, reference-backed builds, verification, and optional SQLite name/boundary lookup.

The crate does not run the game, emulate its runtime, or include WASM/WGPU integrations. The `redb` feature name is retained for upstream CLI compatibility; its `redb.rs` module reads the local RE knowledge SQLite database and does not add a game runtime dependency.

## Build and use

```powershell
cargo build -p aphrody-nie-forge
cargo run -p aphrody-nie-forge -- --help
```

The `aphrody-nie-forge` CLI provides `split`, `build`, `verify`, `report`, `match`, and `unit` commands. Its reference binary and registry inputs are supplied by the analyst; it does not download or modify game installations.

Source is ported from Aphrody Labs' `bun-os` workspace. See [LICENSE](LICENSE).
