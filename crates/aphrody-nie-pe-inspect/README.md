# aphrody-nie-pe-inspect

Bounded PE/COFF analysis with shared RE triage, strings, header probing and x86-64 disassembly. This is a static inspection library; it does not load or execute target binaries.

Ported from the NIE reverse-engineering workspace. It depends on the local `yolo-re-core` crate, uses explicit input/output limits, and has no emulator, WASM runtime, or WGPU dependency.

```rust
use aphrody_nie_pe_inspect::pe::inspect_bytes;

let report = inspect_bytes(&std::fs::read("target.exe")?)?;
println!("{}", serde_json::to_string_pretty(&report)?);
# Ok::<(), Box<dyn std::error::Error>>(())
```

The upstream source is subject to the license text in `LICENSE`.
