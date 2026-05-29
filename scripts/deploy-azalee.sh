#!/usr/bin/env bash
# Déploiement web self-host VPS pour Azalee (Next 16 standalone).
# Idempotent — à relancer APRÈS chaque `next build` : le build régénère
# `.next/standalone/` et N'INCLUT PAS `public/` ni les `data/*` exclus du tracing.
set -eo pipefail

cd /home/ubuntu/rg/apps/azalee

SA=.next/standalone/apps/azalee

echo "[deploy] build present ?"
test -f .next/BUILD_ID || { echo "ERREUR: lance d'abord 'next build'"; exit 1; }

# Créer le répertoire .bun-cache requis par la configuration systemd (ReadWritePaths)
mkdir -p /home/ubuntu/rg/apps/azalee/.bun-cache

echo "[deploy] static → standalone (chunks JS/fonts)"
# S'assurer que le répertoire .next existe dans standalone
mkdir -p "$SA/.next"
rm -rf "$SA/.next/static"
cp -r .next/static "$SA/.next/static"

# Cache ISR : standalone n'embarque PAS .next/cache.
# Le pré-créer pour éviter EROFS / EACCES au runtime.
mkdir -p "$SA/.next/cache"

echo "[deploy] public → standalone"
rm -rf "$SA/public"
cp -r public "$SA/public"

echo "[deploy] data → standalone"
rm -rf "$SA/data"
cp -r data "$SA/data"

echo "[deploy] OK — restart : sudo systemctl restart azalee-web.service"
