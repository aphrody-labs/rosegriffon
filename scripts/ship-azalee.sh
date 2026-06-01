#!/usr/bin/env bash
# ship-azalee.sh — déploiement web en UNE commande pour Azalee.
#   build (Next 16) → standalone deploy → restart → healthcheck.
# Idempotent. Usage : bash scripts/ship-azalee.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AZALEE="$ROOT/apps/azalee"

echo "▸ [1/4] build (Next.js standalone)…"
cd "$AZALEE"
build_start=$(date +%s)
# `bun --smol --bun` (cf. package.json) peut segfault à la SORTIE (SIGILL)
# APRÈS un build complet sous Next 16. On valide l'artefact BUILD_ID plutôt
# que le code retour, sinon `set -e` aborte avant le restart.
BUILD_RC=0
SENTRY_SKIP_UPLOAD=1 NEXT_TELEMETRY_DISABLED=1 bun --env-file=../../.env.local run build || BUILD_RC=$?
if [ ! -f .next/BUILD_ID ] || [ "$(stat -c %Y .next/BUILD_ID)" -lt "$build_start" ]; then
	echo "✗ build réellement échoué — pas de BUILD_ID frais (exit $BUILD_RC)" >&2
	exit 1
fi
if [ "$BUILD_RC" -ne 0 ]; then
	echo "⚠ build OK (BUILD_ID $(cat .next/BUILD_ID)) — crash Bun à l'exit (code $BUILD_RC) ignoré"
fi

echo "▸ [2/4] deploy standalone (static/public/data)…"
bash "$ROOT/scripts/deploy-azalee.sh"

echo "▸ [3/4] restart azalee-web.service…"
sudo systemctl restart azalee-web.service

echo "▸ [4/4] healthcheck local port 3003 …"
# Le nom de domaine azalee.rosegriffon.fr pouvant pointer sur Vercel,
# nous vérifions l'instance VPS locale sur le port 3003 directement.
LOCAL_URL="http://127.0.0.1:3003/"
for i in $(seq 1 15); do
	code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$LOCAL_URL" || echo 000)"
	if [ "$code" = "200" ]; then
		echo "✓ live local ($code) — déploiement OK"
		exit 0
	fi
	sleep 2
done
echo "✗ healthcheck KO (dernier code: ${code:-?}) — vérifier: sudo journalctl -u azalee-web.service -n 50" >&2
exit 1
