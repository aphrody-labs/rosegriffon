# Content server protocol

Source: `third_party/steam-ecosystem/steam-protobufs/steam/steammessages_contentsystem.steamclient.proto` (service `ContentServerDirectory`), `third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Steam/CDN/Client.cs`.

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
- CDN auth token: `GetCDNAuthToken` returns the token string, which SteamKit uses verbatim as the URL query string (`BuildCommand` sets `UriBuilder.Query`, `third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Steam/CDN/Client.cs`).

## Chunk decode (DepotChunk.cs)

1. AES-256 decrypt with the depot key (ECB IV, then CBC PKCS7).
2. Detect compression: `VSZa` zstd, `VZa` LZMA (Valve's VZip container, `third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Util/VZipUtil.cs`), `PK\x03\x04` zip.
3. Check output length against `cb_original` and Adler-32 (seed 0) of the output against `ChunkData.crc` (`third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Steam/CDN/DepotChunk.cs`, `third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Util/Adler32.cs`).

## Request codes

DepotDownloader requests a code with `GetManifestRequestCode` before downloading a manifest, treats a returned 0 as fatal, and requests a new code once the previous one is 5 minutes old (`third_party/steam-ecosystem/depotdownloader/DepotDownloader/ContentDownloader.cs`, `GetDepotManifestRequestCodeAsync` call). When no code is returned for an anonymous session it suggests logging in, as old manifests may not be available to anonymous accounts (`third_party/steam-ecosystem/depotdownloader/DepotDownloader/Steam3Session.cs`). Branch-protected manifests use the `app_branch` and `branch_password_hash` request fields (proto above).
