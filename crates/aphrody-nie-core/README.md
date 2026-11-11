# aphrody-nie-core

Rust ports of reverse-engineered Victory Road structures and deterministic algorithms, including ball and keeper state, match/action/tactics models, stat growth, XP, skills, auras, and Azalee's host-independent rules. It is useful for RE analysis and offline data inspection; it does not load or execute the original game binary.

The `data` feature enables embedded public-format fixture tables. Upstream's optional full Azalee formation and cut-in loaders depended on separate generated `iecode` datasets that are not present in this workspace, so those dataset loaders are excluded; the deterministic rules, schemas, and parsers remain. The default library and `serde,data` profile compile without that external repository.

`aphrody-nie-geom` is the small shared vector dependency. Both crates retain the upstream license at `LICENSE.upstream`. No emulator, game runtime, WASM binding, WGPU, or rendering integration is included.
