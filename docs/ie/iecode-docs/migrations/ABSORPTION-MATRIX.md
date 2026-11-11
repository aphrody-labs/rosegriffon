# IECODE source absorption ownership

Current source boundaries, 2026-10-01. NIE's migrated product source belongs to
IECODE under `crates/nie`. Historical `nie`, `rg`, `vps` and category repositories
are provenance/audit sources, not live dependency roots.

| Source surface                       | Current IECODE owner                                                              | Boundary                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| NIE formats, data, runtime and tools | `crates/nie/aphrody-nie-*`                                                        | IEVR product behavior; preserve private rights boundary          |
| NIE C ABI                            | `crates/nie/aphrody-nie-ffi`                                                      | Shared library target `iecode`; host bindings                    |
| NIE Bun consumers                    | `packages/ieverse`                                                                | Thin client adapters; real native/data integration gates         |
| DS emulator and tooling              | `crates/emu/core`, `crates/emu/cli`, `crates/emu/render`, `apps/web/crate`        | Retained Dust CPU/device ownership and licenses                  |
| Wii emulator                         | `crates/emu/wii`, `apps/web/wii`, `crates/aphrody-wii`                            | Gecko runtime/renderer plus measured portable extraction         |
| 3DS extraction                       | `crates/aphrody-ctr`; native SDK reference under `src/iecode-cpp/third_party/3ds` | Extraction is not a complete emulator                            |
| Switch source                        | `crates/emu/ruzu`                                                                 | Snapshot awaiting root graph/browser integration                 |
| Native and managed toolkit           | `src/iecode-cpp`, `src/IECODE`                                                    | Existing native reference code and managed hosts                 |
| Python tools                         | Declared `src/` members and root uv workspace                                     | Extraction, scripting and analysis                               |
| Shared infrastructure                | Sibling Aphrody; local `scripts/tools/aphrody-ops.ts` adapter                     | Deployment/release orchestration belongs to `@aphrody/workspace` |
| Historical rg/vps                    | Audit evidence only                                                               | No implicit import of services, credentials or generated content |

## Merge rules

A reusable capability has one library owner. Preserve language-native reference
implementations until measured extraction and consumer rewiring justify removal.
Do not invent a `crates/pipeline` owner or a second generic Rust CLI. The existing
Dust CLI remains the established emulator tooling host.

Private fixtures, dumps, BIOS, keys, package caches and generated build trees
stay outside committed source. Imports preserve exact notices and revision
records in [THIRD_PARTY.md](../../THIRD_PARTY.md). Historical source audits do not
prove integration or authorize a deployment.

See [Architecture](../architecture/ARCHITECTURE.md), [upstream emulator references](../upstream/README.md) and
[Remaining work](../REMAINING-WORK.md). Dated extraction measurements remain
historical evidence; current ownership comes from root manifests and source.
