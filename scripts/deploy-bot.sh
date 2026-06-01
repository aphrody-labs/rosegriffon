#!/usr/bin/env bash
# Deploy du bot Discord Rose Griffon sur le VPS.
#
# Étapes :
#   1. Build via bun (depuis ~/rg/apps/bot/)
#   2. systemctl restart rg-bot.service
#   3. Smoke health journalctl 30s
#
# Usage : bash scripts/deploy-bot.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOT_DIR="$REPO_ROOT/apps/bot"
SERVICE="rg-bot.service"

echo "[deploy-bot] build…"
cd "$BOT_DIR"
bun run build

echo "[deploy-bot] restart $SERVICE"
sudo systemctl restart "$SERVICE"
sleep 2
sudo systemctl status --no-pager "$SERVICE" | head -10

echo "[deploy-bot] smoke logs (30s)…"
journalctl -u "$SERVICE" --since "30 seconds ago" --no-pager | tail -20

echo "[deploy-bot] OK"
