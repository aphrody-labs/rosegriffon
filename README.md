# Rose Griffon

Monorepo of [Rose Griffon](https://rosegriffon.fr): the website, the Discord bots, the
unified API, the Achillea ranked platform, and Azalee. Bun workspaces, Turborepo, Changesets.

History is preserved from `aphrody-labs/rg`, then `aphrody-labs/iecode` and
`aphrody-labs/bun-distribution` (Bun OS), rewritten to the flat layout below.

## Layout

| Path | Package | Role |
| --- | --- | --- |
| `apps/rg-website` | `@rosegriffon/website` | Next.js site (rosegriffon.fr) |
| `apps/rg-bot` | `@rosegriffon/bot` | Discord gateways (profiles `rg`, `azalee`), unified Elysia API, Achillea ranked Colyseus server, `rg-core` VPS service |
| `packages/achillea-*` | `@rosegriffon/achillea-{client,contract,core,types}` | Achillea esport domain, API contract and client |
| `packages/azalee` | `@rosegriffon/azalee` | Azalee library and CLI |
| `packages/rg-*` | `@rosegriffon/{app-shell,assets,auth,config,cron,db,discord-sync,i18n,identity,preferences,search,types}`, `@rosegriffon/ui` (private) | shared site, data and service packages |
| `supabase/` | — | Supabase CLI config and migrations of the `rg` project |
| `scripts/` | — | build, deploy, operations and campaign scripts |
| `infra/` | — | systemd units, nginx sites, cloud descriptors, VPS helper scripts |
| `docs/` | — | architecture notes (`docs/rg/` holds the historical documentation) |

`@rosegriffon/inagle` and `@rosegriffon/inagle-cross` (IEVR game data) are owned by
Bun OS (`aphrody-labs/bun-distribution`, with nie and iecode) and consumed here from npm.
`@aphrody/*` packages come from npm as well.

## Toolchain

- [Aphrody Bun](https://github.com/aphrody-labs/bun) 1.4.4 or newer (`packageManager: bun@1.4.4`).
  Type checking, lint and format use its native `bun check`, `bun lint` and `bun fmt`;
  upstream Bun does not ship them. CI installs the fork with `.github/actions/setup-bun`.

```sh
bun install
bun run typecheck          # turbo run typecheck
bun run lint               # turbo run lint
bun run build              # turbo run build (Next builds, bundles)
bun run turbo run typecheck --filter=@rosegriffon/cron...
```

### just

The root `justfile` drives the same turbo tasks (`just` lists them):
`just install` (`bun install --ignore-scripts`), `just check`, `just lint`, `just test`,
`just build`, `just ci` (check, lint, test, build), `just compile [args]`, `just tokens`
(rg-ui themes and tokens). `deploy-preflight`, `deploy-build`, `deploy-status`, `deploy-site`
and `deploy-verify` only wrap the VPS steps of `docs/vps/RUNBOOK-2026-11-05.md` (section 4);
run them by hand, in that order.

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

## Cloud topology

| Surface | Host | Configuration |
| --- | --- | --- |
| Website | Vercel (Fluid Compute, Bun runtime), prebuilt deploys | `apps/rg-website/vercel.ts` |
| Unified API | Vercel Function (Bun), prebuilt Build Output | `apps/rg-bot/vercel.ts`, `apps/rg-bot/src/scripts/build-vercel.ts` |
| Postgres, Auth, Storage, Realtime | Supabase project `rg` (ref `xzwfnxzkxtcpgmtqulbh`) | `supabase/config.toml`, `supabase/migrations` |
| Game data mirror | Neon project `inagle` (pooled endpoint, `INAGLE_DATABASE_URL`) | schema owned by `@rosegriffon/inagle` in Bun OS |
| Long-running services | VPS `rg-core` (`rosegriffon serve` or `apps/rg-bot/src/core.ts`) behind nginx | `infra/systemd`, `infra/nginx`, `scripts/assemble-vps-release.sh` |
| Models | `aphrody-nie-model-serve` (Bun OS), relayed by rg-core | `NIE_MODEL_SERVE_*` |

Supabase: `supabase link --project-ref xzwfnxzkxtcpgmtqulbh`, then `supabase db push` from the
repository root. Gameplay reads stay on the Neon pooler; Supabase keeps the site, auth and
community data. Credentials live in Vercel project environments, the VPS env file (mode 0600)
and GitHub secrets, never in the repository.

## Releases

- **npm**: add a changeset (`bun run changeset`). On `main`, `Release packages` opens a
  "Version packages" pull request after a green CI; merging it publishes every public `@rosegriffon/*` package
  whose version is not on npm (`bun pm pack`, then `npm publish --provenance`). The
  `@rosegriffon/inagle*` packages are skipped: Bun OS publishes them.
- **Executables**: push a `v*` tag (or run `rosegriffon binaries` manually) to build and
  attach `rosegriffon-linux-x64` and `rosegriffon-windows-x64.exe` with `SHA256SUMS`.

## License

Each package declares its license: Apache-2.0 for most Rose Griffon packages, MIT for
`packages/azalee` and `crates/aphrody-rg-server`, with their `LICENSE` files. Repository-level
tooling is available under MIT (`LICENSE`) or Apache-2.0 (`LICENSE-APACHE`).
