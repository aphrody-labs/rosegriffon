#!/usr/bin/env bash
# ship-azalee.sh — conservé pour compatibilité (README, documentation, habitudes).
#
# Le déploiement passe désormais par `scripts/ops/deploy.ts` : bascule bleu/vert sans
# coupure (le nouveau build démarre sur un second port, est sondé, puis nginx bascule),
# au lieu du `systemctl restart` qui coupait le service le temps du démarrage de Next.
# Options utiles : --no-build (publier les artefacts déjà bâtis), --no-gate (sauter le
# type-check), --allow-low-memory. `bun scripts/ops/deploy.ts --help` liste tout.
set -euo pipefail
exec /home/ubuntu/.bun/bin/bun /home/ubuntu/rg/scripts/ops/deploy.ts deploy azalee "$@"
