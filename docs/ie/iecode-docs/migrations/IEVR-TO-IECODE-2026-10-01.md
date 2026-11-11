<!-- SPDX-License-Identifier: Apache-2.0 -->

# IEVR to IECODE (2026-10-01)

IECODE is the exclusive owner of pure IEVR code: the unified
`@rosegriffon/inagle` (parsers, zukan, game data, NIE bridge, FFI/.NET
bindings, wiki types and services), `@rosegriffon/inagle-cross`,
`@rosegriffon/azalee` (wiki library; game logic re-exported from inagle), the
NIE crates and the IECODE .NET solution. The Aphrody monorepo and aphrody-py no
longer carry copies. The per-file source-to-target map, with Git blobs and
SHA-256 hashes, is [ievr-to-iecode-2026-10-01.json](ievr-to-iecode-2026-10-01.json).

## What moved

| Aphrody / aphrody-py source                   | IECODE owner                                | Result                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/rg/inagle` (194 files)              | `packages/inagle`                           | IECODE already newer; Aphrody-only behaviour ported (source-first exports, real CDP transport for the zukan crawler, kuroshiro type reference) |
| `packages/rg/inagle-cross` (13)               | `packages/inagle-cross`                     | formatting-only differences; generated data modules deep-equal                                                                                 |
| `packages/rg/azalee` (127)                    | `packages/azalee`                           | IECODE newer (game logic moved to inagle); host paths and two test fixes ported                                                                |
| `scripts/rg/inagle` (29)                      | `packages/inagle/scripts`                   | IECODE newer; checkout-relative roots fixed through `src/core/roots.ts`                                                                        |
| `docs/<category>/{iecode,nie}` (1,196)        | `docs/history/aphrody-docs-2026-10-01/`     | 340 Aphrody-only files moved; 856 identical or already in IECODE history deleted                                                               |
| `docs/rg/architecture-unifiee-ievr.md`        | `docs/nie/architecture-unifiee-ievr.md`     | moved; three other `docs/rg` IEVR docs were identical to `docs/nie/{inagle,azalee}`                                                            |
| aphrody-py `docs/migration/locks/nie/uv.lock` | `docs/history/aphrody-py-locks-2026-10-01/` | moved; the two other IEVR lockfiles exist in IECODE history                                                                                    |

Game datasets, extracted VFS binaries, generated wasm and other protected data
kept their storage; only references changed. Gitignored private game-data
fixtures under Aphrody `docs/reference/nie/game-data/` were left in place.

## How Aphrody consumes IECODE

Aphrody's root `package.json` lists `../iecode/packages/inagle`,
`../iecode/packages/inagle-cross` and `../iecode/packages/azalee` as Bun
workspace members. This is the same sibling-checkout convention as IECODE's
Cargo path dependencies on `../aphrody`; nothing is fetched from a remote.
Consumers (`apps/rg/website`, `apps/rg/bot`, `packages/rg/cron`) keep
`workspace:*` and unchanged import specifiers, so no shim exists in Aphrody.

- IECODE `catalog:` dependencies resolve through the Aphrody catalog when
  Aphrody installs; `@rosegriffon/db` and `@rosegriffon/assets` then link to
  Aphrody `packages/rg/{db,assets}`.
- `bun install` in either repository rewrites the `node_modules` symlinks of
  these three packages; both stores are valid and the last install wins.
- `@aphrody/agent-browser` is an optional peer of inagle. Inside Aphrody it
  provides the CDP transport of `src/zukan/web-cdp.ts`; elsewhere `connect()`
  fails explicitly unless `setWebCdpPageFactory()` installs a transport.
- `src/core/roots.ts` resolves the IECODE root, IECODE `data/`, and the RG
  website in the Aphrody sibling (`APHRODY_IECODE_ROOT`/`IECODE_ROOT`/`NIE_ROOT`,
  `DATA_ROOT`/`DATA_PATH`/`NIE_DATA_ROOT`, `APHRODY_RG_ROOT`/`RG_REPO_ROOT`).
- The RG website builds with Turbopack and output-tracing roots at the common
  parent of both checkouts.

## Checks left to the integrator

Cargo and .NET were not run. No Rust or C# source changed in this migration.
