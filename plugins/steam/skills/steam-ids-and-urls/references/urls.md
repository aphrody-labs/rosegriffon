# Steam URL forms

| Purpose        | Form                                                                   | Status             |
| -------------- | ---------------------------------------------------------------------- | ------------------ |
| Store page     | `https://store.steampowered.com/app/<appid>`                           | well known         |
| Store JSON     | `https://store.steampowered.com/api/appdetails?appids=<appid>`         | fetched 2026-11-12 |
| Profile        | `https://steamcommunity.com/profiles/<steamid64>`                      | well known         |
| Vanity profile | `https://steamcommunity.com/id/<vanity>`                               | well known         |
| Community hub  | `https://steamcommunity.com/app/<appid>`                               | well known         |
| Workshop item  | `https://steamcommunity.com/sharedfiles/filedetails/?id=<id>`          | well known         |
| CM list        | `https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/` | fetched 2026-11-12 |
| SteamDB        | via the `steamdb_link` MCP tool                                        | n/a                |

## Image assets

Observed in appdetails for 2799860 (fetched 2026-11-12):

- `header_image`: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2799860/d7e5240b6182e4a085a365503b22aefd2e6ae6cf/header.jpg?t=1764296831`
- `capsule_image`: `.../2799860/9ee2aa35c24c19588eec70c6f7ff94f6efa26b1f/capsule_231x87.jpg?t=1764296831`
- `capsule_imagev5`: `.../2799860/9ee2aa35c24c19588eec70c6f7ff94f6efa26b1f/capsule_184x69.jpg?t=1764296831`

A content hash segment sits between the AppID and the file name. Assets are hashed per upload, so a hardcoded template can 404.

Unverified forms (common in third-party code, not confirmed here):

- `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<appid>/header.jpg`
- `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<appid>/library_600x900.jpg`
- `https://cdn.cloudflare.steamstatic.com/steam/apps/<appid>/header.jpg`

Rule: fetch appdetails and use the returned field values.
