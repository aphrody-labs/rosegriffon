#!/usr/bin/env bash
# Déploiement web self-host VPS pour Website (rosegriffon.fr — Next 16 standalone).
# Idempotent — à relancer APRÈS chaque `next build` : le build régénère
# `.next/standalone/` et N'INCLUT PAS `public/` ni `.next/static`.
set -eo pipefail

cd /home/ubuntu/rg/apps/website

SA=.next/standalone/apps/website

echo "[deploy] build present ?"
test -f .next/BUILD_ID || { echo "ERREUR: lance d'abord 'next build'"; exit 1; }

# Répertoire .bun-cache requis par la conf systemd (ReadWritePaths)
mkdir -p /home/ubuntu/rg/apps/website/.bun-cache

echo "[deploy] static → standalone (chunks JS/fonts)"
mkdir -p "$SA/.next"
rm -rf "$SA/.next/static"
cp -r .next/static "$SA/.next/static"

# Cache ISR : standalone n'embarque PAS .next/cache. Le pré-créer (évite EROFS/EACCES).
mkdir -p "$SA/.next/cache"

echo "[deploy] public → standalone"
rm -rf "$SA/public"
cp -r public "$SA/public"

echo "[deploy] OK — restart : sudo systemctl restart website-web.service"
