# Nintendo DS/DSi and 3DS homebrew stack

This is the end-to-end IECODE path for studying the SDKs, building native C
homebrew, and driving builds from Rust or Bun. The two console families share a
small input/display ABI; all hardware services and rendering remain native to
their SDK.

## Supported targets

| Target              | SDK/toolchain                                                | Typical artifact | Source project                |
| ------------------- | ------------------------------------------------------------ | ---------------- | ----------------------------- |
| Nintendo DS / DSi   | BlocksDS core, ARM toolchain, libnds and its installed tools | `.nds`           | `src/iecode-cpp/homebrew/nds` |
| Nintendo 3DS family | devkitPro devkitARM, libctru; citro3d/citro2d for graphics   | `.3dsx`          | `src/iecode-cpp/homebrew/3ds` |

Install [BlocksDS from source](https://blocksds.skylyrac.net/docs/setup/from_source/)
using its recursive checkout instructions. Its source build installs under
`/opt/blocksds/core` by default; use `BLOCKSDS` to select another installation.
For 3DS, follow the [devkitPro installation guide](https://devkitpro.org/wiki/Getting_Started),
initialize its environment so `DEVKITPRO` and `DEVKITARM` are exported, and
install the `3ds-dev` packages. The
vendored SDK trees are pinned study copies, not relocatable prebuilt
toolchains. See [`third_party/CONSOLE-SDKS.md`](../../src/iecode-cpp/third_party/CONSOLE-SDKS.md).

For source study, begin with BlocksDS `libs/libnds` and its `sys/` makefiles;
the pinned recursive repositories and their commits are recorded in the DS
inventory. On 3DS, begin with `libctru/libctru/include/3ds.h` and the matching
service headers, then read citro3d/citro2d separately for graphics. These trees
are snapshots for reading and diffing. Build against the SDK installed by its
maintainers so the compiler, support libraries and generated tools stay in
sync.

## Build from the repository root

```sh
# DS/DSi
export BLOCKSDS=/opt/blocksds/core
cmake -S . -B build/homebrew-nds -DBUILD_HOMEBREW_NDS=ON
cmake --build build/homebrew-nds --target homebrew_nds

# 3DS: run in a devkitPro shell with its environment initialized
cmake -S . -B build/homebrew-3ds -DBUILD_HOMEBREW_3DS=ON
cmake --build build/homebrew-3ds --target homebrew_3ds
```

Equivalent Bun commands are `bun run --filter iecode-homebrew homebrew targets`,
`bun run --filter iecode-homebrew homebrew doctor nds` (or `doctor 3ds`), and
the same command with `build nds` or `build 3ds`. The Bun package starts the
Rust CLI, which configures the one root CMake superbuild and invokes its
platform target. The lower-level route is:

```sh
cargo run --manifest-path crates/aphrody-homebrew/Cargo.toml -- targets
cargo run --manifest-path crates/aphrody-homebrew/Cargo.toml -- doctor nds
cargo run --manifest-path crates/aphrody-homebrew/Cargo.toml -- build nds
```

Use `doctor 3ds` / `build 3ds` for the other target. The `.nds` and `.3dsx`
outputs and intermediate SDK files stay in each sample's `build/` directory;
CMake's own generated files are in `build/homebrew-nds` or
`build/homebrew-3ds`.

## Native code and C ABI

The public header is
[`iecode/homebrew.h`](../../src/iecode-cpp/homebrew/common/include/iecode/homebrew.h).
It defines the versioned `extern "C"` boundary, screen dimensions, shared
button bit assignments, a pressed/held snapshot and touchscreen coordinates.
`crates/aphrody-homebrew` mirrors the ABI data layouts with Rust `repr(C)` types
and contains the host build CLI. Bun starts that CLI as a process because
compiling a console program is a coarse-grained operation; neither runtime
loads `libctru` or BlocksDS as a host FFI library.

The `screen_count` and `get_screen` calls expose each target's logical display
geometry; `get_screen` returns `-1` for an invalid index or null output pointer.
Input snapshots expose `held` and edge-triggered `pressed` button masks. Touch
coordinates are valid only while `touch_valid` is nonzero and are in the
bottom-screen coordinate space. Reserved fields must stay zero. Additive ABI
changes should use reserved space; incompatible layout changes require an ABI
version increment and matching updates to both platform adapters and Rust types.

The samples currently implement lifecycle, two-screen geometry, button input,
touch input and a VBlank wait. DS screens are each 256x192. On 3DS, the top
screen is 400x240 and the bottom screen is 320x240. Screen identity and native
pixel dimensions are preserved. GPU command submission, 3D depth/stereoscopy,
sound, filesystem, networking, wireless IPC, camera, power and model-specific
features stay behind platform code rather than being represented as false
cross-platform guarantees.

The starter samples are intentionally small C entry points. Extend the matching
platform project for a native service or renderer, then add a common ABI only
when both consoles have a useful equivalent. Keep hardware-specific data and
capabilities queryable instead of flattening them into generic calls that lose
their meaning.

Use [BlocksDS/libnds](https://blocksds.skylyrac.net/docs/libs/) APIs for the DS/DSi ARM9/ARM7 split, DLDI storage, NitroFS,
audio, interrupts, IPC and DSi-specific services. Use libctru's ARM11 user-mode
services for 3DS input, filesystem, networking, camera and system IPC; use
citro3d for GPU work and citro2d for its 2D drawing layer. The [3DBrew library
index](https://www.3dbrew.org/wiki/Homebrew_Libraries_and_Tools) identifies the
maintained 3DS libraries; start API study from SDK documentation and examples,
then check platform observations in
[3DBrew](https://www.3dbrew.org/wiki/Main_Page). 3DBrew is community reverse-
engineering documentation, not a hardware vendor specification. The
[awesome-blocksds list](https://codeberg.org/blocksds/awesome-blocksds) is a
discovery index: review maintenance and each upstream license before adding a
library. Do not vendor an entire list of unrelated apps and libraries.

## Rust and Bun integration boundary

- C headers are the stable target-side ABI. Platform C sources implement it
  and can be called by C or C++ homebrew.
- Rust `repr(C)` types allow a Rust target application to share the ABI layout.
  This repository's Rust binary is a host-side SDK/build orchestrator, not a
  claim that the standard Rust toolchain can build every console target.
- Bun provides commands and project scripting through the Rust CLI. A future
  target Rust runtime or Bun-authored game still needs a separately supported
  console compiler/runtime and must call the same native SDK services.
- Add shared gameplay/data code above this boundary. Keep GPU, services,
  interrupts, storage backends and platform lifecycle in DS or 3DS adapters.

## Source study, licenses and upstream changes

SDK pins, upstream URLs, submodule pins and component license locations live in
the two SDK inventory files. Preserve each upstream notice. The BlocksDS
awesome list is CC0-1.0; it is reference-only. The 3DS examples repository is
also reference-only and not redistributed in this checkout. Consult
[`THIRD_PARTY.md`](../../THIRD_PARTY.md) and [`LICENSES.md`](../../LICENSES.md)
before redistributing any resulting binary or source bundle. Update the pin
record when refreshing a snapshot and keep local IECODE code outside upstream
trees.
