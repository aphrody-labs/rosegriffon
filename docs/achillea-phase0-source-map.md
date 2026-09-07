# Achillea Phase 0 — Source to RG matrix

Source baseline: `rose-griffon/achillea@674b6897d49241f811eaa0254975bc3587e85b7f`. This matrix describes the import boundary only; it does not copy code, install packages, migrate data, alter RG root manifests, or authorize deployment. The exhaustive per-file mapping and SHA-256 evidence live in `docs/achillea-phase0-import-manifest.json`.

## Import destinations

| Source root | RG destination | Files | Bytes |
| --- | --- | ---: | ---: |
| `apps/bot` | `apps/achillea-bot` | 533 | 8416855 |
| `apps/web` | `apps/achillea-web` | 357 | 10912162 |
| `packages/core` | `packages/achillea-core` | 28 | 158095 |
| `packages/types` | `packages/achillea-types` | 7 | 9937 |

## Operational mapping

| Source surface | RG target/action | Earliest phase | Boundary |
| --- | --- | --- | --- |
| `packages/types/**` | `packages/achillea-types/**` | Phase 1 | Portable contracts first; preserve package API, then rename paths only. |
| `packages/core/**` | `packages/achillea-core/**` | Phase 1 | Portable business logic; dependency only on Achillea types and catalog utilities. |
| `apps/bot/src/**` | `apps/achillea-bot/src/**` | Phase 2 | Keep Discord, REST :4000, ranked :4002 and Socket.IO :4005 isolated from RG bot. |
| `apps/bot/database/migrations/**` | `apps/achillea-bot/database/migrations/**` | Phase 2 | Import TypeScript migrations; snapshots are excluded. Never point at the RG database. |
| `apps/bot/infra/**` | excluded | Review only | Duplicate non-canonical infrastructure; root source infra must be adapted separately. |
| `apps/web/src/**`, `public/**` | `apps/achillea-web/**` | Phase 3 | Preserve Angular/PrimeNG and Achillea-owned static assets. |
| `apps/web/src/environments/environment.prod.ts` | quarantined by secret scan | Phase 3 | Regenerate from an injectable public runtime/build configuration; do not copy credentials. |
| root configs/scripts/docs/infra | excluded from import | Manual adaptation | Review one by one; never overwrite RG root configuration or operations. |
| `.github/workflows/*deploy|*migrate|*release*` | excluded | Phase 5 | No source deployment or mutation automation enters the first port. |

## Exclusion evidence

| Rule | Tracked files excluded |
| --- | ---: |
| `deploy-workflow` | 2 |
| `duplicate-bot-infra` | 2 |
| `environment` | 1 |
| `lockfile` | 4 |
| `outside-port-scope` | 67 |
| `runtime-data` | 2 |
| `secret-signature` | 1 |
| `snapshot` | 5 |

`.git` and `node_modules` are structural deny rules even when Git cannot enumerate them as tracked files. Every imported destination is allowlisted under one of the four roots above, destination collisions are fatal, and each imported file carries a content hash. Content matching a secret signature is quarantined as an exclusion without recording the matched value.

## Reproduce and verify

```bash
bun scripts/achillea/phase0.ts --check --source /path/to/clean/achillea
# Deliberate refresh after auditing a new generator/source change:
bun scripts/achillea/phase0.ts --generate --source /path/to/clean/achillea
```

The command refuses a source commit other than the frozen hash, a dirty source checkout, an untracked file dependency, a destination outside the allowlist, a collision, or any drift in the three generated artifacts.
