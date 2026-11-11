# aphrody-nie-computer-use

Bounded Computer Use primitives for REA's NIE workflows. The offline image inspector accepts explicit bounded byte ranges. Host mode binds an executable hash to a read-only SQLite RE row, exposes bounded live memory/AOB probes through `aphrody-nie-trace`, and checks whether a local Ghidra MCP endpoint responds. Ghidra and the game are never launched by probes.

The static RE facade uses local `yolo-re-core::nie`/`propagate`; live process operations use the local `aphrody-nie-trace` crate. The upstream licensing notice is retained in `LICENSE`. No emulator, GUI, WASM binding or WGPU code is included.

Build with `cargo check -p aphrody-nie-computer-use`. Use `--no-default-features` to build only the offline image inspector.
