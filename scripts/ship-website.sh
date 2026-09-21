#!/usr/bin/env bash
# ship-website.sh — conservé pour compatibilité (README, documentation, habitudes).
#
# Le déploiement passe désormais par `scripts/ops/deploy.ts` : bascule bleu/vert sans
# coupure (le nouveau build démarre sur un second port, est sondé, puis nginx bascule),
# au lieu du `systemctl restart` qui coupait le service le temps du démarrage de Next.
# Options utiles : --no-build (publier les artefacts déjà bâtis), --no-gate (sauter le
# type-check), --allow-low-memory. `bun scripts/ops/deploy.ts --help` liste tout.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bun "$REPO_ROOT/scripts/ops/deploy.ts" deploy website "$@"
