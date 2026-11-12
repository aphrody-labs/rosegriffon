# Rose Griffon Docker stack

`compose.yaml` (repository root) runs every Rose Griffon process on `vps`. Images come from
[`Dockerfile`](./Dockerfile), one target per service. The systemd units in `infra/systemd/`
and the host nginx files in `infra/nginx/` stay in the repository as the rollback path.

## Services

| Service       | Target        | Source                                         | Port (internal) | Health                |
| ------------- | ------------- | ---------------------------------------------- | --------------- | --------------------- |
| `nginx`       | upstream image | `nginxinc/nginx-unprivileged:1.29-alpine`, `infra/docker/nginx/` | 8080, 8443 -> host 80, 443 | `/nginx-health` |
| `website`     | `website`     | `apps/rg-website` (Next standalone, Bun)        | 3100            | `/api/health` (503 = DB down, still alive) |
| `core`        | `core`        | `apps/rg-bot/src/core.ts`: Discord gateways rg/azalee/achillea, ranked Colyseus, unified API `/v1`, bot admin. Network aliases `api`, `bot` | 8810 | `/health` |
| `cron`        | `cron`        | `packages/rg-cron/src/scheduler.ts` (`Bun.cron` over the task registry) | 8811 | `/health` |
| `model-serve` | `model-serve` | `crates/aphrody-nie-model-serve`, static musl   | 8792            | `/health`             |
| `steam-depot` | profile `tools` | `infra/docker/steam-depot/` (`crates/bun-steam`, other agent) | none | on demand |
| `cdn-sync`    | profile `tools` | Bun.s3 push to R2/S3 (other agent)            | none            | on demand             |

The API and the bots stay one process: the unified API reads the live gateway client and
relays the per-profile admin servers on :8810, so splitting them would need a second Discord
login with the same token. `RG_CORE_CRON=0` and `RG_CORE_MODELES=0` turn off the in-process
cron and the supervised model-serve child that the systemd unit used.

Only `nginx` publishes ports. The others are reachable only on the `rosegriffon-backend` network.

## Host layout

| Host path (vps)                        | Container path                               | Mode |
| -------------------------------------- | -------------------------------------------- | ---- |
| `/srv/rosegriffon/game/ievr`           | `/data/game` (model-serve)                    | ro   |
| `/srv/rosegriffon/steam`               | `STEAM_HOME` (steam-depot), 0700              | rw   |
| `/srv/rosegriffon/cdn/static`          | `/data/cdn` (nginx, core: ro; cron: rw)       |      |
| `/srv/rosegriffon/cache/nginx`         | `/var/cache/nginx`                            | rw   |
| `/srv/rosegriffon/cache/model-serve`   | `/var/cache/nie-model-serve`                  | rw   |
| `/srv/rosegriffon/state`               | `/var/lib/rg-core` (core, cron); `state/media` -> `/data/media` (nginx, ro) | rw |
| `/srv/rosegriffon/nie`                 | `/srv/nie`, model-serve working dir (`var/*.ndjson` manifests) | rw |
| `/srv/rosegriffon/log/nginx`           | `/var/log/nginx` (nginx rw, cron ro: `rg-stats.log`) | |
| `/etc/letsencrypt`                     | `/etc/letsencrypt` (nginx)                    | ro   |
| `/etc/rosegriffon/rosegriffon.env`     | `env_file` of every service and build secret `rg_env` | 0600 |

All of these are bind mounts. No named volume holds data; build caches live in BuildKit cache
mounts (`/root/.bun/install/cache`, cargo registry, `target/`, `.next/cache`).
Containers run as uid 1000, the host `ubuntu` user that owns `/srv/rosegriffon`.

## Environment

`/etc/rosegriffon/rosegriffon.env` replaces both `/etc/aphrody/rg-core.env` (core, cron) and
`/etc/rg/rg.env` (website). Names only: [`.env.example`](./.env.example). Compose sets the
paths and ports per service (`NIE_GAME_DIR=/data/game`, `CDN_STATIC_ROOT=/data/cdn`,
`RG_MEDIA_ROOT`, `ACHILLEA_BACKUP_DIR`, `RG_CORE_*`, `NIE_MODEL_*`), overriding the file.

Migration of the file (once, as root on vps):

```sh
install -d -m 0750 -o root -g ubuntu /etc/rosegriffon
cat /etc/rg/rg.env /etc/aphrody/rg-core.env > /etc/rosegriffon/rosegriffon.env   # later keys win
chown root:ubuntu /etc/rosegriffon/rosegriffon.env && chmod 0640 /etc/rosegriffon/rosegriffon.env
# Edit: drop the host paths (NIE_*, RG_MEDIA_ROOT, CDN_STATIC_ROOT, ACHILLEA_BACKUP_DIR,
# HOSTNAME, PORT); replace 127.0.0.1/localhost URLs (REDIS_URL...) with host.docker.internal;
# keep multi-line values (GOOGLE_PRIVATE_KEY) double-quoted.
```

`0640 root:ubuntu` instead of `0600`: `docker compose` runs as `ubuntu` and must read the
file to inject it. The website build reads it as the BuildKit secret `rg_env`, inside one
`RUN`; `NEXT_PUBLIC_*` values end up in the client bundle by design, nothing else is kept.

## Deploy

```sh
just deploy-stack            # build on vps, up -d --wait, smoke checks
just deploy-stack <ref>      # a given commit or tag
just deploy-stack-smoke      # health of every service and of the public names
just deploy-stack-rollback <tag>   # previous images (tag = short commit of a good deploy)
```

`deploy-stack` uses its own checkout (`/home/ubuntu/src/rosegriffon-stack`, `RG_STACK_DIR`),
never the systemd build tree, builds there (heavy Rust build on the 12 vps cores), tags
images with the short commit, and runs `docker compose up -d --wait`.

## Cutover (not done yet; run by hand, in order)

Before: `just deploy-preflight` green, no deploy of the systemd setup in progress.

1. Directories and data:
   ```sh
   sudo install -d -o ubuntu -g ubuntu /srv/rosegriffon/{game,cdn,cache/nginx,cache/model-serve,state,nie,log/nginx}
   sudo install -d -m 0700 -o ubuntu -g ubuntu /srv/rosegriffon/steam
   # Game: /home/ubuntu/games/ievr (symlink target of the old Steam path) -> /srv/rosegriffon/game/ievr
   sudo mv "$(readlink -f /home/ubuntu/games/ievr)" /srv/rosegriffon/game/ievr   # same filesystem; else rsync -aH then remove
   ln -sfn /srv/rosegriffon/game/ievr /home/ubuntu/games/ievr                    # keeps the systemd rollback working
   sudo rsync -aH /var/lib/rg-core/ /srv/rosegriffon/state/
   sudo rsync -aH /var/lib/rg-core/cdn/static/ /srv/rosegriffon/cdn/static/
   sudo rsync -aH /home/ubuntu/apps/nie/var /srv/rosegriffon/nie/
   sudo rsync -aH /home/ubuntu/apps/nie/cache/ /srv/rosegriffon/cache/model-serve/
   sudo chown -R ubuntu:ubuntu /srv/rosegriffon
   ```
   Then the env file migration above.
2. Build without starting: `just deploy-stack` stops at the nginx port bind while the host
   nginx holds 80/443, so build first on vps: `cd ~/src/rosegriffon-stack && docker compose build`.
3. Switch (a short outage, about the length of `up --wait`):
   ```sh
   sudo systemctl stop rg-core rg-website
   sudo systemctl stop nginx          # see the risk below about the other vhosts
   cd ~/src/rosegriffon-stack && docker compose up -d --wait
   just deploy-stack-smoke
   sudo systemctl disable rg-core rg-website nginx
   ```

## Rollback

```sh
cd ~/src/rosegriffon-stack && docker compose down        # data stays on /srv/rosegriffon
sudo systemctl enable --now nginx rg-core rg-website
just deploy-verify
```

The systemd units still read `/etc/aphrody/rg-core.env`, `/etc/rg/rg.env` and
`/var/lib/rg-core`; leave them in place until the stack has run cleanly for a while. State
written by the stack after the cutover lives in `/srv/rosegriffon/state`: copy it back
(`rsync -aH /srv/rosegriffon/state/ /var/lib/rg-core/`) if the rollback happens later.

## Risks to check before the cutover

- The host nginx also serves aphrody.com, cdn.aphrody.com, downloads, creator, fleet-api,
  rpbey.fr and nie.aphrody.app (`/etc/nginx/conf.d`). Stopping it takes those down. Either port
  them into this nginx too, or keep the host nginx as the TLS front and publish the container
  on loopback (`RG_PUBLISH_ADDR=127.0.0.1 RG_HTTP_PORT=8080 RG_HTTPS_PORT=8443`).
- nie.aphrody.app used the same `nie-assets.inc` through rg-core: it needs a server block here
  (or in the host nginx) pointing at model-serve.
- Cron runs outside rg-core: the in-process `task.done` / `tweets.signal` events that the bot
  subscribed to (`apps/rg-bot/src/lib/cron-ipc.ts`) are no longer delivered. The real-time
  message watch stays in core (it needs the gateway). If those notifications matter, set
  `RG_CORE_CRON=1` on core and drop the `cron` service.
- `GOOGLE_APPLICATION_CREDENTIALS`, `NIERS_ROOT`, `APHRODY_WORKSPACE_ROOT`, `RG_BOT_DIR`,
  `APHRODY_BIN`, `RG_CRON_SHARED_ROOT`, `RANKED_STORAGE_DIR` are host paths in the env file:
  each must point inside a mount (`/var/lib/rg-core/...`) or be mounted.
- `rust-toolchain.toml` says `nightly` without a date: pin `RUST_TOOLCHAIN` in the Dockerfile
  for reproducible model-serve images.
