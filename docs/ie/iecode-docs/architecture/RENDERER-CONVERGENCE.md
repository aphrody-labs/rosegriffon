# Rust renderer convergence

Current state: 2026-10-02. IECODE owns emulator/NIE renderer adapters and uses
published Bevy and wgpu crates. Bevy and wgpu fork sources, their build tools,
benchmarks and upstream documentation are owned separately by archived GPU research.

## Source and GPU ownership

| Owner                                      | Responsibility                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| crates.io `wgpu` 30.0.1                    | Direct API for IECODE emulator rendering                                   |
| crates.io `bevy` 0.19.1                    | NIE GUI host and DS ECS scheduling                                         |
| `../aphrody/crates/native/gpu-backend`     | Aphrody-owned (consumed by path) adapter/device requests and surface setup |
| `crates/emu/render/wgpu`                   | Combined Dust 2D/3D renderer                                               |
| `crates/aphrody-emulator-host`             | Dust headless execution through Bevy scheduling                            |
| `crates/emu/wii/render`                    | Retained Gecko GX/WebGPU rendering                                         |
| `apps/web/crate`, `apps/web/wii/crate`     | DS and Wii browser bindings                                                |
| crates.io `egui-wgpu`, `egui-winit` 0.36.2 | Official integrations for wgpu 30 consumers                                |

Root dependency aliases point at published packages. Bevy 0.19 uses wgpu-types
29 while direct emulator and egui-wgpu consumers use wgpu 30; GPU handles are
not shared between those type families. Shader and console-specific behavior
stays in its renderer owner; a shared package/version does not make console
pipelines or host event loops interchangeable.

## Active hosts

Dust's browser frontend is `apps/web`; its old ImGui desktop frontend remains
archived at `vendor/dust-imgui-frontend-archive`. `crates/emu/cli` owns the
established `dust` command. Dust's browser path runs on its worker without
Rust threads, supports WebGPU texture presentation and retains software/WebGL
fallback. Worker startup serializes asynchronous initialization and input.

Wii's frontend is `apps/web/wii`; its runtime and GX renderer are active root
members. The console switcher loads and unloads the Wii frame. The adapter
boots checked DOL input and supports keyboard Wiimote buttons and pointer IR.
It retains Gecko/winit hosting; multi-console Bevy hosting is still open.
Legacy native Gecko launchers share canonical core source through archived
manifest paths rather than copied implementations.

NIE's native game host uses Bevy window/input/sprite plugins; its offscreen
capture and custom render work use `aphrody-gpu-backend`. Browser and native
hosts must make device ownership and platform capabilities explicit.

## Evidence and remaining gates

The root Cargo graph resolves with its lockfile. DS/Wii WASM builds and the
three webpack targets pass the latest scoped gates recorded in [PLAN.md](../../PLAN.md).
Actual Chromium 133 SwiftShader WebGPU runs completed three frames for both
consoles. The DS smoke checks framebuffer colors; the Wii DOL smoke executes
Broadway instructions without graphics writes. This is browser execution
proof, not a GPU hardware benchmark or retail-game fidelity claim.

Wii runtime/renderer/browser checks and targeted strict Clippy passed. Native
wgpu has two recorded lint-expectation warnings. Full repository lint/test and
release gates, real-game comparison, replay, Switch/3DS browser execution and
browser NAND remain open. Earlier package-cache/fontconfig blockers are
historical and must not be used to describe current root resolution.

## Performance policy

Keep root profile choices in `Cargo.toml`; capability selection is adaptive.
Avoid an unconditional native CPU target or optional GPU feature requirement.
Measure a representative workload before changing LTO, bindless layouts,
meshlets or synchronization policy. Record adapter/backend, enabled features,
CPU/GPU frame time and upload/readback volume separately from software-GPU
smoke execution.

Retained emulator revision/license records are in [Upstream sources](../upstream/README.md);
Cargo configuration is in [Rust configuration](../migrations/RUST-CARGO-UNIFICATION.md).
