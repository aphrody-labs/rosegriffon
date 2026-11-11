# Console SDK source snapshots

These upstream source trees are kept for study and adaptation. Their source files and
component-level license notices are preserved. They are not built by the host `iecode_native`
target; console homebrew projects and IECODE adapters will own their build integration.

## Nintendo DS and DSi: BlocksDS

- Upstream: <https://codeberg.org/blocksds/sdk>
- Revision: `4b2a0437ed8cde4c2a99ba0cbc02a01bff21c166`
- Snapshot: `nds/blocksds/`
- Cloned with recursive submodules. Pinned submodule revisions:

| Path                | Revision                                   |
| ------------------- | ------------------------------------------ |
| `libs/dswifi`       | `02f193979c945b41386f5b5050f7cc426a999484` |
| `libs/libath6k`     | `f10c8f3962dde6f6cb49f92fb6dac5c820629b7d` |
| `libs/libnds`       | `c8d68c3e2e2d7f47bf8716b00d5811f138b926c3` |
| `libs/libnds/fatfs` | `2b5c26e2a1eb4cdbbcb57070d49a6ebf7b60c7f9` |
| `libs/libteak`      | `b64605937efce24e09efc11f56713c75835ef39e` |
| `libs/libxm7`       | `eafd1732bd3d83aace7f4ab60619616ed6d16e44` |
| `libs/maxmod`       | `5e7b86daab5acef24f2a69fa39ce423e7c7c84f8` |
| `sys/dldi_r4`       | `8dff29496cecdf64b83b6e7ebb76d3f89aa7520c` |
| `tools/dldipatch`   | `e71d40a8676d9483c45147bb2f3368ca85c0f9b2` |
| `tools/grit`        | `df7a06b8a0f10722a81f1fd319f0afe9ed7e21b5` |
| `tools/mmutil`      | `d491ebb9e86f5a7b6f6059d9eece1affbc7c52a0` |
| `tools/ndstool`     | `9435e06a4678abb88da3740c543c83482d16186c` |
| `tools/squeezer`    | `c51c665fc4ce3bcc8b5d0e97498158428f0637c6` |

The [source build guide](https://blocksds.skylyrac.net/docs/setup/from_source/) installs its
build output under `/opt/blocksds/core` by default. Keep generated SDK output outside this tree.

## Nintendo 3DS: libctru

- Upstream: <https://github.com/devkitPro/libctru>
- Revision: `36fe1ada5b7ebe53ba4decda36d764a55f8fefb6`
- Snapshot: `3ds/libctru/`
- The upstream license terms are preserved in its README and source headers.

The graphics libraries citro3d and citro2d are upstream devkitPro libraries. Install devkitPro packages for builds.

## Shared Lua 5.2.4 C sources

- Source distribution: Lua 5.2.4, originally vendored by the `lua-src` Rust crate.
- Snapshot: `lua-5.2.4/`
- Consumed by the patched `vendor/lua-src` crate; Lua's license is retained beside the source.
