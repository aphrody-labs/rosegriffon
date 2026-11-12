# When to use which

| Need                                                        | First choice                                         | Fallback                                                 | Avoid                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Show a human the history of an app, depot, package or build | `steamdb_link` (SteamDB URL)                         | Steam store page                                         | fetching SteamDB                                             |
| Current manifest id per branch                              | `steamroom manifests --app <id>`                     | `DepotDownloader -manifest-only`                         | SteamDB scraping                                             |
| App info (depots, branches, OS)                             | `steamroom info --app <id> --format json`            | `steamcmd +app_info_print`, `steamctl apps product_info` |                                                              |
| List files of a depot                                       | `steamroom files`                                    | `steamctl depot list`                                    |                                                              |
| Read a local `.manifest` offline                            | `steamroom files --manifest-file`                    | `steamctl depot info -f`                                 |                                                              |
| Download one depot or old manifest                          | `steamroom download`                                 | `DepotDownloader -depot -manifest`                       |                                                              |
| Full app or dedicated server install                        | SteamCMD `app_update <id> validate`                  | DepotDownloader `-app`                                   |                                                              |
| Diff manifest against disk                                  | `steamroom diff`                                     | `steamctl depot diff`                                    |                                                              |
| Workshop item download                                      | `steamroom workshop`                                 | `DepotDownloader -pubfile`, `steamctl workshop download` |                                                              |
| Cloud files                                                 | `steamctl cloud list`                                | node-steam-user                                          |                                                              |
| Steam Guard codes                                           | `steamctl authenticator code`                        |                                                          | sharing secrets in logs                                      |
| Embed a CM client in Bun                                    | node-steam-user / node-steam-session                 | port from steam-vent                                     | copying SteamKit2/DepotDownloader                            |
| Embed in Rust (bun-steam)                                   | steamroom crates, steam-vent (port with attribution) | steam-rs for Web API                                     | GPL/LGPL code                                                |
| Steamworks SDK features                                     | steamworks-rs (local Windows, client running)        |                                                          | headless servers                                             |
| Proton compatibility                                        | ProtonDB (link only)                                 |                                                          | scraping ProtonDB                                            |
| Fix a Proton prefix                                         | protontricks                                         |                                                          |                                                              |
| Steam Deck game-mode plugins                                | Decky Loader                                         |                                                          |                                                              |
| Add emulators/non-Steam games                               | Steam ROM Manager                                    |                                                          |                                                              |
| Terminal library browser                                    | steam-tui (needs steamcmd)                           |                                                          |                                                              |
| Warm a lancache                                             | steam-lancache-prefill                               |                                                          |                                                              |
| Card idling                                                 | none for this repo                                   |                                                          | ArchiSteamFarm, steamctl idle (Steam terms risk, unverified) |

# License reuse for Apache-2.0 bun-steam

| License                            | Tools                                                                                                                                                               | Reuse in bun-steam                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| MIT, MIT OR Apache-2.0, Apache-2.0 | steamroom, steam-vent, steamworks-rs, steam-rs, steamctl, ValvePython steam, node-steam-user, node-steam-session, steam-lancache-prefill, steam-tui, ArchiSteamFarm | allowed with notice                        |
| LGPL-2.1                           | SteamKit2                                                                                                                                                           | reference only                             |
| GPL-2.0 / GPL-3.0                  | DepotDownloader, Decky Loader, protontricks, Steam ROM Manager                                                                                                      | reference only; running the binary is fine |
| none stated                        | SteamTracking                                                                                                                                                       | reference only                             |

Sources: `crates/bun-steam/UPSTREAM.md`, license files under `third_party/steam-ecosystem/`,
GitHub repository pages listed in `../SKILL.md`.
