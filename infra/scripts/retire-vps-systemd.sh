#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Runs on vps from rg-retire-systemd.timer. From RG_RETIRE_AFTER on, and only while prod on
# prd is healthy, retires the legacy systemd path (rg-core, rg-website): units are moved to
# /etc/systemd/system.retired/ (kept, not deleted), then the timer disables itself.
# Any failed check leaves everything in place for the next run.
set -eu
after=${RG_RETIRE_AFTER:-2026-11-15}
units="rg-core.service rg-website.service"
log() { echo "rg-retire: $*"; }

[ "$(date -u +%F)" \< "$after" ] && { log "before $after, nothing to do"; exit 0; }

for u in $units; do
  systemctl is-active --quiet "$u" && { log "$u is active: prod still on vps, keep"; exit 0; }
done
for url in https://rosegriffon.fr/api/health https://api.rosegriffon.fr/health https://rosegriffon.fr/wiki https://cdn.rosegriffon.fr/health; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url")
  [ "$code" = 200 ] || { log "$url answered $code: keep the rollback path"; exit 0; }
done
for p in raw vfs depot; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://cdn.rosegriffon.fr/$p/x")
  [ "$code" = 404 ] || { log "/$p answered $code: keep"; exit 0; }
done

install -d -m 0755 /etc/systemd/system.retired
for u in $units; do
  systemctl disable "$u" 2>/dev/null || true
  [ -f "/etc/systemd/system/$u" ] && mv "/etc/systemd/system/$u" /etc/systemd/system.retired/
done
systemctl daemon-reload
systemctl disable rg-retire-systemd.timer
log "retired $units to /etc/systemd/system.retired (restore: mv back, daemon-reload)"
