# IECODE workspace

IECODE's active checkout is separate from the sibling Aphrody monorepo. The
historical `../src` archive is not a default source or dependency owner.

Development uses the qualified Aphrody Bun fork pinned in
`config/bun-runtime.json`, including its full source revision. The root Bun
catalog and overrides resolve Bun declarations to `@aphrody/bun-types`; an
upstream Bun executable or a different fork revision does not satisfy setup.

## Optional external data

Dependency setup does not require a sibling database, remote asset CDN or private
game catalogue. The shared storage launcher prefers an installed/indexed game
VFS, otherwise a ready IE-owned Docker PostgreSQL database, otherwise an existing
qualified local SQLite mirror. Set `INAGLE_DATA_SOURCE=vfs`, `sqlite` or `postgres`
to select explicitly; unavailable explicit sources fail rather than silently
changing backend. An inherited database URL alone never selects PostgreSQL:
the selected domain connection must use `NIE_PG_URL`.
Inagle uses same-origin asset URLs unless an explicit asset service is selected.

Run `bun run storage:status` for redacted readiness evidence, and
`bun run storage:run -- bun <script>` to launch with the selected backend and
actual checkout root. `bun run inagle:cli -- <arguments>` uses this launcher. Native VFS
requires the qualified IECODE library and an installed/indexed game source;
the shared native resolver handles Steam installations and explicit
`NIE_GAME_SOURCE` inputs without downloading private game data.

`bun run storage:setup` provisions only the isolated IE Docker PostgreSQL
project using the immutable images in `config/storage-runtime.json`. A healthy
empty PostgreSQL database does not displace a populated local SQLite mirror.
`bun run storage:backup` snapshots the existing mirror consistently, verifies
SQLite integrity and SHA-256, and verifies a read-only Docker backup mount.
When Windows host bind sharing is unavailable, it uses a separately labeled
IE backup volume. Profile runtime configuration, passwords, backup receipts
and database payloads remain outside Git. No backup is restored implicitly and
no Aphrody or DBFR database is adopted by discovery.

NIE's editorial gallery starts with an empty inventory and preserves available
selection rows from the selected local mirror. `NIE_GALLERY_MANIFEST` optionally
selects a validated JSON inventory. A missing or malformed explicitly selected
file is an error, rather than an implicit download. Private payloads and complete
catalogue parity remain separate runtime qualifications; an empty inventory does
not establish game-content completeness.

The dated npm archive and integrity evidence is retained in
[the release receipt](../../../tools/ie/config/iecode-npm-release.json). Publication of source,
compiled browser bindings and complete game-runtime qualification are separate
checks; the receipt keeps pending packages explicit.

| Language       | Single active entry point                            | Source                                    |
| -------------- | ---------------------------------------------------- | ----------------------------------------- |
| Rust           | `Cargo.toml`, `Cargo.lock`                           | `crates/` and Rust adapters in `apps/web` |
| Bun/TypeScript | `package.json`, `bun.lock`                           | `packages/`, `apps/`, shared `scripts/`   |
| .NET           | `IECODE.sln`, central NuGet properties/project locks | `src/IECODE`                              |
| C/C++          | `CMakeLists.txt`, `CMakePresets.json`, `vcpkg.json`  | `src/iecode-cpp`                          |
| Python         | `pyproject.toml`, `uv.lock`                          | Declared Python members in `src/`         |

NIE libraries live in `crates/nie`; emulator libraries in `crates/emu`. They
consume published Bevy 0.19.1, wgpu 30.0.1 and egui adapters from the
root dependency catalog. Bevy's renderer remains on the wgpu-types 29 family;
the licensed `aphrody-egui-winit =0.36.2` compatibility release supplies the
minimal native/WASM clipboard correction required by the Wii browser adapter.
the IECODE emulator adapter uses wgpu 30. Browser apps belong in `apps/`,
JS/TS libraries in `packages/`. Bevy/wgpu forks, their docs, tools, benchmarks,
examples and engine tests belong to the independent archived GPU research repository,
which is not a build dependency. Not every retained source snapshot is an
active workspace member: Ruzu and legacy native Gecko launchers still have
separate integration gaps.

## Root gates and build output

```sh
bun run doctor
bun run check:workspace
cargo metadata --no-deps --format-version 1 --locked
cargo check --workspace --tests --locked
bun run build:web
cmake --preset unified
cmake --build --preset unified --parallel 2
dotnet restore IECODE.sln --locked-mode
dotnet build IECODE.sln --configuration Release --no-restore
dotnet test src/IECODE/Core.Tests/IECODE.Core.Tests.csproj --configuration Release --no-restore
```

These commands describe the current interfaces, not a claim that every gate
passes. Cargo metadata and dependency resolution have been restored; full
workspace checking and a complete release remain separate acceptance gates.

`BUILD_UNIFIED=ON` enables the native C++/melonDS builds and managed tests.
The aggregate `iecode` target depends on native compilation, root Cargo
workspace tests and .NET solution tests. It does not build a separate Rust
IECODE CLI or explicitly package the NIE FFI artifact.

Native dependencies are opt-in features in the single root `vcpkg.json`.
`iecode-cpp-debug` and `iecode-cpp-release` select `iecode-cpp` (core, CLI and
tests); the portable Release preset disables compiler-specific AVX2 requirements.
`debug` and
`release` also select `melonds`. `engine` adds the retained Bullet/Lua adapters,
`qt6` adds the optional Qt frontend, and `native-display` supplies explicit
display SDK packages when needed. Core bgfx still uses the host graphics
development libraries. Assimp has no source consumer and is no longer linked.
External projects share one installed dependency tree and the same feature
union, including `qt6` when its frontend is requested.
`IECODE_NATIVE_BUILD_JOBS` defaults to two and also bounds nested native builds;
the root build's `--parallel` alone does not limit an external Ninja process.

The C++ external target is excluded from the root default build. Build and test
it explicitly:

```sh
VCPKG_MAX_CONCURRENCY=2 cmake --preset iecode-cpp-debug
cmake --build --preset iecode-cpp-debug --target iecode_cpp --parallel 2
ctest --test-dir build/iecode-cpp-debug/iecode-cpp --output-on-failure
```

Cargo artifacts belong in root `target/`; CMake artifacts in the preset's
build directory; browser bindings and bundles in ignored generated paths.
No build output, ROM, BIOS, keys or private fixture belongs in Git. Shared
operations resolve installed `@aphrody/workspace/ops` via
`scripts/tools/aphrody-ops.ts`; explicit checkout settings take precedence.

See [Architecture](../architecture/ARCHITECTURE.md), [Conventions](../architecture/MONOREPO-CONVENTIONS.md)
and [Development environment](DEVELOPMENT-ENVIRONMENT.md).

## Bun and Infra script ownership

Declared Bun workspace patterns resolve the actual members through their package
manifests (32 local members on 2026-10-09; `@rosegriffon/ui` is consumed from npm). They use the root dependency catalog and `bun.lock`, with
matching `engines.bun`. `bunfig.toml` applies the shared isolated-install policy.
`Cargo.toml` declares Rust membership; `workspace.manifest.json` is the validation inventory.
Keep these in agreement rather than treating a recorded member count as acceptance.

`scripts/tools/aphrody-ops.ts` verifies the installed operations owner identity and
delegates to its `./ops` export. Explicit `APHRODY_ROOT` or `APHRODY_INFRA_ROOT`
selects the owning source checkout; both aliases must resolve to the same checkout.
`bun run check:workspace` includes shared Bun/layout checks and the script relocation
inventory. `bun run pipeline:sync` generates the IECODE pipeline through Infra;
it does not execute the pipeline. See [Scripts](../../scripts/README.md).

Production service and ingress policy have one owner: the sibling Aphrody Infra
workspace. Its canonical catalogs are `../aphrody/config/service-catalog.json`,
`../aphrody/config/nginx-routes.json` and
`../aphrody/config/production-topology.json`; lifecycle operations are owned by
`../aphrody/crates/infra/infra` and exposed here only through the thin operations
binding. Do not add IECODE-owned systemd units, Nginx routes or a second host
supervisor. The virtual unit model under Aphrody `crates/os/systemd` is an
in-process model; host lifecycle operations currently use the Infra adapter.
Those source files describe policy and implementation, not the live state of a
host. Verify WSL, VPS or DBFR state through the owning Infra status surface.

The contracts CI checks out IECODE into `iecode/` and Aphrody into sibling
`aphrody/`. `.github/actions/setup-aphrody/action.yml` reads the repository and
full revision from `workspace.manifest.json`'s `operations` contract. Its
`APHRODY_CHECKOUT_TOKEN` secret must have read access to that repository;
checkout credentials are not persisted. Update the manifest pin after shared
owners are published. Local sibling checks do not establish clean-runner acceptance.

## Shared ownership and acquisition

IECODE owns `@rosegriffon/inagle`, `@rosegriffon/inagle-cross` and
`@rosegriffon/azalee`. Bun consumers use published npm packages pinned in the root
catalog; Rust consumers use crates.io versions in the root Cargo catalog.
Producer releases require coordinated consumer versions and lockfiles.
Install both dependency sets with `bun run setup`, or use
`bun run install:workspace` and `cargo fetch --locked` separately. Setup uses the
frozen Bun lockfile and fetches Rust dependencies without compiling engines.
It never links or copies sibling databases. Private game-data resolution is
optional and requires `bun run setup --setup-data`.
Shared operations install from the root npm catalog and frozen lockfile. Registry
mode works without a sibling checkout and preserves native host configuration.
The declared sibling remains a legacy fallback only when the package is absent.
No sibling Bun package is an additional workspace member. The optional
`@aphrody/agent-browser/service` peer delegates Zukan acquisition to
`aphrody-web`; IECODE retains domain parsing and reference-file validation.
A standalone installation without the peer fails explicitly when acquisition
is requested. RG and Shenron integration remains quarantined until their own
product gates pass; Inagle tests do not qualify those consumers.

Use the Aphrody discovery snapshot at `../aphrody/docs/ecosystem/`
(`ECOSYSTEM.md`, `CLI.md`, `MCP-TOOLS.md`, `ecosystem.json`) to locate candidates,
then verify their current manifests and source. The 2026-10-02 path audit found
stale entries, including former Aphrody RG package paths; this snapshot does
not establish current ownership or availability. Its generator is the Aphrody
root script `scripts/ecosystem.ts`, not the Infra `ecosystem-deps` operation.
From Aphrody, `bun scripts/ecosystem.ts --root .. --check` checks freshness;
without `--check` it regenerates the four existing catalog files. The generator
invokes `cargo metadata --no-deps --offline`, so coordinate it with native
validation. The older `docs/reference/infra/ecosystem/` records the split-repo
layout. References to standalone `aphrody-infra` or `../src` in historical
records describe earlier layouts, not active dependency owners.

## Qualified Bun runtime

Use the Aphrody Bun fork selected by [the runtime contract](../../config/bun-runtime.json),
currently `1.4.3-aphrody.3` at revision `d46f0ed6c69b3d945bbe9452d52e85231db02d0a`.
The root package-manager pin identifies this fork; member engine ranges declare
the base semantic-version floor. `bun scripts/validation/bun-runtime.ts` verifies
the current executable before setup or Bun checks. Standard Bun and different
unqualified revisions fail explicitly. Future fork builds need an updated version
and full revision contract after native qualification. No machine-specific path
or global environment change is required.

## Manifest baseline (2026-10-09)

The root Bun catalog declares TypeScript `7.0.2`, Oxlint `1.86.0` and Oxfmt
`0.70.0`; Bun's engine minimum is `1.4.3` and package-manager pin is `1.4.3-aphrody.3`.
`rust-toolchain.toml` selects `1.98.1`, while Cargo's inherited MSRV is `1.97`
and edition is 2024. The root wasm-bindgen requirement is `0.2.127`; the
lockfile resolves `0.2.129`, which is the required matching CLI version.
Python requires `>=3.10`, uv exactly `0.12.22`; .NET selects `10.0.102` with
`latestMinor` roll-forward. These are checked-in contracts, not claims about
fresh-host installation or all-target build success. Dated measured test
results and their fixture, target and execution limits belong in [PLAN.md](../../PLAN.md).
