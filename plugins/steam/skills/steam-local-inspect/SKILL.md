---
name: steam-local-inspect
description: This skill should be used when the user asks to "inspect my Steam install", "where is Steam installed", "list my Steam games", "list Steam libraries", "find the install folder of appid X", "read appmanifest", "which manifest or buildid is installed", "where are the saves, compatdata or shadercache for this game", or "dump appinfo.vdf for an app". It inspects the local Steam client install read-only with a bundled Bun script.
argument-hint: "[root|apps|app|paths|appinfo|libraries|vdf] [appid|filter|file]"
allowed-tools: Bash, Read
---

# Inspect the local Steam install

Read-only inspection of the Steam client on this machine (Windows, Linux, Flatpak, Snap,
macOS) through `${CLAUDE_PLUGIN_ROOT}/scripts/steam-inspect.ts`. The script uses Bun
built-ins only and shares its parsers with the `steam` MCP server (`lib/steam.ts`).

## Procedure

1. Locate Steam: `bun run ${CLAUDE_PLUGIN_ROOT}/scripts/steam-inspect.ts root`.
   Resolution order: `--steam-path <dir>`, `$STEAM_PATH`, Windows registry
   `HKCU\Software\Valve\Steam\SteamPath`, then `HKLM\SOFTWARE\WOW6432Node\Valve\Steam\InstallPath`,
   then `~/.steam/steam`, `~/.local/share/Steam`, the Flatpak path
   `~/.var/app/com.valvesoftware.Steam/.local/share/Steam`, Snap, and
   `~/Library/Application Support/Steam`.
2. List libraries (`libraries`) and installed apps (`apps [filter]`). Apps come from
   `steamapps/appmanifest_<appid>.acf` in every library listed in
   `steamapps/libraryfolders.vdf`.
3. For one app, run `app <appid>` (full ACF, decoded StateFlags, installed depots and
   manifest ids) and `paths <appid> [accountid]` (install dir, depotcache manifests,
   shadercache, workshop, compatdata/pfx, librarycache, userdata remote and screenshots).
4. For the PICS metadata cached by the client, run `appinfo <appid>` (parses
   `appcache/appinfo.vdf` v39 to v41, including the v41 string table).
5. To read any other KeyValues file as JSON, run `vdf <file>` (detects text or binary,
   e.g. `userdata/<accountid>/config/shortcuts.vdf`).

Output is JSON on stdout. Exit code 2 means a usage error or no Steam install found;
exit code 1 means the app is not installed or the file was refused.

## Rules

- Never read or print `config/config.vdf`, `config/loginusers.vdf` or `ssfn*` files: they
  hold login tokens. The script and the `read_vdf` MCP tool refuse them.
- Treat everything as read-only. Do not edit ACF files while Steam runs; the client
  rewrites them.
- Prefer the MCP tools when the `steam` server is connected: `local_apps`, `app_paths`,
  `read_vdf`. They return the same data.
- To decode a depot manifest found by `paths`, use `steamctl depot info -f <file>` or
  `steamroom files --manifest-file <file>` (see the steam-community-tools skill).

## Worked example (verified on this host, 2026-11-12)

`apps 2799860` returns INAZUMA ELEVEN: Victory Road, buildid 26031700, about 61 GB,
StateFlags 4 (FullyInstalled). `paths 2799860` shows the install in
`steamapps/common/INAZUMA ELEVEN Victory Road`, the depot manifest
`depotcache/2799861_5864006674348129563.manifest`, and Steam Cloud files under
`userdata/<accountid>/2799860/remote`. `appinfo 2799860` reads a v41 appinfo.vdf.

## Additional Resources

- `references/layout.md`: files the script reads, field meanings and StateFlags bits.
- Related skills: steam-client-windows (full layout, binary formats), steam-linux-proton
  (compatdata and prefixes), steam-content-cdn (manifests and chunks).

## Sources

- third_party/steam-ecosystem/steamlocate-rs/src (library discovery, StateFlag bit offsets)
- third_party/steam-ecosystem/steamappinfo/README.md (appinfo.vdf v39 to v41 layout)
- third_party/steam-ecosystem/valvekeyvalue (binary KeyValues type bytes)
- apps/rosegriffon/crates/bun-steam/src/install.rs and src/vdf.rs
