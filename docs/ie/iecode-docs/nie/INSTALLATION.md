# Install the NIE CLI from IECODE

## Current package owner — 2026-10-01

The user CLI binary is `nie`, supplied by the root workspace package
`aphrody-nie-cli` at `crates/nie/aphrody-nie-cli`. The canonical checkout is
IECODE; the former standalone NIE Git installation instructions are historical.
The package inherits `publish = false` from the root workspace.

Game rights and Inazuma Eleven content remain governed by the retained
[NIE license](LICENSE) and the commercial exploitation agreement
RG-L5-VR-2026-001. Installing a CLI does not redistribute game data.

## Requirements

- The toolchain in [rust-toolchain.toml](../../rust-toolchain.toml).
- The IECODE checkout and the sibling Aphrody source paths required by its
  root `Cargo.toml` dependency catalog.
- Native libraries required by the selected platform and package features.

The manifest lists Linux, macOS and Windows as intended platforms; this page
does not claim that an installation on all three has been tested. Memory
inspection commands can have platform-specific requirements.

## Build and install

Run from the IECODE checkout root:

```console
cargo build -p aphrody-nie-cli --release --locked
cargo install --path crates/nie/aphrody-nie-cli --locked
nie --version
```

These are package-scoped commands, not a full workspace release gate. Root
`AGENTS.md` and `PLAN.md` record the current measured gates and release boundary.

Cargo installs the binary in `$CARGO_HOME/bin` (normally `~/.cargo/bin` on Unix).
Ensure that directory is in `PATH`. To update, update the checkout and run the
same installation command with `--force`; do not use the old standalone NIE
Git URL as the current source owner.

## Uninstall

```console
cargo uninstall aphrody-nie-cli
```

This removes the installed CLI package. Game installations, private inputs
and the source checkout are separate.

The retained [NIE command manual](NIE-ET-CLI.md) describes game-specific RE and
format operations. Check the current binary's `--help` before using historical
command examples. No `just installer` entry point exists in the IECODE root.
