# Emulator crate layout

The imported Rust emulator and renderer sources use these owners:

| Platform            | Fork                  | Workspace path                                                                                                         |
| ------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Nintendo DS         | Dust                  | `crates/emu/core`, `../aphrody/crates/native/gpu-backend`, `crates/emu/render/*`, `apps/web`, unified `crates/emu/cli` |
| Wii/GameCube        | Gecko                 | `crates/emu/wii/{core,image,dff,disasm,render,debug}`, `apps/web/wii/crate`                                            |
| Nintendo Switch     | Ruzu                  | source snapshot: `crates/emu/ruzu`                                                                                     |
| Graphics API        | Published wgpu 30.0.1 | Root dependency catalog                                                                                                |
| ECS and host engine | Published Bevy 0.19.1 | Root dependency catalog                                                                                                |

Imported emulator source retains upstream license notices and provenance, but
IECODE has one Cargo workspace root. IECODE-owned shared APIs and adapters use
the `aphrody-*` namespace. Bevy and wgpu source forks and their upstream build
tools are owned by the independent archived GPU research, not this Cargo workspace.
Ruzu remains a source snapshot.
Ruzu's upstream workspace documentation is retained under
`docs/ruzu/upstream/` until its package graph is integrated.

Dust's WGPU 2D and 3D renderers now share the `aphrody-dust-wgpu` package at
`crates/emu/render/wgpu`, with one WGPU dependency and one renderer package.
Their former standalone manifests are retained as `Cargo.toml.upstream` provenance files.
`aphrody-gpu-backend` now owned by aphrody at `crates/native/gpu-backend`; it adapter/device requests and shared
surface configuration for Dust and NIE renderers; console-specific pipelines remain in their
renderer crates. `aphrody-emulator-host` composes the headless DS core with Bevy scheduling.
The NIE native game host also uses Bevy's window, input and sprite-render plugins; it no longer
declares a direct `winit` dependency or creates a second window surface/device.
The Gecko runtime and Web frontend are active root workspace members; its
older native launchers and the ImGui desktop frontend remain archived. `apps/web` is the browser host for DS, Wii, Switch and
3DS; DS and Wii have verified browser smoke execution. `apps/web/crate` is the Dust
WASM adapter;
`crates/emu/cli` is the sole active Dust command-line interface.

The dependency catalog pins released Bevy 0.19.1 and wgpu 30.0.1. Bevy's
renderer resolves wgpu 29.0.4; IECODE's direct renderer resolves wgpu 30.0.1.
These remain separate renderer type families. Upstream forks and experiments
are maintained outside IECODE.
Gecko core, render and Web adapter WASM checks pass. Three real Wii DOL runtime
tests and four native library tests pass. The Wii browser owner is
`apps/web/wii/index.html` with adapter `apps/web/wii/crate`; the adapter exports
validated `start_wii_emulator` DOL boot. Browser smoke execution passes for three frames in Chromium 133 with
SwiftShader WebGPU (`execution_status` `[3, 18225000, 2147500032]`, canvas
300 by 150). The fixture has no graphics writes; game fidelity remains open.
Optional supplied DSP ROM is supported. Wii input uses system-specific neutral
state, keyboard Wiimote buttons and pointer IR. Real remote hardware, nunchuk
controls and browser NAND integration remain absent. Native GameCube HLE IPL loading uses an explicit local
`IECODE_GC_IPL_HLE` file; the unlicensed Solstice input is excluded.
See [`Gecko Web upstream audit`](../gecko/WEB-UPSTREAM-AUDIT.md). Dust's WebAssembly UI includes a
WebGPU presentation path and a software fallback; Switch and 3DS browser
execution remains pending.

The active graph is one root Rust workspace and lockfile. Emulator cores remain
headless libraries; Bevy owns selected host composition and IECODE adapters
define emulator-specific wgpu boundaries. Common dependency versions belong in
the root workspace manifest.

Ruzu's source has been moved from its upstream checkout into `crates/emu/ruzu/`.
Ruzu is not yet a member of the root Cargo workspace, and its `rxbyak` and
`rhazel` submodules remain unavailable in this source snapshot.

## Nintendo DS ROM and decompilation ownership

Dust core also owns the merged `ds-rom` cartridge API (`aphrody_dust_core::rom`) and the
`ds-decomp` analysis API (`aphrody_dust_core::decomp`). The single `dust` executable combines
ROM inspection/editing, the full decompilation command set, and the aphrody-dust-cli skill
debug bridge. See [`DS-TOOLING.md`](../development/DS-TOOLING.md) for command examples, feature flags,
upstream licenses, and the DSi support boundary.
