# Files read by steam-inspect

| File                                                   | Format                                             | Used for                                                                                                                                                    |
| ------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `steamapps/libraryfolders.vdf`                         | text KV                                            | Library list. The current format has `path`, `label`, `contentid`, `totalsize`, `apps { appid size }`; the old format is `"1" "D:\\Games"`.                 |
| `steamapps/appmanifest_<appid>.acf`                    | text KV `AppState`                                 | appid, name, installdir, buildid, StateFlags, SizeOnDisk, LastUpdated, InstalledDepots { depot { manifest size } }, SharedDepots, UserConfig, MountedConfig |
| `depotcache/<depotid>_<manifestid>.manifest`           | binary depot manifest                              | Listed by `paths`; decode with steamctl or steamroom                                                                                                        |
| `appcache/appinfo.vdf`                                 | binary, magic `0x07564427`/`28`/`29` (v39/v40/v41) | PICS app metadata; v41 adds an int64 string-table offset after the header                                                                                   |
| `userdata/<accountid>/<appid>/remote`                  | files                                              | Steam Cloud working copy                                                                                                                                    |
| `userdata/<accountid>/760/remote/<appid>/screenshots`  | files                                              | Screenshots (unverified on this host: no screenshots present)                                                                                               |
| `steamapps/compatdata/<appid>/pfx`                     | Wine prefix                                        | Proton prefix (Linux)                                                                                                                                       |
| `steamapps/shadercache/<appid>`                        | Fossilize caches                                   | Shader pre-caching                                                                                                                                          |
| `steamapps/workshop/content/<appid>/<publishedfileid>` | files                                              | Workshop items; `appworkshop_<appid>.acf` lists them                                                                                                        |

Verified on the local Windows install (C:/Program Files (x86)/Steam) for AppID 2799860 on
2026-11-12. The `<accountid>` directory name is the 32-bit account id, that is the
SteamID64 minus 76561197960265728.

## StateFlags bits

Per third_party/steam-ecosystem/steamlocate-rs/src/app.rs (`StateFlag::from_bit_offset`):

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
