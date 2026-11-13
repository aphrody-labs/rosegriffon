# Files read by ay steam

## Steam root lookup order

As implemented by `ay steam root` (`--root`, then `$STEAM_PATH`, then `find_steam_installations` in `crates/steam-depot/src/install.rs`; the first candidate that contains `steamapps/` wins):

1. `$STEAM_PATH`
2. Windows `HKCU\Software\Valve\Steam` value `SteamPath`
3. Windows `HKLM\SOFTWARE\WOW6432Node\Valve\Steam` value `InstallPath`
4. `C:\Program Files (x86)\Steam`

Items 2 to 4 run on Windows only; items 5 to 10 run on every other platform (`crates/steam-depot/src/install.rs` `find_steam_installations`).

5. `~/.steam/steam`
6. `~/.local/share/Steam`
7. `~/.var/app/com.valvesoftware.Steam/.local/share/Steam` (Flatpak)
8. `~/.var/app/com.valvesoftware.Steam/.steam/steam` (Flatpak)
9. `~/snap/steam/common/.local/share/Steam` (Snap)
10. `~/Library/Application Support/Steam` (macOS)

## Files

| File                                                  | Format                | Used for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `steamapps/libraryfolders.vdf`                        | text KV               | Root `libraryfolders` keyed `"0"`, `"1"`, ...; each entry has `path`, `label`, `contentid`, `totalsize`, `update_clean_bytes_tally`, `time_last_update_verified`, `apps { "<appid>" "<size bytes>" }`. The old format is `"1" "D:\Games"`. Verified on the local install.                                                                                                                                                                                                                                                                                         |
| `steamapps/appmanifest_<appid>.acf`                   | text KV `AppState`    | `appid`, `Universe`, `LauncherPath`, `name`, `StateFlags`, `installdir`, `LastUpdated`, `LastPlayed`, `SizeOnDisk`, `StagingSize`, `buildid`, `LastOwner` (SteamID64), `DownloadType`, `UpdateResult`, `BytesToDownload`, `BytesDownloaded`, `BytesToStage`, `BytesStaged`, `TargetBuildID`, `AutoUpdateBehavior`, `AllowOtherDownloadsWhileRunning`, `ScheduledAutoUpdate`, `InstalledDepots { <depot> { manifest size } }`, `InstallScripts`, `SharedDepots { <depot> <owning appid> }`, `UserConfig`, `MountedConfig` (verified on `appmanifest_2799860.acf`). |
| `depotcache/<depotid>_<manifestid>.manifest`          | binary depot manifest | Listed by `paths`; decode with steamctl or steamroom                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `appcache/appinfo.vdf`                                | binary (v39 to v41)   | PICS app metadata; format in [`vdf-formats.md`](../../steam-client-windows/references/vdf-formats.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `userdata/<accountid>/<appid>/remote`                 | files                 | Steam Cloud working copy: the app's `remote/` files plus `remotecache.vdf` beside it (observed in the worked example below); Cloud concepts in [`cloud.md`](../../steam-content-cdn/references/cloud.md)                                                                                                                                                                                                                                                                                                                                                          |
| `userdata/<accountid>/<n>/remote/<appid>/screenshots` | files                 | `<n>` is any app directory under `userdata/<accountid>/`: `findScreenshots` in `packages/gaming/src/steam.ts` scans all of them; `steamclient64.dll` strings show `<gameid>/screenshots/` and `thumbnails/`                                                                                                                                                                                                                                                                                                                                                       |
| `steamapps/compatdata/<appid>/pfx`                    | Wine prefix           | Proton prefix (Linux)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `steamapps/shadercache/<appid>`                       | Fossilize caches      | Shader pre-caching                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `steamapps/workshop/`                                 | directory             | Workshop items; install path in [`steam-content-cdn`](../../steam-content-cdn/SKILL.md) (Workshop)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

The `<accountid>` directory name is the 32-bit account id; see
[`../../steam-ids-and-urls/references/steamid.md`](../../steam-ids-and-urls/references/steamid.md).

## StateFlags bits

Per `third_party/steamlocate-rs/src/app.rs` (`StateFlag::from_bit_offset`):

| Bit | Value   | Name           |
| --- | ------- | -------------- |
| 0   | 1       | Uninstalled    |
| 1   | 2       | UpdateRequired |
| 2   | 4       | FullyInstalled |
| 3   | 8       | Encrypted      |
| 4   | 16      | Locked         |
| 5   | 32      | FilesMissing   |
| 6   | 64      | AppRunning     |
| 7   | 128     | FilesCorrupt   |
| 8   | 256     | UpdateRunning  |
| 9   | 512     | UpdatePaused   |
| 10  | 1024    | UpdateStarted  |
| 11  | 2048    | Uninstalling   |
| 12  | 4096    | BackupRunning  |
| 16  | 65536   | Reconfiguring  |
| 17  | 131072  | Validating     |
| 18  | 262144  | AddingFiles    |
| 19  | 524288  | Preallocating  |
| 20  | 1048576 | Downloading    |
| 21  | 2097152 | Staging        |
| 22  | 4194304 | Committing     |
| 23  | 8388608 | UpdateStopping |

Common values: 4 (installed), 6 (installed and update required), 1026 (update started and
required).

## Worked example (verified on this host, 2026-11-12)

On the local Windows install (`C:/Program Files (x86)/Steam`), `apps 2799860` returns
INAZUMA ELEVEN: Victory Road, buildid 26031700, about 61 GB, StateFlags 4
(FullyInstalled). `paths 2799860` shows the install in
`steamapps/common/INAZUMA ELEVEN Victory Road`, the depot manifest
`depotcache/2799861_5864006674348129563.manifest` (depot 2799861, manifest
5864006674348129563), and `userdata/<accountid>/2799860/` with `remote/` and `remotecache.vdf` present (see
[`cloud.md`](../../steam-content-cdn/references/cloud.md)).
`appinfo 2799860` reads a v41 appinfo.vdf.
