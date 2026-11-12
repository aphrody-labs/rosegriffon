# Depot manifest format

Sources: `steam-protobufs/steam/content_manifest.proto`, `steamkit/SteamKit2/SteamKit2/Types/DepotManifest.cs`, `steamkit/SteamKit2/SteamKit2/Steam/CDN/Client.cs`.

## Container

1. CDN response: PKZip with exactly one entry (SteamKit asserts `entries.Count == 1`).
2. Entry body: repeated `[uint32 magic LE][uint32 length LE][protobuf bytes]` until `0x32C415AB`.

| Magic        | Message                    |
| ------------ | -------------------------- |
| `0x71F617D0` | `ContentManifestPayload`   |
| `0x1F4812BE` | `ContentManifestMetadata`  |
| `0x1B81B817` | `ContentManifestSignature` |
| `0x32C415AB` | end marker                 |

## Fields

`ContentManifestPayload.FileMapping`: 1 filename, 2 size (uint64), 3 flags, 4 sha_filename, 5 sha_content, 6 chunks, 7 linktarget.

`ChunkData`: 1 sha (bytes, chunk ID), 2 crc (fixed32), 3 offset (uint64), 4 cb_original, 5 cb_compressed.

`ContentManifestMetadata`: 1 depot_id, 2 gid_manifest (uint64), 3 creation_time, 4 filenames_encrypted, 5 cb_disk_original, 6 cb_disk_compressed, 7 unique_chunks, 8 crc_encrypted, 9 crc_clear.

`ContentManifestSignature`: 1 signature (bytes).

`ContentDeltaChunks` also exists for delta patches (source/target manifest IDs, `DeltaChunk` entries).

## Filename decryption (DepotManifest.DecryptFilenames)

1. Require a 32-byte depot key.
2. Base64-decode the filename.
3. Decrypt the first 16 bytes with AES-256-ECB (no padding) to get the IV.
4. Decrypt the remainder with AES-256-CBC, PKCS7.
5. Apply the same to `linktarget`; then clear `filenames_encrypted`.

## Local depotcache

`<Steam>/depotcache/<depotid>_<manifestid>.manifest`. Verified: `2799861_5864006674348129563.manifest`. The local copy is raw sections, not zipped: the file starts with `D0 17 F6 71` (payload magic, little-endian; verified 2026-11-12).
