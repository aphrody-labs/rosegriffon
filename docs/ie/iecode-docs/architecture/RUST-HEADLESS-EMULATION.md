# Rust headless execution and host boundaries

Current implementation and proposed contracts, checked on 2026-10-01.
`crates/emu` is a source container, not a Rust package. It has no common
`headless` module, `HeadlessSession` API or synthetic platform-contract suite.

## Implemented execution owners

| Surface                 | Owner                          | Implemented evidence                                                |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------- |
| DS hardware             | `crates/emu/core`              | Retained Dust ARM9/ARM7 interpreters and devices                    |
| DS host scheduling      | `crates/aphrody-emulator-host` | `DsHost` composes the real core with a Bevy update lifecycle        |
| DS tools                | `crates/emu/cli`               | Established `dust` executable, ROM/decompilation/debug surfaces     |
| DS browser              | `apps/web/crate`               | Worker-hosted WASM, WebGPU presentation and software/WebGL fallback |
| Wii hardware            | `crates/emu/wii/core`          | Retained Gecko Broadway interpreter/devices and validated DOL boot  |
| Wii browser             | `apps/web/wii/crate`           | Gecko/winit host, GX WebGPU renderer, keyboard/pointer input        |
| 3DS portable extraction | `crates/aphrody-ctr`           | Parsers and command encoding; no complete CPU/device emulator       |
| Switch snapshot         | `crates/emu/ruzu`              | Retained source awaiting active graph/browser integration           |
| NIE game runtime        | `crates/nie/aphrody-nie-*`     | Local product libraries and native hosts                            |

DS native interpreter tests and generated browser smoke runs execute original
homebrew. Wii executes an original DOL loop in native tests and completes three
browser frames. The Wii fixture has no graphics writes. These gates do not
prove common save-state/replay compatibility or full-console game fidelity.
The complete measured results are in [PLAN.md](../../PLAN.md).

## Proposed shared lifecycle

A future common host should make console input, virtual-time budgets, frame/
audio transport, lifecycle errors and versioned state envelopes explicit.
Per-console CPU, bus, device timing and graphics semantics remain separate.
Hosts own file pickers, persistence, accounts, real sockets and presentation.
Bounded queues and replay inputs need measured implementation and tests; their
presence in this design is not evidence that all current adapters enforce them.

Dust currently uses Bevy scheduling through `DsHost`. Wii retains its separate
Gecko event loop. Unifying these hosts requires parity tests and lifecycle
measurements rather than an empty wrapper crate. No generic `HeadlessSession`
contract should be documented as implemented until source and callers exist.

## Graphics and bindings

The active root graphics dependencies are published Bevy **0.19.1** and wgpu
**30.0.1**. Bevy's renderer owns a separate wgpu-types 29 family; direct
emulator rendering uses wgpu 30. `aphrody-gpu-backend` owns IECODE's shared
adapter/device/surface setup; console pipelines stay in their render crates.
GPU execution is optional to CPU-only tests. Do not pass incompatible foreign
GPU handles across bindings. Benchmarking and engine research live in the
independent archived GPU research; this workspace does not depend on it.

The existing NIE C ABI belongs to `crates/nie/aphrody-nie-ffi`, with shared
library target `iecode`. A universal emulator ABI with opaque handles, explicit
buffer lifetimes and versioned errors is still proposed. CLI/browser/C# and
Python adapters do not yet expose one identical multi-console session API.

## SDK and external runtimes

Target-side homebrew SDKs are independent of host emulator runtimes. Existing
DS/3DS build interfaces and source notices are documented in
[Homebrew stack](../development/HOMEBREW-STACK.md). Wii/Switch target adapters
need their own source, license and toolchain acceptance before being advertised.
Official SDK inputs remain external; private fixtures and firmware stay ignored.

Steam/Proton/Wine provide PC integration, not another console core. Current
Steam ownership is in [Steam architecture](STEAM-ARCHITECTURE.md). A protected
online launch mode or publisher SDK integration requires its own implementation
and tests; neither is established by emulator smoke execution.

## Remaining acceptance

- Compare core timing and rendered output with reference implementations.
- Qualify replay, snapshots/version rejection and bounded output transports.
- Validate host lifecycle and state ownership across native/browser bindings.
- Implement 3DS/Switch execution before claiming browser availability.
- Measure actual hardware performance separately from SwiftShader execution.

See [Platform decision](EMULATION-PLATFORM-DECISION.md) and
[Remaining work](../REMAINING-WORK.md).
