# Upstream emulator and domain references

This index covers sources retained for console emulation and NIE game-domain
work. Bevy and wgpu are consumed as published crates; their fork history,
benchmark tools, engine documentation and source snapshots are owned by the
independent archived GPU research and are not IECODE build inputs.

## Retained emulator sources

| Project              | IECODE owner                                  | License and provenance                                                          |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Dust Nintendo DS     | `crates/emu/`                                 | See `THIRD_PARTY.md` and `docs/licenses/dust/`                                  |
| Gecko Wii/GameCube   | `crates/emu/wii/`, `apps/web/wii/`            | See `THIRD_PARTY.md` and source notices                                         |
| Ruzu Switch snapshot | `crates/emu/ruzu/`                            | GPL-3.0; integration remains incomplete                                         |
| Lua source           | `vendor/lua-src/` and native console adapters | See local license notices                                                       |
| NIE game analysis    | `crates/nie/`, `packages/inagle/`             | Domain specifications and private-data policy are indexed in `../nie/README.md` |

## External reference implementations

- [melonDS](https://github.com/melonDS-emu/melonDS): Nintendo DS hardware behavior.
- [BlocksDS](https://codeberg.org/blocksds/awesome-blocksds): Nintendo DS homebrew SDK.
- [libctru](https://github.com/devkitPro/libctru): Nintendo 3DS SDK.
- [Buscador-Inazuma](https://github.com/migueleven/Buscador-Inazuma): game data search oracle.
- [IEStrikers](https://github.com/SwareJonge/IEStrikers): Wii game reverse-engineering reference.
- [InazumaElevenGoMapenv](https://github.com/Tiniifan/InazumaElevenGoMapenv): Level-5 Mapenv reference.

Preserve component license notices beside every retained source. Historical
migration reports remain under `docs/history/` and do not define active build
ownership.
