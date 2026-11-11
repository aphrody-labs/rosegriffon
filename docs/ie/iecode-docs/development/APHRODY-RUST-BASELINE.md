# Aphrody Rust baseline for IECODE

Current alignment on 2026-10-01. Shared Aphrody platform crates live in the
sibling `../aphrody` monorepo; historical `../src/aphrody-*` checkouts are not
active package owners. IECODE owns the NIE game-domain source in `crates/nie`.

## Adopted baseline

| Policy               | IECODE decision                                                      | Active evidence                                 |
| -------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| Compiler             | Pinned Rust 1.98.1                                                   | `rust-toolchain.toml`                           |
| Language             | Rust 2024, resolver 3, root MSRV                                     | `Cargo.toml` package/workspace metadata         |
| Formatting           | Root rustfmt policy                                                  | `rustfmt.toml`                                  |
| Dependency ownership | Root catalog; consumed target features                               | `[workspace.dependencies]` and member manifests |
| Package identity     | Active packages use `aphrody-*`; compatible library aliases retained | `scripts/validation/rust-crate-names.ts`        |
| GPU identity         | Published Bevy 0.19.1 and wgpu 30.0.1; Bevy renderer uses wgpu 29    | Root Cargo catalog and `Cargo.lock`             |
| Operations           | Thin binding to sibling `@aphrody/workspace`                         | `scripts/tools/aphrody-ops.ts`                  |
| Distribution         | Preserve upstream notices and private NIE boundary                   | `LICENSES.md`, `THIRD_PARTY.md`                 |

The active Cargo graph resolves 74 emulator/NIE members from one root lockfile.
The older 203-member imported engine graph and separate GPU lab are not part of
the IECODE workspace. They are not build prerequisites for game or emulator
consumers.

Reuse existing compatible Aphrody crates before copying platform behavior.
Local dependencies use current sibling source paths and canonical package
selectors. Version alignment still requires source/API and feature validation;
textually matching version numbers does not establish GPU interoperability.

## Gate after dependency changes

```sh
bun run check:workspace
cargo metadata --no-deps --format-version 1 --locked
cargo fmt --all --check
cargo check --workspace --tests --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo nextest run --workspace --locked
git diff --check
```

The latest measured root resolution and targeted DS/Wii execution gates are
recorded in [PLAN.md](../../PLAN.md). The complete current workspace release is
not qualified by historical extraction test counts. Missing authorized game
data and native NIE binding validation remain explicit acceptance gaps.
