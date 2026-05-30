#!/bin/bash
set -e

# Go to repository root
cd "$(dirname "$0")/../../.."

echo "======================================================"
echo "🌊 [$(date)] Running Data Processing Wave Cycle..."
echo "======================================================"

# 1. Run the wave processing scripts (Zukan audit, series correction, glossary, asset xref, patch notes sync)
bun scripts/inagle/pipeline/wave-processing.ts

# 2. Sync database corrections back to characters.json
bun scripts/inagle/pipeline/sync-db-to-json.ts

# 3. Check if characters.json has changed
if git diff --name-only | grep -q "characters.json"; then
    echo "✨ Detected changes in characters.json! Rebuilding Next.js application..."
    
    # Commit changes
    git add packages/inagle/src/entries/characters.json
    git commit -m "chore(inagle): auto-align characters.json with latest DB corrections"
    
    # Rebuild Next.js standalone server
    CI=true bun run build
    
    # Restart the Next.js service
    echo "🔄 Restarting web service..."
    sudo -n systemctl restart azalee-web.service
    echo "✅ Service restarted successfully."
else
    echo "✨ No changes detected in characters.json. Skipping build and restart."
fi

echo "======================================================"
echo "🎉 Wave Cycle finished successfully."
echo "======================================================"
