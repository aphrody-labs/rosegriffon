# Steam community tools: reference

Local source root: `C:\src\third_party\steam-ecosystem\` (abbreviated `se/`).

## SteamDB

- Site: https://steamdb.info. No public API; contact partnerships@steamdb.info. No scraping or
  crawling, no auto-refreshing plugins, no full-data publication, no AI training on its data
  (https://steamdb.info/faq/).
- URL patterns: `/app/<id>/`, `/app/<id>/depots/`, `/depot/<id>/manifests/`, `/sub/<id>/`,
  `/patchnotes/<buildid>/`, `/calculator/` (unverified, not fetched).
- In this plugin: build links with the MCP tool `steamdb_link`; it does not fetch pages.
- Related: SteamTracking (`se/steamtracking`, sparse, no license stated, `UPSTREAM.md`).

## SteamCMD

- Valve's command-line Steam client. Docs: https://developer.valvesoftware.com/wiki/SteamCMD
  (HTTP 403 when fetched; syntax below unverified).
- `+force_install_dir <dir>` (before login), `+login anonymous`, `+app_update <id> [-beta <name>] validate`,
  `+app_info_print <id>`, `+download_depot <app> <depot> [<manifest>]`, `+quit`.
- Not listed as installed on vps (`UPSTREAM.md`).

## DepotDownloader (SteamRE)

- GPL-2.0 (`se/depotdownloader/LICENSE`). Built on SteamKit2.
- Args (`se/depotdownloader/README.md`): `-app <#>`, `-depot <#>`, `-manifest <id>` (needs
  `-depot`), `-branch <name>`, `-branchpassword <pass>`, `-ugc <#>`, `-pubfile <#>`,
  `-username <user>`, `-password <pass>`, `-remember-password`, `-qr`, `-os windows|macos|linux`,
  `-osarch 32|64`, `-all-platforms`, `-language`, `-dir <dir>`, `-filelist <file>` (`regex:`
  prefix supported), `-validate`, `-manifest-only`.
- `-beta` is not in the 3.x README; use `-branch` (older alias status unverified).
- vps: `DepotDownloader` 3.4.0 (`UPSTREAM.md`). Reference only for `bun-steam`.

## steamroom

- MIT OR Apache-2.0 (`se/steamroom/LICENSE-MIT`, `LICENSE-APACHE`). Rust cleanroom
  reimplementation of DepotDownloader made to avoid GPL (`se/steamroom/README.md`).
- Commands (`se/steamroom/README.md`): `login`, `download`, `info`, `manifests`,
  `save-manifest`, `files`, `diff`, `packages`, `workshop`, `local-info`.
- Examples: `steamroom info --app 730 --os linux --format json`;
  `steamroom manifests --app 480 --branch previous`;
  `steamroom download --app 480 --depot 481 --manifest <id> --file-regex '\.dll$' --verify -o out/`;
  `--branch-password`, `--max-downloads 16`, `--local-keys`.
- vps: steamroom-cli 0.3.0 (`UPSTREAM.md`).

## steamctl

- MIT (`se/steamctl/LICENSE`). Python CLI on ValvePython steam.
- Command groups (`se/steamctl/README.rst`): `apps` (activate_key, licenses list/add, list,
  product_info, idle-games, idle-cards), `authenticator` (add, remove, list, status, code),
  `clear`, `cloud` (list, list_apps), `depot` (info, list, download, diff), `hlmaster query`,
  `ugc info`, `webapi` (set-key, clear-key, list), `workshop` (search, info, download,
  subscribe, unsubscribe, favorite).
- Offline manifest read: `steamctl depot info -f <file.manifest>` (`UPSTREAM.md`).
- vps: steamctl 0.9.5, uv tool from commit 274a8db0 (`UPSTREAM.md`).

## Libraries

| Library            | Lang | License           | Source path             | Notes                                     |
| ------------------ | ---- | ----------------- | ----------------------- | ----------------------------------------- |
| SteamKit2          | C#   | LGPL-2.1          | `se/steamkit`           | EMsg, manifest format reference           |
| node-steam-user    | JS   | MIT               | `se/node-steam-user`    | CM client; runs under Bun (`UPSTREAM.md`) |
| node-steam-session | JS   | MIT               | `se/node-steam-session` | IAuthenticationService login              |
| ValvePython steam  | Py   | MIT               | `se/valvepython-steam`  | CM client and CDN                         |
| steam-vent         | Rust | MIT               | `se/steam-vent`         | GitHub archived, Codeberg upstream        |
| steamworks-rs      | Rust | MIT OR Apache-2.0 | `se/steamworks-rs`      | needs running Steam client                |
| steam-rs           | Rust | MIT               | `se/steam-rs`           | Web API                                   |

## Ecosystem applications (not mirrored locally)

| Tool                   | License    | Purpose                                                                | Source                                            |
| ---------------------- | ---------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| ArchiSteamFarm         | Apache-2.0 | card farming on multiple accounts; Steam terms risk (unverified)       | https://github.com/JustArchiNET/ArchiSteamFarm    |
| Steam ROM Manager      | GPL-3.0    | bulk game importer and artwork manager                                 | https://github.com/SteamGridDB/steam-rom-manager  |
| Decky Loader           | GPL-2.0    | plugin loader for the Steam Deck (game mode)                           | https://github.com/SteamDeckHomebrew/decky-loader |
| protontricks           | GPL-3.0    | winetricks for Proton prefixes                                         | https://github.com/Matoking/protontricks          |
| steam-tui              | MIT        | Rust TUI wrapper, requires steamcmd                                    | https://github.com/dmadisetti/steam-tui           |
| ProtonDB               | n/a        | Proton compatibility reports; official API not documented (unverified) | https://www.protondb.com                          |
| steam-lancache-prefill | MIT        | lancache prefill (C#)                                                  | `se/steam-lancache-prefill`                       |
