# VDF and KeyValues formats

## Text KeyValues (VDF, ACF)

- Tokens: quoted string, unquoted token, `{`, `}`. A key followed by a string is a leaf; a key followed by `{` opens an object.
- `//` starts a line comment. Escapes inside quotes: `\\`, `\"`, `\n`, `\t` (Windows paths appear as `C:\\Program Files (x86)\\Steam`).
- Keys are case-insensitive in Valve code and may repeat; keep duplicates in order (unverified for Valve's own reader; `bun-steam` keeps an ordered entry list, `crates/bun-steam/src/vdf.rs` `VdfValue`).
- Parser: `parse_vdf` in `crates/bun-steam/src/vdf.rs`; Rust alternative `third_party/steam-ecosystem/vdf-rs`; .NET `valvekeyvalue`.

## Binary KeyValues

Each node: one type byte, NUL-terminated key (or a u32 string-table index in appinfo v41), then the payload.

| Byte | Type          | Payload                                                      |
| ---- | ------------- | ------------------------------------------------------------ |
| 0x00 | object        | child nodes until 0x08 or 0x0B                               |
| 0x01 | string        | NUL-terminated UTF-8                                         |
| 0x02 | int32         | 4 bytes LE                                                   |
| 0x03 | float32       | 4 bytes LE                                                   |
| 0x04 | pointer       | 4 bytes                                                      |
| 0x05 | wide string   | NUL-terminated UTF-16LE                                      |
| 0x06 | color         | 4 bytes RGBA                                                 |
| 0x07 | uint64        | 8 bytes LE                                                   |
| 0x08 | end           | none                                                         |
| 0x09 | binary blob   | length-prefixed bytes (ValveKeyValue only; not in bun-steam) |
| 0x0A | int64         | 8 bytes LE                                                   |
| 0x0B | alternate end | none                                                         |

Sources: `crates/bun-steam/src/vdf.rs` (`bin_type`), `third_party/steam-ecosystem/valvekeyvalue/.../KeyValues1/KV1BinaryNodeType.cs`. ValveKeyValue also detects an optional `VBKV` header (`0x564B4256`, `KV1BinaryReader.cs`).

## appcache/appinfo.vdf

Header: u32 magic, u32 universe (1), and from v41 an i64 offset of the string table.

Magic = `0x075644` << 8 | version:

| Version | Magic      | Change                      |
| ------- | ---------- | --------------------------- |
| 37      | 0x07564425 |                             |
| 38      | 0x07564426 | PICS token and SHA-1        |
| 39      | 0x07564427 | unified VDF structure       |
| 40      | 0x07564428 | binary VDF SHA-1 (Dec 2022) |
| 41      | 0x07564429 | string table (June 2024)    |

Record (repeat until app id 0): u32 app id, u32 size, u32 info state, u32 last updated, u64 PICS token, 20-byte SHA-1 of text VDF, u32 change number, 20-byte SHA-1 of binary VDF (v40+), binary KV blob.

String table (v41): u32 count, then `count` NUL-terminated strings. Read it first; keys in every blob are u32 indices into it.

## appcache/packageinfo.vdf

Header: u32 magic (`0x065655` << 8 | version), u32 universe. v39 `0x06565527`, v40 `0x06565528` (adds PICS token, Apr 2020).

Record (repeat until package id `0xFFFFFFFF`): u32 package id, 20-byte SHA-1, u32 change number, u64 PICS token (v40+), binary KV blob.

Sources: `third_party/steam-ecosystem/steamappinfo/README.md`, `SteamAppInfoParser/AppInfo.cs`, `PackageInfo.cs`; `crates/bun-steam/src/vdf.rs` (`appinfo_magic`, `packageinfo_magic`, `parse_appinfo`, `parse_packageinfo`).
