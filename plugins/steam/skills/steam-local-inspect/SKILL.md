---
name: steam-local-inspect
description: This skill should be used when the user asks to "inspect my Steam install", "where is Steam installed", "list my Steam games", "find the install folder, compatdata prefix or shadercache of appid X", "which manifest or buildid is installed", "decode StateFlags", or "show the cached appinfo entry of an installed app". For layout and format explanations, steam-client-windows applies.
argument-hint: "[root|apps|app|paths|appinfo|libraries|vdf] [appid|filter|file]"
allowed-tools: Bash, Read
---

# Inspect the local Steam install

Read-only inspection of the Steam client on this machine (Windows, Linux, Flatpak, Snap,
macOS) through `${CLAUDE_PLUGIN_ROOT}/scripts/steam-inspect.ts`. The script uses Bun
built-ins only and shares its parsers with the `steam` MCP server (`plugins/steam/lib/steam.ts`).

## Procedure

1. Locate Steam: `bun run ${CLAUDE_PLUGIN_ROOT}/scripts/steam-inspect.ts root`.
   `--steam-path <dir>` overrides the lookup; otherwise the order in
   [`references/layout.md`](references/layout.md) applies.
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
exit code 1 means `app` found no such installed app or `vdf` refused the file; `paths` and `appinfo` report a missing app in their JSON (`installed: false`, no `app` entry) with exit code 0.

## Rules

- Never read or print `config/config.vdf`, `config/loginusers.vdf`,
  `userdata/<accountid>/config/local.vdf` or `ssfn*` files: they hold login tokens or machine
  auth. The script and the `read_vdf` MCP tool refuse them (`isSecretFile` in
  `plugins/steam/lib/steam.ts`, `read_vdf` description in `plugins/steam/servers/steam-mcp.ts`).
- Treat everything as read-only. Close Steam before editing any file it owns.
- Prefer the MCP tools when the `steam` server is connected: `local_apps`, `app_paths`,
  `read_vdf`. They return the same data.
- To decode a depot manifest found by `paths`, use the offline manifest commands in
  [`../steam-community-tools/references/tools.md`](../steam-community-tools/references/tools.md).

## Worked example

The verified IEVR example (AppID 2799860) is in [`references/layout.md`](references/layout.md).

## Additional Resources

- `references/layout.md`: files the script reads, field meanings and StateFlags bits.
- Related skills: steam-client-windows (full layout, binary formats), steam-linux-proton
  (compatdata and prefixes), steam-content-cdn (manifests and chunks).

## Sources

- `third_party/steamlocate-rs/src` (library discovery, StateFlag bit offsets)
- `third_party/steamappinfo/README.md` (appinfo.vdf v39 to v41 layout)
- `third_party/valvekeyvalue` (binary KeyValues type bytes)
- `crates/steam-depot/src/install.rs` and `crates/steam-depot/src/vdf.rs`
