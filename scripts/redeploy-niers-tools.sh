#!/usr/bin/env bash
# redeploy-niers-tools.sh — redeploy azalee après un changement de CODE dans
# apps/azalee/app/tools/niers/** ou apps/azalee/lib/niers-releases.ts.
#
# PAS nécessaire pour une simple nouvelle release niers (msi/nsis/zip) : la page
# `/tools/niers` et l'endpoint `/tools/niers/latest.json` lisent l'API GitHub
# Releases EN DIRECT via `lib/niers-releases.ts` (cache 1h) — ils se mettent à jour
# tout seuls. Ce script ne sert que quand le CODE de ces routes a changé (contrat
# JSON de l'updater, mise en page de la page de download, etc.) — appelé
# automatiquement par `scripts/release-desktop.sh --ship-azalee` côté dépôt niers,
# ou à la main après un `git pull` sur ce dépôt.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.bun/bin:$PATH"

echo "▸ git pull (rg)…"
git -C "$ROOT" pull --ff-only

echo "▸ build + deploy + restart + healthcheck (ship-azalee.sh)…"
bash "$ROOT/scripts/ship-azalee.sh"

echo "▸ vérification live…"
for path in "/tools/niers" "/tools/niers/latest.json"; do
	code="$(curl -s -o /dev/null -w '%{http_code}' "https://azalee.rosegriffon.fr$path")"
	echo "  $path → $code"
done
