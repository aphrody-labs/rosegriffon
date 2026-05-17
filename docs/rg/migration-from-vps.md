# Migration depuis vps-monorepo

Document de référence pour l'extraction des 3 apps + 4 packages depuis `aphrody-code/vps` vers `rose-griffon/rg` (2026-05-17).

## Pourquoi

Le `vps-monorepo` (`~/vps/`) hébergeait :
- 4 apps Vercel (azalee, rosegriffon, rpbey, gacha)
- 3 services VPS (rpb-bot, shenron, cdn)
- 11 packages internes (bxc, canvas, discordy, mrx, n2b, patreon-bun, rpb-challonge, …)

Cette concentration créait plusieurs frictions :
1. **Couplage VPS ↔ Vercel** : tout modif d'une app Vercel forçait un push sur le repo `vps`, qui contient aussi de l'infra (nginx, systemd) — risque de drift entre source de vérité git et état live.
2. **CI Vercel lente** : `bun install --frozen-lockfile` à la racine `vps` résolvait ~1500 packages dont 80 % inutiles pour `azalee`.
3. **Catalog vps trop large** : versions ciblées pour `rpb-bot` (canary React/Next, Bun-native discordx) imposées à toutes les apps même quand elles n'en avaient pas besoin.
4. **Submodule sprawl** : 8+ submodules à init avant `bun install` — barrière à l'onboarding contributeur.

Le `rg-monorepo` est focalisé sur l'écosystème **Rose Griffon** uniquement : 2 apps Next + 1 bot Discord + 4 packages partagés.

## Mapping des sources

| Avant (`~/vps/`) | Après (`~/rg/`) | Note |
|---|---|---|
| `apps/azalee/` (submodule `rose-griffon/azalee`) | `apps/azalee/` | name : `@rose-griffon/azalee` → `@rg/azalee` |
| `apps/rosegriffon/` (submodule `rose-griffon/rosegriffon`) | `apps/website/` | renommée `website` pour clarté ; name : `@rose-griffon/website` → `@rg/website` |
| `apps/rg-bot/` (supprimé au commit `c4d47a683`) | `apps/bot/` | restauré depuis `vps@c4d47a683^`, modernisé Bun + discordx + Supabase shared client |
| `packages/patreon-bun/` (submodule `rose-griffon/patreon-bun`) | `packages/patreon-bun/` | vendoré en local (repo privé → impossible via `github:` dep) |
| `apps/rosegriffon/src/types/supabase.ts` (3925 lignes) | `packages/db/src/types.gen.ts` | source de vérité unique pour les types Database (site + bot) |
| `apps/rosegriffon/src/components/ui/` (57 fichiers) | `packages/ui/src/components/` | shadcn new-york style, partagé site + futur dashboard bot |
| `apps/rosegriffon/src/lib/supabase/{client,server}.ts` | `packages/db/src/{browser,server,service}.ts` | helpers centralisés ; les fichiers source du site sont devenus de simples shims réexportant `@rg/db/*` (zéro modif des 84 call sites) |

## Décisions architecture

### Catalog versions (stable, pas canary)
Contrairement à `vps` qui utilisait `react@canary` / `next@canary` pour les besoins du `rpb-bot`, `rg` utilise les **stable** correspondantes (`react ^19.2.6`, `next ^16.2.6`, `typescript ^6.0.3`).

### Database types
Générés une fois via `bun run types:gen` dans `packages/db/` (nécessite `SUPABASE_ACCESS_TOKEN`). Le fichier `types.gen.ts` est commit pour que les builds Vercel n'aient pas à appeler l'API Supabase.

### Pas de `packages/types`
Au début un package `@rg/types` avec des zod schemas dérivés avait été envisagé, mais il dupliquait `Tables<'X'>` du `Database` type Supabase. **Décision** : importer directement `Tables<'profiles'>` depuis `@rg/db` plutôt que de maintenir une couche d'abstraction supplémentaire.

### Bot DB : double accès
Le bot expose **deux** clients DB pointant sur la même Postgres Supabase :
- `supabase` (`@rg/db/service`) : query builder typé, préféré pour les nouvelles queries.
- `sql` (Bun.SQL) : connexion Postgres directe via pooler, préféré pour les queries SQL complexes (CTE, agrégats, fenêtres).

Pas une transition à terminer — c'est un choix assumé : chaque chemin a son use case.

## Migration des envs Vercel

Les variables d'env de chaque app Vercel sont à migrer vers le nouveau projet `rose-griffon/rg` :

```bash
# Lister les envs du projet azalee actuel
vercel env ls --project azalee

# Les pousser dans le nouveau projet (à créer après push initial)
vercel env add NEXT_PUBLIC_SUPABASE_URL --project rg-azalee
# … (répéter pour chaque var)
```

Procédure complète à exécuter une fois `rose-griffon/rg` poussé sur GitHub et le projet Vercel re-créé sur la racine `apps/azalee` (resp. `apps/website`).

## Désactivation côté vps

Une fois la prod Vercel basculée sur `rose-griffon/rg`, dans `~/vps/` :

```bash
git submodule deinit apps/azalee apps/rosegriffon
git rm apps/azalee apps/rosegriffon
# Mettre à jour .gitmodules
# MAJ CLAUDE.md / ai-feat.json / state.md pour pointer vers rose-griffon/rg
```

Le bot `rg-bot` est nouveau côté VPS — une fois prêt, ajouter unit systemd `rg-bot.service` dans `~/vps/infra/systemd/`.

## Diff stack vs vps

| Couche | vps (avant) | rg (après) |
|---|---|---|
| Next | canary | 16.2.6 stable |
| React | canary | 19.2.6 stable |
| TypeScript | next | 6.0.3 stable |
| Bun | 1.3.14 | 1.3.14 (identique) |
| Tailwind | 4.2.2 | 4.3.0 |
| Supabase JS | 2.89 | 2.105.4 |
| Better Auth | 1.6.11 | 1.6.11 (identique) |
| Zod | 4.4.3 | 4.4.3 (identique) |
| Vitest | 4.0.18 | 4.1.6 |
| Turborepo | 2.9.14 | 2.9.14 (identique) |
