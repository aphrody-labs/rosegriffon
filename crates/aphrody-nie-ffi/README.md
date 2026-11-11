# aphrody-nie-ffi

Native C ABI for Inazuma Eleven reverse-engineering and game-data tooling. The active library
uses workspace implementations from `aphrody-nie-app`, `aphrody-nie-core`, `aphrody-nie-data`,
`aphrody-nie-formats`, `aphrody-nie-save`, and `aphrody-nie-wiki`. `src/upstream.rs` preserves the larger upstream
FFI source for provenance; it is not a promise that every upstream symbol is active here.

## Current build profile

The default profile exports native format inspection and decode, CRand, CFG.bin and typed menu
settings, CPK/CRI-LAYLA, G4TX, local VFS, font and texture helpers, IEVR save inspection, and
the deterministic seeded match simulator, shared game-source discovery, and native domain queries
over mounted VFS data, and the Rust wiki mirror/query API. The simulator uses the current aggregate-stat model
in `aphrody-nie-core`; its match scoring model is nominal rather than a byte-exact port of the
game's event-driven resolution.
The capability report describes this profile at runtime. Emulator, WASM, and WGPU integrations
are excluded.

This upstream export remains unavailable because its owning backend registry is part of the
separate `bun-engine` emulator runtime, which is outside this RE FFI profile:

- `nie_emu_registry_json_out`: emulator registry from `bun-engine`.
It is absent from the dynamic-library symbol table rather than replaced with a capability-error
stub. The original upstream implementation and license are preserved in `src/upstream.rs`.
