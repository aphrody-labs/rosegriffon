#!/usr/bin/env bash
# Deploy du bot Discord Rose Griffon sur le VPS.
#
# Étapes :
#   1. Build via bun (depuis ~/rg/apps/bot/)
#   2. Rsync vers /home/ubuntu/rg-bot-prod/ (hors monorepo, pour ne pas bloquer git)
#   3. systemctl restart rg-bot.service
#   4. Smoke health journalctl 30s
#
# Usage : bash scripts/deploy-bot.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOT_DIR="$REPO_ROOT/apps/bot"
DEPLOY_DIR="/home/ubuntu/rg-bot-prod"
SERVICE="rg-bot.service"

echo "[deploy-bot] build…"
cd "$BOT_DIR"
bun run build

echo "[deploy-bot] sync vers $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
rsync -a --delete \
	--exclude='.git/' --exclude='node_modules/' --exclude='.turbo/' \
	--exclude='__tests__/' --exclude='*.log' \
	"$BOT_DIR/" "$DEPLOY_DIR/"

# Lien symbolique node_modules sur le cache hoisted du monorepo
ln -sfn "$REPO_ROOT/node_modules" "$DEPLOY_DIR/node_modules"

echo "[deploy-bot] restart $SERVICE"
sudo systemctl restart "$SERVICE"
sleep 2
sudo systemctl status --no-pager "$SERVICE" | head -10

echo "[deploy-bot] smoke logs (30s)…"
journalctl -u "$SERVICE" --since "30 seconds ago" --no-pager | tail -20

echo "[deploy-bot] OK"
