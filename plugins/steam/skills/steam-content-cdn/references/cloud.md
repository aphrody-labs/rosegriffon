# Steam Cloud

Source: https://partner.steamgames.com/doc/features/cloud (fetched 2026-11-12), `third_party/steam-ecosystem/steam-protobufs/steam/steammessages_cloud.steamclient.proto`.

## Auto-Cloud roots

| Root                  | OS      | Maps to                                                                 |
| --------------------- | ------- | ----------------------------------------------------------------------- |
| App Install Directory | All     | `[Steam Install]\SteamApps\common\[Game Folder]\`                       |
| SteamCloudDocuments   | All     | platform specific, e.g. Linux `~/.SteamCloud/[username]/[Game Folder]/` |
| WinMyDocuments        | Windows | `%USERPROFILE%\My Documents\`                                           |
| WinAppDataLocal       | Windows | `%USERPROFILE%\AppData\Local\`                                          |
| WinAppDataLocalLow    | Windows | `%USERPROFILE%\AppData\LocalLow\`                                       |
| WinAppDataRoaming     | Windows | `%USERPROFILE%\AppData\Roaming\`                                        |
| WinSavedGames         | Windows | `%USERPROFILE%\Saved Games\`                                            |
| MacHome               | macOS   | `~/`                                                                    |
| MacAppSupport         | macOS   | `~/Library/Application Support/`                                        |
| MacDocuments          | macOS   | `~/Documents/`                                                          |
| LinuxHome             | Linux   | `~/`                                                                    |
| LinuxXdgDataHome      | Linux   | `$XDG_DATA_HOME/`                                                       |

## Local layout

The local directory layout is described once, in the files table of [`../../steam-local-inspect/references/layout.md`](../../steam-local-inspect/references/layout.md).

- `<accountid>` is the 32-bit account ID (see [`../../steam-ids-and-urls/references/steamid.md`](../../steam-ids-and-urls/references/steamid.md)). Use `app_paths` to resolve.

## CM service `Cloud` (selected RPCs)

`EnumerateUserFiles`, `GetFileDetails`, `GetSingleFileInfo`, `BeginHTTPUpload`, `CommitHTTPUpload`, `BeginUGCUpload`, `CommitUGCUpload`, `ShareFile`, `Delete`, `GetClientEncryptionKey`. See the proto for fields.
