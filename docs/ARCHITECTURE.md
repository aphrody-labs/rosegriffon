# Rose Griffon architecture

One page for how Rose Griffon is laid out and operated: host roles, service modules,
data flow, and how to move a service or add a host. Everything below is driven by two
manifests and one CLI; nothing else should name a machine, an address or a host path.

| Source of truth | Owns |
| --- | --- |
| [`infra/hosts.toml`](../infra/hosts.toml) | roles -> hosts: ssh alias, public and mesh IP, cores, capabilities, `srv_root`, `stack_dir`, `env_file` |
| [`infra/services.toml`](../infra/services.toml) | the service registry and the public apex domain |
| [`packages/rg-config/infra.ts`](../packages/rg-config/infra.ts) (`@rosegriffon/config/infra`) | typed loader and resolvers for both manifests |
| [`packages/rg-config/rg-urls.ts`](../packages/rg-config/rg-urls.ts) (`@rosegriffon/config/rg-urls`) | public origins derived from `RG_DOMAIN`, typed env parsing for service code |
| [`infra/ops/cli.ts`](../infra/ops/cli.ts) | the verbs; `justfile` and `rg <verb>` are thin wrappers |

## Roles and hosts

A role is a job (build, storage, cdn, prod, any new one); a host is a machine. Code and
recipes ask for a role and get a host back:

```sh
just host prod                 # resolved host as JSON
just host build ssh            # one field
just ssh storage -- df -h /srv # remote command on the storage host
bun infra/ops/cli.ts env prod  # RG_SRV_ROOT, RG_ENV_FILE, RG_STACK_DIR, RG_DOMAIN exported to compose
```

Current mapping (see the manifest for addresses): `build` and `storage` on `vps` (12 cores,
sccache, game install, Steam home, backups), `cdn` on `cdn` (static assets, R2 sync origin,
Bun test runs), `prod` on `prd` (the compose stack).

Overrides, for one command or a whole session:

- `RG_HOST_<ROLE>=<host key | ssh alias>`: re-point a role (`RG_HOST_PROD=vps just verify`).
  An unknown value is used as an ad hoc ssh alias with the default paths.
- `RG_HOST_<KEY>_<FIELD>=<value>`: one field of one host (`RG_HOST_PRD_SRV_ROOT=/data/rg`).
- `RG_DOMAIN=<apex>`: the public domain used for vhosts, verification and URL defaults.

## Service modules

Every deployable unit has the same contract in `infra/services.toml`:

| Field | Meaning |
| --- | --- |
| `entry` | source entry point |
| `dockerfile` + `target` (or `image`) | how its image is built |
| `compose` (+ `profile`) | compose file and service name; a profile makes it opt-in |
| `port`, `health` | container port and HTTP health path |
| `role` | host role it deploys to (overridable per verb with `--role`) |
| `state` | directories under the host `srv_root` that belong to it (moved by `migrate`) |
| `env` | configuration keys; values only in the host `env_file`, never in the repository |
| `vhosts` | public names it answers (`@` = apex), used by `verify` |
| `upstream` | nginx upstream rendered into `infra/docker/nginx/conf.d/00-upstreams.conf` |

Units: `website` (Next standalone on Bun), `core` (API, Discord bots, ranked, in-process
cron), `cron` (profile `cron-split`), `model-serve` (static musl Rust), `nginx` (stack
router, only published port), `steam-depot` and `cdn-sync` (profile `tools`, on demand).
`just services` prints the registry with resolved hosts.

Configuration is env only. Service code reads its own variables through
`@rosegriffon/config/rg-urls` (`rgUrl(process.env, "api", "PUBLIC_API_URL")`) or the typed
parsers `envString`, `envInt`, `envBool`; defaults derive from `RG_DOMAIN`, never from a
literal host. Containers see fixed in-container paths (`/data/game`, `/data/cdn`,
`/var/lib/rg-core`); compose maps them onto `${RG_SRV_ROOT}` on the host.

Generated config: `just render` rewrites files derived from the registry; `just render --check`
fails on drift (also asserted by `infra/ops/scripts.test.ts`).

## Data flow

```
Cloudflare -> host nginx on prod (TLS) -> 127.0.0.1:${RG_NGINX_PORT} stack nginx
                                            -> website:3100  core:8810  model-serve:8792
storage host: steam-depot writes ${srv_root}/game/ievr  -> read-only into model-serve
core / cron write ${srv_root}/state and ${srv_root}/cdn/static
cdn host: cdn-sync pushes cdn/static to R2/S3; cdn.<domain> serves /static
Postgres, auth, storage: Supabase; game data mirror: Neon (URLs in the env file)
```

## Verbs

All take `<service|all>`, `--role R` to override the target, `--ref REF` (default
`origin/main`) and `--dry-run` to print the generated remote script.

```sh
just build  [service]           # images on the build role
just deploy [service]           # checkout + build + up -d --wait on the service role, then verify
just verify [service]           # health inside the stack network, then vhosts
just rollback <tag> [service]   # restart on a previous RG_TAG, no build
just migrate <service> --to <role|host> [--from <role|host>] [--apply]
```

## Migrating a service

`just migrate core --to vps` prints the plan; `--apply` runs it:

1. prepare: checkout and build the service on the target;
2. stop it on the source (state stays there for rollback);
3. sync its `state` dirs `source:srv_root/<dir>` -> `target:srv_root/<dir>` with rsync from
   the source host (the source needs ssh access to the target), plus the env file when the
   target has none;
4. start it on the target (`up -d --wait`);
5. verify it there.

Then make it permanent: point the role at the new host in `infra/hosts.toml` (or set
`RG_HOST_<ROLE>`), and repoint the public proxy or DNS for its vhosts. The CLI never
touches DNS. On failure after step 1, restart on the source: `just deploy <service> --role <source>`.

## Adding a host

1. Add an ssh alias for it (`~/.ssh/config`).
2. Add `[hosts.<key>]` to `infra/hosts.toml` with `ssh`, `user`, addresses, `capabilities`,
   `srv_root`, `stack_dir`, `env_file`.
3. Install Docker, create `srv_root` and the env file (mode 0600/0640, names in
   `infra/docker/.env.example`).
4. Point a role at it, or migrate services onto it with `just migrate <service> --to <key>`.

A new role is just a new key in `[roles]` and a `role = "<name>"` in the services that use it.

## Legacy

`infra/systemd/`, `infra/nginx/` (host vhosts), `scripts/assemble-vps-release.sh` and
`infra/scripts/{provision-vps-env,prune-vps-releases}.py` are the pre-container systemd path,
kept only as rollback until the prod cutover is closed. Do not build on them.
