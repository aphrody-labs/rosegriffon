---
name: steam-web-api
description: This skill should be used when the user asks to "call the Steam Web API", "get a player's owned games", "get the Steam app list", "fetch Steam store app details", "get Steam reviews", or mentions api.steampowered.com, ISteamUser, IPlayerService, IStoreService, or appdetails. For obtaining or protecting keys and for login flows, steam-auth applies.
---

# Steam Web API

Use this skill to build, debug, or explain HTTP calls to Valve's Steam Web API and the Steam storefront JSON endpoints.

## URL form and hosts

Build every call as:

```
https://api.steampowered.com/<Interface>/<Method>/v<N>/?<params>   (key in the x-webapi-key header)
```

- Use `api.steampowered.com` for public methods (HTTP and HTTPS). Source: https://partner.steamgames.com/doc/webapi_overview
- Partner host and publisher key rules: [`../steam-auth/references/keys.md`](../steam-auth/references/keys.md).
- Always use HTTPS when a key is attached. How a key is passed is in [`../steam-auth/references/keys.md`](../steam-auth/references/keys.md).
- For `*Service` interfaces (IPlayerService, IStoreService, IPublishedFileService, IUserReviewsService), parameters can go into a URL-encoded JSON blob in `input_json`. Keep `format` as a separate parameter; the key goes in the header ([`../steam-auth/references/keys.md`](../steam-auth/references/keys.md)). Source: https://partner.steamgames.com/doc/webapi_overview
- `format` accepts `json` (default), `xml` and `vdf`. The overview does not list the values; verified with keyless calls to `ISteamWebAPIUtil/GetServerInfo/v1/?format=vdf` and `?format=xml` on 2026-11-12.
- Array parameters use indexed names such as `publishedfileids[0]` and `name[0]`. Source: https://partner.steamgames.com/doc/webapi/ISteamRemoteStorage

## Keys and limits

- Obtaining and handling keys (user and publisher keys, daily cap, terms, environment variable, header, secrecy): [`../steam-auth/references/keys.md`](../steam-auth/references/keys.md).

## Choosing a method

Start with the table below. Full parameter lists are in [`references/interfaces.md`](references/interfaces.md).

| Need                             | Method                                                               | Key      |
| -------------------------------- | -------------------------------------------------------------------- | -------- |
| Profile name, avatar, visibility | ISteamUser/GetPlayerSummaries/v2 (max 100 ids)                       | user     |
| Friends                          | ISteamUser/GetFriendList/v1                                          | user     |
| Vanity name to SteamID64         | ISteamUser/ResolveVanityURL/v1                                       | user     |
| VAC/game/community bans          | ISteamUser/GetPlayerBans/v1                                          | user     |
| Library and playtime             | IPlayerService/GetOwnedGames/v1                                      | user     |
| Recent games, level, badges      | IPlayerService/GetRecentlyPlayedGames, GetSteamLevel, GetBadges (v1) | user     |
| Achievement and stat schema      | ISteamUserStats/GetSchemaForGame/v2                                  | user     |
| A player's achievements          | ISteamUserStats/GetPlayerAchievements/v1                             | user     |
| Global achievement percentages   | ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2 (`gameid`)  | none     |
| Concurrent players               | ISteamUserStats/GetNumberOfCurrentPlayers/v1                         | none     |
| Full app catalogue               | IStoreService/GetAppList/v1 (paged with `last_appid`)                | user     |
| Patch check                      | ISteamApps/UpToDateCheck/v1                                          | none     |
| News                             | ISteamNews/GetNewsForApp/v2                                          | none     |
| Workshop search                  | IPublishedFileService/QueryFiles/v1                                  | user     |
| Workshop item details            | ISteamRemoteStorage/GetPublishedFileDetails/v1 (POST)                | none     |
| Reviews                          | IUserReviewsService/GetAppReviews/v1                                 | optional |
| Discover methods for a key       | ISteamWebAPIUtil/GetSupportedAPIList/v1                              | optional |

Rules that save time:

- Use IStoreService/GetAppList for the app list; ISteamApps/GetAppList/v2 is deprecated ([`references/interfaces.md`](references/interfaces.md)).
- Use IUserReviewsService/GetAppReviews for reviews; the storefront `appreviews` endpoint is deprecated ([`references/store-api.md`](references/store-api.md)).
- Private profiles return empty or missing data on GetOwnedGames, GetFriendList, and GetPlayerAchievements. GetOwnedGames returns games only "if their owned games/game details are visible to you" (https://partner.steamgames.com/doc/webapi/IPlayerService); GetFriendList returns HTTP 401 for a private friend list (https://partner.steamgames.com/doc/webapi/ISteamUser). Check `communityvisibilitystate` from GetPlayerSummaries first. The partner sample shows values 1 and 3 without defining them; `third_party/steam-rs/src/steam_user/get_player_summaries.rs` documents 1 as private.
- Resolve a vanity name or profile URL to a SteamID64 before calling any per-user method.

## Store endpoints (undocumented)

`store.steampowered.com/api/appdetails`, `/api/packagedetails`, and related endpoints are not part of the documented Web API. They need no key, can change without notice, and are rate-limited per IP. Treat them as best-effort. Cache responses and back off on HTTP 429. See [`references/store-api.md`](references/store-api.md).

## Plugin MCP tools

Prefer the plugin tools over hand-built HTTP calls:

- `web_api_call`: generic `<Interface>/<Method>/v<N>` call. It adds `STEAM_WEB_API_KEY` when that variable is set. Without it, only keyless methods work. A keyless call to `ISteamWebAPIUtil/GetSupportedAPIList/v1/` (2026-11-12) lists exactly the methods that take no `key` parameter. The keyless methods, interface by interface, and the common methods that need a key are listed in [`references/interfaces.md`](references/interfaces.md).
- `store_appdetails`: wraps `store.steampowered.com/api/appdetails` with `cc`, `l`, and `filters`.
- `resolve_steamid`: turns a vanity name, profile URL, or SteamID form into a SteamID64. Vanity names use ResolveVanityURL when a key is set, otherwise the public `steamcommunity.com/id/<name>/?xml=1` feed (`plugins/steam/servers/steam-mcp.ts`).

If a call fails, report the HTTP status and the error body. Do not retry the same call in a loop.

## Workflow

1. Identify the data needed and pick the method from the table.
2. Check the key requirement. If a key is required and `STEAM_WEB_API_KEY` is unset, say so and offer keyless alternatives.
3. Resolve SteamIDs, then make the call. Use `input_json` for `*Service` methods when passing arrays.
4. For bulk work, page (`last_appid`, `cursor`), cache, and stay well under the daily cap ([`../steam-auth/references/keys.md`](../steam-auth/references/keys.md)).
5. Cite the method version used. Older versions may still respond but are unsupported (for example, GetNewsForApp v1 versus v2).

## Additional Resources

- `references/interfaces.md`: method tables for each interface with versions, parameters, key types, and hosts.
- `references/store-api.md`: storefront endpoints (appdetails, packagedetails, appreviews), parameters, limits, and caveats.

## Sources

- https://partner.steamgames.com/doc/webapi_overview
- https://partner.steamgames.com/doc/webapi_overview/auth
- https://steamcommunity.com/dev/apiterms
- https://partner.steamgames.com/doc/webapi/ISteamUser
- https://partner.steamgames.com/doc/webapi/IPlayerService
- https://partner.steamgames.com/doc/webapi/ISteamUserStats
- https://partner.steamgames.com/doc/webapi/ISteamApps
- https://partner.steamgames.com/doc/webapi/IStoreService
- https://partner.steamgames.com/doc/webapi/ISteamNews
- https://partner.steamgames.com/doc/webapi/ISteamRemoteStorage
- https://partner.steamgames.com/doc/webapi/IPublishedFileService
- https://partner.steamgames.com/doc/webapi/IUserReviewsService
- Local typed client: `third_party/steam-rs/src/lib.rs` (base `https://api.steampowered.com`)
