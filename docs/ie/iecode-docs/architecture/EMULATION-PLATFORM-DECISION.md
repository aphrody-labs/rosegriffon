# IECODE emulation platform decision

Current ownership and acceptance state, 2026-10-01. Rust is the default owner
for new portable emulator logic, scheduling, device models and adapters.
Existing native emulator references retain their source and license boundaries.

## Language ownership

| Surface                                                  | Owner                                                  |
| -------------------------------------------------------- | ------------------------------------------------------ |
| NIE product libraries and runtime                        | Local `crates/nie/aphrody-nie-*`                       |
| Portable console cores, scheduling and graphics adapters | Active root Rust packages in `crates/` and `apps/web`  |
| Native reference toolkit, melonDS and target-side SDKs   | `src/iecode-cpp`                                       |
| Managed launcher, save/modding and desktop toolkit       | `src/IECODE`, root .NET solution                       |
| Extraction, scripting and analysis                       | Root uv workspace and declared Python members          |
| Browser frontends and JS/TS bindings                     | `apps/` and `packages/`, root Bun workspace            |
| Shared platform operations                               | Sibling Aphrody through `scripts/tools/aphrody-ops.ts` |

The root catalog uses released Bevy 0.19.1 and wgpu 30.0.1. Bevy's renderer
uses a separate wgpu 29 family from direct emulator renderers. Forks and GPU
benchmarks are maintained in independent archived GPU research; IECODE does not
depend on that repository. The current Cargo graph contains 74 active members;
this does not imply full release validation.
`crates/emu` is a directory container, not an executable registry package or a
common `headless` lifecycle implementation.

## Platform state

| Platform | Current authoritative source                                                                | Measured state                                                                                    | Remaining acceptance                                                     |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| DS       | Dust core/render/CLI in `crates/emu`, browser in `apps/web/crate`; native melonDS reference | Native original-homebrew execution, worker startup and actual generated-WASM WebGPU browser smoke | Game fidelity, extended replay/state coverage and hardware performance   |
| Wii      | Gecko in `crates/emu/wii`, portable extraction `crates/aphrody-wii`, browser `apps/web/wii` | Validated DOL execution, runtime tests and three browser frames                                   | Retail disc boot, visual fidelity, browser NAND and real remote/nunchuk  |
| 3DS      | `crates/aphrody-ctr` and retained native SDK references                                     | Portable parsing/command extraction tests                                                         | CPU/device/service integration, PICA execution and homebrew/browser boot |
| Switch   | `crates/emu/ruzu` snapshot and `crates/aphrody-switch` portable owner                       | Source retained; no complete browser execution                                                    | Root graph integration, missing inputs, portable CPU and WebGPU strategy |
| Steam/PC | `crates/nie/aphrody-nie-steam` and retained managed compatibility code                      | Product-specific source and external PC runtimes                                                  | Authorized launch/integration qualification; not console emulation       |

Actual test counts, revisions and proof limits are recorded in
[PLAN.md](../../PLAN.md), [Console migration](../emulation/MULTICONSOLE-RUST-MIGRATION.md)
and [Upstream references](../upstream/README.md). Source import,
metadata or SDK orchestration alone does not prove a console boots.

## Shared architecture decisions

Console cores retain hardware-specific CPU, memory, input and timing semantics.
Reusable library APIs should precede host wrappers. The implemented DS host is
`DsHost` in `aphrody-emulator-host`; Wii still has its own Gecko host. A common
multi-console lifecycle, state envelope and emulator ABI remain design work,
not a fictitious `crates/emu::headless` API.

The existing NIE ABI is `aphrody-nie-ffi`, library target `iecode`. Future ABI
extensions require explicit handles, lifetimes, sized buffers and error codes;
foreign allocator ownership and exceptions must not cross that boundary.

## Source and fixture gates

Preserve pinned revisions and original notices before integrating any source.
Use original or independently redistributable homebrew for automated boot
fixtures. Private dumps, BIOS, keys, firmware, generated game data and licensed
SDK inputs remain outside committed source. Native GameCube HLE IPL loading
uses an explicit local `IECODE_GC_IPL_HLE` input rather than an embedded binary.

Target-side libraries such as BlocksDS/libctru/libogc/libnx are SDK components,
not host console emulators. Check their actual retained source and toolchain
interfaces in [Homebrew stack](../development/HOMEBREW-STACK.md). Combined
license obligations are documented in [LICENSES.md](../../LICENSES.md).
