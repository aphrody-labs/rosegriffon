# Mach-O triage

`bunre triage` and the Rust `yolo-re-core::triage` API parse thin 32-bit and
64-bit Mach-O images and fat32 universal containers. Reports include validated
architecture slices, entry points, segment section addresses and sizes,
section entropy, imported and exported names, and dependent dylibs. Fat
containers aggregate symbols and sections while preserving per-slice offsets,
lengths, bitness, and entry points.

The legacy Bun OS RE surface routed executable inspection through the shared
triage owner (`docs/re/bun-os-legacy/REA-MATRIX.md`, rows for `re bin`). Its
Rust source explicitly documented Mach-O as unsupported because Goblin's
`mach32` and `mach64` features were disabled
(`bun-os-archive/crates/re/src/lib.rs`, archive revision `ca9f273962`). This
change closes that documented gap in the migrated Rust owner without adding
another RE command implementation. Binary structure parsing is provided by
the upstream [`goblin`](https://github.com/m4b/goblin) crate; Goblin is dual
licensed MIT/Apache-2.0.

The parser returns `Unknown` for malformed Mach-O input. A universal image is
accepted only when every declared slice is an independently parsed Mach-O with
matching CPU type and a non-overlapping range outside the architecture table.
Universal archives are currently reported as `Unknown`. A thin Mach-O image is
reported as one slice at offset zero.
