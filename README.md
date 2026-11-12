# Rose Griffon

Monorepo of [Rose Griffon](https://rosegriffon.fr): the website, the Discord bots, the
unified API, the Achillea ranked platform, and Azalee. Pure Bun v1.4.4 workspaces.

History is preserved from `aphrody-labs/rg`, then `aphrody-labs/iecode` and
`aphrody-labs/bun-distribution` (Bun OS), rewritten to the flat layout below.

## Layout

| Path | Package | Role |
| --- | --- | --- |
| `apps/rg-website` | `@rosegriffon/website` | Next.js site (rosegriffon.fr) |
| `apps/rg-bot` | `@rosegriffon/bot` | Discord gateways (profiles `rg`, `azalee`), unified Elysia API, Achillea ranked Colyseus server, `rg-core` VPS service |
| `packages/achillea-*` | `@rosegriffon/achillea-{client,contract,core,types}` | Achillea esport domain, API contract and client |
| `packages/azalee` | `@rosegriffon/azalee` | Azalee library and CLI |
| `packages/nie-ui` | `@aphrody/nie-ui` | Unified NIE Studio, Save Editor, Mod Manager, 3D Chara & Emulator UI |
| `packages/filmcraft` | `@aphrody/filmcraft` | FilmCraft NLE timeline engine, multi-track cuts and video export |
| `packages/hyperframes` | `@aphrody/hyperframes` | Zero-download HTTP byte-range ISOBMFF parser and frame decoder |
| `packages/remotion` | `@aphrody/remotion` | Zero-dependency React/Bun remotion timeline composition |
| `crates/aphrody-nie-headless` | `aphrody-nie-headless` | Headless IEVR simulation, save editor, menu capture & core memory dump |
| `packages/rg-*` | `@rosegriffon/{app-shell,assets,auth,config,cron,db,discord-sync,i18n,identity,preferences,search,types}`, `@rosegriffon/ui` (private) | shared site, data and service packages |
| `supabase/` | — | Supabase CLI config and migrations of the `rg` project |
| `scripts/` | — | build, deploy, operations and campaign scripts |
| `infra/` | — | systemd units, nginx sites, cloud descriptors, VPS helper scripts |
| `docs/` | — | architecture notes (`docs/rg/` holds the historical documentation) |

`@rosegriffon/inagle` and `@rosegriffon/inagle-cross` (IEVR game data) are owned by
Bun OS (`aphrody-labs/bun-distribution`, with nie and iecode) and consumed here from npm.
`@aphrody/*` packages come from npm as well.

## Toolchain

- [Aphrody Bun](https://github.com/aphrody-dev/bun) 1.4.4 or newer (`packageManager: bun@1.4.4`).
  Type checking, lint and format use its native `bun check`, `bun lint` and `bun fmt`.

```sh
bun install
bun run typecheck          # bun run --filter '*' typecheck
bun run lint               # bun run --filter '*' lint
bun run build              # bun run --filter '*' build
bun run --filter '@rosegriffon/cron' typecheck
```

### just

The root `justfile` drives the same workspace tasks (`just` lists them):
`just install` (`bun install --ignore-scripts`), `just check`, `just lint`, `just test`,
`just fmt`, `just ci` (check, lint, test, workspace build), `just compile [args]`, `just tokens`
(rg-ui themes and tokens). Host verbs are uniform over the service registry:
`just build|deploy|verify <service|all> [--role R]`, `just rollback <tag> [service]`,
`just migrate <service> --to <role|host> [--apply]`, plus `just host <role>`, `just ssh <role>`,
`just services` and `just render`. Roles, services, data flow and migration:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## VPS Service: `rg-core` executable

`bun run compile` links `apps/rg-bot/src/core.ts` into a single file, `dist/rg-core-<target>[.exe]`.

```sh
bun run compile                                # host target
bun run compile --target linux-x64
bun run compile --target windows-x64
```

```text
rg-core                        service complet sur RG_CORE_PORT (défaut 8810)
rg-core bot                    seule la passerelle Discord du profil RG_PROFIL_BOT
```

Configuration comes from one dotenv file: `./.env` next to the working directory or
`--env-file <path>` (repeatable); the process environment wins. `.env.example` lists every
variable. `aphrody-nie-model-serve` is a Bun OS product and is never embedded: set
`NIE_MODEL_SERVE_URL` to relay an external instance, or `NIE_MODEL_SERVE_BIN` and
`NIE_GAME_DIR` to let `serve` supervise a local binary.

A VPS install is the executable, an env file and a systemd unit; `infra/systemd` and
`infra/nginx` hold the production units and the nginx site for `rosegriffon.fr`.

## NIE Studio & Headless Simulation Engine

Inazuma Eleven: Victory Road (`nie.exe` Level-5 "Lives" engine) reverse-engineering and studio capabilities are exposed via:

1. **Headless Engine (`crates/aphrody-nie-headless`)**:
   - `detect`: Identifies Level-5 / Criware binary structures (`CPK`, `@UTF`, `CRILAYLA`, `G4TX`, `G4MD`, `RDBN`).
   - `match`: Deterministic 90-minute football match simulation.
   - `save-edit`: Encrypted XOR stream cipher manipulation with CRC32 recalculation.
   - `capture-menus`: Captures all game menu screens (boot, title, main menu, save editor, match UI, formation) as PNG sequences + `timeline.json`.
   - `memory-dump`: Full structured JSON memory map and binary core image matching `nie.exe` PE sections.
   - `pipeline`: Automated end-to-end run combining save editing, core dumping, and menu capture.

2. **Unified Studio Package (`@aphrody/nie-ui/studio`)**:
   - Save Editor, Mod Manager with VFS path overlays, CPK Explorer, and 3D Character Editor with morphological tuning.
   - NLE Timeline and video processing through `@aphrody/filmcraft`, `@aphrody/hyperframes`, and `@aphrody/remotion`.
   - Multimodal RAG dataset ingestion with SigLIP vision embeddings on RTX 4070 (`sm_89`).

3. **Technical Specs & Roadmap**:
   - [Roadmap 2026-2027](file:///C:/src/apps/rosegriffon/docs/ROADMAP-2026-2027.md)
   - [Architecture Studio NIE](file:///C:/src/apps/rosegriffon/docs/ARCHITECTURE-NIE-STUDIO.md)

## Cloud topology

| Surface | Host | Configuration |
| --- | --- | --- |
| Website | Vercel (Fluid Compute, Bun runtime), prebuilt deploys | `apps/rg-website/vercel.ts` |
| Unified API | Vercel Function (Bun), prebuilt Build Output | `apps/rg-bot/vercel.ts`, `apps/rg-bot/src/scripts/build-vercel.ts` |
| Postgres, Auth, Storage, Realtime | Supabase project `rg` (ref `xzwfnxzkxtcpgmtqulbh`) | `supabase/config.toml`, `supabase/migrations` |
| Game data mirror | Neon project `inagle` (pooled endpoint, `INAGLE_DATABASE_URL`) | schema owned by `@rosegriffon/inagle` in Bun OS |
| Long-running services | compose stack on the `prod` role host (`core`, `website`, `model-serve`, `nginx`) | `infra/hosts.toml`, `infra/services.toml`, `compose.yaml`, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Models | `aphrody-nie-model-serve` (Bun OS), relayed by rg-core | `NIE_MODEL_SERVE_*` |

Supabase: `supabase link --project-ref xzwfnxzkxtcpgmtqulbh`, then `supabase db push` from the
repository root. Gameplay reads stay on the Neon pooler; Supabase keeps the site, auth and
community data. Credentials live in Vercel project environments, the VPS env file (mode 0600)
and GitHub secrets, never in the repository.

## Releases

- **npm**: bump the package `version` and run `bun run release` (`scripts/publish.ts`), which
  publishes every public `@rosegriffon/*` package whose version is not on npm (`bun pm pack`,
  then `npm publish --provenance`). The `@rosegriffon/inagle*` packages are skipped.
- **Executables**: push a `v*` tag (or run `rosegriffon binaries` manually) to build and
  attach `rosegriffon-linux-x64` and `rosegriffon-windows-x64.exe` with `SHA256SUMS`.

## License

Each package declares its license: Apache-2.0 for most Rose Griffon packages, MIT for
`packages/azalee` and `crates/aphrody-rg-server`, with their `LICENSE` files. Repository-level
tooling is available under MIT (`LICENSE`) or Apache-2.0 (`LICENSE-APACHE`).
