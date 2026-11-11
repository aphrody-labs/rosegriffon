# Dust CLI skill snapshot consolidation

Measured on 2026-10-01 against IECODE commit
`37e321b3f063de1688927265586b667d12539449`.

The skill formerly contained a second Dust source tree: 257 tracked files totaling
3,745,361 bytes. Every source and asset has a retained counterpart: 86 files are
byte-identical; 165 differ from the canonical counterparts. Differences include
formatting, prefixed crate names, merged WGPU modules, later API adaptations and
additional canonical ROM tooling. This is a source ownership inventory, not a
claim that all versions are semantically identical.

Six obsolete workspace control files are mapped to the root Cargo workspace,
root toolchain/ignore configuration and merged renderer manifest. Their old
contents remain in Git history; they are not active build entry points.

## Owners

| Former skill tree                                  | Current owner                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/core`                                         | `crates/emu/core`                                                        |
| `src/render/soft-2d`, `src/render/soft-3d`         | `crates/emu/render/soft-2d`, `crates/emu/render/soft-3d`                 |
| `src/render/wgpu-2d/src`, `src/render/wgpu-3d/src` | `crates/emu/render/wgpu/2d/src`, `crates/emu/render/wgpu/3d/src`         |
| `src/frontend/desktop`                             | `vendor/dust-imgui-frontend-archive` (inactive native frontend)          |
| Python TCP client                                  | `crates/emu/cli/dust-cli`                                                |
| Skill entry point                                  | `.agents/skills/dust-cli/bin/aphrody-dust-cli` (thin repository wrapper) |

The archived desktop owner retains the headless loop, JSON TCP server, protocol,
watchpoint/stepping hooks, touchscreen injection and deterministic replay code.
It is outside the root Cargo workspace; the active Rust `dust` executable forwards
commands to the Python client and does not contain that server. A compatible
external `dust-desktop` executable is required for live debugging.

The portable installer copies the canonical Python client and skill instructions,
not emulator source. The skill's obsolete nested workspace and lockfile were
removed together with the duplicated source tree.

## Evidence and recovery

[DUST-CLI-SNAPSHOT.json](DUST-CLI-SNAPSHOT.json) records all 257 original paths,
Git blob IDs, SHA256 values, byte lengths and current owners. It preserves exact
references to the differing snapshots without duplicating their source again.
For an original file, read its recorded path or Git blob from the retained history:

```sh
git show 37e321b3f063de1688927265586b667d12539449:.agents/skills/dust-cli/src/core/src/lib.rs
git show <git_blob_from_inventory>
```

The historical source keeps Dust's upstream license obligations. Canonical source
licenses and fork origins are recorded in the root `THIRD_PARTY.md` and
`docs/licenses/dust/`.
