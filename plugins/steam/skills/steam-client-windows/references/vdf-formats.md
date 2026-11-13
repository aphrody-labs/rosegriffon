# VDF and KeyValues formats

## Text KeyValues (VDF, ACF)

- Tokens: quoted string, unquoted token, `{`, `}`. A key followed by a string is a leaf; a key followed by `{` opens an object.
- `//` starts a line comment. Escapes inside quotes: `\\`, `\"`, `\n`, `\r`, `\t`; any other escaped character is kept as is (tokenizer in `crates/steam-depot/src/vdf.rs`: quoted-string escape match and `//` line-comment skip).
- Keys may repeat. bun-steam keeps duplicates in order as an ordered entry list (`crates/steam-depot/src/vdf.rs` `VdfValue`); the plugin's `parseVdf` (`plugins/steam/lib/steam.ts`) keeps only the last value, so `read_vdf` output shows one value per key.
- Parser: `parse_vdf` in `crates/steam-depot/src/vdf.rs`; Rust alternative `third_party/vdf-rs`; .NET `third_party/valvekeyvalue`.

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

Sources: `crates/steam-depot/src/vdf.rs` (`bin_type`), `third_party/valvekeyvalue/ValveKeyValue/ValveKeyValue/KeyValues1/KV1BinaryNodeType.cs`. ValveKeyValue also detects an optional `VBKV` header (`0x564B4256`, `third_party/valvekeyvalue/ValveKeyValue/ValveKeyValue/Deserialization/KeyValues1/KV1BinaryReader.cs`).

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

Sources: `third_party/steamappinfo/README.md`, `third_party/steamappinfo/SteamAppInfoParser/AppInfo.cs`, `third_party/steamappinfo/SteamAppInfoParser/PackageInfo.cs`; `crates/steam-depot/src/vdf.rs` (`appinfo_magic`, `packageinfo_magic`, `parse_appinfo`, `parse_packageinfo`).
