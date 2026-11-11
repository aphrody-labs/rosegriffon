# IECODE architecture

Current ownership, checked against repository manifests on 2026-10-02.
IECODE contains the NIE game-domain libraries, retained emulator sources and
their language bindings. Aphrody is a sibling monorepo for shared platform services.

| Surface                                        | Canonical owner                                                           | Entry point                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| NIE game libraries, native runtime and tooling | `crates/nie/aphrody-nie-*`                                                | Root Cargo workspace                            |
| DS runtime, renderer and command-line tools    | `crates/emu/core`, `crates/emu/render`, `crates/emu/cli`                  | Root Cargo workspace; `dust` executable         |
| Wii runtime and renderer                       | `crates/emu/wii/{core,image,dff,disasm,render,debug}`                     | Root Cargo workspace                            |
| Portable Wii and 3DS extractions               | `crates/aphrody-wii`, `crates/aphrody-ctr`                                | Root Cargo workspace                            |
| Switch source snapshot                         | `crates/emu/ruzu`                                                         | Not integrated into the active root Cargo graph |
| Emulator/NIE graphics integration              | `../aphrody/crates/native/gpu-backend`, `crates/emu/render`, `crates/nie` | Root Cargo workspace; released upstream crates  |
| Browser frontend                               | `apps/web`                                                                | Root Bun workspace                              |
| DS / Wii WASM bindings                         | `apps/web/crate`, `apps/web/wii/crate`                                    | Root Cargo workspace                            |
| JS/TS libraries                                | `packages/ieverse`, `packages/iecode-homebrew`                            | Root Bun workspace                              |
| Managed toolkit                                | `src/IECODE`                                                              | `IECODE.sln`                                    |
| Native toolkit and melonDS                     | `src/iecode-cpp`                                                          | Root CMake superbuild                           |
| Python extraction and analysis                 | Python members in `src/`                                                  | Root uv workspace                               |

## Runtime boundaries

Reusable behavior belongs in libraries. CLI, browser, .NET and Python hosts
expose those libraries through their existing adapters; the retained native
reference implementations keep their explicit source and license boundaries.
The NIE C ABI is `aphrody-nie-ffi`, whose shared library target is `iecode`.
This does not imply every historical host already uses that ABI exclusively.

Dust's browser execution uses `aphrody-emulator-host` for Bevy scheduling and
`aphrody-dust-wgpu` for graphics. `aphrody-gpu-backend` owns shared device/surface
setup. Wii retains Gecko's interpreter, device models and GX renderer, with
browser input and presentation in `apps/web/wii`. Its host is not yet a shared
multi-console Bevy host. IECODE uses released Bevy 0.19.1 and direct wgpu
30.0.1; Bevy retains its own wgpu 29 renderer family. Engine experiments and
benchmarks are maintained in archived GPU research, which IECODE does not depend on.

## Measured capabilities

The root Cargo graph resolves 74 members, including NIE and emulator consumers, with one
active `Cargo.lock`. DS and Wii generated WASM have completed three-frame
Chromium SwiftShader WebGPU smoke runs. Wii accepts validated homebrew DOL input.
These measurements do not establish retail-game fidelity, hardware performance,
Switch/3DS browser execution or a successful full-repository release gate.

Retained emulator source revisions and notices are indexed in [Upstream sources](../upstream/README.md).
[Remaining work](../REMAINING-WORK.md) records unfulfilled gates; dated measured
results remain in the root execution ledger [PLAN.md](../../PLAN.md).
