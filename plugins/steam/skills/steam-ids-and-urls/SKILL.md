---
name: steam-ids-and-urls
description: This skill should be used when the user asks to "convert a SteamID", "turn a SteamID64 into STEAM_X:Y:Z", "what is [U:1:N]", "find the depot ID for an app", "what is a manifest ID", "explain AppID vs PackageID vs SubID", "build a store or community URL", "get the header image URL for an app", "open a game with steam://", "what CM servers does Steam use", or mentions buildid, betas, branch passwords, vanity URLs, steamstatic image paths, or GetCMListForConnect.
---

# Steam identifiers and URLs

Use this skill to identify, convert, and link Steam objects (apps, depots, manifests, packages, accounts) and to build Steam URLs without guessing. Prefer the plugin MCP tools over manual arithmetic: `resolve_steamid` for account IDs, `steamdb_link` to build steamdb.info links (it only builds links, it does not query SteamDB), and `app_paths` for local install, depotcache, and userdata paths.

## Identifier taxonomy

Treat each ID type as a distinct namespace. Never assume two IDs of different types are interchangeable, even when the numbers coincide.

- **AppID** (uint32): a product (game, DLC, tool, soundtrack). Example: 2799860 is "INAZUMA ELEVEN: Victory Road" (verified via the store appdetails API, see Sources).
- **DepotID** (uint32): a content bundle owned by an app. The first content depot is often `appid + 1` (local example: depot 2799861 for app 2799860). Treat this as a convention only; read the real list from PICS appinfo `depots` or the Steamworks depot settings (https://partner.steamgames.com/doc/store/application/depots).
- **ManifestID / GID** (uint64): one immutable snapshot of a depot. `ContentManifestMetadata.gid_manifest` is `uint64` in `content_manifest.proto`. Handle it as a 64-bit unsigned value or a string; a JavaScript `number` loses precision. Local verified example: depot 2799861, manifest 5864006674348129563 (`depotcache/2799861_5864006674348129563.manifest`).
- **PackageID / SubID** (uint32): a license bundle granting one or more apps and depots. "Sub" and "package" name the same object.
- **BuildID** (uint32): a build uploaded through SteamPipe; a build sets one manifest per depot and is assigned to branches (https://partner.steamgames.com/doc/sdk/uploading).
- **Branches**: `public` is the default; other branches are betas, optionally protected by a password. Branch data appears under `depots.branches` in appinfo (exact key names unverified; read a real appinfo dump).

## SteamID layout

A SteamID64 packs four fields, per `SteamKit2/Types/SteamID.cs` and https://developer.valvesoftware.com/wiki/SteamID:

| Bits  | Width | Field                                   |
| ----- | ----- | --------------------------------------- |
| 56-63 | 8     | Universe (1 = Public)                   |
| 52-55 | 4     | Account type (1 = Individual, 7 = Clan) |
| 32-51 | 20    | Instance (1 = desktop for individuals)  |
| 0-31  | 32    | Account ID                              |

For individual public accounts, `SteamID64 = 76561197960265728 + accountId`. The base is `0x0110000100000000` (universe 1, type 1, instance 1, account 0).

### Text forms

- **SteamID3**: `[U:1:<accountId>]`. The letter encodes account type (U individual, g clan, G game server, A anon game server, T chat, and others; see `AccountTypeChars` in `SteamID.cs`).
- **SteamID2 (legacy)**: `STEAM_X:Y:Z` where `Y = accountId & 1`, `Z = accountId >> 1`, and `X` is the universe. Older games print `X = 0` for public accounts, newer code prints `1`; accept both on input. SteamKit parses `STEAM_[0-4]:[0-1]:<n>`.
- **SteamID32**: the bare account ID, also used in `userdata/<accountId>/`.

### Worked example: 76561199559674816

1. `accountId = 76561199559674816 - 76561197960265728 = 1599409088`.
2. Hex check: `0x011000015F550BC0`; top byte `0x01` (universe Public), next nibble `1` (Individual), instance `00001`.
3. SteamID3: `[U:1:1599409088]`.
4. SteamID2: `Y = 1599409088 & 1 = 0`, `Z = 1599409088 >> 1 = 799704544`, giving `STEAM_1:0:799704544` (or `STEAM_0:0:799704544` in older tooling).
5. Profile URL: `https://steamcommunity.com/profiles/76561199559674816`.

Use `resolve_steamid` for these conversions and for vanity names. Do not hand-roll 64-bit math in languages without native uint64 or BigInt.

## Store and community URLs

- Store page: `https://store.steampowered.com/app/<appid>`
- Store data: `https://store.steampowered.com/api/appdetails?appids=<appid>` (undocumented, rate limited).
- Profile by ID: `https://steamcommunity.com/profiles/<steamid64>`; by vanity: `https://steamcommunity.com/id/<vanity>`.
- Community hub: `https://steamcommunity.com/app/<appid>`
- Workshop or guide item: `https://steamcommunity.com/sharedfiles/filedetails/?id=<publishedfileid>`
- SteamDB: build with `steamdb_link` rather than typing paths.

## Image CDN paths

Do not construct image URLs from a fixed template. The live appdetails response for 2799860 returned hashed paths:

```
https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2799860/<hash>/header.jpg?t=<ts>
https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2799860/<hash>/capsule_231x87.jpg?t=<ts>
```

The unhashed forms `.../store_item_assets/steam/apps/<appid>/header.jpg` and `.../library_600x900.jpg`, and the `cdn.cloudflare.steamstatic.com/steam/apps/<appid>/...` host, are widely used but (unverified) for any given app. Fetch appdetails and use `header_image`, `capsule_image`, `capsule_imagev5`, and `background` verbatim. See `references/urls.md`.

## steam:// protocol

The Steam client registers the `steam://` scheme. Common commands (exact syntax unverified: the Valve wiki returned HTTP 403 to automated fetches):

- `steam://run/<appid>`, `steam://rungameid/<appid>`: launch.
- `steam://install/<appid>`, `steam://uninstall/<appid>`, `steam://validate/<appid>`: manage installs.
- `steam://store/<appid>`, `steam://url/<page>`, `steam://open/<page>`, `steam://nav/<path>`: open client UI.

Confirm any command against https://developer.valvesoftware.com/wiki/Steam_browser_protocol before relying on it. `references/steam-protocol.md` lists them.

## CM servers

Steam clients connect to Connection Manager (CM) servers. Discover them with the public Web API:

```
https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/?cellid=0
```

The live response (fetched 2026-11-12) returned entries with `endpoint`, `type` (`websockets` or `netfilter`), `dc`, `realm`, `load`, `wtd_load`. Observed: `netfilter` (raw TCP/UDP) on `<ip>:27017`, and `websockets` on `ext*-<dc>.steamserver.net` with ports 27019, 27021, 27025, 27035. The 27017-27019 range and port 443 are commonly cited but not fully seen in this sample (unverified). Always use the returned list instead of hardcoding hosts. Details: `references/cm-servers.md`.

## Workflow

1. Identify the ID type from context (length, prefix, URL position). 17-digit numbers starting with `7656119` are almost always individual SteamID64s.
2. Convert accounts with `resolve_steamid`; check universe and type before treating the ID as a user.
3. For apps, confirm the AppID through appdetails or PICS before deriving depots.
4. For local data, call `app_paths` to locate `depotcache/<depot>_<manifest>.manifest` and `userdata/<accountId>/`.
5. Mark any URL not seen in a real response as unverified.

## Additional Resources

- `references/steamid.md`: full bit layout, account types, instance flags, conversion pseudo code.
- `references/urls.md`: store, community, image, and Web API URL forms with verification status.
- `references/steam-protocol.md`: steam:// commands.
- `references/cm-servers.md`: CM discovery and transport types.

## Sources

- `C:\src\third_party\steam-ecosystem\steamkit\SteamKit2\SteamKit2\Types\SteamID.cs`
- `C:\src\third_party\steam-ecosystem\steam-protobufs\steam\content_manifest.proto`
- https://developer.valvesoftware.com/wiki/SteamID
- https://developer.valvesoftware.com/wiki/Steam_browser_protocol (not fetched: HTTP 403)
- https://store.steampowered.com/api/appdetails?appids=2799860 (fetched 2026-11-12)
- https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/?cellid=0 (fetched 2026-11-12)
- https://partner.steamgames.com/doc/store/application/depots
- https://partner.steamgames.com/doc/sdk/uploading
- Local: `C:/Program Files (x86)/Steam/depotcache/2799861_5864006674348129563.manifest`
