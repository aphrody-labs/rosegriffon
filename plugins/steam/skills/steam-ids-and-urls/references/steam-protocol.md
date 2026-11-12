# steam:// browser protocol

Primary source: https://developer.valvesoftware.com/wiki/Steam_browser_protocol. The page returned HTTP 403 to automated fetches on 2026-11-12, so every syntax below is (unverified) and must be confirmed in a browser before use.

| Command                     | Purpose                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `steam://run/<appid>`       | Launch an app; installs first if needed (unverified)              |
| `steam://rungameid/<appid>` | Launch by game ID; also used for non-Steam shortcuts (unverified) |
| `steam://install/<appid>`   | Open the install dialog (unverified)                              |
| `steam://uninstall/<appid>` | Uninstall prompt (unverified)                                     |
| `steam://validate/<appid>`  | Verify local files (unverified)                                   |
| `steam://store/<appid>`     | Open the store page in the client (unverified)                    |
| `steam://nav/<section>`     | Navigate client UI (unverified)                                   |
| `steam://open/<page>`       | Open a client page such as `friends` or `downloads` (unverified)  |
| `steam://url/<WebPageName>` | Open a named Steam web page (unverified)                          |

Do not invent further commands. Add rows only after reading the wiki page.
