# steam-index

Read-only index of a local Steam install, stored as SQLite at
`~/.local/share/nie/steam-index.sqlite`. The Rust half (`src/main.rs`) uses the `crates/bun-steam`
parsers (`vdf::parse_vdf`, `vdf::parse_appinfo`, `vdf::parse_packageinfo`,
`install::scan_steam_libraries`, `config::library_folders`, `config::login_users`) and streams
blake3 hashes. The Bun half (`index.ts`) writes the database with `bun:sqlite`.

## Run

```sh
# Rust half: build on vps/prd only, never on the Windows box (remote-hash.sh does it)
bun tools/steam-index/index.ts                 # local: metadata + file paths/sizes (no hashing)
sh tools/steam-index/remote-hash.sh prd <synced_steam_root>   # blake3 on prd (builds there)
bun tools/steam-index/index.ts --vault         # also set STEAM_ACCOUNT_NAME, STEAM_ID in C:\src\.env
# options: --steam <root> (default C:/Program Files (x86)/Steam), --db <path>, --bin <steam-index exe>
```

Hashing is resumable. Rerunning skips files whose `size` and `mtime_ms` did not change and already
have a `blake3`. Changed files are reset and hashed again. Results commit in batches of 500 rows,
or every 2 s.

## Credential policy

`ssfn*`, `config/loginusers.vdf`, `config/local.vdf`, `config/config.vdf` and
`%LOCALAPPDATA%/Steam/local.vdf` go into `credential_artifacts` by path, size and blake3 only.
The tool never parses them, with one exception: `--vault`, which reads the most recent account's
name and SteamID64 from `loginusers.vdf`. `config.vdf` is never parsed, so compat tools come from
directories, not from `CompatToolMapping`.

## Schema

| Table                  | Columns                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `meta`                 | `key`, `value` (`steam_root`, `scanned_at`, `appinfo_version`, `packageinfo_version`)                                       |
| `libraries`            | `idx`, `path` PK, `label`, `total_size`, `app_count` (from `libraryfolders.vdf`)                                            |
| `apps`                 | `appid` PK, `name`, `installdir`, `library`, `install_path`, `exists_on_disk`, `size_on_disk`, `buildid`, `state_flags`, `last_updated`, `acf_path` |
| `app_depots`           | `appid`, `depot`, `manifest` (gid), `size` (from `InstalledDepots` of the ACF)                                              |
| `depotcache`           | `path` PK, `depot`, `gid`, `size` (`depotcache/<depot>_<gid>.manifest`)                                                     |
| `pics_apps`            | `appid` PK, `name`, `type`, `change_number`, `last_updated` (`appcache/appinfo.vdf`; apps known to the client cache)        |
| `pics_packages`        | `packageid` PK, `change_number`, `appids` JSON, `depotids` JSON (`appcache/packageinfo.vdf`)                                |
| `workshop`             | `appid`, `item`, `size`, `timeupdated`, `manifest`, `path`, `exists_on_disk`, `library`                                     |
| `compat_tools`         | `name`, `path` PK, `source` (`compatibilitytools.d` or `steamapps/common/Proton*`)                                          |
| `controller_configs`   | `path` PK, `size` (`controller_config/`, `Steam Controller Configs/`, `userdata/*/241100/`)                                  |
| `userdata`             | `account_id`, `config_file` (file names in `userdata/<id>/config` only)                                                     |
| `credential_artifacts` | `path` PK, `size`, `blake3`, `error`                                                                                        |
| `files`                | `path` PK, `appid`, `size`, `mtime_ms`, `blake3`, `error`, `hashed_at` (every file of every installed game)                 |

Every table except `files` is rebuilt on each run. `files` is incremental.

`pics_apps` and `pics_packages` list what the client has cached metadata for. That is close to,
but not proof of, ownership: the real license list (`licensecache`) is encrypted and not read.
