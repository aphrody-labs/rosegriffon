#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Runs on vps (storage role), as ubuntu, from rg-cdn-sync.timer.
# Derived public assets are written by core/cron on prd (/srv/rosegriffon/cdn/static).
#   1. prd  -> vps  storage copy (/srv/rosegriffon/cdn/static)
#   2. vps  -> cdn  edge disk   (/srv/rosegriffon/cdn/static, served under /static/)
#   3. vps  -> R2   bucket rosegriffon-cdn (rclone remote r2), off-site copy
# No --delete: the vps copy is the archive; the edge only gains files.
set -eu
src=${RG_CDN_STATIC:-/srv/rosegriffon/cdn/static}
prod=${RG_PROD_SSH:-root@10.200.77.5}   # "local" when this runs on the prod host itself
cdn=${RG_CDN_SSH:-root@10.200.77.3}
bucket=${RG_R2_BUCKET:-r2:rosegriffon-cdn/static}
ssh_opts="-o BatchMode=yes -o ConnectTimeout=10"
# Mesh first, public address when the WireGuard link drops: the timer must not need a human.
pick() { for h in "$@"; do ssh -n $ssh_opts "$h" true 2>/dev/null && { echo "$h"; return 0; }; done; echo "sync-cdn: no route ($*)" >&2; return 1; }
[ "$prod" = local ] || prod=$(pick "$prod" "${RG_PROD_SSH_PUBLIC:-root@72.60.186.43}")
cdn=$(pick "$cdn" "${RG_CDN_SSH_PUBLIC:-root@51.255.162.6}")

mkdir -p "$src"
[ "$prod" = local ] || rsync -a -e "ssh $ssh_opts" "$prod:/srv/rosegriffon/cdn/static/" "$src/"
ssh $ssh_opts "$cdn" "install -d -o 1000 -g 1000 -m 0755 /srv/rosegriffon/cdn/static"
rsync -a --chmod=D755,F644 -e "ssh $ssh_opts" "$src/" "$cdn:/srv/rosegriffon/cdn/static/"
rclone copy --fast-list --transfers 16 "$src" "$bucket"
echo "sync-cdn ok $(date -u +%FT%TZ) files=$(find "$src" -type f | wc -l)"
