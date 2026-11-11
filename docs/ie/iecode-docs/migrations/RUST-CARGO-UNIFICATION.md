# Rust toolchain and Cargo configuration

Current repository configuration, checked on 2026-10-01. Run Cargo from the
IECODE root. `rust-toolchain.toml`, `Cargo.toml`, `Cargo.lock`, `rustfmt.toml`
and `.cargo/config.toml` are the active shared entry points.

## Active graph

The root workspace has 203 members, including 51 NIE members. Bevy, wgpu,
Dust and active Gecko libraries inherit root dependency ownership. Full root
dependency resolution is restored with one active lockfile. Ruzu and archived
native launchers are retained source with separate integration boundaries.
Earlier notes about 198 absent members and unresolved fontconfig selection
are historical, not current configuration failures.

## Shared settings

- Rust 1.98.1 and the targets/components declared by `rust-toolchain.toml`.
- Rust 2024 source style and the root formatter policy.
- Root `target/` output, v0 symbol mangling and repository-relative dep-info.
- Sparse crates.io, five retries and Git CLI fetching.
- Explicit MinGW linker/stack-protector configuration for that target.
- Host-global sccache wrapper; do not disable it except for a deliberate
  per-command investigation.
- No global `target-cpu=native`, WASM SIMD requirement or upstream debug cfg.

The Dust browser build currently uses scoped `RUSTC_BOOTSTRAP=1` for retained
nightly-language requirements through `scripts/build/build-emulator-web.ts`. The
pinned stable toolchain does not imply every imported crate is stable-only.
That shared script builds DS/Wii against the root lock and uses a matching
`wasm-bindgen` CLI. Generated bindings are ignored.

## Upstream configuration handling

| Source | Retained decision                                                                   |
| ------ | ----------------------------------------------------------------------------------- |
| NIE    | Shared root versions, artifacts and target flags; product source under `crates/nie` |
| wgpu   | Root toolchain; `cargo xtask-wgpu`; upstream lock-validation cfg is not global      |
| Naga   | `cargo xtask-naga` avoids alias collision                                           |
| Bevy   | Root toolchain/formatter; optional fast-link/nightly settings remain opt-in         |
| Gecko  | Root toolchain; upstream WASM/configuration snapshots are reference material        |

Upstream snapshots under `docs/upstream` and component docs record provenance;
they do not override the active root configuration. Compare source requirements
before promoting upstream flags or copying dependency features.

## Configuration gates

```sh
cargo metadata --no-deps --format-version 1 --locked
bun run check:workspace
cargo fmt --all --check
cargo check --workspace --tests --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
git diff --check
```

Metadata, dependency resolution and the targeted browser/native emulator gates
have measured results in [PLAN.md](../../PLAN.md). Full-workspace format/check/
Clippy are acceptance commands, not an assertion that all imported source has
passed. Run the narrowest changed-owner gate before the combined release gates.
