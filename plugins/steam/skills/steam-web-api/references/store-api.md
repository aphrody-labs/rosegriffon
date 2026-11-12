# Steam storefront JSON endpoints

The Steamworks Web API documentation does not cover these endpoints. The one exception is a deprecation notice for `appreviews`. They are internal endpoints used by the Steam store. They take no key, can change at any time, and are throttled per IP. Behaviour below without another cited source was observed with real calls on 2026-11-12.

## appdetails (undocumented)

```
GET https://store.steampowered.com/api/appdetails?appids=<appid>&cc=<country>&l=<language>&filters=<list>
```

Parameters:

- `appids`: one appid. Multiple ids work only with `filters=price_overview`: `appids=440,570&filters=basic` returned HTTP 400, the same ids with `filters=price_overview` returned 200.
- `cc`: two-letter country code. It sets the currency and regional pricing (`cc=fr` returned `price_overview.currency` `EUR`).
- `l`: language name such as `english` or `french` (`l=french` returned a French `short_description`).
- `filters`: comma list of top-level `data` keys to return (`filters=genres,release_date` returned only those two keys). `basic` returns the base fields.

Response: `{ "<appid>": { "success": true, "data": { "type", "name", "steam_appid", "is_free", "short_description", "header_image", "developers", "publishers", "price_overview", "platforms", "categories", "genres", "release_date", ... } } }`. An unknown appid (`appids=1`) returns `{"1":{"success":false}}` with no `data`.

Rate limit: undocumented. Valve publishes no figure; the endpoint is throttled per IP and answers HTTP 429 when over the limit.

Use the plugin tool `store_appdetails` and cache results per `(appid, cc, l)`. For catalogue-wide crawls, list ids with IStoreService/GetAppList first (https://partner.steamgames.com/doc/webapi/IStoreService) and pace the requests.

## packagedetails (undocumented)

```
GET https://store.steampowered.com/api/packagedetails?packageids=<subid>&cc=<country>
```

Keyed by package id: `{"<subid>":{"success":true,"data":{...}}}`. `packageids=469` returned the `data` keys `name`, `page_content`, `page_image`, `header_image`, `small_logo`, `apps`, `price`, `platforms`, `controller`, `release_date`.

## appreviews (deprecated)

```
GET https://store.steampowered.com/appreviews/<appid>?json=1&filter=...&language=...&cursor=*&num_per_page=...
```

This endpoint is deprecated. Use `IUserReviewsService/GetAppReviews/v1` instead. What changes:

- Parameters move into `input_json`, and string filters become enums.
- `language` becomes the `languages` list.
- There is no `success` field, so check the HTTP status.
- `author.num_games_owned` is no longer returned.
- `weighted_vote_score` is a number instead of a string.
- `refunded`, `total_matching`, and `day_range_used` are new.

Sources: https://partner.steamgames.com/doc/store/getreviews and https://partner.steamgames.com/doc/webapi/IUserReviewsService

A cookieless request to `appreviews/440?json=1&num_per_page=1` on 2026-11-12 was redirected to the HTML "Welcome to Steam" page instead of JSON. That is one more reason to use GetAppReviews.

Do not build production features on storefront endpoints without a fallback.
