# Rose Griffon entry points. Thin wrappers: workspace tasks run Bun, host verbs run
# infra/ops/cli.ts, which resolves roles from infra/hosts.toml and services from
# infra/services.toml. No host, address or path is spelled here. See docs/ARCHITECTURE.md.
#
#   just deploy core              deploy one service to its role's host (prod by default)
#   just deploy all --role prod   the whole stack
#   just migrate core --to vps    dry run; add --apply to move state + service
#   RG_HOST_PROD=vps just verify  re-point a role for one command

set dotenv-load
set dotenv-filename := ".env.local"
set shell := ["bash", "-euo", "pipefail", "-c"]
set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

ops := "bun infra/ops/cli.ts"

import 'infra/just/workspace.just'
import 'infra/just/rust.just'
import 'infra/just/cloud.just'
import 'infra/just/qa.just'

[private]
default:
    @just --list

# --- hosts, services, and uniform deploy verbs -----------------------------------------

[group('infra')]
[doc("Print the host holding a role (optionally one field: ssh, srv_root, stack_dir, ...).")]
host role="prod" field="":
    {{ops}} host {{role}} {{field}}

[group('infra')]
[doc("ssh to the host holding a role; extra args are the remote command.")]
ssh role="prod" *cmd:
    {{ops}} ssh {{role}} -- {{cmd}}

[group('infra')]
[doc("The service registry with resolved hosts.")]
services:
    {{ops}} services

[group('infra')]
[doc("Regenerate config derived from the registry (nginx upstreams); --check fails on drift.")]
render *args:
    {{ops}} render {{args}}

[group('infra')]
[doc("Build images on the build role (or --role).")]
build service="all" *args:
    {{ops}} build {{service}} {{args}}

[group('infra')]
[doc("Build and start on the service's role host, then verify.")]
deploy service="all" *args:
    {{ops}} deploy {{service}} {{args}}

[group('infra')]
[doc("Health of the service(s) inside the stack, then their vhosts.")]
verify service="all" *args:
    {{ops}} verify {{service}} {{args}}

[group('infra')]
[doc("Restart on a previous image tag (RG_TAG of the last good deploy).")]
rollback tag service="all" *args:
    {{ops}} rollback {{tag}} {{service}} {{args}}

[group('infra')]
[doc("Move a service and its state: --to <role|host> [--from <role|host>] [--apply].")]
migrate service *args:
    {{ops}} migrate {{service}} {{args}}

[group('infra')]
[doc("Derived assets: prod -> storage copy -> cdn edge and R2 (rg-cdn-sync.timer, every 10 min).")]
cdn-sync:
    {{ops}} ssh storage -- sudo systemctl start rg-cdn-sync.service

[group('infra')]
[doc("Install the cdn edge vhosts (infra/docker/cdn-edge/) on the cdn role and reload nginx.")]
cdn-edge:
    {{ if os() == "windows" { "$h = (" + ops + " host cdn ssh); scp -q infra/docker/cdn-edge/rosegriffon-cdn.conf infra/docker/cdn-edge/rosegriffon-cdn-edge.inc \"${h}:/tmp/\"; if ($LASTEXITCODE -eq 0) { ssh $h \"sudo install -m 644 /tmp/rosegriffon-cdn-edge.inc /etc/nginx/snippets/ && sudo install -m 644 /tmp/rosegriffon-cdn.conf /etc/nginx/conf.d/ && sudo nginx -t && sudo systemctl reload nginx\" }" } else { "h=$(" + ops + " host cdn ssh); scp -q infra/docker/cdn-edge/rosegriffon-cdn.conf infra/docker/cdn-edge/rosegriffon-cdn-edge.inc \"$h:/tmp/\" && ssh \"$h\" \"sudo install -m 644 /tmp/rosegriffon-cdn-edge.inc /etc/nginx/snippets/ && sudo install -m 644 /tmp/rosegriffon-cdn.conf /etc/nginx/conf.d/ && sudo nginx -t && sudo systemctl reload nginx\"" } }}

[group('infra')]
[doc("One-click Steam login of the storage host: account from local Steam client (--qr: Steam app).")]
steam-login *args:
    bun scripts/steam-login.ts {{args}}
