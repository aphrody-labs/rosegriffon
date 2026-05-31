# Changelog

Toutes les évolutions notables du monorepo `rg`. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) + [SemVer](https://semver.org/lang/fr/).

## [0.2.0] — 2026-05-31

### Ajouté

- **Intégration & Rendu Premium des actualités X (Azalée)** :
  - Synchronisation et importation complète du thread de 26 tweets de @Azalee_IE (`2061064712393982247`).
  - Téléchargement et hébergement local sur Supabase Storage de tous les médias associés (photos et vidéos).
  - Lettrine (Drop Cap) stylisée sur le premier paragraphe de l'article pour un look éditorial haut de gamme.
  - Mise en forme automatique des blocs de citation (Blockquotes) pour les passages entre guillemets.
  - Intégration de la police *Super Cartoon* sur le titre et les sous-titres de l'article.
  - Ajout d'overlays avec icônes de lecture (Play buttons) sur les vidéos et GIFs animés dans la galerie.
  - Alignement à gauche du texte pour éviter les rivières de blancs inesthétiques issues du texte justifié.
- **Cache local SQLite (Azalée)** :
  - Proxy transparent SQLite pour le wiki réduisant les latences à moins de 100ms.
- **Sécurité et robustesse (Cron)** :
  - Rotation de proxies pour contourner les limitations et protections d'API.
  - Sauvegarde logique PostgreSQL 18 automatisée (`roles.sql`, `schema.sql`, `data.sql`).

## [0.1.0] — 2026-05-17

### Ajouté

- **Monorepo Turborepo + Bun workspaces** avec catalog versions stables (Next 16.2.6, React 19.2.6, TS 6.0.3, Tailwind 4.3.0, Bun 1.3.14).
- **`@rose-griffon/azalee`** (apps/azalee) — wiki Inazuma Eleven Victory Road. Extrait de `aphrody-code/vps@apps/azalee` (submodule Vercel `rose-griffon/azalee`).
- **`@rose-griffon/website`** (apps/website) — site principal `rosegriffon.fr`. Extrait de `aphrody-code/vps@apps/rosegriffon` (renommé `website` pour clarté).
- **`@rose-griffon/bot`** (apps/bot) — bot Discord (Bun + discordx + tsyringe DI + canvas). Restauré depuis `aphrody-code/vps@c4d47a683^:apps/rg-bot/`. 15 commandes (8 publiques + 7 admin), 4 services, 7 modules lib (canvas/cache/rbac/audit/embeds/api/db), 2 events Discord.
- **`@rose-griffon/ui`** (packages/ui) — 55 composants shadcn/ui style new-york + 3 hooks (`use-mobile`, `use-media-query`, `useSwipe`) + helper `cn`.
- **`@rose-griffon/db`** (packages/db) — client Supabase partagé (`browser` / `server` / `service`) + `types.gen.ts` (3925 lignes générées par `supabase gen types`).
- **`@rose-griffon/patreon-bun`** (packages/patreon-bun) — vendoré depuis `rose-griffon/patreon-bun` (repo privé inaccessible via `github:` dep). Build OK (`index.js` 118.64 KB).
- **`@rose-griffon/config`** (packages/config) — tsconfig (base, nextjs, bun) + eslint flat configs + oxlintrc + tailwind preset.
- **Infra bot** : `infra/systemd/rg-bot.service` (resource limits 1G/256M, hardening systemd, cgroup v2 weights cohérents avec rpb-bot/shenron côté vps).
- **Script deploy** : `scripts/deploy-bot.sh` (build + rsync vers `/home/ubuntu/rg-bot-prod/` + systemctl restart + smoke logs).
- **Docs** : `README.md`, `CLAUDE.md`, `docs/migration-from-vps.md`.

### Décisions architecture

- **Pas de `packages/types`** : les zod schemas dérivés dupliquaient `Tables<'X'>` de `@rose-griffon/db`. Les apps importent directement les types Database de `@rose-griffon/db`.
- **Bot DB double accès** : `supabase` (query builder typé) + `sql` (Bun.SQL Postgres direct via pooler). Choix assumé, pas une transition.
- **Catalog versions stables** : ne pas reprendre `react@canary` / `next@canary` du vps (besoins rpb-bot uniquement). `rg` cible la prod Vercel avec versions LTS.
- **Shim Supabase côté website** : `src/lib/supabase/{client,server}.ts` réexporte `@rose-griffon/db/*` pour préserver les 84 call sites legacy. Migration progressive possible site par site.

### Connu

- Apps `apps/azalee` et `apps/rosegriffon` restent dans `~/vps/` comme submodules figés jusqu'à la bascule manuelle Vercel sur `rose-griffon/rg`.
- Le bot historique utilisait Prisma — remplacé par Supabase shared client + Bun.SQL legacy pour queries complexes.
