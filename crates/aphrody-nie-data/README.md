# aphrody-nie-data

Static, RE-derived schemas and JSON decoders for Inazuma Eleven: Victory Road game data. The crate carries the upstream source modules and export CLIs, including character, skill, formation, event, mission, item, team, and typed config models. It parses user-provided dumps and does not include game data dumps or execute game logic.

The `serde` feature enables typed serialization, and `std` enables the export binaries. Core JSON access uses `serde_json`'s alloc support. The crate retains its upstream license at `LICENSE.upstream`.

```powershell
cargo check -p aphrody-nie-data --features serde,std --lib --bins
cargo run -p aphrody-nie-data --features serde,std --bin export_skills -- <game-data-dir> <output.json>
```

The export tools require files from a user-owned game installation. No game asset files are redistributed here.
