# NIE game-domain documentation

The current Rust owners are the `aphrody-nie-*` packages under
[`crates/nie`](../../crates/nie/), members of IECODE's root Cargo workspace.
The root [architecture](../architecture/ARCHITECTURE.md),
[conventions](../architecture/MONOREPO-CONVENTIONS.md) and
[execution ledger](../../PLAN.md) define current integration and priorities.

## Current integration

- [Measured VFS contents and decoding coverage](../formats/VFS-FORMAT-SPECIFICATIONS.md) — observations from the installed dataset, not inferred source capabilities.
- [Migration and ownership boundary](IECODE-MIGRATION.md)
- [Commercial license](LICENSE)
- [Root workspace and language gates](../development/WORKSPACE.md)
- [Remaining integration work](../REMAINING-WORK.md)

`aphrody-nie-ffi` already exists and retains its `iecode` library target.
Other NIE CLI, rendering, formats, data, API and RE owners remain in their
existing crates. Their presence does not establish complete reconstructed-game
execution, private-data availability or native/browser parity. The maintained
Bun members are those declared in the root package.json; the former NIE web
application and Bun package layout are not IECODE workspace members.

## Retained specifications and evidence

The following documents retain useful domain evidence from NIE before its
migration. Package names, paths, host layouts, deployment commands and measured
results in those records may describe their dated source checkout; use current
root manifests for commands. They do not create another agent contract or plan.

| Topic                       | Reference                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Format and resource parsing | [Formats](FORMATS.md), [VFS](VFS.md), [import/export](IMPORT-EXPORT.md), [game data](game-data/) |
| Executable reconstruction   | [Forge](FORGE.md), [RE](RE.md), [atlas](ATLAS.md), [symbol/field evidence](re/)                  |
| Runtime and rendering       | [Architecture reference](ARCHITECTURE.md), [render QA](RENDER-QA.md), [video](VIDEO-STACK.md)    |
| Network and competition     | [Online mode](NIE-ONLINE-MODE.md), [esport evidence](esport/)                                    |
| Migration audits            | [Reports](reports/), [source transfer manifest](SOURCE-TRANSFER-MANIFEST.json)                   |

The full retained corpus is classified in root
[`documentation.json`](../documentation.json). `bun run docs:check` checks
current documentation links and instruction entry points; it does not certify
that every historical recipe is still executable.
