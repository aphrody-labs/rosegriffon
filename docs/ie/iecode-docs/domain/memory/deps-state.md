# Dependency state

## Dependencies (managed by `aphrody-update deps memory`, 2026-10-02)

- tauri: 3.0.0-alpha.4
- wasm-bindgen: 0.2.128
- rio-vt: 0.5.28
- portable-pty: 0.8
- lexical: 0.52.0
- react-table: 9.2.4
- sentry-nextjs: 11.0.0
- next: 16.3.5
- discord.js: 14.27.0
- bun: 1.4.2
- uv: 0.12.21
- last bump 2026-10-02: tauri 3.0.0-alpha.3->3.0.0-alpha.4, tauri-runtime-wry 3.0.0-alpha.3->3.0.0-alpha.4, tauri-build 3.0.0-alpha.2->3.0.0-alpha.3, tauri-plugin 3.0.0-alpha.2->3.0.0-alpha.3, tauri-runtime-cef 3.0.0-alpha.4->3.0.0-alpha.5, uv 0.12.17->0.12.21, lexical 0.45.0->0.52.0, @sentry/nextjs 10.75.3->11.0.0, @tanstack/react-table 8.21.3->9.2.4, @colyseus/core 0.17.51->0.18.17, @types/node 25.9.8->26.6.3, @cloudflare/workers-types 4.20260702.1->5.20260928.1

Rules: run `bun run update:deps` (plan) before touching pins; after a bump read `docs/research/workspace/deps/` and
`.coord/shared/deps-fix-*.md`; fix consumers with the briefs, never bulk-update Cargo; never edit CHANGELOG.md by hand.
