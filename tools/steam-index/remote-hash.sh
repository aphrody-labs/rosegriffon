#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Remote blake3 inventory of a Steam copy synced to a VPS. Never run the hashing on the Windows box.
#
#   sh tools/steam-index/remote-hash.sh <host> <remote_steam_root> [remote_repo]
#   e.g. sh tools/steam-index/remote-hash.sh prd /srv/steam-mirror/Steam
#
# Syncs this tool to the host, builds the Rust half there (release, 8 jobs), then runs the
# resumable indexer with --hash. The DB stays on the host at ~/.local/share/nie/steam-index.sqlite;
# fetch it with scp afterwards if needed. Rerunning resumes (unchanged size+mtime are skipped).
set -eu
host="$1"
steam_root="$2"
repo="${3:-~/src/apps/rosegriffon}"
here="$(cd "$(dirname "$0")" && pwd)"

ssh "$host" "mkdir -p $repo/tools/steam-index $repo/crates"
rsync -az --delete --exclude target "$here/" "$host:$repo/tools/steam-index/"
rsync -az "$here/../../Cargo.toml" "$here/../../rust-toolchain.toml" "$host:$repo/"
ssh "$host" "cd $repo/tools/steam-index && cargo build --release -j 8 && \
  nohup bun index.ts --hash --steam '$steam_root' > hash.log 2>&1 &"
echo "started on $host; follow with: ssh $host tail -f $repo/tools/steam-index/hash.log"
