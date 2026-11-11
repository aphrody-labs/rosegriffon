# aphrody-nie-inventory

Offline IEVR inventory analysis: JSON inventory summaries, CRIWARE `@UTF`/CPK and manifest parsers, and PE analysis. The PE facade is adapted to the local bounded `aphrody-nie-pe-inspect` API; there is no dependency on the original `aphrody-re` crate.

```powershell
cargo run -p aphrody-nie-inventory --bin ievr-tools -- summary --json inventory.json
cargo run -p aphrody-nie-inventory --bin ievr-tools -- by-ext --json inventory.json
cargo run -p aphrody-nie-inventory --bin ievr-tools -- top 25 --json inventory.json
```

This is static RE tooling only. No game process, emulator, WASM runtime, or WGPU renderer is included. The upstream source is subject to the license text in `LICENSE`.
