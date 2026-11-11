# aphrody-nie-model-serve

Ports the full IEVR model asset service from `bun-os/crates/aphrody-nie-model-serve`.

- Default build exposes the offline `aphrody-nie-model-core` catalog and menu API, without enabling host facilities.
- `--features host` builds the local HTTP service, live VFS/CPK-backed GLB assembly and texture/audio routes, bounded local asset reads, and SQLite/PostgreSQL mirror integration.
- The service dependencies are native and feature-gated; the separate `aphrody-nie-model-core` crate retains portable catalog and compositor APIs.

This port excludes only GPU presentation from the server side: it uses the shared CPU compositor. No WASM host or emulator integration is included. `presentation.json` carries the upstream presentation metadata required by the server. `LICENSE.upstream` preserves the source license.

Build the service with `cargo build -p aphrody-nie-model-serve --features host`; run `aphrody-nie-model-serve --help` for its host CLI options.
