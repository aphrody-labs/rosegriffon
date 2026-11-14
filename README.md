# Rose Griffon

Monorepo of [Rose Griffon](https://rosegriffon.fr): Next.js 16 website, separated Discord gateways (`rg`, `achillea`, `azalee`), unified Elysia API, Achilléa ranked Colyseus server, Azalée wiki & CLI, and the Inazuma Eleven: Victory Road (`nie`) Rust/Bevy/Taffy/WebGPU engine and studio.

Pure **Bun v1.4.5+** workspaces (25 packages, 6 apps) + **Rust 2024** workspace (42 crates).

## Monorepo Layout

### Apps (`apps/`)

| Path                 | Package                | Role                                                                                        |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| `apps/rg-website`    | `@rosegriffon/website` | Next.js 16.5 site (`rosegriffon.fr`, shadcn `base-nova` + `@base-ui/react`, Better Auth)    |
| `apps/rg-bot`        | `@rosegriffon/bot`     | Discord gateways (`rg`, `achillea`, `azalee`), unified Elysia API, Achilléa Colyseus ranked |
| `apps/cli`           | `@rosegriffon/cli`     | Unified Bun CLI (`ie`, `rg`, `rosegriffon`) routing all JS/TS, Rust, and `infra/ops` CLIs   |
| `apps/rosegriffon`   | `@rosegriffon/server`  | Self-hostable `rosegriffon` server binary (`serve`, `site`, `api`, `bot`, `ranked`, `cron`) |
| `apps/mcp`           | `@rosegriffon/mcp`     | Rose Griffon Model Context Protocol server                                                  |
| `apps/iecode-dotnet` | —                      | .NET interop, FFI, CLI, and GUI tooling for IEVR assets                                     |

### Packages (`packages/`)

| Scope                        | Packages                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Achilléa**                 | `achillea-client` (with `achillea` CLI), `achillea-contract`, `achillea-core`, `achillea-types`                   |
| **Azalée & Game Data**       | `azalee`, `inagle`, `ieverse`, `bun-engine-formats`, `iecode-homebrew`                                            |
| **NIE Studio & Media**       | `nie-ui`, `nie-web`, `filmcraft`, `hyperframes`, `remotion`                                                       |
| **Shared Platform (`rg-*`)** | `rg-app-shell`, `rg-assets`, `rg-auth`, `rg-config`, `rg-cron`, `rg-db`, `rg-i18n`, `rg-lua`, `rg-types`, `rg-ui` |
| **Integrations**             | `patreon-bun`                                                                                                     |

### Rust Workspace (`crates/`, 42 crates)

- **Engine & UI**: `aphrody-nie-bevy` (`bevy 0.20.1`), `aphrody-nie-ui` (`taffy 0.15.1`), `aphrody-nie-wasm` (`wasm32` WebGPU/WebGL), `aphrody-nie-render3d`, `aphrody-nie-camera`, `aphrody-nie-game`, `aphrody-nie-app`, `aphrody-nie-launcher`, `aphrody-nie-editor`
- **Core, Formats & Simulation**: `aphrody-nie-core`, `aphrody-nie-formats`, `aphrody-nie-data`, `aphrody-nie-save`, `aphrody-nie-headless`, `aphrody-nie-viola`, `aphrody-nie-zukan`, `aphrody-nie-wiki`, `aphrody-nie-inventory`, `aphrody-nie-ocgen`
- **Services, CLI, MCP & RE**: `aphrody-nie-model-serve` (CDN assets & catalogs), `aphrody-nie-cli`, `aphrody-nie-mcp`, `aphrody-nie-ffi`, `aphrody-nie-computer-use`, `aphrody-nie-lua`, `aphrody-nie-lua-web`, `aphrody-nie-net`, `aphrody-nie-pe`, `aphrody-nie-pg`, `aphrody-nie-sql`, `aphrody-nie-queue`, `aphrody-nie-tasks`, `aphrody-nie-trace`, `aphrody-nie-index`, `aphrody-nie-seed`, `aphrody-nie-forge`, `aphrody-nie-explore`, `aphrody-nie-bench`, `aphrody-nie-identity-source`, `nie-pkg`, `re`, `yolo-re-core`

## Unified CLI

`apps/cli` (`ie` / `rg` / `rosegriffon`) exposes every CLI in one entrypoint:

```sh
bun apps/cli/src/index.ts --help
bun apps/cli/src/index.ts inagle <args...>        # IEVR data & Zukan CLI
bun apps/cli/src/index.ts azalee <args...>        # Azalee DB, sync, audit
bun apps/cli/src/index.ts achillea <args...>      # Full 19-resource Achilléa v1 API CLI
bun apps/cli/src/index.ts nie <args...>           # Rust aphrody-nie-cli
bun apps/cli/src/index.ts contract <args...>      # Achilléa schema/contract generator
bun apps/cli/src/index.ts formats <args...>       # Console ROM/binary formats
bun apps/cli/src/index.ts homebrew <args...>      # DS/3DS homebrew toolchain
bun apps/cli/src/index.ts serve|site|api|bot|ranked|cron
bun apps/cli/src/index.ts build|deploy|verify <service|all>
```

Standalone Achilléa client CLI:

```sh
bun packages/achillea-client/src/cli.ts resources
bun packages/achillea-client/src/cli.ts ranked leaderboard
```

## Toolchain & Verification

```sh
bun install
bun fmt
bun --filter @rosegriffon/ui tokens
bun --filter @rosegriffon/achillea-contract generate
bun run typecheck
bun run lint
bun run test
cargo check --workspace --all-targets
```

### `just` & Production Fleet

`justfile` and `infra/ops/cli.ts` drive builds, deployments, and verification across hosts (`infra/hosts.toml`, `infra/services.toml`):

```sh
just ci
just build all
just deploy all
just verify all
```

Production runs Docker Compose (`compose.yaml`) behind Nginx/Cloudflare on `prd`:

- **Website**: `https://rosegriffon.fr` (`apps/rg-website`)
- **API & Bots**: `https://api.rosegriffon.fr` (`apps/rg-bot` — separated Discord gateways `rg`, `achillea`, `azalee` and Better Auth providers `discord`, `discord-achillea`, `discord-azalee`)
- **Ranked**: `https://ranked.rosegriffon.fr` (Colyseus + Achilléa API)
- **CDN**: `https://cdn.rosegriffon.fr` (`aphrody-nie-model-serve`)

## AI Agents, Skills & MCP Plugin

Project-scoped tooling is consolidated in:

- `.mcp.json`: `nie`, `rosegriffon`, `shadcn`, `next-devtools`, `better-auth`, `context7`
- `.agents/skills/` & `.claude/skills/` (kept in sync via `bun run skills:sync`)
- `.claude-plugin/plugin.json`: plugin manifest referencing `./.claude/skills` and `./.mcp.json`

## Documentation

- [Documentation Index](docs/README.md)
- [Architecture & Services](docs/ARCHITECTURE.md)
- [Plan & Design System](PLAN.md)
- [Production Status](docs/PROD-STATUS.md)

## License

Packages declare their license in `package.json` / `Cargo.toml` (primarily `Apache-2.0` or `MIT`, see `LICENSE` and `LICENSE-APACHE`).
