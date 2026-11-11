# Environment ownership

Updated on 2026-10-10. IECODE, Aphrody and RG share source owners but keep
application credentials and runtime configuration in separate private files.

| Owner                 | Private configuration                                                                 | Contract                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IECODE root           | `.env.local`; `.env` points to it                                                     | Game paths and local tools. Optional `NIE_PG_URL` is loopback-only; do not put shared RG or provider credentials here.                                        |
| Inagle / NIE gameplay | Private runtime secret store                                                          | Neon project `inagle`, database `inagle`, Europe region. Use `INAGLE_DATABASE_URL`; `NIE_PG_URL` is a historical alias. Never fall back to RG `DATABASE_URL`. |
| RG website            | `apps/rg/website/.env` and `.env.production.local`                                    | Supabase `RG_DATABASE_URL` plus Neon `INAGLE_DATABASE_URL` for gameplay routes. `DATABASE_URL` is an RG-only compatibility alias.                             |
| RG bot                | `apps/rg/bot/.env`                                                                    | Bot credentials, Supabase `RG_DATABASE_URL`, Neon `INAGLE_DATABASE_URL` and local compatibility services.                                                     |
| RG cron               | `packages/rg/cron/.env`                                                               | Cron credentials, Supabase `RG_DATABASE_URL` and Neon `INAGLE_DATABASE_URL`.                                                                                  |
| Aphrody               | `../aphrody/.env`                                                                     | Shared operations and `APHRODY_TRAINING_DATABASE_URL[_POOLED]` for training.                                                                                  |
| Workstation           | `~/.config/shell/env.sh`, `~/.config/nushell/env.nu`, `~/.config/nie/environment.env` | Toolchain and checkout paths; no globally exported application database URL.                                                                                  |

Private environment files are ignored by Git and have mode `0600`. Templates
are documentation, not credential sources. Keep unique backups in
`~/.aphrody/private/backups/environment/`; never include their contents in logs,
commits or generated documentation.

## Loading configuration

For Bash game tools, source `scripts/dev/env.sh` or `scripts/dev/nie-env.sh`
from IECODE. Each selects `.env.local` when present, otherwise `.env`.
The NIE script also loads the workstation's non-secret machine paths.
On this workstation, `NIE_GAME_DIR`, `IEVR_GAME_DIR` and `NIE_GAME_PATH` point
to the private `data/` installation, which contains the executable, CPK list
and game directories. `IECODE_ROOT` remains the repository root.

Run an RG application from its own directory so Bun/Next loads that application's
configuration. Bun supports explicit `--env-file` arguments when launching from
another directory. Its dotenv precedence is documented in the
[official Bun environment-variable documentation](https://bun.sh/docs/runtime/environment-variables).
Avoid exporting a generic `DATABASE_URL` in a global shell profile: it can
select a different application's database despite its local configuration.

```bash
cd apps/rg/website
bun run build
```

A source-only build snapshot needs the website's private build environment
injected explicitly. Successful TypeScript bundling alone does not prove that
page collection, database access or deployment succeeds.

## Database boundary

The [SQL convergence decision](https://github.com/aphrody-labs/aphrody/blob/main/docs/decisions/infra/sql-convergence.md)
keeps RG and Achillea in the Supabase Cloud project `rg`, Inagle/NIE gameplay
projections in the Neon project `inagle`, Shenron in `shenron_site`, and training
metadata in its separate training store. The RG and gameplay URLs must remain
separate even when an application reads both stores.

IECODE does not derive `INAGLE_DATABASE_URL`/`NIE_PG_URL` from an inherited
generic `DATABASE_URL`. The Inagle migration runner rejects Supabase hosts.
RG libraries accept `RG_DATABASE_URL` first and only retain generic URL names
as RG-only compatibility aliases. Store provider credentials in each owner's
existing private runtime configuration; do not copy credentials between owners.

## Local checks

```bash
bash -c 'source scripts/dev/env.sh >/dev/null; test -f "$NIE_GAME_DIR/cpk_list.cfg.bin"'
git check-ignore .env .env.local
bun run test:integration
```

The 2026-10-01 audit corrected the game-directory settings and the cron's
stale cloud endpoints after private backups. Bash and Nushell path checks pass;
Nushell does not export a generic database URL. Bun also verifies the three RG application configurations select `rg`, and
Aphrody training has its own configured URL without a generic database export.
A read-only RG connection check currently fails because the local PostgreSQL
18/main cluster is stopped. These checks do not establish production service
connectivity.
