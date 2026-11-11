# Rose Griffon infra over the Bun workspace (turbo stays the task runner).
# `just` lists the recipes. Bun only: no node, npm, npx, pnpm or yarn.

set shell := ["bash", "-euo", "pipefail", "-c"]
set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

# Documented RG VPS hop (docs/vps/RUNBOOK-2026-11-05.md section 4): prod, then WireGuard to vps.
vps := "ssh -o BatchMode=yes prod \"ssh -o BatchMode=yes vps bash -s\""

default:
    @just --list

# Install workspace dependencies (msw postinstall fails on Bun canaries).
install:
    bun install --ignore-scripts

# Type-check every workspace (turbo run typecheck).
check:
    bun run typecheck

lint:
    bun run lint

test:
    bun run test

# Production build of every workspace (turbo run build).
build:
    bun run build

# Full gate: check, lint, test, build.
ci: check lint test build

# Single-file `rg-core` executable (scripts/compile.ts); extra args are forwarded.
compile *args:
    bun scripts/compile.ts {{args}}

# Regenerate rg-ui theme packs and design tokens.
tokens:
    cd packages/rg-ui && bun run themes

# --- Deploy: wrappers around the documented VPS scripts, never run implicitly ---

# 4.1 Read-only preflight on the VPS.
[script("bash", "-euo", "pipefail")]
deploy-preflight:
    {{vps}} <<'EOF'
    systemctl is-active rg-core rg-website
    df -h / /home | tail -2
    sha256sum /usr/local/bin/rg-core
    EOF

# 4.3 Build and install rg-core, then build the site (/home/ubuntu/ops/build-site-root.sh).
[script("bash", "-euo", "pipefail")]
deploy-build:
    {{vps}} <<'EOF'
    setsid nohup /home/ubuntu/ops/build-site-root.sh > /home/ubuntu/logs/build-root.log 2>&1 < /dev/null &
    sleep 2; echo started
    EOF

# 4.3 Follow the VPS build log.
[script("bash", "-euo", "pipefail")]
deploy-status:
    {{vps}} <<'EOF'
    grep -E "^[0-9a-f]{7} |packages installed|compile +dist/rg-core|^(active|inactive|failed)$|BUILD-EXIT|rror" /home/ubuntu/logs/build-root.log | tail -8
    EOF

# 4.4 Switch the site to the new build (/home/ubuntu/ops/deploy-from-tmp.sh), after BUILD-EXIT=0.
[script("bash", "-euo", "pipefail")]
deploy-site:
    {{vps}} <<'EOF'
    /home/ubuntu/ops/deploy-from-tmp.sh
    EOF

# 4.5 Post-deploy checks.
[script("bash", "-euo", "pipefail")]
deploy-verify:
    {{vps}} <<'EOF'
    cat /home/ubuntu/apps/rg/current/apps/rg-website/.next/BUILD_ID; echo
    systemctl show rg-website -p ActiveEnterTimestamp -p NRestarts
    curl -s -o /dev/null -w "site %{http_code} %{time_total}s\n" http://127.0.0.1:3100/
    for h in rosegriffon.fr achillea.rosegriffon.fr api.rosegriffon.fr ranked.rosegriffon.fr; do
    curl -s -o /dev/null -w "$h %{http_code}\n" --max-time 10 https://$h/; done
    EOF
