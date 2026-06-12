#!/usr/bin/env bash
# ship-website.sh — déploiement web en UNE commande pour Website (rosegriffon.fr).
#   build (Next 16 standalone, runtime Node) → deploy static/public → restart → healthcheck.
# Idempotent. Usage : bash scripts/ship-website.sh
# Calqué sur ship-azalee.sh. Le build passe par scripts/next-build.sh (Node, PAS Bun,
# VERCEL unset → output:"standalone"). Service = website-web.service (port 3004).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBSITE="$ROOT/apps/website"

echo "▸ [1/4] build (Next.js standalone, runtime Node)…"
cd "$WEBSITE"
SERVER_JS=".next/standalone/apps/website/server.js"
BUILD_OK=0
for attempt in 1 2 3; do
	build_start=$(date +%s)
	BUILD_RC=0
	# package.json "build" = bash ../../scripts/next-build.sh (Node, standalone).
	SENTRY_SKIP_UPLOAD=1 NEXT_TELEMETRY_DISABLED=1 bun run build || BUILD_RC=$?
	if [ -f .next/BUILD_ID ] && [ "$(stat -c %Y .next/BUILD_ID)" -ge "$build_start" ] && [ -f "$SERVER_JS" ]; then
		[ "$BUILD_RC" -ne 0 ] && echo "⚠ build OK (BUILD_ID $(cat .next/BUILD_ID)) — code retour $BUILD_RC ignoré (artefacts présents)"
		BUILD_OK=1
		break
	fi
	echo "⚠ build $attempt incomplet (BUILD_ID frais=$([ -f .next/BUILD_ID ] && echo o || echo n) server.js=$([ -f "$SERVER_JS" ] && echo o || echo n), exit $BUILD_RC) — retry…" >&2
done
if [ "$BUILD_OK" -ne 1 ]; then
	echo "✗ build réellement échoué — standalone incomplet après 3 tentatives" >&2
	exit 1
fi

echo "▸ [2/4] deploy standalone (static/public)…"
bash "$ROOT/scripts/deploy-website.sh"

echo "▸ [3/4] restart website-web.service…"
sudo systemctl restart website-web.service

echo "▸ [4/4] healthcheck local port 3004 …"
LOCAL_URL="http://127.0.0.1:3004/"
for i in $(seq 1 15); do
	code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$LOCAL_URL" || echo 000)"
	if [ "$code" = "200" ]; then
		echo "✓ live local ($code) — déploiement OK"
		exit 0
	fi
	sleep 2
done
echo "✗ healthcheck KO (dernier code: ${code:-?}) — vérifier: sudo journalctl -u website-web.service -n 50" >&2
exit 1
