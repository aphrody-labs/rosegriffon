# Rose Griffon

Monorepo of [Rose Griffon](https://rosegriffon.fr): the website, the Discord bots, the
unified API, the Achillea ranked platform, Azalee and the self-hostable `rosegriffon`
executable. Bun workspaces, Turborepo, Changesets, and one Rust crate for Vercel edge
functions.

History is preserved from `aphrody-labs/rg`, then `aphrody-labs/iecode` and
`aphrody-labs/bun-distribution` (Bun OS), rewritten to the flat layout below.

## Layout

| Path | Package | Role |
| --- | --- | --- |
| `apps/rg-website` | `@rosegriffon/website` | Next.js site (rosegriffon.fr) |
| `apps/rg-bot` | `@rosegriffon/bot` | Discord gateways (profiles `rg`, `azalee`), unified Elysia API, Achillea ranked Colyseus server, `rg-core` VPS service |
| `apps/azalee-web` | `@rosegriffon/azalee-web` (private) | Azalee Next.js app |
| `apps/rosegriffon` | `@rosegriffon/server` (private) | the `rosegriffon` executable |
| `packages/achillea-*` | `@rosegriffon/achillea-{client,contract,core,types}` | Achillea esport domain, API contract and client |
| `packages/azalee` | `@rosegriffon/azalee` | Azalee library and CLI |
| `packages/rg-*` | `@rosegriffon/{app-shell,assets,auth,config,cron,db,discord-sync,i18n,identity,preferences,search,types}`, `@rosegriffon/ui` (private) | shared site, data and service packages |
| `crates/aphrody-rg-server` | — | Vercel Rust Functions: Discord HTTP interactions and health |
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
- Rust nightly pinned by `rust-toolchain.toml` for `crates/aphrody-rg-server`.

```sh
bun install
bun run typecheck          # turbo run typecheck
bun run lint               # turbo run lint
bun run build              # turbo run build (Next builds, bundles)
bun run turbo run typecheck --filter=@rosegriffon/cron...
cargo clippy --workspace   # Rust edge crate
```

## Self-hosting: one executable

`bun run compile` links `apps/rosegriffon` into a single file, `dist/rosegriffon-<target>[.exe]`,
with the Next.js site embedded (its `output: "standalone"` build, packed as a gzip tarball and
extracted once per build into the user cache directory).

```sh
bun run compile                                # host target, site built if missing
bun run compile --target linux-x64 --site=build
bun run compile --target windows-x64 --site=skip
bun run compile --site-dir path/to/.next/standalone   # embed a prebuilt site
```

The embedded site carries the native addons of the build host (sharp), so it is embedded only
into executables of the host platform; the `rosegriffon binaries` workflow builds Linux x64 and
Windows x64 on their own runners and attaches them to a GitHub Release.

```text
rosegriffon serve              site + rg-core: Discord gateways, ranked Colyseus with the unified
                               API on its port, cron schedules, model-serve relay (default)
rosegriffon site               Next.js site only (RG_SITE_PORT, default 3100)
rosegriffon api                unified Elysia API only (API_PORT, default 8800)
rosegriffon bot                Discord gateway of RG_PROFIL_BOT (rg or azalee)
rosegriffon ranked             Achillea ranked Colyseus server only
rosegriffon cron --run <task>  run one cron task and exit
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
| Discord HTTP interactions, health | Vercel Rust Functions | `crates/aphrody-rg-server/vercel.json` |
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
