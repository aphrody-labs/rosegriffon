---
name: steam-web-api
description: This skill should be used when the user asks to "call the Steam Web API", "get a player's owned games", "resolve a Steam vanity URL", "look up Steam achievements", "get the Steam app list", "fetch Steam store app details", "get current player count for a Steam game", "query Workshop items", "get Steam reviews for an app", or mentions api.steampowered.com, partner.steam-api.com, ISteamUser, IPlayerService, ISteamUserStats, IStoreService, appdetails, or a Steam Web API key. For obtaining or protecting keys and for login flows, steam-auth applies.
---

# Steam Web API

Use this skill to build, debug, or explain HTTP calls to Valve's Steam Web API and the Steam storefront JSON endpoints.

## URL form and hosts

Build every call as:

```
https://api.steampowered.com/<Interface>/<Method>/v<N>/?key=<KEY>&<params>
```

- Use `api.steampowered.com` for public methods (HTTP and HTTPS). Source: https://partner.steamgames.com/doc/webapi_overview
- Use `https://partner.steam-api.com` only from a secure server with a publisher key. That host is HTTPS-only. Every request needs a publisher key, and requests without a valid one return 403. Repeated 403s bring strict per-IP rate limits. Source: same page.
- Always use HTTPS when a key is attached. Pass the key as the `key` query parameter or in the `x-webapi-key` request header. Source: https://partner.steamgames.com/doc/webapi_overview/auth
- For `*Service` interfaces (IPlayerService, IStoreService, IPublishedFileService, IUserReviewsService), parameters can go into a URL-encoded JSON blob in `input_json`. Keep `key` and `format` as separate parameters. Source: https://partner.steamgames.com/doc/webapi_overview
- Use `format=json` (default), `xml` or `vdf` (unverified: the overview names `format` but does not list its values in the fetched text).
- Array parameters use indexed names such as `publishedfileids[0]` and `name[0]`. Source: https://partner.steamgames.com/doc/webapi/ISteamRemoteStorage

## Keys and limits

- User keys are free and need a Steam account, a domain name, and acceptance of the Terms. Register one at https://steamcommunity.com/dev/apikey. Source: https://partner.steamgames.com/doc/webapi_overview/auth
- Publisher keys belong to a Steamworks publisher group (Users & Permissions -> Manage Groups -> Create WebAPI Key). They can be IP-locked and must never ship in a client. Source: same page.
- The Terms of Use cap usage at 100,000 calls per day. Keys are personal, confidential, and non-transferable. Source: https://steamcommunity.com/dev/apiterms
- Never print, log, or commit a key. Read it from the `STEAM_WEB_API_KEY` environment variable.

## Choosing a method

Start with the table below. Full parameter lists are in `references/interfaces.md`.

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

- Use IStoreService/GetAppList for the app list. ISteamApps/GetAppList/v2 is deprecated because it "can no longer scale to the number of items available on Steam". Source: https://partner.steamgames.com/doc/webapi/ISteamApps
- Use IUserReviewsService/GetAppReviews for reviews. `store.steampowered.com/appreviews/<appid>?json=1` is deprecated. Source: https://partner.steamgames.com/doc/webapi/IUserReviewsService
- Private profiles return empty or missing data on GetOwnedGames, GetFriendList, and GetPlayerAchievements. Check `communityvisibilitystate` from GetPlayerSummaries first (unverified: the page documenting this behavior returned 403 when fetched).
- Resolve a vanity name or profile URL to a SteamID64 before calling any per-user method.

## Store endpoints (undocumented)

`store.steampowered.com/api/appdetails`, `/api/packagedetails`, and related endpoints are not part of the documented Web API. They need no key, can change without notice, and are rate-limited per IP. Treat them as best-effort. Cache responses and back off on 429 or 403. See `references/store-api.md`.

## Plugin MCP tools

Prefer the plugin tools over hand-built HTTP calls:

- `web_api_call`: generic `<Interface>/<Method>/v<N>` call. It adds `STEAM_WEB_API_KEY` when that variable is set. Without it, only keyless methods work (GetNumberOfCurrentPlayers, GetGlobalAchievementPercentagesForApp, GetNewsForApp, UpToDateCheck, GetPublishedFileDetails, GetAppReviews).
- `store_appdetails`: wraps `store.steampowered.com/api/appdetails` with `cc`, `l`, and `filters`.
- `resolve_steamid`: turns a vanity name, profile URL, or SteamID form into a SteamID64. Vanity resolution needs a key.

If a call fails, report the HTTP status and the error body. Do not retry the same call in a loop.

## Workflow

1. Identify the data needed and pick the method from the table.
2. Check the key requirement. If a key is required and `STEAM_WEB_API_KEY` is unset, say so and offer keyless alternatives.
3. Resolve SteamIDs, then make the call. Use `input_json` for `*Service` methods when passing arrays.
4. For bulk work, page (`last_appid`, `cursor`), cache, and stay well under 100,000 calls per day.
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
- Local typed client: `C:\src\third_party\steam-ecosystem\steam-rs\src\lib.rs` (base `https://api.steampowered.com`)
