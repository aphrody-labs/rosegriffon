# Steam Web API interface reference

Each row was checked against the cited partner documentation page on 2026-11-12 unless marked "(unverified)". "user" means a standard Web API key (https://steamcommunity.com/dev/apikey). "publisher" means a Steamworks publisher key, used only from a secure server and normally against `https://partner.steam-api.com`.

Base: `https://api.steampowered.com/<Interface>/<Method>/v<N>/`

## ISteamUser

Source: https://partner.steamgames.com/doc/webapi/ISteamUser

| Method                   | Ver                                                  | HTTP | Key                                           | Parameters                                                             |
| ------------------------ | ---------------------------------------------------- | ---- | --------------------------------------------- | ---------------------------------------------------------------------- |
| GetPlayerSummaries       | v2                                                   | GET  | user                                          | `steamids` (comma list, max 100)                                       |
| GetFriendList            | v1                                                   | GET  | user                                          | `steamid`, `relationship` (optional)                                   |
| ResolveVanityURL         | v1                                                   | GET  | user                                          | `vanityurl`, `url_type` (1 individual, 2 group, 3 official game group) |
| GetPlayerBans            | v1                                                   | GET  | user                                          | `steamids` (comma list)                                                |
| GetUserGroupList         | v1                                                   | GET  | publisher (inferred from the key description) | `steamid`                                                              |
| CheckAppOwnership        | v4                                                   | GET  | publisher                                     | `steamid`, `appid`                                                     |
| GetPublisherAppOwnership | v4 (change history mentions v5 adding `timeexpires`) | GET  | publisher                                     | `steamid`                                                              |
| GetAppPriceInfo          | v1                                                   | GET  | publisher                                     | `steamid`, `appids` (max 100)                                          |
| GetDeletedSteamIDs       | v1                                                   | GET  | publisher                                     | `rowversion`                                                           |

ResolveVanityURL returns `response.success` (1 = match) and `response.steamid` (unverified: the fetched page does not show the response shape).

## IPlayerService

Source: https://partner.steamgames.com/doc/webapi/IPlayerService. The page says to call this interface with `input_json`.

| Method                 | Ver | Key  | Parameters                                                                         |
| ---------------------- | --- | ---- | ---------------------------------------------------------------------------------- |
| GetOwnedGames          | v1  | user | `steamid`, `include_appinfo`, `include_played_free_games`, `appids_filter` (array) |
| GetRecentlyPlayedGames | v1  | user | `steamid`, `count` (0 = all)                                                       |
| GetSteamLevel          | v1  | user | `steamid`                                                                          |
| GetBadges              | v1  | user | `steamid`                                                                          |

The page marks every parameter as required, but its own descriptions show that the booleans and `appids_filter` are optional.

Example (the `input_json` value is URL-encoded `{"steamid":76561197960435530,"include_appinfo":true}`):

```
GET https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=KEY&input_json=%7B%22steamid%22%3A76561197960435530%2C%22include_appinfo%22%3Atrue%7D
```

## ISteamUserStats

Source: https://partner.steamgames.com/doc/webapi/ISteamUserStats

| Method                                | Ver | Key       | Parameters                                            |
| ------------------------------------- | --- | --------- | ----------------------------------------------------- |
| GetGlobalAchievementPercentagesForApp | v2  | none      | `gameid`                                              |
| GetNumberOfCurrentPlayers             | v1  | none      | `appid`                                               |
| GetSchemaForGame                      | v2  | user      | `appid`, `l` (language)                               |
| GetPlayerAchievements                 | v1  | user      | `steamid`, `appid`, `l`                               |
| GetUserStatsForGame                   | v2  | user      | `steamid`, `appid`                                    |
| GetGlobalStatsForGame                 | v1  | publisher | `appid`, `count`, `name[0..]`, `startdate`, `enddate` |

## ISteamApps

Source: https://partner.steamgames.com/doc/webapi/ISteamApps

| Method                                                                                          | Ver     | Key                   | Parameters                                              | Notes                                                                                                               |
| ----------------------------------------------------------------------------------------------- | ------- | --------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| GetAppList                                                                                      | v2      | none                  | none                                                    | Deprecated: "this API can no longer scale to the number of items available on Steam". Use IStoreService/GetAppList. |
| UpToDateCheck                                                                                   | v1      | none                  | `appid`, `version`                                      | Reports whether the installed version is current.                                                                   |
| GetServersAtAddress                                                                             | v1      | none                  | `addr`                                                  |                                                                                                                     |
| GetServerList                                                                                   | v1      | key (type unverified) | `filter`, `limit`                                       |                                                                                                                     |
| GetAppBetas, GetAppBuilds, GetAppDepotVersions, GetPartnerAppListForWebAPIKey, GetPlayersBanned | v1/v2   | publisher             | `appid`, ...                                            | Partner host                                                                                                        |
| SetAppBuildLive                                                                                 | v2 POST | publisher             | `appid`, `buildid`, `betakey`, `steamid`, `description` | Partner host                                                                                                        |

## IStoreService

Source: https://partner.steamgames.com/doc/webapi/IStoreService

GetAppList v1 (GET). The page documents it on `partner.steam-api.com` with "a Web API key". It also accepts a user key on `api.steampowered.com` (unverified on the fetched page).

Parameters: `key` (required), `if_modified_since`, `have_description_language`, `include_games` (on by default), `include_dlc`, `include_software`, `include_videos`, `include_hardware`, `last_appid`, and `max_results` (default 10,000, max 50,000).

Results are ordered by appid. To page, pass the last appid of the previous response as `last_appid`. The response field names `have_more_results` and `last_appid` are unverified. Only games are returned unless other `include_*` flags are set.

## ISteamNews

Source: https://partner.steamgames.com/doc/webapi/ISteamNews

GetNewsForApp v2 (GET, no key): `appid` (required), `maxlength` (0 = full content), `enddate`, `count` (default 20), and `feeds` (comma list). Older versions still respond but are no longer officially supported.

## ISteamRemoteStorage

Source: https://partner.steamgames.com/doc/webapi/ISteamRemoteStorage

| Method                  | Ver | HTTP             | Parameters                                 |
| ----------------------- | --- | ---------------- | ------------------------------------------ |
| GetPublishedFileDetails | v1  | POST (form body) | `itemcount`, `publishedfileids[0..]`       |
| GetCollectionDetails    | v1  | POST             | `collectioncount`, `publishedfileids[0..]` |

No `key` parameter is listed for these methods.

## IPublishedFileService

Source: https://partner.steamgames.com/doc/webapi/IPublishedFileService

QueryFiles v1 (GET, user key) parameters:

- `query_type` (EPublishedFileQueryType)
- `cursor` (`*` on the first request, then `next_cursor`)
- `page`
- `creator_appid`, `appid`
- `requiredtags`, `excludedtags`
- `search_text`
- `filetype`

GetDetails and GetUserFiles exist as service methods in `C:\src\third_party\steam-ecosystem\steam-protobufs\steam\steammessages_publishedfile.steamclient.proto`. Their public Web API exposure is not on the fetched page (unverified).

## IUserReviewsService

Source: https://partner.steamgames.com/doc/webapi/IUserReviewsService

GetAppReviews v1 (GET on `api.steampowered.com`). The key is optional:

- A publisher key for the app gets a higher rate limit.
- Keyless calls share a lower limit and get HTTP 429 when throttled.
- Anonymous responses may be cached for up to 10 minutes.

Parameters, passed via `input_json`:

- `appid` (required)
- `filter`, `cursor`, `num_per_page` (max 100), `day_range`
- `review_type`, `purchase_type`, `languages`, `filter_offtopic_activity`, `use_review_quality`
- `date_range_start`, `date_range_end`, `date_range_exclude`
- playtime and hardware filters
- `display_language`

The response has no `success` field, so check the HTTP status.

## ISteamWebAPIUtil (unverified)

The partner page for this interface was not fetched.

- `ISteamWebAPIUtil/GetServerInfo/v1`: returns server time. Useful for clock skew.
- `ISteamWebAPIUtil/GetSupportedAPIList/v1`: lists the interfaces and methods visible to the supplied key. With a publisher key it includes partner methods.

Call GetSupportedAPIList before concluding that a method exists or does not exist.

## ISteamEconomy and IEconService

- ISteamEconomy (GetAssetClassInfo, GetAssetPrices): needs `appid` and a key (unverified: the partner page was not fetched).
- IEconService GetTradeOffers, GetTradeOffer, GetTradeHistory, GetTradeOffersSummary (v1): implemented in `C:\src\third_party\steam-ecosystem\steam-rs\src\econ_service\`.

## ISteamDirectory

`ISteamDirectory/GetCMListForConnect/v1/?cellid=0` returns the CM server list. Source: `C:\src\third_party\steam-ecosystem\node-steam-session\src\transports\WebSocketCMTransport.ts`.

## Errors

| Status   | Meaning                                                                     | Source                                                        |
| -------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 400      | Missing or malformed parameter                                              | unverified                                                    |
| 403      | Missing or invalid key, publisher key required, or IP not on the allow list | https://partner.steamgames.com/doc/webapi_overview            |
| 429      | Rate limited                                                                | https://partner.steamgames.com/doc/webapi/IUserReviewsService |
| 500, 503 | Transient error; retry with backoff                                         | unverified                                                    |
