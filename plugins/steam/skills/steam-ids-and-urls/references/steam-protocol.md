# steam:// browser protocol

Source: https://developer.valvesoftware.com/wiki/Steam_browser_protocol, read through the Wayback snapshot https://web.archive.org/web/20261020182138/https://developer.valvesoftware.com/wiki/Steam_browser_protocol (accessed 2026-11-12; the live wiki serves a bot challenge to automated clients).

| Command                     | Purpose (wiki wording, condensed)                                                   |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `steam://run/<id>//<args>/` | Runs an application, installing it if necessary; `//<args>` is optional launch args |
| `steam://rungameid/<id>`    | Same as run, with support for mods and non-Steam shortcuts                          |
| `steam://install/<id>`      | Installs an application (example: `steam://install/8230`)                           |
| `steam://uninstall/<id>`    | Deletes the specified apps' cache files                                             |
| `steam://validate/<id>`     | Validates the local files of an app                                                 |
| `steam://store/<id>`        | Opens the store for an app (default store page if no id)                            |
| `steam://nav/<component>`   | Opens a Steam window without making it active                                       |
| `steam://open/<component>`  | Opens a Steam window                                                                |
| `steam://url/<named page>`  | Opens a named Steam web page                                                        |

The same page also lists, among others: `advertise`, `appnews`, `backup`, `connect`, `defrag`, `flushconfig`, `friends`, `gameproperties`, `installaddon`, `launch`, `openurl`, `preload`, `purchase`, `removeaddon`, `runsafe`, `settings`, `subscriptioninstall`, `updatenews`. Read the page before using one of these.
