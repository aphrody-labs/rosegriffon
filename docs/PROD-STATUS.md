---
title: "Production status"
description: "Verified production topology and retired surfaces"
scope: ["ops", "agents"]
status: "stable"
---

# Production status

Last verified: **2026-09-08 UTC** on the Rose Griffon VPS.

## Live surfaces

- `rosegriffon.fr`, `azalee.rosegriffon.fr`, `achillea.rosegriffon.fr`, and
  `nie.aphrody.com` are served from the VPS behind nginx.
- Postgres, PostgREST, Storage, Realtime, CDN, API, Auth, and site watchdogs are
  active. `systemctl --failed` is empty.
- Public site/API probes returned `200`; active Aphrody API/CDN endpoints negotiate
  HTTP/2. Typical measured TTFB was 8–30 ms after the performance pass.
- Achillea local Supabase is isolated on its dedicated ports. The verified local
  inventory contains 109 tables and 379 Storage files.

## Retired surfaces

- The BXC public site is a future project, not a production service. Its systemd
  units, crawlers, scheduler, and public origin are disabled. The public vhost
  returns `410` until a new release is explicitly promoted.
- Public MCP and RAG HTTP endpoints return `410`. `rg-mcp`, `rag-api`,
  `rg-rag-embed`, and the `8799` tunnel are inactive and masked.
- MCP remains available only through the local stdio process used by the agent
  host. Do not recreate an HTTP listener or re-enable the retired units.

## Backups and cleanup

- Automatic backup timers for RG, BXC, cloud mirrors, and the package database are
  disabled. The latest verified PostgreSQL dumps remain under `/var/backups/postgres`.
- Regenerable BXC runtime databases, crawls, captures, cookies, `node_modules`, and
  `dist` were removed. They are recoverable by reinstalling/building/recrawling;
  they are not Git source data.
- The retired AI/MCP/RAG configuration and data remain in the private mode-0700
  archive `/home/ubuntu/archives/retired-rg-ai-20260908T101029Z`.

## Agent rules

- Treat `infra/` and the installed nginx/systemd state as the production contract.
- Validate with `sudo nginx -t`, `systemctl --failed`, endpoint probes, and listener
  inspection before claiming a deployment.
- Keep the local MCP stdio path; never restore the retired public HTTP transport.
- A kernel reboot is pending but was intentionally deferred to avoid interrupting
  the continuously served sites.
