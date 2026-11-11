# aphrody-nie-zukan

Offline RE components for the Inagle encyclopedia: typed records, JP/FR/EN HTML parsers, the site's `?q=` codec, bounded JSON API, fuzzy matcher, and optional SQLite correlation with local game-data mirrors.

Enable `sqlite` (the default) for `cross` correlation. Live crawling (`client`/`pull`) remains outside this port because it depends on bun-os's web-client transport; the parser and analysis APIs need no network and never launch game code. No emulator, WASM, or WGPU code is included.

Build with `cargo check -p aphrody-nie-zukan`. The upstream licensing notice is preserved in `LICENSE`.
