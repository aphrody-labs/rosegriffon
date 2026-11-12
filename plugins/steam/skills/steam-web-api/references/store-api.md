# Steam storefront JSON endpoints

The Steamworks Web API documentation does not cover these endpoints. The one exception is a deprecation notice for `appreviews`. They are internal endpoints used by the Steam store. They take no key, can change at any time, and are throttled per IP. Anything below without a cited source is marked "(unverified)".

## appdetails (undocumented)

```
GET https://store.steampowered.com/api/appdetails?appids=<appid>&cc=<country>&l=<language>&filters=<list>
```

Parameters:

- `appids`: one appid. Multiple ids are only accepted with `filters=price_overview` (unverified, community-observed).
- `cc`: two-letter country code. It sets the currency and regional pricing (unverified).
- `l`: language name such as `english` or `french` (unverified).
- `filters`: comma list of top-level `data` keys to return, such as `basic,price_overview,categories,genres,release_date,platforms` (unverified).

Response: `{ "<appid>": { "success": true, "data": { "type", "name", "steam_appid", "is_free", "short_description", "header_image", "developers", "publishers", "price_overview", "platforms", "categories", "genres", "release_date", ... } } }`. `success: false` means the app is unknown, region-locked, or hidden (unverified).

Rate limit: about 200 requests per 5 minutes per IP is the commonly reported figure (unverified, Valve publishes no number). Going over returns 429 or 403, and sometimes a `null` body.

Use the plugin tool `store_appdetails` and cache results per `(appid, cc, l)`. For catalogue-wide crawls, list ids with IStoreService/GetAppList first (https://partner.steamgames.com/doc/webapi/IStoreService) and pace the requests.

## packagedetails (undocumented)

```
GET https://store.steampowered.com/api/packagedetails?packageids=<subid>&cc=<country>
```

Returns the package (sub) name, price, and contained apps, keyed by package id (unverified).

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

## Other storefront endpoints (unverified)

- `https://store.steampowered.com/api/featured/` and `/api/featuredcategories/`: front-page lists.
- `https://store.steampowered.com/api/appuserdetails/`: needs a logged-in store cookie.

Do not build production features on these without a fallback.
