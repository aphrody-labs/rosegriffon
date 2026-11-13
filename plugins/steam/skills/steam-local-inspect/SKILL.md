---
name: steam-local-inspect
description: This skill should be used when the user asks to "inspect my Steam install", "where is Steam installed", "list my Steam games", "find the install folder, compatdata prefix or shadercache of appid X", "which manifest or buildid is installed", "decode StateFlags", or "show the cached appinfo entry of an installed app". For layout and format explanations, steam-client-windows applies.
argument-hint: "[root|libraries|apps|vdf|compat|env] [appid|filter|file]"
allowed-tools: Bash, Read
---

# Inspect the local Steam install

Read-only inspection of the Steam client on this machine (Windows, Linux, Flatpak, Snap,
macOS) through `ay steam` (JSON from the Rust parsers of `crates/steam-depot`, the only VDF,
ACF and appinfo parsers of the monorepo) and `ay gaming` (`packages/gaming`). The `steam` MCP
server calls the same code (docs/gaming/OWNERSHIP.md in aphrody-labs/src).

## Procedure

1. Locate Steam: `ay steam root`. `--root <dir>` or `STEAM_PATH` overrides the lookup;
   otherwise the order in [`references/layout.md`](references/layout.md) applies.
2. List libraries (`ay steam libraries`) and installed apps (`ay steam apps [--filter <text>]`).
   Apps come from `steamapps/appmanifest_<appid>.acf` in every library listed in
   `steamapps/libraryfolders.vdf`, with decoded StateFlags and installed depots.
3. For one app: `ay steam vdf <library>/steamapps/appmanifest_<appid>.acf` (full ACF) and the
   MCP tool `app_paths` (install dir, depotcache manifests, shadercache, workshop, compatdata/pfx,
   librarycache, userdata remote and screenshots).
4. For the PICS metadata cached by the client: `ay steam vdf <root>/appcache/appinfo.vdf --app <appid>`
   (appinfo.vdf v39 to v41, including the v41 string table).
5. Any other KeyValues file: `ay steam vdf <file>` (detects text or binary, e.g.
   `userdata/<accountid>/config/shortcuts.vdf`; `--format text|binary|appinfo` forces one).
6. Host summary (compat tools, Vulkan layers, DirectX, steamcmd): `ay gaming status`.

Output is JSON on stdout (`ay gaming` adds `--json`). Exit code 1 means no Steam install found,
a parse error or a refused file; 2 is a usage error.

## Rules

- Never read or print `config/config.vdf`, `config/loginusers.vdf`,
  `userdata/<accountid>/config/local.vdf` or `ssfn*` files: they hold login tokens or machine
  auth. `ay steam vdf` and the `read_vdf` MCP tool refuse them (`is_secret_file` in
  `crates/ay/src/low/steam.rs`, `isSecretFile` in `packages/gaming/src/steam.ts`).
- Treat everything as read-only. Close Steam before editing any file it owns.
- Prefer the MCP tools when the `steam` server is connected: `local_apps`, `app_paths`,
  `read_vdf`, `compat_tools`, `launch_env`. They return the same data.
- To decode a depot manifest found by `paths`, use the offline manifest commands in
  [`../steam-community-tools/references/tools.md`](../steam-community-tools/references/tools.md).

## Worked example

The verified IEVR example (AppID 2799860) is in [`references/layout.md`](references/layout.md).

## Additional Resources

- `references/layout.md`: files `ay steam` reads, field meanings and StateFlags bits.
- Related skills: steam-client-windows (full layout, binary formats), steam-linux-proton
  (compatdata and prefixes), steam-content-cdn (manifests and chunks).

## Sources

- `third_party/steamlocate-rs/src` (library discovery, StateFlag bit offsets)
- `third_party/steamappinfo/README.md` (appinfo.vdf v39 to v41 layout)
- `third_party/valvekeyvalue` (binary KeyValues type bytes)
- `crates/steam-depot/src/install.rs` and `crates/steam-depot/src/vdf.rs`
