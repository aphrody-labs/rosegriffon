# Changelog

Toutes les évolutions notables du monorepo `rg`. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) + [SemVer](https://semver.org/lang/fr/).

## [0.1.0] — 2026-05-17

### Ajouté

- **Monorepo Turborepo + Bun workspaces** avec catalog versions stables (Next 16.2.6, React 19.2.6, TS 6.0.3, Tailwind 4.3.0, Bun 1.3.14).
- **`@rosegriffon/azalee`** (apps/azalee) — wiki Inazuma Eleven Victory Road. Extrait de `aphrody-code/vps@apps/azalee` (submodule Vercel `rose-griffon/azalee`).
- **`@rosegriffon/website`** (apps/website) — site principal `rosegriffon.fr`. Extrait de `aphrody-code/vps@apps/rosegriffon` (renommé `website` pour clarté).
- **`@rosegriffon/bot`** (apps/bot) — bot Discord (Bun + discordx + tsyringe DI + canvas). Restauré depuis `aphrody-code/vps@c4d47a683^:apps/rg-bot/`. 15 commandes (8 publiques + 7 admin), 4 services, 7 modules lib (canvas/cache/rbac/audit/embeds/api/db), 2 events Discord.
- **`@rosegriffon/ui`** (packages/ui) — 55 composants shadcn/ui style new-york + 3 hooks (`use-mobile`, `use-media-query`, `useSwipe`) + helper `cn`.
- **`@rosegriffon/db`** (packages/db) — client Supabase partagé (`browser` / `server` / `service`) + `types.gen.ts` (3925 lignes générées par `supabase gen types`).
- **`@rosegriffon/patreon-bun`** (packages/patreon-bun) — vendoré depuis `rose-griffon/patreon-bun` (repo privé inaccessible via `github:` dep). Build OK (`index.js` 118.64 KB).
- **`@rosegriffon/config`** (packages/config) — tsconfig (base, nextjs, bun) + eslint flat configs + oxlintrc + tailwind preset.
- **Infra bot** : `infra/systemd/rg-bot.service` (resource limits 1G/256M, hardening systemd, cgroup v2 weights cohérents avec rpb-bot/shenron côté vps).
- **Script deploy** : `scripts/deploy-bot.sh` (build + rsync vers `/home/ubuntu/rg-bot-prod/` + systemctl restart + smoke logs).
- **Docs** : `README.md`, `CLAUDE.md`, `docs/migration-from-vps.md`.

### Décisions architecture

- **Pas de `packages/types`** : les zod schemas dérivés dupliquaient `Tables<'X'>` de `@rosegriffon/db`. Les apps importent directement les types Database de `@rosegriffon/db`.
- **Bot DB double accès** : `supabase` (query builder typé) + `sql` (Bun.SQL Postgres direct via pooler). Choix assumé, pas une transition.
- **Catalog versions stables** : ne pas reprendre `react@canary` / `next@canary` du vps (besoins rpb-bot uniquement). `rg` cible la prod Vercel avec versions LTS.
- **Shim Supabase côté website** : `src/lib/supabase/{client,server}.ts` réexporte `@rosegriffon/db/*` pour préserver les 84 call sites legacy. Migration progressive possible site par site.

### Connu

- Apps `apps/azalee` et `apps/rosegriffon` restent dans `~/vps/` comme submodules figés jusqu'à la bascule manuelle Vercel sur `rose-griffon/rg`.
- Le bot historique utilisait Prisma — remplacé par Supabase shared client + Bun.SQL legacy pour queries complexes.
