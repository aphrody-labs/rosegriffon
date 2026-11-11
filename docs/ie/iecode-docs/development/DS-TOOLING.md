# Nintendo DS tooling in Dust

`aphrody-dust-core` is the shared implementation owner for the Dust emulator, DS cartridge
formats, and static DS binary analysis. The ROM API lives under `aphrody_dust_core::rom`;
decompilation and project analysis live under `aphrody_dust_core::decomp` and consume the
same ROM model. The corresponding CLI is the single `dust` binary from package
`aphrody-dust-cli`.

## Feature groups

- `nds-rom` enables raw and plain ROM parsing, extraction/building, LZ compression,
  DS protection and Blowfish helpers, checksums, banner images, and text decoding.
- `nds-decomp` adds ARM/Thumb analysis, function and jump-table discovery, symbol and
  relocation maps, module/section configuration, and project utilities.
- `nds-complete` is the core feature bundle for consumers that need both ROM editing
  and decompilation; `aphrody-dust-cli` enables this single bundle.
- The emulator remains usable independently of the tooling features.

## CLI surface

```text
dust rom info game.nds [--json]
dust rom dump --rom game.nds header
dust rom extract --rom game.nds --path extracted/
dust rom build --config extracted/config.yaml --rom rebuilt.nds
dust decomp dis ...
dust decomp init ...
dust decomp delink ...
dust debug launch game.nds --model ds
dust launch game.nds --model ds
```

The decompilation namespace preserves the `dsd` command set (`dis`, `delink`, `init`,
`rom`, `lcf`, `import`, `check`, `objdiff`, `fix`, `apply`, `dump`, `json`, `sig`,
`format`, and `diff`). `dust debug` and direct skill commands forward to the repository's
`crates/emu/cli/dust-cli` Python bridge, which controls Dust's existing headless
`cli-server` protocol. The old `dust-desktop` host is archived outside the active
workspace; the bridge needs a separately built or installed compatible binary
selected with `DUST_DESKTOP_BIN` or `--dust-desktop-bin`.

`rom info` uses `aphrody-dust-core`'s shared bounded ROM inspection API. It reports DS/DSi
metadata, ARM9i/ARM7i presence, declared region bounds, and header/logo CRC status in
both text and JSON output. Inspection validates region ranges before any deeper parser
can slice them. DSi/DSiWare partition decryption and complete DSi extraction remain
unsupported; header inspection does not imply those capabilities.

## Upstream provenance

- Dust core and frontends: upstream revision and license are recorded in
  `THIRD_PARTY.md` and `docs/licenses/dust/`.
- ROM implementation and ROM CLI: ds-rom 0.8.0, MIT; source is integrated into
  `crates/emu/core` and `crates/emu/cli`, with the notice in `docs/licenses/ds-rom/`.
- Decompilation library and commands: ds-decomp 0.12.1, MIT; source is integrated
  into Dust's `decomp` API and the notice is in `docs/licenses/dsd/`; the
  unified CLI. The `object` dependency uses the upstream fork required by its ELF
  writer; it is kept as a separately named root workspace dependency.

The upstream revisions and original documentation are retained in
`THIRD_PARTY.md` and `docs/upstream/`. Changes to shared logic belong in Dust's
core and CLI owners; do not create a second ROM or decompilation API.
