# Content server protocol

Source: `steam-protobufs/steam/steammessages_contentsystem.steamclient.proto` (service `ContentServerDirectory`), `steamkit/SteamKit2/SteamKit2/Steam/CDN/Client.cs`.

## RPCs

| RPC                                              | Request fields                                                                                  | Response                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| `GetServersForSteamPipe`                         | cell_id, max_servers (default 20), ip_override, launcher_type, ipv6_public, current_connections | list of `ServerInfo`           |
| `GetManifestRequestCode`                         | app_id, depot_id, manifest_id (uint64), app_branch, branch_password_hash                        | manifest_request_code (uint64) |
| `GetCDNAuthToken`                                | depot_id, host_name, app_id                                                                     | token, expiration_time         |
| `GetDepotPatchInfo`                              | see proto                                                                                       | see proto                      |
| `GetClientUpdateHosts`                           | see proto                                                                                       | see proto                      |
| `RequestPeerContentServer`, `GetPeerContentInfo` | peer-to-peer LAN content (see proto)                                                            | see proto                      |

## Paths (relative to a server from GetServersForSteamPipe)

- Manifest: `depot/<depotid>/manifest/<manifestid>/5/<requestcode>` (SteamKit falls back to omitting the code segment when it is 0).
- Chunk: `depot/<depotid>/chunk/<sha1hex>`.
- CDN auth token: appended to the URL for servers that need it (exact query form: read `Client.cs`, unverified here).

## Chunk decode (DepotChunk.cs)

1. AES-256 decrypt with the depot key (ECB IV, then CBC PKCS7).
2. Detect compression: `VSZa` zstd, `VZa` LZMA, `PK\x03\x04` zip.
3. Check output length against `cb_original` and checksum against `ChunkData.crc`.

## Request codes

Required for most manifests since Valve introduced them; they expire (lifetime unverified). Branch-protected manifests need `app_branch` and `branch_password_hash`.
