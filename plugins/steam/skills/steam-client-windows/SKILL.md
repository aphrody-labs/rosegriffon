---
name: steam-client-windows
description: This skill should be used when the user asks to "explain the Steam folder layout on Windows", "read libraryfolders.vdf", "parse an appmanifest", "explain the appinfo.vdf binary layout (magic, versions, string table)", "parse binary VDF", "check Steam logs", "launch steam.exe with -console", or mentions SteamPath, userdata, localconfig.vdf or steamwebhelper. To run the bundled inspector, steam-local-inspect applies.
---

# Steam client on Windows

Use this skill to locate, inspect and parse the files of a Windows Steam client install. Read-only handling rules: [`../steam-local-inspect/SKILL.md`](../steam-local-inspect/SKILL.md) (Rules).

Prefer the plugin MCP tools before shelling out:

- `local_apps`: list installed apps across all libraries (wraps `libraryfolders.vdf` plus every `appmanifest_*.acf`).
- `app_paths`: resolve install dir, manifest, compatdata/userdata paths for one app id.
- `read_vdf`: parse a text VDF/ACF or binary KV file into JSON.

They are implemented in `plugins/steam/servers/steam-mcp.ts` over `plugins/steam/lib/steam.ts` (text KV, binary KV and appinfo.vdf v39 to v41). Credential files that `read_vdf` refuses: [`../steam-local-inspect/SKILL.md`](../steam-local-inspect/SKILL.md) (Rules). The Rust equivalents live in `crates/steam-depot/src/vdf.rs` and `crates/steam-depot/src/install.rs`.

## 1. Locate the install

The full lookup order (environment, registry, per-OS fallbacks) is in [`../steam-local-inspect/references/layout.md`](../steam-local-inspect/references/layout.md). Windows registry details (verified with `reg query`, value names only, 2026-11-12):

- `HKCU\Software\Valve\Steam`: `SteamPath` (forward slashes, lower-cased, e.g. `c:/program files (x86)/steam`), `SteamExe`, `AutoLoginUser` (remembered account name, personal data), `RunningAppID` (DWORD, 0 when idle), `Language`, `SourceModInstallPath`, `SuppressAutoRun`, `Restart`, `GPUAccelWebViewsV3`, `SmoothScrollWebViews`. Subkeys `ActiveProcess` and `Apps`.
- `HKCU\Software\Valve\Steam\ActiveProcess`: `pid` (DWORD), `SteamClientDll`, `SteamClientDll64`, `Universe` (REG_SZ) and `ActiveUser` (DWORD).
- `HKLM\SOFTWARE\WOW6432Node\Valve\Steam`: `InstallPath` (backslashes), `SteamPID`, `Universe` (`Public`), `BetaName`, `Version` (QWORD), `Language`, subkeys `Apps` and `NSIS`.

Normalise `SteamPath` before comparing paths.

## 2. Root layout (verified on a local install)

- `steam.exe`, `steamclient.dll`/`steamclient64.dll`, `tier0_s*.dll`, `vstdlib_s*.dll`, `GameOverlayRenderer*.dll`, `gameoverlayui*.exe`, `steamerrorreporter*.exe`, `WriteMiniDump.exe`, `uninstall.exe`.
- `bin/`: helper binaries; `steamwebhelper.exe` lives in `bin/cef/cef.win64/` (also `cef.win7/` and `cef.win7x64/` builds).
- `steamapps/`: library 0. Contains `libraryfolders.vdf`, `appmanifest_<appid>.acf`, `common/`, `downloading/`, `temp/`, `shadercache/`, `workshop/`, `sourcemods/`.
- `appcache/`: `appinfo.vdf`, `packageinfo.vdf`, `librarycache/` (artwork per app), `httpcache/`, `stats/`.
- `config/`: `config.vdf`, `loginusers.vdf`, `libraryfolders.vdf` (copy), `DialogConfig*.vdf`, `avatarcache/`.
- `depotcache/`: depot manifests (file naming and worked example in [`../steam-local-inspect/references/layout.md`](../steam-local-inspect/references/layout.md)).
- `userdata/<accountid>/`: per-user data, where `<accountid>` is the 32-bit account id (conversion in [`../steam-ids-and-urls/references/steamid.md`](../steam-ids-and-urls/references/steamid.md)).
- `logs/`, `dumps/`, `package/` (client update packages), `steamui/`, `clientui/`, `tenfoot/` (Big Picture), `controller_base/`, `friends/`, `graphics/`, `resource/`, `public/`.

## 3. Libraries and manifests

`steamapps/libraryfolders.vdf` lists every library (fields: [../steam-local-inspect/references/layout.md](../steam-local-inspect/references/layout.md)). Iterate every entry; never assume a game sits in the root library. For each library, read `<path>/steamapps/appmanifest_<appid>.acf`; the game lives in `<path>/steamapps/common/<installdir>`.

`appmanifest_<appid>.acf` holds one `AppState` object (fields: [../steam-local-inspect/references/layout.md](../steam-local-inspect/references/layout.md)). Compare `buildid` with `TargetBuildID` to detect a pending update.

`StateFlags` is a bitmask; its bit table and common values are in [`../steam-local-inspect/references/layout.md`](../steam-local-inspect/references/layout.md).

## 4. Per-user data

Key paths below were checked by grepping key names only in the local files (2026-11-12).

- `userdata/<accountid>/config/localconfig.vdf`: root `UserLocalConfigStore`; per-app data under `Software/Valve/Steam/apps/<appid>` (`LastPlayed`, `Playtime`, `Playtime2wks`, `PlaytimeDisconnected`). No `LaunchOptions` key exists in that file on this host, where no launch options are set; the bare string `LaunchOptions` does appear in `steamclient64.dll`.
- `userdata/<accountid>/7/remote/sharedconfig.vdf`: cloud-synced client config (app 7 is the Steam client), root `UserRoamingConfigStore/Software/Valve/Steam`.
- `userdata/<accountid>/<appid>/`: see [`../steam-local-inspect/references/layout.md`](../steam-local-inspect/references/layout.md).
- Screenshots: the path pattern and how the plugin finds them are in [`../steam-local-inspect/references/layout.md`](../steam-local-inspect/references/layout.md) (Files table). `steamclient64.dll` strings also show files named `<name>_<n>.jpg` and a per-user `screenshots.vdf` index.
- `config/loginusers.vdf` and `config/config.vdf` exist but must never be read or printed ([`../steam-local-inspect/SKILL.md`](../steam-local-inspect/SKILL.md), Rules).

## 5. Logs and dumps

`logs/` (verified list) includes `content_log.txt` (downloads, depots, validation), `connection_log.txt` (CM connections), `console_log.txt`, `bootstrap_log.txt` (client self-update), `appinfo_log.txt`, `cloud_log.txt`, `cef_log.txt` and `webhelper.txt` (CEF UI), `gameprocess_log.txt` and `runprocess_log.txt` (game launch, exit codes), `shader_log.txt`, `stats_log.txt`, `streaming_log.txt`, `remote_connections.txt`, `gameoverlay_*.txt`, `controller*.txt`, `steamui_*.txt`, `system*manager.txt`. Read the tail only. `dumps/` holds client crash minidumps.

## 6. steam.exe flags and processes

From the Valve wiki page Command_line_options_(Steam) (Wayback snapshot 20251230201815):

- `-console`: enables the Steam debug console tab.
- `-dev`: sets `developer` to 1 (VGUI editor on F6, zoo on F7), also enables the console tab.
- `-silent`: silent startup, tray only.
- `-tcp`: forces the backend connection over TCP.
- `-clearbeta`: opts out of beta participation.
- `-noverifyfiles`: skips file integrity checks.
- `-forceservice`: runs the Steam Client Service even when Steam has admin rights.
- `-no-browser`: disables CEF; deprecated as of January 2023.
- `-cef-disable-gpu`: software rendering in CEF. `-cef-disable-gpu-compositing`: disables GPU compositing.
- `-applaunch <appid> [args]`: launches a game through Steam.
- `-login <user|anonymous> [password]`: Steam must be closed. Never pass a real password on a command line.

Prefer `steam://rungameid/<appid>` for launching a game through a running client (`crates/steam-depot/src/launch.rs`; it accepts only `steam://` URIs without quotes or control characters).

- `steamwebhelper.exe` (`bin/cef/cef.win64/`): Chromium Embedded Framework process tree that renders the client UI; `-cef-disable-gpu` is the documented switch for GPU rendering problems.
- Steam Client Service: `steamservice.exe` in `C:\Program Files (x86)\Common Files\Steam` (with `SteamService.dll` and `service_log.txt`, verified locally), the privileged helper used by `-forceservice`.

## 7. File formats

Text VDF, binary KeyValues type bytes, `appinfo.vdf` and `packageinfo.vdf` layouts are documented once in [`references/vdf-formats.md`](references/vdf-formats.md). Read it before writing a parser.

## Sources

- Local install `C:/Program Files (x86)/Steam` (directory listing, `bin/cef/`, `steamapps/libraryfolders.vdf`, `steamapps/appmanifest_2799860.acf`, `logs/`, key names in `localconfig.vdf` and `sharedconfig.vdf`, strings in `steamclient64.dll`), `C:/Program Files (x86)/Common Files/Steam`, `reg query` of `HKCU\Software\Valve\Steam`, `HKCU\Software\Valve\Steam\ActiveProcess`, `HKLM\SOFTWARE\WOW6432Node\Valve\Steam` (read 2026-11-12).
- https://web.archive.org/web/20251230201815/https://developer.valvesoftware.com/wiki/Command_line_options_(Steam) (accessed 2026-11-12; the live page is behind an Anubis bot check).
- `crates/steam-depot/src/vdf.rs`, `crates/steam-depot/src/install.rs`, `crates/steam-depot/src/launch.rs`.
