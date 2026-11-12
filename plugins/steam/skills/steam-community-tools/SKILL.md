---
name: steam-community-tools
description: This skill should be used when the user asks to "download a Steam depot", "find a depot manifest id", "open the SteamDB page for an app", "use SteamCMD to install a dedicated server", "compare DepotDownloader and steamroom", "list files in a Steam manifest", "pick a Steam client library", "check a game on ProtonDB", "run protontricks for an app id", "prefill a lancache", "is this Steam library GPL", or needs to choose between SteamDB, SteamCMD, DepotDownloader, steamctl, steamroom, SteamKit2, node-steam-user, ValvePython steam, steam-vent, steamworks-rs, ArchiSteamFarm, Steam ROM Manager, Decky Loader, ProtonDB, protontricks, steam-tui or steam-lancache-prefill. For the manifest and chunk format itself, steam-content-cdn applies.
---

# Steam community tools

Map a Steam task to the right community tool, respect each tool's license and usage policy, and
use the copies already installed for this repository. Detailed per-tool notes live in
`references/tools.md`; the selection table lives in `references/decision-matrix.md`.

## Ground rules

1. Treat SteamDB as a read-only human reference. It has no public API, and its FAQ states
   "We also do not allow scraping/crawling on SteamDB", forbids auto-refreshing plugins, and
   prohibits publishing the data in its entirety or using it to train AI models
   (https://steamdb.info/faq/). Never fetch SteamDB pages programmatically. Build links only.
2. Get data from Steam itself instead: anonymous PICS and CDN access through steamroom,
   DepotDownloader, steamctl or a CM client library, as the SteamDB FAQ itself recommends
   (SteamKit or Steam Web APIs).
3. Check the license before reusing code. `crates/bun-steam` is Apache-2.0. GPL-2.0
   (DepotDownloader) and LGPL-2.1 (SteamKit2) code is reference only and must not enter
   `bun-steam`; MIT and MIT/Apache-2.0 sources may be ported with attribution
   (`crates/bun-steam/UPSTREAM.md`).
4. Run heavy downloads on `vps`, not on the local Windows host (repo memory: remote build hosts).
5. Prefer anonymous login. Content of a paid app needs an account that owns a license
   (`UPSTREAM.md`: `-manifest-only` resolves AppInfo anonymously, content needs a license).

## SteamDB links: use `steamdb_link`

Use the plugin MCP tool `steamdb_link` to produce SteamDB URLs. It only builds links and never
requests the site. Known URL patterns:

| Page                   | Pattern                                           |
| ---------------------- | ------------------------------------------------- |
| App overview           | `https://steamdb.info/app/<appid>/`               |
| App depots             | `https://steamdb.info/app/<appid>/depots/`        |
| Depot manifest history | `https://steamdb.info/depot/<depotid>/manifests/` |
| Package (sub)          | `https://steamdb.info/sub/<subid>/`               |
| Patch notes for build  | `https://steamdb.info/patchnotes/<buildid>/`      |
| Profile calculator     | `https://steamdb.info/calculator/`                |

These patterns follow SteamDB's public navigation; they were not
re-fetched for this skill (unverified). Hand the link to the user; do not read the page on
their behalf. For the related tracking data (client and web resources), use the local mirror
`third_party/steam-ecosystem/steamtracking` (sparse, root files only, no license stated).

## Workflow: inspect or download depot content

1. Resolve the app: `steamroom info --app <appid>` (add `--os linux`, `--format json`).
2. List current manifests per branch: `steamroom manifests --app <appid> [--branch <name>]`.
3. List files without downloading: `steamroom files --app <appid> --depot <depotid>`, or offline
   with `steamroom files --manifest-file <path>` or `steamctl depot info -f <path>`.
4. Download: `steamroom download --app <appid> --depot <depotid> [--manifest <id>] -o <dir>`;
   filter with `--file-regex` or `--filelist`, resume and check with `--verify`.
5. Cross-check with DepotDownloader when steamroom misbehaves:
   `DepotDownloader -app <appid> -depot <depotid> -manifest <id> -dir <dir> -validate`.
   DepotDownloader 3.x names branches with `-branch <name>` and `-branchpassword`; the older
   `-beta` spelling is not in the current README (`third_party/steam-ecosystem/depotdownloader/README.md`).
6. Record manifest ids in commits or notes, never in SteamDB scrapes.

Verified example (`UPSTREAM.md`): AppID 2799860, depot 2799861, public manifest
5864006674348129563, 1003 files, 61 GB.

## Workflow: SteamCMD

Use SteamCMD for dedicated servers and official installs where a full app (not a single depot)
is needed. Per https://developer.valvesoftware.com/wiki/SteamCMD (page returned HTTP 403 when
fetched for this skill, so syntax below is from prior knowledge, unverified):

```sh
steamcmd +force_install_dir /srv/game +login anonymous +app_update <appid> validate +quit
steamcmd +force_install_dir /srv/game +login anonymous +app_update <appid> -beta <branch> validate +quit
steamcmd +login anonymous +app_info_print <appid> +quit
steamcmd +login anonymous +download_depot <appid> <depotid> [<manifestid>] +quit
```

Put `+force_install_dir` before `+login` (unverified, commonly documented). SteamCMD is not
installed on vps per `UPSTREAM.md`; install it before relying on it.

## Workflow: choose a client library

- Rust, Apache-2.0-compatible reuse: steam-vent (MIT; GitHub archived, Codeberg upstream),
  steam-rs (MIT, Web API), vdf-rs, steamlocate-rs, steamroom crates (MIT OR Apache-2.0).
- Steamworks SDK features (Workshop UGC, Remote Storage) with a running client: steamworks-rs
  (MIT OR Apache-2.0), local Windows host only.
- JavaScript under Bun: node-steam-user and node-steam-session (MIT) for anonymous PICS,
  Workshop details, Cloud and the IAuthenticationService login flow.
- Python: ValvePython steam (MIT), and its CLI front end steamctl.
- C#: SteamKit2 (LGPL-2.1). Read `SteamKit2/Base/Generated` and `DepotManifest.cs` for EMsg
  values and the manifest format; do not copy code into `bun-steam`.

## Workflow: Linux, Deck and Proton questions

- Proton compatibility: send the user to ProtonDB (`https://www.protondb.com/app/<appid>`,
  pattern unverified). ProtonDB has no documented official public API (unverified); community
  report dumps exist (unverified). Do not scrape it.
- Prefix fixes: `protontricks <appid> <actions>`, search with `protontricks -s <name>`, launch
  an exe with `protontricks-launch --appid <appid> <program>` (GPL-3.0,
  https://github.com/Matoking/protontricks).
- Steam Deck game-mode plugins: Decky Loader (GPL-2.0, "A plugin loader for the Steam Deck",
  https://github.com/SteamDeckHomebrew/decky-loader).
- Non-Steam games and emulators in the library, with artwork: Steam ROM Manager (GPL-3.0,
  https://github.com/SteamGridDB/steam-rom-manager).
- Terminal UI: steam-tui (MIT, Rust) is a wrapper around steamcmd and requires it
  (https://github.com/dmadisetti/steam-tui).

## Workflow: caching and bulk transfer

Use steam-lancache-prefill (MIT, C#) to warm a lancache, with the Alpine nginx port of the
lancache rules in `infra/docker/lancache/` (`UPSTREAM.md`).

## ArchiSteamFarm caveat

ArchiSteamFarm is Apache-2.0 and describes itself as an application "with primary purpose of
farming Steam cards from multiple accounts simultaneously"
(https://github.com/JustArchiNET/ArchiSteamFarm). Its README makes no statement about the Steam
Subscriber Agreement. Card idling and multi-account automation may conflict with Valve's terms
(unverified). Do not deploy it for this repository, and do not use it as a download tool.
steamctl `apps idle-games` / `idle-cards` carry the same caveat.

## Installed on vps for this repository

Per `crates/bun-steam/UPSTREAM.md`, in `~/.local/bin` on `vps`:

- `DepotDownloader` 3.4.0, self-contained linux-x64 single file, built on prd.
- `steamroom` (steamroom-cli 0.3.0), static-pie musl, built on prd.
- `steamctl` 0.9.5, `uv tool install` from git at commit 274a8db0.

Sources of every library above are mirrored under `C:\src\third_party\steam-ecosystem\`.

## Additional Resources

- `references/tools.md`: per-tool purpose, commands, license, source path and install location.
- `references/decision-matrix.md`: "when to use which" table and license reuse matrix.

## Sources

- `C:\src\apps\rosegriffon\crates\bun-steam\UPSTREAM.md`
- `C:\src\third_party\steam-ecosystem\{depotdownloader,steamroom,steamctl,steamkit,node-steam-user,node-steam-session,valvepython-steam,steam-vent,steamworks-rs,steam-lancache-prefill,steamtracking}\`
- https://steamdb.info/faq/
- https://developer.valvesoftware.com/wiki/SteamCMD (HTTP 403 at fetch time)
- https://github.com/JustArchiNET/ArchiSteamFarm
- https://github.com/SteamGridDB/steam-rom-manager
- https://github.com/SteamDeckHomebrew/decky-loader
- https://github.com/Matoking/protontricks
- https://github.com/dmadisetti/steam-tui
- https://www.protondb.com (not fetched; claims marked unverified)
