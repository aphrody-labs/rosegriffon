# aphrody-nie-explore

Format-aware reverse-engineering views for files read from the local Level-5/CriWare VFS: asset summaries, game-data bridges, geometry and animation previews, menu/cinema/audio metadata, raw byte export and Lua 5.2 bytecode structure. Parsing is offline and does not run the game's Lua logic.

```powershell
cargo check -p aphrody-nie-explore --no-default-features
cargo check -p aphrody-nie-explore --features host
```

The host feature enables filesystem search and local VFS viewer helpers. Session persistence from the source desktop app remains in that app layer; this crate intentionally has no SQL dependency. Lua inspection uses the local static bytecode parser and excludes the optional instrumented Lua VM. WASM/WGPU renderers, emulator integration and game runtime code are not included. The original source license terms are preserved in [LICENSE](LICENSE).
