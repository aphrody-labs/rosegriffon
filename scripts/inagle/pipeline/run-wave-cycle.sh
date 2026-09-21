#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "======================================================"
echo "🌊 [$(date)] Running Data Processing Wave Cycle..."
echo "======================================================"

# 1. Run the wave processing scripts (Zukan audit, series correction, glossary, asset xref, patch notes sync)
bun scripts/inagle/pipeline/wave-processing.ts

# 2. Sync database corrections back to characters.json
bun scripts/inagle/pipeline/sync-db-to-json.ts

# 3. Check if characters.json has changed
if ! git diff --quiet -- packages/inagle/src/entries/characters.json; then
    echo "✨ Detected changes in characters.json! Rebuilding Next.js application..."
    
    # Commit changes
    git add packages/inagle/src/entries/characters.json
    git commit -m "chore(inagle): auto-align characters.json with latest DB corrections"
    
    # Rebuild Next.js standalone server
    CI=true bun --filter @rosegriffon/website build
    
    # Republication sans coupure (bascule bleu/vert) au lieu d'un restart brutal.
    echo "🔄 Publication de la nouvelle version..."
    bun "$REPO_ROOT/scripts/ops/deploy.ts" deploy website --no-build --no-gate
    echo "✅ Nouvelle version en ligne."
else
    echo "✨ No changes detected in characters.json. Skipping build and restart."
fi

echo "======================================================"
echo "🎉 Wave Cycle finished successfully."
echo "======================================================"
