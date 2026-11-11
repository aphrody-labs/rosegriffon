# aphrody-nie-model-core

Offline portions extracted from `aphrody-nie-model-serve`:

- bounded parsing of IEVR `chara_parts` and `chara_model` T2B `cfg.bin` payloads into reusable catalogs;
- a deterministic, bounded CPU compositor that turns a JSON menu layout and caller-provided RGBA sprites into PNG.

The caller owns asset discovery and sprite loading. This crate does not include the original live GLB/HTTP server, filesystem VFS/database mirror, TCP or SQL integration, game runtime, WASM host, or WGPU renderer. It delegates T2B and PNG encoding to the local `aphrody-nie-formats` crate.

Source modules were ported from `bun-os/crates/aphrody-nie-model-serve/src/{catalog.rs,menu.rs}`. The upstream license notice is retained in `LICENSE.upstream`.
