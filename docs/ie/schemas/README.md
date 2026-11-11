# Inazuma / Level-5 VFS schemas

These machine-readable schemas and the 28-format VFS registry were migrated from `bun-os/scripts/iecode/schemas/vfs`. They complement the native parsers in `aphrody-nie-formats` and `aphrody-nie-save` by documenting archive listings and decoded CPK, G4TX, RDBN, and LIVE-save metadata for downstream tooling.

`vfs-formats.json` is an upstream registry snapshot (`version: 2.0.4`); keep its format IDs and magic values aligned with the Rust `FileFormat` registry when changing either side. JSON Schema validates the documented JSON representation. It does not validate or decode raw binary assets, and a registry entry alone does not claim that every listed decoder is implemented here.

The original MIT license is preserved in [`LICENSE.upstream`](LICENSE.upstream).
