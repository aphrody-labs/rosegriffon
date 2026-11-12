# Rose Griffon infra over the Bun v1.4.4 workspace (bun run --filter '*' is the task runner).
# `just` lists the recipes. Bun only: no node, npm, npx, pnpm, yarn, or bunx.

set shell := ["bash", "-euo", "pipefail", "-c"]
set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

# Documented RG VPS hop (docs/vps/RUNBOOK-2026-11-05.md section 4): prod, then WireGuard to vps.
vps := "ssh -o BatchMode=yes prod \"ssh -o BatchMode=yes vps bash -s\""

default:
    @just --list

# Install workspace dependencies (msw postinstall fails on Bun canaries).
install:
    bun install --ignore-scripts

# Type-check every workspace (bun run --filter '*' typecheck).
check:
    bun run typecheck

lint:
    bun run lint

test:
    bun run test

# Production build of every workspace (bun run --filter '*' build).
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

# --- Docker stack (compose.yaml, infra/docker/README.md): the single deploy entry ---------

# Checkout dedicated to the stack on the VPS (never the systemd build tree).
stack_dir := env("RG_STACK_DIR", "/home/ubuntu/src/rosegriffon-stack")

# Build every image on the VPS (12 cores, per policy), start the stack with --wait, smoke-check.
[script("bash", "-euo", "pipefail")]
deploy-stack ref="origin/main":
    {{vps}} <<'EOF'
    set -euo pipefail
    dir={{stack_dir}}
    # Two rg-core processes would log the same Discord bots in twice and run cron twice.
    if systemctl is-active --quiet rg-core; then echo "rg-core.service is active: cut over first (infra/docker/README.md)"; exit 1; fi
    [ -d "$dir/.git" ] || git clone --filter=blob:none https://github.com/aphrody-dev/rosegriffon.git "$dir"
    git -C "$dir" fetch --quiet origin
    git -C "$dir" checkout --quiet --detach {{ref}}
    cd "$dir"
    export RG_TAG=$(git rev-parse --short HEAD)
    docker compose config -q
    docker compose build --pull
    docker compose up -d --wait --wait-timeout 300 --remove-orphans
    docker compose ps
    EOF
    just deploy-stack-smoke

# Health of every service from inside the stack network, then the public names through nginx.
[script("bash", "-euo", "pipefail")]
deploy-stack-smoke:
    {{vps}} <<'EOF'
    set -euo pipefail
    cd {{stack_dir}}
    docker compose ps
    for target in core:8810/health model-serve:8792/health website:3100/api/health nginx:8080/nginx-health; do
    docker compose exec -T nginx wget -q -O /dev/null -T 10 "http://$target" && echo "ok   $target" || echo "FAIL $target"
    done
    # Through the stack nginx on loopback (what the host nginx proxies to).
    for h in rosegriffon.fr api.rosegriffon.fr bot.rosegriffon.fr cdn.rosegriffon.fr; do
    curl -s -o /dev/null -w "stack $h %{http_code}\n" --max-time 10 -H "Host: $h" "http://127.0.0.1:18080/health"; done
    curl -s -o /dev/null -w "stack cdn /raw/x %{http_code} (want 404)\n" -H "Host: cdn.rosegriffon.fr" http://127.0.0.1:18080/raw/x
    # Public names through the host nginx (meaningful once its vhosts point at the stack).
    for h in rosegriffon.fr api.rosegriffon.fr bot.rosegriffon.fr cdn.rosegriffon.fr; do
    curl -s -o /dev/null -w "public $h %{http_code}\n" --max-time 10 "https://$h/health"; done
    EOF

# Roll the stack back to the previous image tag (RG_TAG of the last good deploy).
[script("bash", "-euo", "pipefail")]
deploy-stack-rollback tag:
    {{vps}} <<'EOF'
    cd {{stack_dir}} && RG_TAG={{tag}} docker compose up -d --wait --no-build
    EOF
