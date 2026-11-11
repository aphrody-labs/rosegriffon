# Gecko Web and WASM upstream audit

Checked on 2026-10-01 against `ioncodes/gecko` default branch `master`, revision
`da39be17b22eb7316e772d2369da15df3a52f7f0`.

## Existing upstream surfaces

Gecko supplies native GameCube/Wii frontends and an existing browser frontend.
The portable `aphrody-wii` extraction is only one part of the retained source;
its small feature set must not be used as an inventory of the whole emulator.

| Surface                                         | Upstream owner                     | Retained IECODE owner                          |
| ----------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| Native launcher                                 | `crates/app`                       | `vendor/gecko-integrated-archive/app`          |
| Native emulator UI                              | `crates/tinyapp`                   | `vendor/gecko-integrated-archive/tinyapp`      |
| Browser file loader                             | `crates/web/index.html`            | `apps/web/wii/index.html`                      |
| Rust/WASM adapter                               | `crates/web/src/lib.rs`            | `apps/web/wii/crate/src/lib.rs`                |
| Optional browser debugger                       | `crates/web/src/debug_ui.rs`       | `apps/web/wii/crate/src/debug_ui.rs`           |
| GX WebGPU renderer                              | `crates/backend-wgpu`              | `crates/emu/wii/render`                        |
| Emulator and Wii devices                        | `crates/gecko`                     | `crates/emu/wii/core`                          |
| Image, DFF, disassembler and debugger libraries | `crates/{image,dff,disasm,dbglib}` | `crates/emu/wii/{image,dff,disasm,debug}`      |
| Browser deployment recipe                       | `docker/Dockerfile.web`            | `scripts/upstream/gecko/docker/Dockerfile.web` |

Upstream builds its browser adapter separately with:

```sh
wasm-pack build crates/web --target web --out-dir pkg --out-name gecko_web --release
```

The `debug` feature adds the debugger. Both variants are published by the
upstream Docker recipe. Upstream Web sources use WGPU 29.0.3 and egui 0.34.2;
the local manifest inherits the root WGPU 30 and egui 0.36 declarations, which
requires API validation beyond correcting paths.

## Historical upstream browser execution boundary

The browser loader accepts IPL/DOL and optional DSP IROM input. Its exported
`start_emulator` constructs `GameCube::with_ipl` or `GameCube::with_image`.
It uses an interpreter (`default-features = false` on Gecko), a winit browser
event loop, a queued GX render sink and WebGPU presentation. There is an actual
frontend and emulator execution loop, not just isolated DOL/branch primitives.

This entry point does not construct `Wii`. Native Wii support in the same
upstream repository does not establish Wii browser boot. Reusing the existing
frontend, interpreter and renderer is the integration starting point; browser
Wii initialization, devices and software boot still require execution evidence.

## Local integration and evidence on 2026-10-01

The earlier audit established that retained upstream Web source was byte-identical
at that time: `src/lib.rs` SHA-256
`c24998c81da4fc2e4e96bf766d6792d97da6a0d78da968bb9d5c03590b78f1a3` and
`index.html` SHA-256
`8135a41d5e982c834e1e3324acabf0061cb32620070c285e9629d4cd40ab7631`.
These hashes describe the historical snapshot, not the adapted local files.

The runtime, image, DFF, disassembler, renderer and debugger now belong to
`crates/emu/wii/{core,image,dff,disasm,render,debug}`. The browser adapter and
loader belong to `apps/web/wii/crate` and `apps/web/wii/index.html`, within the
single root Cargo workspace. Root full dependency resolution succeeds with the
root `Cargo.lock`. Local WGPU 30 and egui 0.36 adapters share the same GPU
package identity; their API changes are compiled for WASM.

- WASM checks pass for the retained core, renderer and Web adapter.
- Three runtime tests boot original Wii DOL fixtures through the real Broadway
  interpreter and devices. Four native library tests also pass.
- The local export `start_wii_emulator` validates a DOL and constructs `Wii`;
  the retained `start_emulator` export remains the GameCube entry point.
- Generated Wii WASM executes three frames in Chromium 133 with SwiftShader
  WebGPU. `execution_status` is `[3, 18225000, 2147500032]`; the canvas is
  300 by 150 pixels. The original DOL runs `addi r3,r3,1` and `b -4`. It makes
  no graphics writes, so this establishes runtime/browser execution, not game
  visual fidelity or hardware GPU performance.
- Optional user-supplied DSP IROM is supported. Input uses
  `HostInput::neutral_for(SYSTEM)`, keyboard Wiimote buttons and pointer IR.
  Z/X map to A/B, 1/2 to their buttons, Enter to Plus, Minus to Home, arrows
  to directional input and Space to shake. Real remote hardware, nunchuk
  controls and browser NAND integration remain unimplemented.

Pinned Chipi specifications are restored as source under
`crates/emu/wii/spec`, with their MPL-2.0 license. Solstice's pinned revision has
no detected license; its IPL source and binary are excluded. Native GameCube IPL
HLE loading requires an explicit local `IECODE_GC_IPL_HLE` file. No proprietary
ROM or empty IPL placeholder is embedded in the runtime.

The shared `scripts/build/build-emulator-web.ts` builds with Cargo and a matching
wasm-bindgen CLI, replacing the old webpack wasm-pack plugin. DS enables
`RUSTC_BOOTSTRAP` for its build command only. TypeScript 7 checks all three DS
UI/worker/renderer projects; webpack explicitly uses the official
`@typescript/typescript` version 6 compiler API. Root doctor and prefix audits
cover 203 Cargo members, including 51 NIE members. The DS browser regression
also completes three frames, with red `[251, 0, 0, 255]` and blue
`[0, 0, 251, 255]` pixels.

## Sources

- [Pinned Web adapter](https://github.com/ioncodes/gecko/blob/da39be17b22eb7316e772d2369da15df3a52f7f0/crates/web/src/lib.rs)
- [Pinned Web manifest](https://github.com/ioncodes/gecko/blob/da39be17b22eb7316e772d2369da15df3a52f7f0/crates/web/Cargo.toml)
- [Upstream browser deployment](https://gecko.layle.dev/)

## Final consolidation gates

Strict Clippy passes on the five runtime/image/DFF/disassembler/debugger owners
and on the debug browser binding. Root metadata counts 203 packages (51 NIE).
The complete `bun run build:web` release-WASM/frontend build and all three
TypeScript target checks pass. Shared build/API versions are locked in root
Cargo.lock and bun.lock. The obsolete vendor Gecko checkout is removed;
configuration fingerprints live in `upstream-config/SOURCE-SHA256.txt`.
Generated outputs were deleted after measured browser execution; reproduce them
with the documented build before rerunning browser gates.

The frame fixture tests CPU progression and presentation, with no graphics
writes. Native WGPU still emits two preexisting lint-expectation warnings.
These measurements are scoped integration gates, not a full-repository release.
