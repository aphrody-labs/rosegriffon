# rg-monorepo

Monorepo **Rose Griffon** : le site communautaire, le wiki *Inazuma Eleven:
Victory Road*, la bibliothèque de données du jeu et l'outillage qui les fait
tourner. Tout est en **Bun**, tout tourne sur un seul VPS.

## Architecture

```
rg/
├── apps/
│   ├── azalee/          # Wiki IEVR (azalee.rosegriffon.fr) — @rosegriffon/azalee-web
│   ├── website/         # Site principal (rosegriffon.fr)
│   ├── cdn/             # Serveur d'images du CDN
│   ├── cdn-variants/    # Redimensionnement + WebP à la volée
│   ├── rag-api/         # Recherche sémantique locale
│   └── bot/             # Bot Discord — source conservée, NON déployé
├── packages/
│   ├── azalee/          # Bibliothèque Bun du wiki : données, index CPK/texte, CLI, API headless
│   ├── mcp/             # Serveur Model Context Protocol du monorepo
│   ├── inagle/          # Parser binaire CPK/G4TX + pipeline de données du jeu
│   ├── inagle-cross/    # Catalogue Inazuma Eleven Cross (jeu mobile)
│   ├── menu-render/     # Rendu des écrans de menu du jeu
│   ├── cron/            # Tâches planifiées (SEO, synchronisations)
│   ├── ui/              # Design system partagé (shadcn, Tailwind v4)
│   ├── db/ auth/ types/ # Client Supabase, guards better-auth, schémas zod
│   ├── patreon-bun/     # Client API Patreon v2
│   └── config/          # Presets tsconfig / eslint / oxlint / tailwind
├── plugins/rose-griffon/# Plugin Claude Code : MCP, skills, agents, hook
├── iecode/              # Toolkit de rétro-ingénierie C#/.NET + pont Bun
├── docs/                # Documentation technique
├── infra/               # Unités systemd et configurations nginx
└── scripts/             # Scripts d'exploitation et de déploiement
```

## Stack

| | |
| --- | --- |
| Runtime | Bun (1.3.14 en CI et en production) |
| Front | Next 16 + React 19, compilateur React actif |
| Style | Tailwind v4 + design system `@rosegriffon/ui` |
| Données | Supabase Postgres + miroir SQLite embarqué |
| Auth | better-auth (Discord, Google, Steam) |
| Lint | oxlint + eslint |
| Tests | `bun test` natif |
| Build | Turborepo |

## Démarrer

```bash
bun install
bun run build           # tous les workspaces (turbo)
bun run type-check      # tsc --noEmit partout
bun run lint            # oxlint + eslint
bun test <chemin>       # depuis le paquet concerné
```

En développement :

```bash
bun run azalee:dev      # wiki
bun run website:dev     # site principal
bun packages/azalee/src/cli.ts --help    # CLI de données du jeu
bun packages/mcp/src/cli.ts --list       # inventaire du serveur MCP
```

## Déploiement

**Aucun push ne déploie.** Les deux applications sont auto-hébergées sur le
VPS derrière nginx :

```bash
bash scripts/ship-azalee.sh      # wiki  → azalee-web.service   (:3003)
bash scripts/ship-website.sh     # site  → website-web.service  (:3004)
```

Les services sans build (API headless, serveur MCP, CDN, cron) se rechargent
par un simple `sudo systemctl restart <unité>`. Procédures complètes,
diagnostic et pièges : [`docs/deploy.md`](docs/deploy.md).

## Workspaces & catalog

Le `catalog:` du `package.json` racine est la source unique de vérité pour les
versions partagées : toute dépendance commune passe par lui. Les dépendances
internes s'écrivent `workspace:*`, jamais une version figée.

Imports internes : `@rosegriffon/ui`, `@rosegriffon/db`,
`@rosegriffon/types`, `@rosegriffon/azalee`, `@rosegriffon/config/*`.

## Travailler avec un agent

[`PROMPT.md`](PROMPT.md) est le prompt d'amorçage à donner à un agent (Claude
Code ou autre) qui intervient sur ce dépôt : règles non négociables, boucle de
travail, pièges qui ont déjà causé une panne, et comment vérifier son travail
plutôt que de l'affirmer.

Il est versionné, contrairement à `CLAUDE.md` qui reste la mémoire **locale**
d'une machine — chemins, notes d'incident, contexte d'environnement.

Le dépôt fournit aussi un serveur MCP (`packages/mcp`) qui expose les données du
jeu, la base, les fichiers extraits et l'exploitation sous forme d'outils, ainsi
qu'un plugin Claude prêt à installer :

```bash
claude plugin marketplace add .
claude plugin install rose-griffon@rose-griffon
```

Détails et portées d'accès : [`docs/mcp.md`](docs/mcp.md).

## Documentation

L'index complet est dans [`docs/README.md`](docs/README.md). Points d'entrée
les plus utiles :

- [`docs/azalee-lib.md`](docs/azalee-lib.md) — la bibliothèque du wiki ;
- [`docs/deploy.md`](docs/deploy.md) — exploitation et déploiement ;
- [`docs/mcp.md`](docs/mcp.md) — serveur MCP et connexion distante ;
- [`docs/gamedata-coverage.md`](docs/gamedata-coverage.md) — couverture de
  l'extraction des données du jeu.

## Licence

Privé. Tous droits réservés Rose Griffon.
