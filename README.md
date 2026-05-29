# rg-monorepo

Monorepo **Rose Griffon** — site communautaire + wiki IEVR + bot Discord. Stack moderne (Next 16.2 / React 19.2 / Bun 1.3 / Supabase / Turborepo).

## Architecture

```
rg/
├── apps/
│   ├── azalee/        # Wiki Inazuma Eleven Victory Road (azalee.rosegriffon.fr)
│   ├── website/       # Site principal (rosegriffon.fr)
│   └── bot/           # Bot Discord (Bun + discordx + tsyringe)
├── packages/
│   ├── ui/            # Composants shadcn partagés (57 composants new-york style)
│   ├── db/            # Client Supabase + types Database générés
│   ├── auth/          # Logique d'authentification et guards partagés (better-auth)
│   ├── types/         # Zod schemas + types métier partagés site/bot
│   ├── patreon-bun/   # Client API Patreon v2 typé pour Bun
│   ├── assets/        # Assets statiques partagés
│   └── config/        # tsconfig / eslint / oxlint / tailwind presets
├── docs/              # Documentation technique
├── infra/             # Configs systemd/nginx (bot uniquement)
└── scripts/           # Scripts ops (deploy, db migrations, etc.)
```

Apps déployées via **Vercel** (azalee, website) ou **systemd sur VPS** (bot).

## Stack

- **Runtime** : Bun 1.3.14
- **Front** : Next.js 16.2.6 + React 19.2.6 (compiler activé)
- **Style** : Tailwind 4.3 + shadcn/ui new-york
- **DB** : Supabase Postgres (RLS + types générés)
- **Auth** : better-auth 1.6+
- **Bot** : discordx (Bun-native fork) + tsyringe DI
- **Lint** : oxlint + eslint (config-next)
- **Tests** : vitest 4
- **Build** : Turborepo 2.9 (daemon TUI + remote cache)
- **TypeScript** : 6.0.3 (strict + moduleResolution: bundler)

## Quick start

```bash
bun install
bun run build           # Build tous les workspaces (turbo)
bun run lint            # oxlint + eslint
bun run type-check      # tsc --noEmit partout
bun run test            # vitest
```

Lancer un seul workspace en dev :

```bash
bun run azalee:dev      # → http://localhost:3001
bun run website:dev     # → http://localhost:3000
bun run bot:dev         # bot Discord en mode dev (hot reload)
```

## Workspaces & catalog

Le `catalog:` du `package.json` racine est la source unique de vérité pour les versions des deps majeures (next, react, ts, tailwind, zod, supabase, etc.). Tout ajout dans une app doit passer par le catalog si la dep est partagée.

Imports internes : `@rose-griffon/ui`, `@rose-griffon/db`, `@rose-griffon/types`, `@rose-griffon/config/*`.

## Migration depuis vps-monorepo

Ce monorepo a été extrait de [`aphrody-code/vps`](https://github.com/aphrody-code/vps) le **2026-05-17** pour découpler les apps Vercel (azalee + website) du VPS Ubuntu (qui ne porte plus que `rpb-bot`, `shenron`, `cdn`).

Historique migration : voir [`docs/migration-from-vps.md`](docs/migration-from-vps.md).

## Vercel

| App | Repo source | Projet Vercel | Domaine |
|---|---|---|---|
| azalee | `rose-griffon/rg` (root: `apps/azalee`) | `rg-azalee` | `azalee.rosegriffon.fr` |
| website | `rose-griffon/rg` (root: `apps/website`) | `rg-website` | `rosegriffon.fr` |

Root directory dans Vercel : `apps/azalee` / `apps/website`. Build command : `cd ../.. && bun run build --filter=@rose-griffon/<app>`.

## Bot Discord (VPS only)

Le bot tourne via `systemd` sur le VPS. Voir `infra/systemd/rg-bot.service`. Deploy : `bash scripts/deploy-bot.sh`.

## License

Privé. Tous droits réservés Rose Griffon.
