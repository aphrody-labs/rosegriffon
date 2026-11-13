---
name: steam-content-cdn
description: This skill should be used when the user asks to "decode a Steam manifest", "decode depot chunks", "what is in depotcache", "get a manifest request code", "fetch a chunk from the Steam CDN", "where are Steam Cloud saves", "where are Workshop files stored", or "set up lancache for Steam", or mentions SteamPipe, GetServersForSteamPipe, GetCDNAuthToken, depot keys, VZip, ISteamUGC, or lancache. For running download or prefill tools, steam-community-tools applies.
---

# Steam content delivery: depots, manifests, chunks, Cloud, Workshop, lancache

Use this skill to reason about how Steam stores and ships game content, and to read or fetch it with existing tools. For IDs and URL forms, use the `steam-ids-and-urls` skill. Call the plugin MCP tool `app_paths` to locate local install, `depotcache`, `userdata`, and `workshop` directories; use `steamdb_link` to build steamdb.info links for a depot (including its manifests list).

## Object model

An app owns depots. Each depot has a sequence of manifests (uint64 GID). A manifest lists files; each file is split into chunks identified by the SHA-1 of their plaintext. Chunks are stored encrypted and compressed on content servers, deduplicated across manifests of the same depot. A build (BuildID) pins one manifest per depot and is set live on a branch (https://partner.steamgames.com/doc/sdk/uploading, https://partner.steamgames.com/doc/store/application/depots).

Worked local example (app, depot, manifest, depotcache file): [`../steam-local-inspect/references/layout.md`](../steam-local-inspect/references/layout.md).

## Manifest format

A manifest is a sequence of magic-tagged protobuf sections (payload, metadata, signature, end marker). Over the CDN it arrives zipped; `depotcache` files are stored unzipped. Filenames may be encrypted with the depot key; obtain keys through a CM session. Magic values, field numbers and decryption steps: [`references/manifest-format.md`](references/manifest-format.md).

## Chunks

Chunks are fetched by SHA-1, decrypted, decompressed and checksummed: [`references/cdn-protocol.md`](references/cdn-protocol.md) (Chunk decode).

## Content servers, request codes, auth tokens

Servers come from `GetServersForSteamPipe`, manifest downloads need a code from `GetManifestRequestCode`, and some hosts need a `GetCDNAuthToken` token (service `ContentServerDirectory`, called over a CM session). Request fields, URL paths and token handling: [`references/cdn-protocol.md`](references/cdn-protocol.md). Do not hardcode CDN hostnames; always take them from `GetServersForSteamPipe`.

## Tools

DepotDownloader, steamctl (offline manifest reads) and steamroom (the Rust library `crates/steam-depot` depends on; see `crates/steam-depot/src/depot/`). Licenses, commands and the versions installed on vps: [`../steam-community-tools/references/tools.md`](../steam-community-tools/references/tools.md).

## Steam Cloud

Two models (https://partner.steamgames.com/doc/features/cloud): the ISteamRemoteStorage API (explicit file writes from the game) and Auto-Cloud (Steam syncs files matching configured roots). Auto-Cloud roots, the local `userdata` layout and the CM `Cloud` service RPCs: [`references/cloud.md`](references/cloud.md). Resolve local paths with `app_paths`.

## Workshop

Game-side API: ISteamUGC (Steamworks SDK; Rust bindings in `steamworks-rs`). Web/CM side: `IPublishedFileService` (`steammessages_publishedfile.steamclient.proto`, e.g. `GetDetails`, `QueryFiles`) and the older ISteamRemoteStorage web methods. Subscribed items install to `steamapps/workshop/content/<appid>/<publishedfileid>/` (https://partner.steamgames.com/doc/features/workshop; confirmed 2026-11-12 on the local install: `steamapps/workshop/content/241100/1911784383/`, plus `appworkshop_<appid>.acf`, `downloads/`, `temp/` beside `content/`). Item page URL: [`../steam-ids-and-urls/references/urls.md`](../steam-ids-and-urls/references/urls.md).

## Lancache

DNS, cache key, trigger domain, and prefill rules: [`references/lancache.md`](references/lancache.md).

## Workflow

1. Resolve app, depot, manifest IDs (PICS or depotcache file names via `app_paths`).
2. Read an existing local manifest before downloading anything.
3. To fetch: get servers, request code, optional CDN token, then manifest, then chunks; verify sizes and checksums.
4. Check the license before reusing upstream code in `bun-steam` ([`../steam-community-tools/references/decision-matrix.md`](../steam-community-tools/references/decision-matrix.md)).

## Additional Resources

- `references/manifest-format.md`: section layout, fields, decryption steps.
- `references/cdn-protocol.md`: RPC fields and URL paths.
- `references/cloud.md`: Auto-Cloud roots and local layout.
- `references/lancache.md`: DNS, nginx cache key, prefill.

## Sources

- `third_party/steam-protobufs/steam/content_manifest.proto`
- `third_party/steam-protobufs/steam/steammessages_contentsystem.steamclient.proto`
- `third_party/steam-protobufs/steam/steammessages_cloud.steamclient.proto`
- `third_party/steamkit/SteamKit2/SteamKit2/Types/DepotManifest.cs`
- `third_party/steamkit/SteamKit2/SteamKit2/Steam/CDN/Client.cs`, `DepotChunk.cs`, `ClientLancache.cs`
- `third_party/lancache-monolithic/overlay/`, `third_party/lancache-dns/Dockerfile`
- `third_party/steam-lancache-prefill/SteamPrefill/Settings/AppConfig.cs`
- `crates/steam-depot/UPSTREAM.md`, `crates/steam-depot/src/depot/`
- https://partner.steamgames.com/doc/sdk/uploading
- https://partner.steamgames.com/doc/store/application/depots
- https://partner.steamgames.com/doc/features/cloud (fetched 2026-11-12)
- https://partner.steamgames.com/doc/features/workshop
- https://lancache.net/docs/ (fetched 2026-11-12)
