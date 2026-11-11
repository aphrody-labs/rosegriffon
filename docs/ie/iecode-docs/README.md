# IECODE Documentation

Historical reports and research snapshots are stored in `docs.7z`. Run
`bun run docs:unpack` to read or edit them, then `bun run docs:compact` to
verify the archive and remove their expanded directories. Current guides,
format references and license notices remain in this tree.

This index categorizes the technical documentation across the monorepo. `AGENTS.md` defines agent policy and `PLAN.md` records measured execution progress.

---

## 1. Game Domain & `nie.exe` Reverse Engineering

Authoritative disassembly analysis, cryptographic constants, and binary file formats for _Inazuma Eleven: Victory Road_:

- [Measured VFS contents and decoding coverage](formats/VFS-FORMAT-SPECIFICATIONS.md): Whole-install scan counts, observed sample bytes, runtime outcomes and known gaps (2026-10-03).
- [Cross-Language Conventions](formats/CROSS-LANGUAGE-CONVENTIONS.md): Memory alignment, endianness, and C-ABI contracts across Rust, C++, .NET 10, Bun, and Python.
- [Inagle VFS Catalog](../packages/inagle/docs/VFS-SPECIFICATION.md): CRI CPK packaging, priority mounting rules, CRILAYLA decompressor, and directory topologies.
- [`nie.exe` Disassembly Reference](../packages/inagle/docs/NIE-EXE-REVERSE-ENGINEERING.md): PE32+ `0x140000000` base, 117,068 functions, 8 critical offsets, RTTI hierarchy, and Viola cipher keys.
- [Tri-Runtime Architecture](../packages/inagle/docs/CROSS-LANGUAGE-ARCHITECTURE.md): Integration of Bun TypeScript, Rust `libiecode.so`, and .NET 10 NativeAOT `IECODE.Ffi.so`.
- [NIE Domain Index](nie/README.md) & [NIE Migration Boundary](nie/IECODE-MIGRATION.md): Reverse-engineering boundaries and migration matrix.

---

## 2. Multi-Console Emulation Ecosystem

Hardware emulation cores, headless debug bridges, and timing reference implementations:

- [Multiconsole Migration Ledger](emulation/MULTICONSOLE-RUST-MIGRATION.md): Measured emulation milestones for DS, Wii, Switch, and 3DS.
- [Emulator Crate Layout](architecture/EMULATOR-CRATE-LAYOUT.md): Mapping of console subsystems to pure-Rust crates in `crates/emu/*`.
- [Headless Execution Architecture](architecture/RUST-HEADLESS-EMULATION.md): Headless execution, deterministic stepping, and automated test fixtures.
- [melonDS Integration Reference](emulation/MELONDS-UPSTREAM.md): Nintendo DS hardware timings and register oracles.
- [Dust CLI Debug Bridge Skill](../.agents/skills/dust-cli/SKILL.md): Headless CLI tool providing watchpoints, single-stepping, and memory inspection.
- Switch binary analysis: the [`switch-reverse` skill](https://github.com/aphrody-labs/yolo-re/tree/main/skills/switch-reverse) in the standalone yolo-re workspace.

---

## 3. Graphics & Rendering Engine

IECODE's renderer adapters use published Bevy/wgpu releases; engine benchmarks and upstream fork history are maintained in the independent archived GPU research:

- [Renderer Convergence](architecture/RENDERER-CONVERGENCE.md): emulator and NIE renderer ownership and GPU type boundaries.
- [Web Frontend Architecture](../apps/web/README.md): Browser UI and WebAssembly bindings for DS Dust and Wii Broadway GPU presentation.

---

## 4. Architecture & Monorepo Governance

Design patterns, process boundaries, and multi-language ownership rules:

- [Architecture Overview](architecture/ARCHITECTURE.md): Monorepo structure, language owners, and runtime boundaries.
- [Monorepo Conventions](architecture/MONOREPO-CONVENTIONS.md): Crate naming guidelines, package IDs, and directory structure.
- [Emulation Platform Decision](architecture/EMULATION-PLATFORM-DECISION.md): Evaluation criteria for hardware emulation targets.
- [VFS-first CLI and data flow](architecture/CLI-DECISION.md): Shared installed-game reads through NIE, managed IECODE and Inagle, source ownership and runtime gates.
- [Steam Integration Architecture](architecture/STEAM-ARCHITECTURE.md): Steam App ID `2799860` integration and platform layer.
- [Execution Ledger](../PLAN.md) and [Remaining Work](REMAINING-WORK.md): Measured tracking of repository milestones.

---

## 5. Development & Toolchain Guides

Local environment setup, build instructions, and developer tooling:

- [Current Inagle / NIE / IECODE FFI](development/INAGLE-NIE-FFI.md): Native ownership, memory and qualification boundaries.
- [Workspace Entry Points](development/WORKSPACE.md): Setup instructions for Rust, Bun, Python/uv, .NET 10, and CMake/vcpkg.
- [System Requirements & Dependency Matrix](development/SYSTEM-REQUIREMENTS.md): Complete setup for Windows 11, Linux (Debian/Ubuntu), and Docker.
- [Environment Ownership](development/ENVIRONMENT-OWNERSHIP.md): IECODE, Aphrody and RG private configuration and loading rules.
- [Development Environment](development/DEVELOPMENT-ENVIRONMENT.md) and [Aphrody Rust Baseline](development/APHRODY-RUST-BASELINE.md).
- [Nintendo DS Tooling](development/DS-TOOLING.md) and [Homebrew Toolchains](development/HOMEBREW-STACK.md).
- [Python Tooling Guide](development/python-tools.md): Testing and linting pipelines with uv and ruff.
- [Contributing Guide](../CONTRIBUTING.md): Code review, pull requests, formatting standards, and zero AI attribution policy.
- [Agent Skills Catalog](../.agents/README.md): Assistant skills and analysis adapters.

---

## 6. Auto-Generated & Machine-Readable Specifications

Standardized, programmatic specifications generated from reverse-engineering models and codebase schemas:

- [OpenAPI 3.1.0 Specification (JSON)](../packages/inagle/docs/OPENAPI.json) & [YAML](../packages/inagle/docs/OPENAPI.yaml): Standardized RESTful schema for game data and VFS endpoints.
- [Answer.AI LLMs Manifest](../packages/inagle/docs/llms.txt) & [Consolidated Context](../packages/inagle/docs/llms-full.txt): Comprehensive machine-readable documentation index.
- [Public AI Service](https://iecode.aphrody.com): Canonical domain providing public API documentation and LLM resources.

---

## 7. Migration Records & Upstream Evidence

Retained reference source, historical logs, and upstream fork provenance:

- [Rust Workspace Unification](migrations/RUST-CARGO-UNIFICATION.md), [C++ Unification](migrations/CPP-UNIFICATION.md), and [NIE Absorption](migrations/NIERS-ABSORPTION.md).
- [IEVR to IECODE](migrations/IEVR-TO-IECODE-2026-10-01.md): IECODE as the exclusive owner of inagle, azalee, zukan and NIE documentation; Aphrody consumes revision-pinned private package archives ([map](migrations/ievr-to-iecode-2026-10-01.json), [Aphrody docs snapshot](history/aphrody-docs-2026-10-01/README.md)).
- [Upstream Repository Index](upstream/README.md).
- Retained IECODE upstream references cover emulator and game-domain sources; Bevy/wgpu fork evidence and tools belong to archived GPU research.
- Legal and licensing boundaries: [Third-Party Disclosures](../THIRD_PARTY.md) and [License Notices](../LICENSES.md).

Run `bun run docs:check` to validate all documentation links and source owners.
