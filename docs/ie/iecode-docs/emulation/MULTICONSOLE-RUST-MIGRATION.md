# Rust console migration acceptance ledger

Evidence date: 2026-09-30. Scope: DS/DSi, 3DS, Wii and Switch emulation with
portable Rust logic, Bevy hosting, WebGPU presentation and Aphrody UI integration.
Source imports and SDK build orchestration do not prove console execution.

As of 2026-10-01, `apps/web` is the single browser frontend and lists all four
consoles. Gecko's runtime libraries now belong to
`crates/emu/wii/{core,image,dff,disasm,render,debug}` and its browser adapter to
`apps/web/wii/crate`, with loader `apps/web/wii/index.html`. Upstream Web starts
GameCube; local `start_wii_emulator` validates Wii DOL input. WASM checks pass
for core, render and Web. Three Wii DOL runtime tests and four native library
tests pass; browser smoke execution passes for three frames. See the
[`Gecko Web upstream audit`](../gecko/WEB-UPSTREAM-AUDIT.md).

| Platform | Current authoritative source                            | Required execution evidence                                                                                     |
| -------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| DS/DSi   | `crates/emu/core`, `crates/emu/render/wgpu`, `apps/web` | Legal homebrew boot, deterministic input replay, direct WebGPU texture presentation in a browser                |
| 3DS      | `src/iecode-cpp/third_party/3ds`, `crates/aphrody-ctr`  | CPU and device models, memory/service integration, PICA execution, legal homebrew boot and browser presentation |
| Wii      | `crates/aphrody-wii`, `crates/emu/wii`, `apps/web/wii`  | Game visual fidelity, deterministic replay, real remote/nunchuk and NAND integration                            |
| Switch   | `crates/emu/ruzu`, `docs/ruzu/upstream`                 | Reconciled dependencies, portable CPU strategy, WebGPU renderer and homebrew boot                               |

## 3DS specification and SDK mapping

- [GBATEK 3DS reference](https://problemkaputt.de/gbatek.htm#3dsreference):
  the non-www host is accessible and its 3DS reference index was fetched on
  2026-09-30. It links memory/I/O, DMA, crypto, video, interrupts and timers;
  each implementation must read its relevant section before attributing details.
- [3DBrew](https://www.3dbrew.org/wiki/Main_Page) and
  [GPU internal registers](https://www.3dbrew.org/wiki/GPU/Internal_Registers):
  GPU packet layout, byte masks, consecutive writes and finalization. The GPU
  page was fetched successfully on 2026-09-30.
- [Emulation General Wiki emulator files](https://emulation.gametechwiki.com/index.php/Emulator_files#Nintendo_3DS):
  external compatibility reference for the 3DS inputs expected by existing
  emulators (`aes_keys.txt`, `seeddb.bin`, CJK font data, boot ROMs and
  `dspfirm.cdc`). These remain user-supplied inputs and are never vendored.
- `src/iecode-cpp/third_party/3ds/libctru/libctru/source/gpu/gpu.c`:
  reference command encoding and f16/f20/f24/f31 packing. The Rust extraction
  belongs to `aphrody-ctr`; it must not depend on ARM supervisor calls.
- `src/iecode-cpp/third_party/3ds/citro3d`: subsequent shader, texture and
  geometry extraction candidates. Preserve its notice and verify each extracted
  algorithm against its pinned source.
- `src/iecode-cpp/third_party/3ds/citro2d`: subsequent sprite/text batching
  candidates, after their GPU interfaces have portable owners.

## Renderer work still required

The DS web frontend now contains asynchronous OffscreenCanvas WebGPU setup,
same-event-loop 2D/3D rendering and direct GPU texture presentation through the
shared backend. Both software fallback and GPU frames advance through the Bevy
`aphrody-emulator-host`. The worker serializes asynchronous startup and input;
fallback replaces a transferred canvas before creating its WebGL context.
Generated DS WASM now has verified browser smoke execution; game compatibility,
visual fidelity and hardware upload/readback performance remain separate gates.

Gecko runtime, renderer and Web adapter paths now resolve within the root
workspace and their WASM checks pass. The local Wii DOL entry uses the retained
Broadway interpreter and devices. Browser smoke execution now passes; game compatibility remains a separate gate.
Optional supplied DSP ROM, keyboard Wiimote buttons and pointer IR are
supported. Real remote hardware, nunchuk controls and browser NAND integration
remain required. Native GameCube HLE IPL loading uses
an explicit local `IECODE_GC_IPL_HLE` file; unlicensed Solstice source and binary
are excluded. Switch video code uses
native Vulkan/OpenGL/Metal; a dependency version change cannot supply WebGPU.
Extract portable decoding and shaders and establish a browser CPU strategy.

Multi-console Bevy hosting and Aphrody UI integration remain required. Use one
device/queue per host and library-owned console behavior. Actual browser GPU
execution, native execution and deterministic replay are separate gates.

## Verification boundaries

The shared backend now exists. Full root dependency resolution now succeeds
with the root `Cargo.lock`; the earlier pinned Git resolution blocker is cleared. An isolated path-consumer WASM check reaches real Dust, Bevy and
WGPU compilation using Rust 1.98.1 with `RUSTC_BOOTSTRAP=1`. The standalone
Dust core WASM check passes after replacing removed compiler-private integer
attributes with portable constructor validation; two exhaustive utility tests
pass. The combined frontend WASM check also passes after adapting SIMD and
WGPU 30 interfaces; it includes the real Bevy host and GPU presentation path.
This is not clean stable-toolchain support. The restored Dust runtime root
retains feature-gated ROM tooling.

Direct Rust tests pass 13 cases and direct wasm32 library compilation succeeds
for the 3DS extraction. A host C differential test verifies 320 encoding and
8 finalization vectors against retained libctru. The worker startup test passes
16 assertions with mocked WASM/browser interfaces; it does not exercise a GPU.
The actual DS WASM artifact build and binding generation pass, as do UI and
worker TypeScript checking against those real bindings. The native threaded
renderer check passes with existing warnings. Generated browser artifacts are
excluded from Git. These gates do not prove workspace or console completion.

## Execution evidence added on 2026-09-30

Two native DS tests execute an original ARM9/ARM7 increment-loop ROM through
real interpreters, synchronous software renderers and independent Bevy hosts.
Three-frame ARM9 counters are 15,560 / 31,121 / 46,682; ARM7 counters are
93,364 / 186,729 / 280,094. Input transitions and terminal shutdown are tested.
No proprietary ROM, logo or BIOS is used.

The explicit `tests/browser-webgpu-smoke.ts` harness loads actual generated WASM
in a module worker, transfers a real canvas, installs WGPU renderers and
completes three core frames in Chromium 133 with SwiftShader/Vulkan WebGPU.
This is browser execution evidence using a software GPU implementation, not
hardware performance or a visible game scene. The fixture has no display writes
or 3D geometry; DS GPU visual fidelity and real-game compatibility remain open.
Run it with `IECODE_BROWSER` set to a Chromium executable after generating
`apps/web/pkg` bindings.

The 3DS extraction now passes 17 unit tests. SHBIN DVLB/DVLP/DVLE parsing and
output-map generation are bounded, allocation-free and endian-safe; 1,344
output-map vectors match retained libctru C. Shader instruction execution,
full PICA rendering and 3DS CPU/device/service execution remain unimplemented.

`aphrody-wii` provides source-derived checked DOL loading and encoded Broadway
branch execution. Ten unit tests pass, including original DOL execution and
branch-control combinations. This does not implement a complete PowerPC core
or boot Wii firmware/software by itself. The restored `aphrody-wii-runtime`
now separately passes three real DOL boot tests through its Broadway interpreter
and devices. Generated Wii WASM now completes three frames in Chromium 133 with SwiftShader
WebGPU: `execution_status` is `[3, 18225000, 2147500032]`, canvas 300 by 150.
The original DOL executes `addi r3,r3,1` and `b -4` without graphics writes;
this does not establish game visual fidelity. A DS browser regression also
completes three frames with red `[251, 0, 0, 255]` and blue `[0, 0, 251, 255]`
pixels. Both targets use `scripts/build/build-emulator-web.ts` with Cargo and matching
wasm-bindgen; DS enables `RUSTC_BOOTSTRAP` per command. TypeScript 7 checks all
three DS projects, while webpack uses the explicit official TypeScript 6 API
module. Root doctor/prefix audits cover 203 members, including 51 NIE members.

Switch audit: `ruzu/core/src/hle/kernel/k_process.rs` constructs native Dynarmic
backends. The retained A64 JIT supports x86_64/AArch64, not WASM; the NCE
interpreter visitor is not a complete fallback. Next extraction candidates are
the generated A64 decoder and `video_core/src/textures/decoders.rs` Tegra GOB
swizzle/unswizzle for future WebGPU uploads. Moved sources still retain vendor
workspace assumptions and do not establish an integrated Switch core.
