# Rose Griffon entry points. Thin wrappers: workspace tasks run Bun, host verbs run
# infra/ops/cli.ts, which resolves roles from infra/hosts.toml and services from
# infra/services.toml. No host, address or path is spelled here. See docs/ARCHITECTURE.md.
#
#   just deploy core              deploy one service to its role's host (prod by default)
#   just deploy all --role prod   the whole stack
#   just migrate core --to vps    dry run; add --apply to move state + service
#   RG_HOST_PROD=vps just verify  re-point a role for one command

set shell := ["bash", "-euo", "pipefail", "-c"]
set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

ops := "bun infra/ops/cli.ts"

default:
    @just --list

# --- workspace (local, light) -------------------------------------------------------

# Install workspace dependencies (no lifecycle scripts).
install:
    bun install --ignore-scripts

fmt:
    bun fmt

check:
    bun run typecheck

lint:
    bun run lint

test:
    bun run test

# Full gate: check, lint, test, workspace build.
ci: check lint test
    bun run build

# Single-file `rg-core` executable (scripts/compile.ts); extra args are forwarded.
compile *args:
    bun scripts/compile.ts {{args}}

# Regenerate rg-ui theme packs and design tokens.
tokens:
    cd packages/rg-ui && bun run themes

# --- hosts and services ----------------------------------------------------------------

# Print the host holding a role (optionally one field: ssh, srv_root, stack_dir, ...).
host role="prod" field="":
    {{ops}} host {{role}} {{field}}

# ssh to the host holding a role; extra args are the remote command.
ssh role="prod" *cmd:
    {{ops}} ssh {{role}} -- {{cmd}}

# The service registry with resolved hosts.
services:
    {{ops}} services

# Regenerate config derived from the registry (nginx upstreams); --check fails on drift.
render *args:
    {{ops}} render {{args}}

# --- uniform verbs: <service|all> [--role R] [--ref REF] [--dry-run] ----------------------

# Build images on the build role (or --role).
build service="all" *args:
    {{ops}} build {{service}} {{args}}

# Build and start on the service's role host, then verify.
deploy service="all" *args:
    {{ops}} deploy {{service}} {{args}}

# Health of the service(s) inside the stack, then their vhosts.
verify service="all" *args:
    {{ops}} verify {{service}} {{args}}

# Restart on a previous image tag (RG_TAG of the last good deploy).
rollback tag service="all" *args:
    {{ops}} rollback {{tag}} {{service}} {{args}}

# Move a service and its state: --to <role|host> [--from <role|host>] [--apply].
migrate service *args:
    {{ops}} migrate {{service}} {{args}}

# Derived assets: prod -> storage copy -> cdn edge and R2 (rg-cdn-sync.timer, every 10 min).
cdn-sync:
    {{ops}} ssh storage -- sudo systemctl start rg-cdn-sync.service

# Install the cdn edge vhosts (infra/docker/cdn-edge/) on the cdn role and reload nginx.
cdn-edge:
    h=$({{ops}} host cdn ssh); scp -q infra/docker/cdn-edge/rosegriffon-cdn.conf infra/docker/cdn-edge/rosegriffon-cdn-edge.inc "$h:/tmp/" && ssh "$h" "sudo install -m 644 /tmp/rosegriffon-cdn-edge.inc /etc/nginx/snippets/ && sudo install -m 644 /tmp/rosegriffon-cdn.conf /etc/nginx/conf.d/ && sudo nginx -t && sudo systemctl reload nginx"
