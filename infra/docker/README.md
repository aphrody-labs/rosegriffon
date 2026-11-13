# Rose Griffon Docker stack

`compose.yaml` (repository root) runs every Rose Griffon process on the `prod` role host
(`just host prod`; roles in `infra/hosts.toml`, overview in `docs/ARCHITECTURE.md`). Images come from
[`Dockerfile`](./Dockerfile), one target per service. The systemd units in `infra/systemd/`
and the host nginx files in `infra/nginx/` stay in the repository as the rollback path.

## Topology

```
Cloudflare -> host nginx (vps, TLS, every vhost: aphrody.com, rpbey.fr, nie.aphrody.app, ...)
                 | rosegriffon.fr, www, ranked, api, bot, cdn  (host-nginx/rosegriffon-stack.conf)
                 v
              127.0.0.1:18080 -> stack nginx (container: routing, proxy_cache, rate limits,
                                  /raw /vfs /depot 404, /static from /data/cdn)
                                   -> website:3100  core:8810  model-serve:8792
```

The host nginx stays the public entry for everything and is never switched off. The stack
nginx publishes only `127.0.0.1:18080`; the other services publish nothing.

## Services

| Service       | Source                                                                                                                                               | Port                    | Health                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------ |
| `nginx`       | `nginxinc/nginx-unprivileged:1.29-alpine`, `infra/docker/nginx/`                                                                                     | 8080 -> 127.0.0.1:18080 | `/nginx-health`                            |
| `website`     | `apps/rg-website` (Next standalone, Bun)                                                                                                             | 3100                    | `/api/health` (503 = DB down, still alive) |
| `core`        | `apps/rg-bot/src/core.ts`: Discord gateways rg/azalee/achillea, ranked Colyseus, unified API `/v1`, bot admin, in-process cron. Aliases `api`, `bot` | 8810                    | `/health`                                  |
| `model-serve` | `crates/aphrody-nie-model-serve`, static musl                                                                                                        | 8792                    | `/health`                                  |
| `cron`        | `packages/rg-cron/src/scheduler.ts`, profile `cron-split` (opt-in)                                                                                   | 8811                    | `/health`                                  |
| `steam-depot` | profile `tools`, `infra/docker/steam-depot/` (other agent)                                                                                           | none                    | on demand                                  |
| `cdn-sync`    | profile `tools`, Bun.s3 push to R2/S3 (other agent)                                                                                                  | none                    | on demand                                  |

API and bots stay one process: the unified API reads the live gateway client and relays the
per-profile admin servers on :8810; a split would need a second Discord login with the same token.

Cron runs inside core by default (`RG_CORE_CRON=1`): the bot subscribes to its `task.done` and
`tweets.signal` events in process (`apps/rg-bot/src/lib/cron-ipc.ts`), and Redis is used only
as a cache, so there is no cross-process bus yet. Follow-up: publish those events on Redis
pub/sub (`REDIS_URL=redis://host.docker.internal:6379`), then switch with
`RG_CORE_CRON=0 docker compose --profile cron-split up -d --wait`.

## Host layout

| Host path (vps)                      | Container path                                                             | Mode |
| ------------------------------------ | -------------------------------------------------------------------------- | ---- |
| `/srv/rosegriffon/game/ievr`         | `/data/game` (model-serve)                                                 | ro   |
| `/srv/rosegriffon/steam`             | `STEAM_HOME` (steam-depot), 0700                                           | rw   |
| `/srv/rosegriffon/cdn/static`        | `/data/cdn` (nginx ro; core, cron rw)                                      |      |
| `/srv/rosegriffon/cache/nginx`       | `/var/cache/nginx`                                                         | rw   |
| `/srv/rosegriffon/cache/model-serve` | `/var/cache/nie-model-serve`                                               | rw   |
| `/srv/rosegriffon/state`             | `/var/lib/rg-core` (core, cron); `state/media` -> `/data/media` (nginx ro) | rw   |
| `/srv/rosegriffon/nie`               | `/srv/nie`, model-serve working dir (`var/*.ndjson`)                       | rw   |
| `/srv/rosegriffon/log/nginx`         | `/var/log/nginx` (nginx rw; core, cron ro: `rg-stats.log`)                 |      |
| `/etc/rosegriffon/rosegriffon.env`   | `env_file` of every service, build secret `rg_env`                         | 0640 |

All bind mounts. No named volume holds data; build caches are BuildKit cache mounts.
Containers run as uid 1000, the host `ubuntu` user that owns `/srv/rosegriffon`.

## Environment

`/etc/rosegriffon/rosegriffon.env` replaces `/etc/aphrody/rg-core.env` (core, cron) and
`/etc/rg/rg.env` (website). Names only: [`.env.example`](./.env.example). Compose sets the paths
and ports per service (`NIE_GAME_DIR=/data/game`, `CDN_STATIC_ROOT=/data/cdn`, `RG_MEDIA_ROOT`,
`ACHILLEA_BACKUP_DIR`, `RG_CORE_*`, `NIE_MODEL_*`), overriding the file.

```sh
sudo install -d -m 0750 -o root -g ubuntu /etc/rosegriffon
sudo sh -c 'cat /etc/rg/rg.env /etc/aphrody/rg-core.env > /etc/rosegriffon/rosegriffon.env'  # later keys win
sudo chown root:ubuntu /etc/rosegriffon/rosegriffon.env && sudo chmod 0640 /etc/rosegriffon/rosegriffon.env
# Then edit (never print the file): drop host paths (NIE_*, RG_MEDIA_ROOT, CDN_STATIC_ROOT,
# ACHILLEA_BACKUP_DIR, HOSTNAME, PORT); 127.0.0.1/localhost URLs (REDIS_URL...) become
# host.docker.internal; multi-line values (GOOGLE_PRIVATE_KEY) stay double-quoted.
```

`0640 root:ubuntu`: `docker compose` runs as `ubuntu` and must read the file. The website build
reads it as BuildKit secret `rg_env` inside one `RUN`; only `NEXT_PUBLIC_*` reach the bundle.

## Deploy

Hosts, services and verbs are described once in [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
The stack deploys to the host holding the `prod` role (`infra/hosts.toml`):

```sh
just deploy [service|all] [--ref REF]   # checkout, build, up -d --wait on the prod host, then verify
just verify [service|all]               # service health in the stack network, stack nginx, public names
just rollback <tag> [service]           # previous images (tag = short commit of a good deploy)
just migrate <service> --to <role|host> # move state + service (dry run unless --apply)
```

Each host has its own stack checkout (`stack_dir` in `infra/hosts.toml`). The images are built
there, tagged with the short commit, and the deploy refuses to start while `rg-core.service`
is active (two processes would log the bots in twice and run cron twice).

## Cutover (not done; by hand, in order)

1. Data layout:
   ```sh
   sudo install -d -o ubuntu -g ubuntu /srv/rosegriffon/{game,cdn,cache/nginx,cache/model-serve,state,nie,log/nginx}
   sudo install -d -m 0700 -o ubuntu -g ubuntu /srv/rosegriffon/steam
   # Game: real directory behind /home/ubuntu/games/ievr -> /srv/rosegriffon/game/ievr
   src=$(readlink -f /home/ubuntu/games/ievr)
   sudo mv "$src" /srv/rosegriffon/game/ievr          # same filesystem; otherwise rsync -aH, then remove
   ln -sfn /srv/rosegriffon/game/ievr /home/ubuntu/games/ievr   # keeps the systemd rollback path valid
   sudo rsync -aH /var/lib/rg-core/ /srv/rosegriffon/state/
   sudo rsync -aH /var/lib/rg-core/cdn/static/ /srv/rosegriffon/cdn/static/
   sudo rsync -aH /home/ubuntu/apps/nie/var /srv/rosegriffon/nie/
   sudo rsync -aH /home/ubuntu/apps/nie/cache/ /srv/rosegriffon/cache/model-serve/
   sudo chown -R ubuntu:ubuntu /srv/rosegriffon
   ```
   Then the env file migration above.
2. Build ahead, no start: `cd ~/src/rosegriffon-stack && docker compose build`.
3. Switch (outage of about one `up --wait`):
   ```sh
   sudo systemctl stop rg-core rg-website
   cd ~/src/rosegriffon-stack && docker compose up -d --wait
   sudo install -m 644 infra/docker/host-nginx/rosegriffon-stack-proxy.inc /etc/nginx/snippets/
   sudo install -m 644 infra/docker/host-nginx/rosegriffon-stack.conf /etc/nginx/conf.d/
   sudo mkdir -p /etc/nginx/conf.d.off && sudo mv /etc/nginx/conf.d/rg-core.conf /etc/nginx/conf.d/rosegriffon.fr.conf /etc/nginx/conf.d.off/
   sudo nginx -t && sudo systemctl reload nginx
   just verify
   sudo systemctl disable rg-core rg-website
   ```
   `nie.aphrody.app` still includes `snippets/nie-assets.inc`, which proxies to
   `127.0.0.1:8810`: point it at the stack (`proxy_pass http://127.0.0.1:18080` with
   `proxy_set_header Host cdn.rosegriffon.fr`) in the same reload, or it returns 502.

## Rollback

```sh
sudo mv /etc/nginx/conf.d.off/rg-core.conf /etc/nginx/conf.d.off/rosegriffon.fr.conf /etc/nginx/conf.d/
sudo rm /etc/nginx/conf.d/rosegriffon-stack.conf
cd ~/src/rosegriffon-stack && docker compose down          # data stays in /srv/rosegriffon
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl enable --now rg-core rg-website
# legacy systemd checks: see infra/systemd/
```

The systemd units still read `/etc/aphrody/rg-core.env`, `/etc/rg/rg.env` and `/var/lib/rg-core`.
State written by the stack lives in `/srv/rosegriffon/state`; copy it back
(`rsync -aH /srv/rosegriffon/state/ /var/lib/rg-core/`) for a late rollback.

## Open points

- Host paths in the env file (`GOOGLE_APPLICATION_CREDENTIALS`, `NIERS_ROOT`,
  `APHRODY_WORKSPACE_ROOT`, `RG_BOT_DIR`, `APHRODY_BIN`, `RG_CRON_SHARED_ROOT`,
  `RANKED_STORAGE_DIR`) must point inside a mount (`/var/lib/rg-core/...`) or be mounted.
- `rust-toolchain.toml` says `nightly` without a date: pin `RUST_TOOLCHAIN` in the Dockerfile.

## Production on prd (cutover done 2026-11-12)

Roles (infra/hosts.toml): build/storage = vps, cdn = cdn, prod = prd.

```
Cloudflare --(origin rule: port 8443)--> prd host nginx :8443 (TLS, lineage rosegriffon.fr)
                                              -> stack nginx 127.0.0.1:18080 -> website, core, model-serve
cdn.rosegriffon.fr, nie.aphrody.app --> cdn nginx :443 (/static from disk, rest cached)
                                              -> prd :8443 (origin vhost allow-listed to cdn)
```

- prd ports 80/443 belong to the shenron-gateway container: the Rose Griffon TLS entry is
  8443 (`host-nginx/nginx.prd.conf`, `rosegriffon-stack.conf`). Cloudflare zone rule
  "rosegriffon prd origin port" (phase http_request_origin) sends the prod names to 8443, then the src rule
  `aphrody-origin-cacheable-port` sends rosegriffon.fr/www to 9443 (same server block): Cloudflare never caches an
  8443 origin, and the edge copy is what keeps the site up while prd reboots;
  `/etc/fleet/firewall.nft` opens 8443 and 9443 to the Cloudflare ranges (comment `rosegriffon-cf`).
- Images: `just build` on vps, `just deploy` ships them (`docker save | docker load`).
  vps builds with `/etc/rosegriffon/rosegriffon.build.env` (loopback DB URLs, host network).
- prd data: `/srv/rosegriffon` (state, cdn/static, game/ievr read-only copy, db/inagle owned
  by uid 70, cache/nginx and log/nginx owned by uid 101). Secrets in `/srv/rosegriffon/secrets`.
- Assets: `rg-cdn-sync.timer` on vps runs `infra/scripts/sync-cdn.sh` (prd -> vps -> cdn, R2
  bucket `rosegriffon-cdn`). `just cdn-sync` runs it now; `just cdn-edge` reinstalls the edge.
- Rollback: on cdn `~/rg-dns-rollback.sh` (records back to vps, origin rule emptied), on prd
  `docker compose stop core website`, on vps `sudo systemctl enable --now rg-core rg-website`.
  The systemd units on vps are disabled, not removed.
