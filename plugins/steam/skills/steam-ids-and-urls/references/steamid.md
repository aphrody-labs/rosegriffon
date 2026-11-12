# SteamID reference

Sources: `third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Types/SteamID.cs`, https://developer.valvesoftware.com/wiki/SteamID

## Masks (SteamID.cs)

- `AccountIDMask = 0xFFFFFFFF` (bits 0-31)
- `AccountInstanceMask = 0x000FFFFF` (bits 32-51)
- Account type: 4 bits at bit 52; universe: 8 bits at bit 56.
- Instances: `AllInstances = 0`, `DesktopInstance = 1`, `ConsoleInstance = 2`, `WebInstance = 4`.
- Chat instance flags (top bits of the 20-bit instance): `Clan = (mask+1)>>1`, `Lobby = (mask+1)>>2`, `MMSLobby = (mask+1)>>3`.

## Account type letters (SteamID3)

From `AccountTypeChars`: I Invalid, U Individual, M Multiseat, G GameServer, A AnonGameServer, P Pending, C ContentServer, g Clan, T Chat (L lobby chat, c clan chat), a AnonUser. Unknown types render as `i`.

## Universes

0 Invalid, 1 Public, 2 Beta, 3 Internal, 4 Dev (`EUniverse` in `third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Base/Generated/SteamLanguage.cs`, which also defines `EAccountType`).

## Conversion (pseudo code, uint64)

```
id64      = (universe << 56) | (type << 52) | (instance << 32) | accountId
accountId = id64 & 0xFFFFFFFF
steam3    = "[U:1:" + accountId + "]"
steam2    = "STEAM_" + X + ":" + (accountId & 1) + ":" + (accountId >> 1)
```

Individual public base: `76561197960265728 = 0x0110000100000000`.

## Worked example

| Form      | Value                                                 |
| --------- | ----------------------------------------------------- |
| SteamID64 | 76561199559674816                                     |
| Hex       | 0x011000015F550BC0                                    |
| AccountID | 1599409088                                            |
| SteamID3  | [U:1:1599409088]                                      |
| SteamID2  | STEAM_1:0:799704544 (legacy: STEAM_0:0:799704544)     |
| Profile   | https://steamcommunity.com/profiles/76561199559674816 |

SteamID2 `X`: SteamKit's regex accepts 0-4; Source-engine games historically emit 0 for public accounts (Valve wiki).
