---
name: steam-community-tools
description: This skill should be used when the user asks to "download a depot", "find a depot manifest id", "open the SteamDB page for an app", "use SteamCMD to install a dedicated server", "compare DepotDownloader and steamroom", "pick a Steam client library", or "is this Steam library GPL". For the manifest and chunk format itself, steam-content-cdn applies.
---

# Steam community tools

Map a Steam task to the right community tool, respect each tool's license and usage policy, and
use the copies already installed for this repository. Detailed per-tool notes live in
[`references/tools.md`](references/tools.md); the selection table lives in [`references/decision-matrix.md`](references/decision-matrix.md).

Tools covered: SteamDB, SteamCMD, DepotDownloader, steamctl, steamroom, SteamKit2,
node-steam-user, ValvePython steam, steam-vent, steamworks-rs, ArchiSteamFarm, Steam ROM Manager,
Decky Loader, ProtonDB, protontricks, steam-tui and steam-lancache-prefill.

## Ground rules

1. Treat SteamDB as a read-only human reference: never fetch its pages programmatically, build
   links only. Its FAQ restrictions are summarised in [`references/tools.md`](references/tools.md) (SteamDB).
2. Get data from Steam itself instead: anonymous PICS and CDN access through steamroom,
   DepotDownloader, steamctl or a CM client library, as the SteamDB FAQ itself recommends
   (SteamKit or Steam Web APIs).
3. Check the license before reusing code. `apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)` is Apache-2.0. GPL-2.0
   (DepotDownloader) and LGPL-2.1 (SteamKit2) code is reference only and must not enter
   `bun-steam`; MIT and MIT/Apache-2.0 sources may be ported with attribution
   (`apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)/UPSTREAM.md`).
4. Run heavy downloads on `vps`, not on the local Windows host; the tools installed there are listed in [`references/tools.md`](references/tools.md).
5. Prefer anonymous login. Content of a paid app needs an account that owns a license
   (`apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)/UPSTREAM.md`: `-manifest-only` resolves AppInfo anonymously, content needs a license).

## SteamDB links: use `steamdb_link`

Use the plugin MCP tool `steamdb_link` to produce SteamDB URLs. It only builds links and never
requests the site. Hand the link to the user; do not read the page on their behalf. URL patterns
and their verification: [`references/tools.md`](references/tools.md) (SteamDB). For the related
tracking data (client and web resources), use the local mirror
`third_party/steam-ecosystem/steamtracking` (sparse, root files only, no license stated).

## Workflow: inspect or download depot content

1. Resolve the app: `steamroom info --app <appid>` (add `--os linux`, `--format json`).
2. List current manifests per branch: `steamroom manifests --app <appid> [--branch <name>]`.
3. List files without downloading: `steamroom files --app <appid> --depot <depotid>`; offline
   manifest reads are in [`references/tools.md`](references/tools.md) (steamroom, steamctl).
4. Download: `steamroom download --app <appid> --depot <depotid> [--manifest <id>] -o <dir>`;
   filter with `--file-regex` or `--filelist`, resume and check with `--verify`.
5. Cross-check with DepotDownloader when steamroom misbehaves:
   `DepotDownloader -app <appid> -depot <depotid> -manifest <id> -dir <dir> -validate`.
   For branches use `-branch <name>` (the `-beta` alias is covered in [`references/tools.md`](references/tools.md)).
6. Record manifest ids in commits or notes, never in SteamDB scrapes.

For a worked example with real ids, see
[../steam-local-inspect/references/layout.md](../steam-local-inspect/references/layout.md).

## Workflow: SteamCMD

Use SteamCMD for dedicated servers and official installs where a full app (not a single depot)
is needed; command syntax: [`references/tools.md`](references/tools.md) (SteamCMD).

## Workflow: choose a client library

- Rust: steam-vent, steam-rs (Web API), vdf-rs, steamlocate-rs, steamroom crates; steamworks-rs
  for Steamworks SDK features with a running client.
- JavaScript under Bun: node-steam-user and node-steam-session.
- Python: ValvePython steam and its CLI front end steamctl.
- C#: SteamKit2, reference only for `bun-steam`.

Licenses, source paths and notes per library: [`references/tools.md`](references/tools.md)
(Libraries and mirrored tools); reuse rules: [`references/decision-matrix.md`](references/decision-matrix.md).

## Workflow: Linux, Deck and Proton questions

ProtonDB (link only), protontricks, Decky Loader, Steam ROM Manager and steam-tui: purpose,
license and source in [`references/tools.md`](references/tools.md) (Ecosystem applications).
Proton prefix and runtime work: [`../steam-linux-proton/SKILL.md`](../steam-linux-proton/SKILL.md).

## Workflow: caching and bulk transfer

Use steam-lancache-prefill (MIT, C#) to warm a lancache. Cache rules and the local nginx port are documented once in
[../steam-content-cdn/references/lancache.md](../steam-content-cdn/references/lancache.md).

## ArchiSteamFarm caveat

ArchiSteamFarm is Apache-2.0 and describes itself as an application "with primary purpose of
farming Steam cards from multiple accounts simultaneously"
(https://github.com/JustArchiNET/ArchiSteamFarm). Its README makes no statement about Valve's terms. The Steam Subscriber Agreement section 4.C bars
"scripts, bots, macros, or other non-human-controlled systems" and earning rewards "without
genuine user input"; section 4.D allows Valve to restrict or terminate accounts
(https://store.steampowered.com/subscriber_agreement/, accessed 2026-11-12). Do not deploy it for this repository, and do not use it as a download tool.
steamctl `apps idle-games` / `idle-cards` carry the same caveat.

## Installed on vps for this repository

Tool versions and install locations on `vps` are listed once in [`references/tools.md`](references/tools.md).
Sources of every library above are mirrored under `third_party/steam-ecosystem/`.

## Additional Resources

- `references/tools.md`: per-tool purpose, commands, license, source path and install location.
- `references/decision-matrix.md`: "when to use which" table and license reuse matrix.

## Sources

- `apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)/UPSTREAM.md`
- `third_party/steam-ecosystem/{depotdownloader,steamroom,steamctl,steamkit,node-steam-user,node-steam-session,valvepython-steam,steam-vent,steamworks-rs,steam-lancache-prefill,steamtracking,vdf-rs,steamlocate-rs}/`
- https://steamdb.info/faq/
- https://developer.valvesoftware.com/wiki/SteamCMD (read in Chrome, accessed 2026-11-12)
- https://store.steampowered.com/subscriber_agreement/ (sections 4.C, 4.D)
- https://github.com/JustArchiNET/ArchiSteamFarm
- https://github.com/SteamGridDB/steam-rom-manager
- https://github.com/SteamDeckHomebrew/decky-loader
- https://github.com/Matoking/protontricks
- https://github.com/dmadisetti/steam-tui
- https://www.protondb.com (URL pattern checked from vps, 2026-11-12)
