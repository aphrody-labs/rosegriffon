---
name: steam-ids-and-urls
description: This skill should be used when the user asks to "convert a SteamID", "what is [U:1:N]", "explain DepotID vs ManifestID", "explain AppID vs PackageID", "build a store or community URL", "get an app's header image URL", "open a game with steam://", or "what CM servers does Steam use", or mentions buildid, branches, vanity URLs, steamstatic, or GetCMListForConnect. For depot and manifest content, steam-content-cdn applies.
---

# Steam identifiers and URLs

Use this skill to identify, convert, and link Steam objects (apps, depots, manifests, packages, accounts) and to build Steam URLs without guessing. Prefer the plugin MCP tools over manual arithmetic: `resolve_steamid` for account IDs, `steamdb_link` to build steamdb.info links, and `app_paths` for local install, depotcache, and userdata paths.

## Identifier taxonomy

Treat each ID type as a distinct namespace. Never assume two IDs of different types are interchangeable, even when the numbers coincide.

- **AppID** (uint32): a product (game, DLC, tool, soundtrack). Examples below use AppID 2799860, the test app of [`../steam-local-inspect/references/layout.md`](../steam-local-inspect/references/layout.md).
- **DepotID** (uint32): a content bundle owned by an app. The first content depot is often `appid + 1` (worked example in [`../steam-local-inspect/references/layout.md`](../steam-local-inspect/references/layout.md)). Treat this as a convention only; read the real list from PICS appinfo `depots` or the Steamworks depot settings (https://partner.steamgames.com/doc/store/application/depots).
- **ManifestID / GID** (uint64): one immutable snapshot of a depot. Its proto type is in [`../steam-content-cdn/references/manifest-format.md`](../steam-content-cdn/references/manifest-format.md). Handle it as a 64-bit unsigned value or a string; a JavaScript `number` loses precision.
- **PackageID / SubID** (uint32): the "Steam package/subscription ID" keying each entry of `appcache/packageinfo.vdf` (`third_party/steamappinfo/README.md`).
- **BuildID** (uint32): a build uploaded through SteamPipe; a build sets one manifest per depot and is assigned to branches (https://partner.steamgames.com/doc/sdk/uploading).
- **Branches**: `public` is the default; other branches are betas, optionally protected by a password. Branch data appears under `depots.branches.<name>` in appinfo; for the test app 2799860 the `public` entry has keys `buildid`, `timeupdated`, `timebuildupdated`, and `depots.privatebranches` is `"1"` (`appinfo 2799860` read with the former plugins/steam/scripts/steam-inspect.ts, 2026-11-12; today `ay steam vdf <steam>/appcache/appinfo.vdf --app 2799860`). Other branches may carry more keys; read a real dump.

## SteamID layout

The SteamID64 bit layout (universe, account type, instance, account ID) is in [`references/steamid.md`](references/steamid.md).

Text forms are SteamID3 `[U:1:<accountId>]`, legacy SteamID2 `STEAM_X:Y:Z`, and SteamID32 (the bare account ID used in `userdata/<accountId>/`). The individual base value, all conversion formulas, and a worked example live in [`references/steamid.md`](references/steamid.md).

Use `resolve_steamid` for these conversions and for vanity names. Do not hand-roll 64-bit math in languages without native uint64 or BigInt.

## Store and community URLs

Store, store JSON, profile, vanity, community hub and Workshop item URL forms, with their verification: [`references/urls.md`](references/urls.md). Build SteamDB links with `steamdb_link`.

## Image CDN paths

Do not construct image URLs from a fixed template; take them from appdetails. Observed hashed paths and HEAD results: [`references/urls.md`](references/urls.md) (Image assets).

## steam:// protocol

The Steam client registers the `steam://` scheme (launch, install, open UI); commands with the wiki descriptions: [`references/steam-protocol.md`](references/steam-protocol.md).

## CM servers

Steam clients connect to Connection Manager (CM) servers, discovered with the keyless `ISteamDirectory/GetCMListForConnect` method. Always use the returned list instead of hardcoding hosts. The endpoint URL, entry fields, observed ports and the WebSocket path are in [`references/cm-servers.md`](references/cm-servers.md).

## Workflow

1. Identify the ID type from context (length, prefix, URL position). For the SteamID64 range and layout, see [references/steamid.md](references/steamid.md).
2. Convert accounts with `resolve_steamid`; check universe and type before treating the ID as a user.
3. For apps, confirm the AppID through appdetails or PICS before deriving depots.
4. For local data, call `app_paths` to locate the depotcache manifests and `userdata/` directories ([`../steam-local-inspect/references/layout.md`](../steam-local-inspect/references/layout.md)).
5. Use only URLs seen in a real response or confirmed with a HEAD request.

## Additional Resources

- `references/steamid.md`: full bit layout, account types, instance flags, conversion pseudo code.
- `references/urls.md`: store, community, image, and Web API URL forms with verification status.
- `references/steam-protocol.md`: steam:// commands.
- `references/cm-servers.md`: CM discovery and transport types.

## Sources

- `third_party/steamkit/SteamKit2/SteamKit2/Types/SteamID.cs`
- `third_party/steam-protobufs/steam/content_manifest.proto`
- https://developer.valvesoftware.com/wiki/SteamID
- https://developer.valvesoftware.com/wiki/Steam_browser_protocol (via https://web.archive.org/web/20261020182138/, accessed 2026-11-12)
- `third_party/steamkit/SteamKit2/SteamKit2/Networking/Steam3/WebSocketContext.cs`
- https://store.steampowered.com/api/appdetails?appids=2799860 (fetched 2026-11-12)
- https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/?cellid=0 (fetched 2026-11-12)
- https://partner.steamgames.com/doc/store/application/depots
- https://partner.steamgames.com/doc/sdk/uploading
- Worked local example: [`../steam-local-inspect/references/layout.md`](../steam-local-inspect/references/layout.md)
