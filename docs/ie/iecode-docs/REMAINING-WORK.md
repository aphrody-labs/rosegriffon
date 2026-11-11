# IECODE remaining work

Current acceptance gaps as of 2026-10-03. The completed root Cargo resolution,
NIE source migration and DS/Wii browser smoke execution are recorded in
[PLAN.md](../PLAN.md); they are not pending source imports.

## VFS-first source qualification

Installed-source qualification is complete (24/24 probes). Shared indexed
discovery and HTTP/SSH transports are implemented; HTTP qualification passes
27/27 probes against the unchanged original installation, and native SFTP
mount/read/inventory passes on a real configured server with generated fixtures.
Matching global NIE, managed IECODE, Inagle and native-library installations
are maintained in the current ledger. See [the transport contract and measured
limits](architecture/CLI-DECISION.md). Whole-game SSH over a WAN remains an
additional deployment/performance qualification, not evidence supplied by the
fixture test. No dump or SQL projection is required by these analysis paths.

The legacy Inagle-wide Azalee integration still expects extracted game-data
JSON and a SQLite mirror. Its previous run passed 142/143 tests, and a child
CLI test did not finish within 90 seconds. Keep that separate from the focused
VFS adapter tests and direct runtime qualification; do not manufacture game
dumps or database rows to satisfy it.

## Repository acceptance

- Qualify root `bun run check:all` before a combined production release. The
  74-member Rust all-target check and DS WASM check pass; strict Clippy still
  reports 653 retained DustCore diagnostics. Actual root check:all first stops
  at formatting differences in external Cargo path dependencies, which were
  left in their owning sibling checkout. Targeted Rust suites pass 662
  tests, Python 130, managed Core 304, and C++ Release 489. These counts do not
  substitute for all-member tests or complete emulator execution.
- Recover authorized NIE generated game inputs and validate dependent packages
  and the `aphrody-nie-ffi` bindings against real native symbols and fixtures.
  Do not manufacture formations or skill tables to make tests pass.
- Keep inherited warnings, omitted upstream fixtures and excluded snapshots
  explicit; prove clean-clone behavior with declared dependencies.

## Console execution

- DS: extend legal homebrew coverage, deterministic replay and game visual
  fidelity; measure actual hardware GPU performance separately from SwiftShader.
- Wii: validate retail disc boot and rendering against reference output;
  implement browser NAND integration, real remote/nunchuk support and replay.
  Current proof is validated DOL execution and three browser frames, using a
  fixture without graphics writes.
- 3DS: build CPU/device/service integration and PICA execution beyond the
  portable parser/command extractions; boot legal homebrew and present frames.
- Switch: integrate Ruzu's package graph and missing inputs, establish a
  portable browser CPU strategy and WebGPU renderer, then demonstrate homebrew.
- Unify multi-console Bevy hosting only after each console's retained runtime
  interfaces and scheduling requirements are measured.

## Registry automation

- Optional tokenless migration: register niepy's existing-project Trusted
  Publisher with `aphrody-labs / iecode / workflow.yml / pypi`, then remove
  the pypi environment's PYPI_API_TOKEN secret. Automatic token publication
  already passes Actions run 37104130734. OIDC registration remains unverified.
- Qualify dependencies and license boundaries before exposing additional Rust
  workspace members. Wii/AArch64 0.1.1 are published and consumed from crates.io;
  they remain the currently qualified portable leaves.
- Reproduce validation against the exact clean pinned Aphrody source. Local
  Cargo path dependencies currently resolve the active sibling checkout.

## Source and release boundaries

- Preserve pinned source provenance and license notices during future updates.
  Native GameCube HLE IPL remains an explicit local `IECODE_GC_IPL_HLE` input.
- Keep game fixtures, private data and generated output ignored; review source
  rights before distributing private NIE packages or combined GPL artifacts.
- Keep libraries in their existing owners and host adapters thin. Dust already
  has its established `dust` CLI; another generic Rust IECODE CLI is not planned.

Detailed console gaps are in [Console migration](emulation/MULTICONSOLE-RUST-MIGRATION.md)
and legal/source gaps in [upstream emulator references](upstream/README.md).

## Cross-repository handoff (2026-10-01)

- Owner directives (no AI commit identity, private repositories, no AI
  mentions in public products, licences decided at distribution), GitHub
  account state and the SQL/data policy affecting IECODE are recorded in
  [development/AGENT-HANDOFF-2026-10-01.md](development/AGENT-HANDOFF-2026-10-01.md).

## CI shared source publication (2026-10-01)

- The checkout contract now reads the private repository and exact 40-character
  revision from `workspace.manifest.json`'s `operations` entry. The published
  pin is `ec2212914457af395e857b3bb029f6187ffab748`; the checkout action verifies
  the Infra, Web crawl/engine, Bun Web service, RE and UI Rust owner paths needed
  by the current workspace. Configure `APHRODY_CHECKOUT_TOKEN` with read access
  to `aphrody-labs/aphrody`. Local Inagle tests/typecheck, workspace and
  documentation gates pass; a clean GitHub runner has not yet verified the new
  pin contract.
