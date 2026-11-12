# Steam community tools: reference

Local source root: `third_party/steam-ecosystem/`.

## SteamDB

- Site: https://steamdb.info. No public API; contact partnerships@steamdb.info. No scraping or
  crawling, no auto-refreshing plugins, no full-data publication, no AI training on its data
  (https://steamdb.info/faq/).
- URL patterns: `/app/<id>/`, `/app/<id>/depots/`, `/depot/<id>/manifests/`, `/sub/<id>/`
  (each has an HTTP 200 Wayback capture, archive.org availability API, checked 2026-11-12).
  The live site returned HTTP 403 to `curl -I` from vps and a Cloudflare challenge in the
  browser (2026-11-12), which was not bypassed.
- In this plugin: build links with the MCP tool `steamdb_link`; it does not fetch pages.
- Related: SteamTracking (`third_party/steam-ecosystem/steamtracking`, sparse, no license stated, `apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)/UPSTREAM.md`).

## SteamCMD

- Valve's command-line Steam client. Docs: https://developer.valvesoftware.com/wiki/SteamCMD
  (read in Chrome, accessed 2026-11-12).
- `+force_install_dir <dir>` (before login), `+login anonymous`,
  `+app_update <id> [-beta <name>] [-betapassword <pass>] [validate]`, `+app_set_config`,
  `+@sSteamCmdForcePlatformType windows|macos|linux`, `+runscript <file>`, `+quit`.
- vps: `/usr/games/steamcmd` (checked 2026-11-12).
- Never pass a real password or branch password on a command line; prefer
  `+login anonymous` where the content allows it.

## DepotDownloader (SteamRE)

- GPL-2.0 (`third_party/steam-ecosystem/depotdownloader/LICENSE`). Built on SteamKit2.
- Never pass a real password on a command line: use `-qr` or `-remember-password`
  (both listed below) instead of `-password`.
- Args (`third_party/steam-ecosystem/depotdownloader/README.md`): `-app <#>`, `-depot <#>`, `-manifest <id>` (needs
  `-depot`), `-branch <name>`, `-branchpassword <pass>`, `-ugc <#>`, `-pubfile <#>`,
  `-username <user>`, `-password <pass>`, `-remember-password`, `-qr`, `-os windows|macos|linux`,
  `-osarch 32|64`, `-all-platforms`, `-language`, `-dir <dir>`, `-filelist <file>` (`regex:`
  prefix supported), `-validate`, `-manifest-only`.
- `-beta` / `-betapassword` are not in the 3.x README or `--help`, but `Program.cs` (lines 249-250)
  still accepts them as aliases of `-branch` / `-branchpassword`. Prefer `-branch`.
- vps: `DepotDownloader` 3.4.0 (`apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)/UPSTREAM.md`). Reference only for `bun-steam`.

## steamroom

- MIT OR Apache-2.0 (`third_party/steam-ecosystem/steamroom/LICENSE-MIT`, `LICENSE-APACHE`). Rust cleanroom
  reimplementation of DepotDownloader made to avoid GPL (`third_party/steam-ecosystem/steamroom/README.md`).
- Commands (`third_party/steam-ecosystem/steamroom/README.md`): `login`, `download`, `info`, `manifests`,
  `save-manifest`, `files`, `diff`, `packages`, `workshop`, `local-info`.
- Examples: `steamroom info --app 730 --os linux --format json`;
  `steamroom manifests --app 480 --branch previous`;
  `steamroom download --app 480 --depot 481 --manifest <id> --file-regex '\.dll$' --verify -o out/`;
  `--branch-password`, `--max-downloads 16`, `--local-keys`.
- Offline manifest read: `steamroom files --manifest-file <file.manifest>` (`third_party/steam-ecosystem/steamroom/README.md`).
- vps: steamroom-cli 0.3.0 (`apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)/UPSTREAM.md`).

## steamctl

- MIT (`third_party/steam-ecosystem/steamctl/LICENSE`). Python CLI on ValvePython steam.
- Command groups (`third_party/steam-ecosystem/steamctl/README.rst`): `apps` (activate_key, licenses list/add, list,
  product_info, idle-games, idle-cards), `authenticator` (add, remove, list, status, code),
  `clear`, `cloud` (list, list_apps), `depot` (info, list, download, diff), `hlmaster query`,
  `ugc info`, `webapi` (set-key, clear-key, list), `workshop` (search, info, download,
  subscribe, unsubscribe, favorite).
- Offline manifest read: `steamctl depot info -f <file.manifest>` (`apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)/UPSTREAM.md`).
- vps: steamctl 0.9.5, uv tool from commit 274a8db0 (`apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)/UPSTREAM.md`).

## Libraries and mirrored tools

| Library                | Lang | License           | Source path                                          | Notes                                                                       |
| ---------------------- | ---- | ----------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| SteamKit2              | C#   | LGPL-2.1          | `third_party/steam-ecosystem/steamkit`               | EMsg, manifest format reference                                             |
| node-steam-user        | JS   | MIT               | `third_party/steam-ecosystem/node-steam-user`        | CM client; runs under Bun (`apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)/UPSTREAM.md`) |
| node-steam-session     | JS   | MIT               | `third_party/steam-ecosystem/node-steam-session`     | IAuthenticationService login                                                |
| ValvePython steam      | Py   | MIT               | `third_party/steam-ecosystem/valvepython-steam`      | CM client and CDN                                                           |
| steam-vent             | Rust | MIT               | `third_party/steam-ecosystem/steam-vent`             | repository is Codeberg (`Cargo.toml`)                                       |
| steamworks-rs          | Rust | MIT OR Apache-2.0 | `third_party/steam-ecosystem/steamworks-rs`          | needs running Steam client                                                  |
| steam-rs               | Rust | MIT               | `third_party/steam-ecosystem/steam-rs`               | Web API                                                                     |
| vdf-rs                 | Rust | MIT OR Apache-2.0 | `third_party/steam-ecosystem/vdf-rs`                 | text VDF parser (`keyvalues-parser`)                                        |
| steamlocate-rs         | Rust | MIT               | `third_party/steam-ecosystem/steamlocate-rs`         | library discovery, StateFlags                                               |
| steam-lancache-prefill | C#   | MIT               | `third_party/steam-ecosystem/steam-lancache-prefill` | lancache prefill                                                            |

License sources: `third_party/steam-ecosystem/vdf-rs/keyvalues-parser/Cargo.toml`, `third_party/steam-ecosystem/vdf-rs/LICENSE-MIT`, `third_party/steam-ecosystem/vdf-rs/LICENSE-APACHE`; `third_party/steam-ecosystem/steamlocate-rs/Cargo.toml`, `third_party/steam-ecosystem/steamlocate-rs/LICENSE`; `third_party/steam-ecosystem/steam-lancache-prefill/LICENSE`; `third_party/steam-ecosystem/steam-vent/Cargo.toml` (`repository`).

## Ecosystem applications (not mirrored locally)

| Tool              | License    | Purpose                                                                                                                                                                                                                                   | Source                                            |
| ----------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| ArchiSteamFarm    | Apache-2.0 | card farming on multiple accounts; conflicts with SSA 4.C                                                                                                                                                                                 | https://github.com/JustArchiNET/ArchiSteamFarm    |
| Steam ROM Manager | GPL-3.0    | bulk game importer and artwork manager                                                                                                                                                                                                    | https://github.com/SteamGridDB/steam-rom-manager  |
| Decky Loader      | GPL-2.0    | plugin loader for the Steam Deck (game mode)                                                                                                                                                                                              | https://github.com/SteamDeckHomebrew/decky-loader |
| protontricks      | GPL-3.0    | winetricks for Proton prefixes: `protontricks <APPID> <ACTIONS>` passes the actions to winetricks, `protontricks -c <COMMAND> <APPID>` runs a command in the prefix (https://github.com/Matoking/protontricks README, fetched 2026-11-12) | https://github.com/Matoking/protontricks          |
| steam-tui         | MIT        | Rust TUI wrapper, requires steamcmd                                                                                                                                                                                                       | https://github.com/dmadisetti/steam-tui           |
| ProtonDB          | n/a        | Proton compatibility reports; link `/app/<appid>` only, no scraping                                                                                                                                                                       | https://www.protondb.com                          |
