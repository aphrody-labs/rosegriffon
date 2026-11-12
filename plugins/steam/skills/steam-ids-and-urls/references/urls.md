# Steam URL forms

| Purpose        | Form                                                           | Status                                                                                                                     |
| -------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Store page     | `https://store.steampowered.com/app/<appid>`                   | GET 200 for 2799860 (curl, 2026-11-12)                                                                                     |
| Store JSON     | `https://store.steampowered.com/api/appdetails?appids=<appid>` | fetched 2026-11-12; limits in [`../../steam-web-api/references/store-api.md`](../../steam-web-api/references/store-api.md) |
| Profile        | `https://steamcommunity.com/profiles/<steamid64>`              | GET 200 for 76561197960287930 (curl, 2026-11-12)                                                                           |
| Vanity profile | `https://steamcommunity.com/id/<vanity>`                       | GET 200 for `gabelogannewell` (curl, 2026-11-12)                                                                           |
| Community hub  | `https://steamcommunity.com/app/<appid>`                       | GET 200 for 2799860 (curl, 2026-11-12)                                                                                     |
| Workshop item  | `https://steamcommunity.com/sharedfiles/filedetails/?id=<id>`  | GET 200 for 1911784383 (curl, 2026-11-12)                                                                                  |
| CM list        | see [`cm-servers.md`](cm-servers.md)                           | n/a                                                                                                                        |
| SteamDB        | via the `steamdb_link` MCP tool                                | n/a                                                                                                                        |

## Image assets

Observed in appdetails for 2799860, the test app of [`../../steam-local-inspect/references/layout.md`](../../steam-local-inspect/references/layout.md) (fetched 2026-11-12):

- `header_image`: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2799860/d7e5240b6182e4a085a365503b22aefd2e6ae6cf/header.jpg?t=1764296831`
- `capsule_image`: `.../2799860/9ee2aa35c24c19588eec70c6f7ff94f6efa26b1f/capsule_231x87.jpg?t=1764296831`
- `capsule_imagev5`: `.../2799860/9ee2aa35c24c19588eec70c6f7ff94f6efa26b1f/capsule_184x69.jpg?t=1764296831`

A content hash segment sits between the AppID and the file name. Assets are hashed per upload, so a hardcoded template can 404.

Unhashed forms: HEAD requests on 2026-11-12 returned HTTP 200 for app 2799860 on all four:

- `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<appid>/header.jpg`
- `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<appid>/library_600x900.jpg`
- `https://cdn.cloudflare.steamstatic.com/steam/apps/<appid>/header.jpg`
- `https://cdn.cloudflare.steamstatic.com/steam/apps/<appid>/library_600x900.jpg`

One app answering 200 does not mean every app has every asset. Rule: prefer the appdetails field values, and HEAD-check any unhashed URL before use.
