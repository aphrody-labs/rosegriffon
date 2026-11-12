---
name: steam-content-cdn
description: This skill should be used when the user asks to "download a depot", "decode a Steam manifest", "what is in depotcache", "get a manifest request code", "fetch a chunk from the Steam CDN", "decrypt depot filenames", "find Steam content servers", "where are Steam Cloud saves", "what is remotecache.vdf", "set up Auto-Cloud", "where are Workshop files stored", "set up lancache for Steam", "prefill lancache", or mentions SteamPipe, GetServersForSteamPipe, GetManifestRequestCode, GetCDNAuthToken, depot keys, VZip, VSZa, ISteamUGC, IPublishedFileService, or lancache.steamcontent.com. For running download or prefill tools, steam-community-tools applies.
---

# Steam content delivery: depots, manifests, chunks, Cloud, Workshop, lancache

Use this skill to reason about how Steam stores and ships game content, and to read or fetch it with existing tools. For IDs and URL forms, use the `steam-ids-and-urls` skill. Call the plugin MCP tool `app_paths` to locate local install, `depotcache`, `userdata`, and `workshop` directories; use `steamdb_link` to build steamdb.info links for a depot or manifest (link building only).

## Object model

An app owns depots. Each depot has a sequence of manifests (uint64 GID). A manifest lists files; each file is split into chunks identified by the SHA-1 of their plaintext. Chunks are stored encrypted and compressed on content servers, deduplicated across manifests of the same depot. A build (BuildID) pins one manifest per depot and is set live on a branch (https://partner.steamgames.com/doc/sdk/uploading, https://partner.steamgames.com/doc/store/application/depots).

Verified local example: app 2799860, depot 2799861, manifest 5864006674348129563, stored as `C:/Program Files (x86)/Steam/depotcache/2799861_5864006674348129563.manifest`.

## Manifest format

Source: `steam-protobufs/steam/content_manifest.proto`, `steamkit/SteamKit2/SteamKit2/Types/DepotManifest.cs`.

A manifest is a sequence of sections, each a little-endian uint32 magic, a uint32 length, and a protobuf body:

| Magic        | Section                    |
| ------------ | -------------------------- |
| `0x71F617D0` | `ContentManifestPayload`   |
| `0x1F4812BE` | `ContentManifestMetadata`  |
| `0x1B81B817` | `ContentManifestSignature` |
| `0x32C415AB` | end of manifest            |

- `ContentManifestPayload.mappings[]` (`FileMapping`): `filename`, `size`, `flags`, `sha_filename`, `sha_content`, `chunks[]`, `linktarget`.
- `ChunkData`: `sha` (chunk ID), `crc` (fixed32), `offset`, `cb_original`, `cb_compressed`.
- `ContentManifestMetadata`: `depot_id`, `gid_manifest`, `creation_time`, `filenames_encrypted`, `cb_disk_original`, `cb_disk_compressed`, `unique_chunks`, `crc_encrypted`, `crc_clear`.

Over the CDN the manifest arrives as a PKZip archive containing a single entry; SteamKit opens it with `ZipArchive` and asserts one entry (`Steam/CDN/Client.cs`). Files in `depotcache` are stored unzipped: the local `2799861_5864006674348129563.manifest` starts with bytes `D0 17 F6 71`, the payload magic in little-endian (verified 2026-11-12).

### Filename encryption and depot keys

When `filenames_encrypted` is true, each filename is Base64 of AES-256 ciphertext: the first 16 bytes are the IV encrypted with AES-ECB, the rest is AES-CBC with PKCS7 (`DepotManifest.DecryptFilenames`, `Util/CryptoHelper.cs`). The 32-byte depot key comes from the CM (`GetDepotDecryptionKey`) for owned depots, or locally from the client's `config/config.vdf` (steamroom 0.3 `local-info`, per `crates/bun-steam/UPSTREAM.md`).

## Chunks

- Path: `depot/<depotid>/chunk/<sha1hex>` on a content server (`Client.cs`).
- Decrypt with the depot key (same ECB-IV + CBC scheme), then decompress by prefix (`Steam/CDN/DepotChunk.cs`):
  - `VSZa`: Valve zstd wrapper (`VZstdUtil`)
  - `VZa`: Valve LZMA wrapper (`VZipUtil`)
  - `PK\x03\x04`: PKZip (`ZipUtil`)
- Verify the result: length equals `cb_original` and the Adler-32 based checksum matches `crc` (SteamKit passes `verifyChecksum: false` to the decompressor and checks separately; read the file before relying on the exact algorithm).

## Content servers, request codes, auth tokens

RPCs in service `ContentServerDirectory` (`steammessages_contentsystem.steamclient.proto`), called over a CM session:

- `GetServersForSteamPipe(cell_id, max_servers=20, ip_override, launcher_type, ipv6_public, current_connections)`: returns `CContentServerDirectory_ServerInfo` entries (type, host, vhost, HTTPS support, load, and more).
- `GetManifestRequestCode(app_id, depot_id, manifest_id, app_branch, branch_password_hash)` returns `manifest_request_code` (uint64). Request codes are time-limited (unverified duration).
- `GetCDNAuthToken(depot_id, host_name, app_id)` returns `token` and `expiration_time`; SteamKit appends it to CDN URLs when the server type requires it.

Manifest URL (SteamKit, `MANIFEST_VERSION = 5`):

```
depot/<depotid>/manifest/<manifestid>/5/<requestcode>
```

Do not hardcode CDN hostnames; always take them from `GetServersForSteamPipe`.

## Tools

- DepotDownloader (GPL-2.0, reference only for `bun-steam`; installed on vps): `-app`, `-depot`, `-manifest`, `-manifest-only`.
- steamctl (MIT, installed on vps): `steamctl depot info` / `depot list -f` read manifests offline.
- steamroom (MIT/Apache-2.0): the Rust library `crates/bun-steam` depends on; see `crates/bun-steam/src/depot/` (`downloader.rs`, `depot_resolver.rs`, `transfer.rs`).

## Steam Cloud

Two models (https://partner.steamgames.com/doc/features/cloud): the ISteamRemoteStorage API (explicit file writes from the game) and Auto-Cloud (Steam syncs files matching configured root + subdirectory + pattern). Auto-Cloud roots include `WinMyDocuments`, `WinAppDataLocal`, `WinAppDataLocalLow`, `WinAppDataRoaming`, `WinSavedGames`, `MacHome`, `MacAppSupport`, `MacDocuments`, `LinuxHome`, `LinuxXdgDataHome`, `SteamCloudDocuments`, and App Install Directory. Locally, Cloud state lives in `userdata/<accountid>/<appid>/`, with API files under `remote/` and sync state in `remotecache.vdf` (local layout: unverified, not documented on that page; confirm with `app_paths`). The CM-side service `Cloud` exposes `EnumerateUserFiles`, `BeginHTTPUpload`, `CommitHTTPUpload`, `GetFileDetails`, `Delete`, and others (`steammessages_cloud.steamclient.proto`). Details: `references/cloud.md`.

## Workshop

Game-side API: ISteamUGC (Steamworks SDK; Rust bindings in `steamworks-rs`). Web/CM side: `IPublishedFileService` (`steammessages_publishedfile.steamclient.proto`, e.g. `GetDetails`, `QueryFiles`) and the older ISteamRemoteStorage web methods. Subscribed items install to `steamapps/workshop/content/<appid>/<publishedfileid>/` (https://partner.steamgames.com/doc/features/workshop; path confirmation: unverified). Item pages: `https://steamcommunity.com/sharedfiles/filedetails/?id=<id>`.

## Lancache

- lancache-dns answers for CDN domains listed in `uklans/cache-domains` (cloned in `lancache-dns/Dockerfile`), returning `LANCACHE_IP`; clients must use it as their only DNS (https://lancache.net/docs/).
- lancache-monolithic is nginx with `slice 1m` and `proxy_cache_key $cacheidentifier$uri$slice_range` (`overlay/etc/nginx/sites-available/cache.conf.d/root/`). It caches plain HTTP only; HTTPS passes through an SNI proxy.
- Steam detects a cache via the trigger name `lancache.steamcontent.com`: when it resolves to a private address, clients and prefill tools send chunk requests there (`steamkit/.../Steam/CDN/ClientLancache.cs`, `steam-lancache-prefill/SteamPrefill/Settings/AppConfig.cs`).
- steam-lancache-prefill downloads selected apps through the cache and discards data, warming it.
- The repo ports these rules to Alpine nginx in `infra/docker/lancache/` (per `UPSTREAM.md`). Details: `references/lancache.md`.

## Workflow

1. Resolve app, depot, manifest IDs (PICS or depotcache file names via `app_paths`).
2. Read an existing local manifest before downloading anything.
3. To fetch: get servers, request code, optional CDN token, then manifest, then chunks; verify sizes and checksums.
4. Never ship GPL code from DepotDownloader or SteamKit into `bun-steam`.

## Additional Resources

- `references/manifest-format.md`: section layout, fields, decryption steps.
- `references/cdn-protocol.md`: RPC fields and URL paths.
- `references/cloud.md`: Auto-Cloud roots and local layout.
- `references/lancache.md`: DNS, nginx cache key, prefill.

## Sources

- `C:\src\third_party\steam-ecosystem\steam-protobufs\steam\content_manifest.proto`
- `C:\src\third_party\steam-ecosystem\steam-protobufs\steam\steammessages_contentsystem.steamclient.proto`
- `C:\src\third_party\steam-ecosystem\steam-protobufs\steam\steammessages_cloud.steamclient.proto`
- `C:\src\third_party\steam-ecosystem\steamkit\SteamKit2\SteamKit2\Types\DepotManifest.cs`
- `C:\src\third_party\steam-ecosystem\steamkit\SteamKit2\SteamKit2\Steam\CDN\Client.cs`, `DepotChunk.cs`, `ClientLancache.cs`
- `C:\src\third_party\steam-ecosystem\lancache-monolithic\overlay\`, `lancache-dns\Dockerfile`
- `C:\src\third_party\steam-ecosystem\steam-lancache-prefill\SteamPrefill\Settings\AppConfig.cs`
- `C:\src\apps\rosegriffon\crates\bun-steam\UPSTREAM.md`, `crates\bun-steam\src\depot\`
- https://partner.steamgames.com/doc/sdk/uploading
- https://partner.steamgames.com/doc/store/application/depots
- https://partner.steamgames.com/doc/features/cloud (fetched 2026-11-12)
- https://partner.steamgames.com/doc/features/workshop
- https://lancache.net/docs/ (fetched 2026-11-12)
