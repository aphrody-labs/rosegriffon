---
name: steam-client-windows
description: This skill should be used when the user asks to "find the Steam install path on Windows", "read libraryfolders.vdf", "parse an appmanifest", "decode StateFlags", "where does Steam store saves or screenshots", "read appinfo.vdf", "parse binary VDF", "check Steam logs", "find which library a game is in", "launch steam.exe with -console", or mentions SteamPath, SteamExe, AutoLoginUser, steamapps/common, depotcache, userdata, localconfig.vdf, steamwebhelper or steamservice on Windows. To run the bundled inspector on the local install, steam-local-inspect applies.
---

# Steam client on Windows

Use this skill to locate, inspect and parse the files of a Windows Steam client install. Treat every Steam directory as read-only unless the user explicitly asks for a change, and close Steam before editing any file Steam owns: the client rewrites most of them on exit.

Prefer the plugin MCP tools before shelling out:

- `local_apps`: list installed apps across all libraries (wraps `libraryfolders.vdf` plus every `appmanifest_*.acf`).
- `app_paths`: resolve install dir, manifest, compatdata/userdata paths for one app id.
- `read_vdf`: parse a text VDF/ACF or binary KV file into JSON.

They are implemented in `servers/steam-mcp.ts` over `lib/steam.ts` (text KV, binary KV and appinfo.vdf v39 to v41); `read_vdf` refuses `config.vdf`, `loginusers.vdf` and `ssfn*`. The Rust equivalents live in `crates/bun-steam/src/vdf.rs` and `install.rs`.

## 1. Locate the install

Resolve the root in this order:

1. `HKCU\Software\Valve\Steam`: `SteamPath` (forward slashes, lower-cased, e.g. `c:/program files (x86)/steam`) and `SteamExe`. Also present: `AutoLoginUser` (account name of the remembered login, treat as personal data), `RunningAppID` (DWORD, 0 when idle), `Language`, `SourceModInstallPath`, `SuppressAutoRun`, `Restart`. Subkeys `ActiveProcess` and `Apps`. Verified with `reg query` on a local install.
2. `HKLM\SOFTWARE\WOW6432Node\Valve\Steam`: `InstallPath` (backslashes), `SteamPID`, `Universe` (`Public`), `BetaName`, `Version` (QWORD), `Language`, subkeys `Apps` and `NSIS`. Verified locally.
3. Fallback `C:\Program Files (x86)\Steam`.

The `ActiveProcess` key is documented elsewhere as holding `pid`, `SteamClientDll`, `SteamClientDll64` and `ActiveUser` while Steam runs (unverified: the key was empty on the inspected machine with Steam closed). Normalise `SteamPath` before comparing paths.

## 2. Root layout (verified on a local install)

- `steam.exe`, `steamclient.dll`/`steamclient64.dll`, `tier0_s*.dll`, `vstdlib_s*.dll`, `GameOverlayRenderer*.dll`, `gameoverlayui*.exe`, `steamerrorreporter*.exe`, `WriteMiniDump.exe`, `uninstall.exe`.
- `bin/`: helper binaries; `bin/cef/` holds `steamwebhelper.exe` (unverified path on this machine; not listed).
- `steamapps/`: library 0. Contains `libraryfolders.vdf`, `appmanifest_<appid>.acf`, `common/`, `downloading/`, `temp/`, `shadercache/`, `workshop/`, `sourcemods/`.
- `appcache/`: `appinfo.vdf`, `packageinfo.vdf`, `librarycache/` (artwork per app), `httpcache/`, `stats/`.
- `config/`: `config.vdf`, `loginusers.vdf`, `libraryfolders.vdf` (copy), `DialogConfig*.vdf`, `avatarcache/`.
- `depotcache/`: depot manifests named `<depotid>_<manifestid>.manifest` (verified locally: `2799861_5864006674348129563.manifest` for AppID 2799860).
- `userdata/<accountid>/`: per-user data, where `<accountid>` is the 32-bit account id (SteamID64 minus 76561197960265728).
- `logs/`, `dumps/`, `package/` (client update packages), `steamui/`, `clientui/`, `tenfoot/` (Big Picture), `controller_base/`, `friends/`, `graphics/`, `resource/`, `public/`.

## 3. Libraries and manifests

`steamapps/libraryfolders.vdf` has a root `libraryfolders` object keyed `"0"`, `"1"`, ... Each entry holds `path`, `label`, `contentid`, `totalsize`, `update_clean_bytes_tally`, `time_last_update_verified`, and `apps { "<appid>" "<size bytes>" }`. Iterate every entry; never assume a game sits in the root library. For each library, read `<path>/steamapps/appmanifest_<appid>.acf`; the game lives in `<path>/steamapps/common/<installdir>`.

`appmanifest_<appid>.acf` root object `AppState`, fields seen on a real manifest (app 2799860): `appid`, `Universe`, `LauncherPath`, `name`, `StateFlags`, `installdir`, `LastUpdated`, `LastPlayed`, `SizeOnDisk`, `StagingSize`, `buildid`, `LastOwner` (SteamID64), `DownloadType`, `UpdateResult`, `BytesToDownload`, `BytesDownloaded`, `BytesToStage`, `BytesStaged`, `TargetBuildID`, `AutoUpdateBehavior`, `AllowOtherDownloadsWhileRunning`, `ScheduledAutoUpdate`, `InstalledDepots { <depot> { manifest size } }`, `InstallScripts`, `SharedDepots { <depot> <owning appid> }`, `UserConfig`, `MountedConfig` (e.g. `language`). Compare `buildid` with `TargetBuildID` to detect a pending update.

`StateFlags` is a bitmask. SteamKit2 does not define an `EAppState` enum in the vendored copy (grep found none); the values below come from `steamlocate-rs` (`src/app.rs`, bit order Uninstalled, UpdateRequired, FullyInstalled, Encrypted, ...) and `bun-steam` (`install.rs` `state_flags`):

| Bit | Value | Meaning        |
| --- | ----- | -------------- |
| 0   | 1     | Uninstalled    |
| 1   | 2     | UpdateRequired |
| 2   | 4     | FullyInstalled |
| 3   | 8     | Encrypted      |
| 4   | 16    | Locked         |
| 5   | 32    | FilesMissing   |
| 6   | 64    | AppRunning     |
| 7   | 128   | FilesCorrupt   |
| 8   | 256   | UpdateRunning  |
| 9   | 512   | UpdatePaused   |
| 10  | 1024  | UpdateStarted  |
| 11  | 2048  | Uninstalling   |
| 12  | 4096  | BackupRunning  |

`4` alone means installed and idle. `6` means installed with an update required. The full bit table (bits 0 to 23) is in `steam-local-inspect/references/layout.md`.

## 4. Per-user data

- `userdata/<accountid>/config/localconfig.vdf`: per-user client settings, including per-app `LaunchOptions` and playtime (key paths unverified).
- `userdata/<accountid>/7/remote/sharedconfig.vdf`: cloud-synced client config (app 7 is the Steam client), with categories/collections (unverified detail).
- `userdata/<accountid>/<appid>/remote/`: Steam Cloud files of that game; `remotecache.vdf` sits next to it.
- `userdata/<accountid>/760/remote/<appid>/screenshots/`: Steam screenshots (app 760; unverified on this machine).
- `config/loginusers.vdf`: one object per remembered SteamID64 with `AccountName`, `PersonaName`, `RememberPassword`, `MostRecent`, `Timestamp` and similar. Never print its values.
- `config/config.vdf`: `InstallConfigStore` tree with client settings and, under `Software/Valve/Steam`, connection-cache and auth material. Describe keys only; never print values.

## 5. Logs and dumps

`logs/` (verified list) includes `content_log.txt` (downloads, depots, validation), `connection_log.txt` (CM connections), `console_log.txt`, `bootstrap_log.txt` (client self-update), `appinfo_log.txt`, `cloud_log.txt`, `cef_log.txt` and `webhelper.txt` (CEF UI), `gameprocess_log.txt` and `runprocess_log.txt` (game launch, exit codes), `shader_log.txt`, `stats_log.txt`, `streaming_log.txt`, `remote_connections.txt`, `gameoverlay_*.txt`, `controller*.txt`, `steamui_*.txt`, `system*manager.txt`. Read the tail only. `dumps/` holds client crash minidumps.

## 6. steam.exe flags and processes

The Valve wiki page returned HTTP 403 when fetched, so every flag below is unverified against it: `-console` (console tab), `-dev`, `-silent` (start minimised to tray), `-tcp` (force TCP to CMs), `-clearbeta` (leave client beta), `-noverifyfiles`, `-forceservice` (run Steam Service even as admin), `-no-browser`, `-cef-disable-gpu`, `-cef-disable-gpu-compositing`, `-applaunch <appid> [args]`, `-login`. Prefer `steam://rungameid/<appid>` for launching a game through a running client (`crates/bun-steam/src/launch.rs`; it accepts only `steam://` URIs without quotes or control characters).

- `steamwebhelper.exe`: Chromium Embedded Framework process tree that renders the client UI. GPU problems in the UI are usually worked around with `-cef-disable-gpu` (unverified). Registry values `GPUAccelWebViewsV3` and `SmoothScrollWebViews` exist under HKCU (verified) and look related (meaning unverified).
- Steam Client Service (`steamservice.exe`, under `Common Files\Steam`): privileged helper for installs into protected paths (path unverified).

## 7. File formats

Read `references/vdf-formats.md` before writing a parser. Summary:

- Text VDF/ACF: KeyValues1, quoted keys and values, `{ }` objects, `//` comments, `\\` escapes. Duplicate keys are legal.
- Binary KV type bytes: `0x00` object, `0x01` string, `0x02` int32, `0x03` float32, `0x04` pointer, `0x05` wide string, `0x06` color, `0x07` uint64, `0x08` end, `0x09` binary blob (ValveKeyValue only), `0x0A` int64, `0x0B` alternate end.
- `appinfo.vdf` magics `0x07564427` (v39), `0x07564428` (v40, binary-VDF SHA-1), `0x07564429` (v41, string table). The string table appeared in v41, not "v29"; `0x07564425`/`26` are v37/v38.
- `packageinfo.vdf` magics `0x06565527` (v39) and `0x06565528` (v40, adds PICS token).

## Additional Resources

- `references/vdf-formats.md`: text and binary KeyValues, appinfo.vdf and packageinfo.vdf record layouts.

## Sources

- Local install `C:/Program Files (x86)/Steam` (directory listing, `steamapps/libraryfolders.vdf`, `steamapps/appmanifest_2799860.acf`, `logs/`), `reg query HKCU\Software\Valve\Steam`, `reg query HKLM\SOFTWARE\WOW6432Node\Valve\Steam` (read 2026-11-12).
- `C:/src/third_party/steam-ecosystem/steamlocate-rs/src/app.rs` (StateFlags).
- `C:/src/third_party/steam-ecosystem/steamappinfo/README.md`, `SteamAppInfoParser/AppInfo.cs`, `PackageInfo.cs`.
- `C:/src/third_party/steam-ecosystem/valvekeyvalue/ValveKeyValue/ValveKeyValue/KeyValues1/KV1BinaryNodeType.cs`.
- `C:/src/apps/rosegriffon/crates/bun-steam/src/vdf.rs`, `install.rs`, `launch.rs`.
- https://developer.valvesoftware.com/wiki/Command_line_options (403 on fetch; flags unverified).
