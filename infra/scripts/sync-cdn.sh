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
prod=${RG_PROD_SSH:-root@10.200.77.5}
cdn=${RG_CDN_SSH:-root@10.200.77.3}
bucket=${RG_R2_BUCKET:-r2:rosegriffon-cdn/static}
ssh_opts="-o BatchMode=yes -o ConnectTimeout=10"

mkdir -p "$src"
rsync -a -e "ssh $ssh_opts" "$prod:/srv/rosegriffon/cdn/static/" "$src/"
ssh $ssh_opts "$cdn" "install -d -o 1000 -g 1000 -m 0755 /srv/rosegriffon/cdn/static"
rsync -a --chmod=D755,F644 -e "ssh $ssh_opts" "$src/" "$cdn:/srv/rosegriffon/cdn/static/"
rclone copy --fast-list --transfers 16 "$src" "$bucket"
echo "sync-cdn ok $(date -u +%FT%TZ) files=$(find "$src" -type f | wc -l)"
