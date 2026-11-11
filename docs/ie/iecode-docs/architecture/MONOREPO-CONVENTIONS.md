# IECODE multilingual monorepo conventions

Current ownership checked against repository manifests on 2026-10-02. The
repository lives beside the active Aphrody monorepo; `../src` is historical. A **single project per
language** means one owning workspace/solution/build graph, not one enormous
crate, package, assembly or translation unit.

| Surface        | Canonical entry / lock                                   | New source naming                                                                       | Ownership                                                                 |
| -------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Rust           | `Cargo.toml` / `Cargo.lock`                              | Owned packages use `aphrody-<domain>-<capability>`; `crates/nie/aphrody-nie-*` owns NIE | Portable domain logic, headless emulator contract, WASM, versioned C ABI  |
| Bun/TypeScript | `package.json` / `bun.lock`                              | `packages/<domain>`; package names may use `@aphrody/`; apps in `apps/`                 | Thin client bindings, web/CLI presentation and package adapters           |
| .NET 10        | `IECODE.sln`, `Directory.Packages.props`, project locks  | `src/IECODE/<Domain>/IECODE.<Domain>.csproj`                                            | One managed Core, CLI, GUI, FFI and tests; Windows/launcher/modding hosts |
| C/C++          | root `CMakeLists.txt`, `CMakePresets.json`, `vcpkg.json` | `src/iecode-cpp/<domain>`; IECODE targets `iecode_<domain>`                             | Foreign emulator cores, target-side libraries and ABI adapters            |
| Python         | `pyproject.toml` / `uv.lock`                             | New distributions `iecode-<domain>`, imports `iecode_<domain>`                          | Extraction, scripting, analysis and data preparation                      |

The existing historical Python package names are compatibility surfaces. Do
not rename their imports or published identifiers until their consumers and
lockfiles migrate together. Keep names, APIs, paths and new technical docs in
English.

## Rust crate names across Aphrody and IECODE

`aphrody-` is the Cargo package namespace for new Aphrody platform code across
both monorepos. Use `aphrody-<domain>-<capability>` when a domain owns several crates:
`aphrody-nie-formats` in IECODE, `aphrody-web-crawl` in Aphrody, and
`aphrody-dust-core` for the DS emulator. A domain facade can use just
`aphrody-<domain>` (`aphrody-web`); a shared capability without a product
domain can use `aphrody-<capability>` (`aphrody-gpu-backend`). The top-level
`aphrody` CLI keeps its established package name.

- The Cargo package name is the canonical identity. The default Rust library
  target replaces hyphens with underscores. Keep a legacy `[lib]` or `[[bin]]`
  name explicitly when source imports or user commands depend on it.
- NIE directories match `crates/nie/aphrody-nie-<capability>`. Imported
  console forks retain established paths such as `crates/emu/wii/core`; Cargo
  package names remain namespaced. Sibling Aphrody category directories may
  use short capability paths; read their actual manifests rather than infer a
  directory from the package name.
- Use short English capability names. Do not repeat the organization or domain
  inside the capability (`aphrody-nie-identity-source`, not a second `aphrody`).
- Imported forks retain their source layout and legal provenance. Active
  IECODE Bevy, wgpu, Naga and Dust package IDs already use namespaced fork
  families; their Rust library target names remain compatible with upstream.
  Unintegrated vendor source is not renamed merely to fit the namespace.
  The existing Koharu product packages and Obscura/Taffy vendor packages in
  Aphrody retain their upstream package IDs as compatibility contracts.
- Local dependencies point to the owning workspace member; their package
  selectors use the canonical name. A dependency alias is allowed only to keep
  a stable Rust import or an upstream source API during migration.

`bun run check:workspace` checks active IECODE members against this convention.

## One owner per behavior

1. Put reusable algorithms and device-independent state in a library first.
   `crates/emu` owns scheduling/snapshot contracts; a console core owns its own
   CPU, bus, RAM and device semantics. A CLI, GUI, Bun package or Python module
   does not copy those algorithms.
2. Cross-language calls use the versioned C ABI and explicit data schemas.
   C# P/Invoke, Bun FFI and Python bindings are adapters, not competing format
   parsers. A WebGPU/DX12/Vulkan host consumes an owned frame/command contract,
   not another backend's incompatible GPU handles.
3. Web acquisition belongs to Aphrody `aphrody-web`; IECODE owns Zukan parsing
   and reference validation behind the optional `@aphrody/agent-browser/service`
   binding. Do not add a second crawler or HTTP transport to a consumer.
4. Runtime orchestration, deployment and release policy belong to the
   Aphrody monorepo's Infra workspace, not IECODE; IECODE only exposes thin local gates. Private game
   fixtures stay outside Git and are mounted by explicit developer paths.
5. Active Bevy/wgpu/Dust/Gecko packages share one root Cargo workspace and
   lockfile. Ruzu and archived native launchers retain documented integration
   boundaries; their source snapshots are not additional active root graphs. License notices, source provenance and
   hardware-core boundaries remain mandatory during that merge. See
   [Renderer convergence](RENDERER-CONVERGENCE.md).

## Package-manager rules

- Cargo: use the virtual root workspace, inherited package metadata,
  dependencies and lints, one `Cargo.lock`, explicit members/exclusions and
  `--locked` in gates. [Cargo workspace reference](https://doc.rust-lang.org/cargo/reference/workspaces.html).
- Bun: declare every active package in `workspaces.packages`, share versions
  through the root catalog, use `workspace:*` for local package links, commit
  one `bun.lock` and verify with `bun install --frozen-lockfile`. TypeScript 7
  remains semantic checker (catalog `7.0.2`); Oxlint `1.85.0` and Oxfmt
  `0.70.0` own lint/format. Bun is pinned to `1.4.2` in `packageManager`.
  [Bun workspaces](https://bun.com/docs/pm/workspaces),
  [catalogs](https://bun.com/docs/pm/catalogs).
- uv: one root workspace and `uv.lock`; each member has its own
  `pyproject.toml`. Use `tool.uv.sources` with `workspace = true` for internal
  dependencies, not duplicated editable path declarations. Do not add pip or
  Poetry lockfiles. [uv workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/).
- .NET: keep `Directory.Packages.props` as the sole NuGet version source and
  locked restore. Let the target framework choose its supported C# language
  version; `LangVersion=latest` is deliberately removed because Microsoft
  warns that it makes builds machine-dependent.
  [Central Package Management](https://learn.microsoft.com/en-us/nuget/consume-packages/central-package-management),
  [C# version guidance](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/configure-language-version).
- CMake: expose logical targets and usage requirements, do not duplicate
  include/link flags between native modules; use root presets and the one
  vcpkg manifest. Keep upstream melonDS' C++17 requirement separate from
  IECODE's C++20 target. The root superbuild is the acceptance graph while
  upstream native source is being factored.
  [CMake build-system model](https://cmake.org/cmake/help/latest/manual/cmake-buildsystem.7.html),
  [presets](https://cmake.org/cmake/help/latest/manual/cmake-presets.7.html).

## Current convergence gates and gaps

`bun run check:workspace` checks workspace membership and prefixes; `cargo check
--workspace --tests --locked` validates the active Rust graph; locked .NET
restore/build/tests validate the managed graph. `bun run format:check` and
`bun run lint` include Oxlint/Oxfmt alongside Rust and Python.

The complete root release gates are not yet qualified. NIE consumers still need
authorized generated game data and real native binding validation. The
`aphrody-nie-ffi` implementation already lives at `crates/nie/aphrody-nie-ffi`
and exports library target `iecode`; verify consumer symbols and fixtures before
claiming complete integration. Do not substitute invented game data or skipped
assertions. DS and Wii have measured generated-WASM browser execution; Switch
and 3DS do not. Current results and gaps are recorded in [PLAN.md](../../PLAN.md),
[Remaining work](../REMAINING-WORK.md) and [upstream emulator references](../upstream/README.md).

RG and Shenron consumers remain quarantined pending their product gates.
IECODE producer changes and Aphrody's revision-pinned package archives must be
validated and repinned together; local source tests alone do not qualify a
consumer or deployment. Current shared capability discovery uses the catalog
in `../aphrody/docs/ecosystem/`, owned by the active Infra workspace.

## Runtime evidence and analysis ownership

`bun run analyze:cli` is the single root adapter for comparing the installed
NIE, managed IECODE and Inagle commands, plus optional native/inventory tools.
Its implementation belongs in `scripts/tools/cli-evidence.ts`; it runs existing
binaries against the installed VFS and does not introduce another parser or
build/deploy graph. Explicit binary paths establish which artifact was
exercised. Installed executable versions and package-manifest versions remain
separate observations.

Keep source libraries in their existing `crates/`, `packages/`, `src/` and
`apps/` owners. Current measured references belong in `docs/formats/`; the
command flow and observed output shapes belong in the existing
[CLI ownership reference](CLI-DECISION.md). Record actual outcomes and ordered
acceptance gaps in root `PLAN.md` and `docs/REMAINING-WORK.md`.

Private install files, extracted companion pairs, raw CLI output, generated
models and inferred shape JSON stay outside Git. A shape observed from a sample
is not a shared ABI schema, and an advertised command or exit zero is not a
semantic acceptance gate. Compare values and units before consolidating behavior
or moving ownership; preserve one owning library per behavior.
