# rg-monorepo

Monorepo **Rose Griffon** : le site communautaire, le wiki *Inazuma Eleven:
Victory Road*, la bibliothèque de données du jeu et l'outillage qui les fait
tourner. Tout est en **Bun**, tout tourne sur un seul VPS.

## Architecture

```
rg/
├── apps/
│   ├── website/         # Application unifiée Rose Griffon (rosegriffon.fr) : portail, wiki (/wiki), chroniques & news, admin (/admin)
│   ├── achillea-web/    # Application Angular 19 / PrimeNG : tournois, classements, licences (achillea.rosegriffon.fr)
│   ├── achillea-bot/    # Bot Discord et API tournois Achilléa
│   ├── bot/             # Bot Discord unifié (rg-bot & azalee-bot)
│   ├── cdn/             # Serveur d'images du CDN (:8804)
│   ├── storage/         # API de stockage compatible Supabase (fichiers locaux :8810)
│   └── realtime/        # Diffusion SSE des changements Postgres (LISTEN/NOTIFY :8812)
├── packages/
│   ├── azalee/          # Bibliothèque Bun du wiki : données, index CPK/texte, CLI, API headless
│   ├── achillea-types/  # Contrat pur TypeScript de l'écosystème tournois Achilléa (0 runtime dep)
│   ├── achillea-core/   # Logique métier pure, règles de calcul, labels, formats et adaptateurs
│   ├── achillea-contract/# Générateur de contrats polyglottes (JSON Schema, Rust, Swift, Kotlin)
│   ├── achillea-client/ # Client HTTP d'API isomorphe pour Achilléa
│   ├── mcp/             # Serveur Model Context Protocol du monorepo
│   ├── inagle/          # Parser binaire CPK/G4TX + pipeline de données du jeu
│   ├── inagle-cross/    # Catalogue Inazuma Eleven Cross (jeu mobile)
│   ├── cron/            # Tâches planifiées (SEO, synchronisations)
│   ├── ui/              # Design system partagé (shadcn, Tailwind v4)
│   ├── db/ auth/ types/ # Client base de données, guards better-auth, schémas zod
│   ├── assets/          # Assets statiques partagés
│   ├── patreon-bun/     # Client API Patreon v2
│   └── config/          # Presets tsconfig / eslint / oxlint / tailwind
├── plugins/rose-griffon/# Plugin Claude Code : MCP, skills, agents, hook
├── docs/                # Documentation technique
├── infra/               # Unités systemd et configurations nginx
└── scripts/             # Scripts d'exploitation et de déploiement
```

## Stack

| | |
| --- | --- |
| Runtime | Bun (1.3.14 minimum, en production comme en local) |
| Front | Next 16 + React 19, compilateur React actif |
| Style | Tailwind v4 + design system `@rosegriffon/ui` |
| Données | PostgreSQL 18 auto-hébergé + PostgREST, Storage et Realtime maison ; miroir SQLite embarqué côté wiki |
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
bun run website:dev     # portail et wiki Azalée sous /wiki
bun packages/azalee/src/cli.ts --help    # CLI de données du jeu
bun packages/mcp/src/cli.ts --list       # inventaire du serveur MCP
```

## Déploiement

Le portail et le wiki Azalée forment une seule application Next auto-hébergée,
`apps/website`. Il n'existe ni build, ni release, ni service web Azalée autonome.
La publication complète utilise une seule commande :

```bash
bun run deploy website           # portail + /wiki, un seul build Next
bun run deploy:status            # version servie, slots, mémoire, santé publique
```

La publication est **bleu/vert** : le nouveau build démarre sur un second port,
est sondé, puis nginx bascule — le site ne tombe à aucun moment (mesuré :
1 558 requêtes pendant un déploiement complet, 0 erreur). `preview` /
`promote` permettent de valider une version sur le domaine public, derrière un
cookie, avant de la passer en production ; `rollback` revient à la précédente.
Le domaine historique `azalee.rosegriffon.fr` ne possède aucun runtime : nginx le
redirige vers `https://rosegriffon.fr/wiki`. Voir le
[contrat de surface Azalée](docs/azalee.md).

La même mécanique se pilote à distance par le serveur MCP (`deploy_status` en
lecture, `deploy_run` en portée `admin`) ou par
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — le runner ne
construit rien, il déclenche la publication sur le VPS puis en suit l'état. Une
poussée sur `main` ne publie **que** si la variable de dépôt `DEPLOY_ON_PUSH`
vaut `true` ; sinon le déclenchement reste manuel.

Les services sans build (API headless, serveur MCP, CDN, cron) se rechargent
par un simple `sudo systemctl restart <unité>`. Mécanique complète et pièges :
[`docs/deploiement-sans-coupure.md`](docs/deploiement-sans-coupure.md) ;
exploitation générale : [`docs/deploy.md`](docs/deploy.md).

## Workspaces & catalog

Le `catalog:` du `package.json` racine est la source unique de vérité pour les
versions partagées : toute dépendance commune passe par lui. Les dépendances
internes s'écrivent `workspace:*`, jamais une version figée.

Imports internes : `@rosegriffon/ui`, `@rosegriffon/db`,
`@rosegriffon/types`, `@rosegriffon/azalee`, `@rosegriffon/config/*`,
`@rosegriffon/achillea-types`, `@rosegriffon/achillea-core`,
`@rosegriffon/achillea-client`, `@rosegriffon/achillea-contract`.

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
- [`docs/azalee.md`](docs/azalee.md) — surface web unique, domaine historique et
  invariant d'un seul build Next ;
- [`docs/deploy.md`](docs/deploy.md) — exploitation et déploiement ;
- [`docs/deploiement-sans-coupure.md`](docs/deploiement-sans-coupure.md) — la
  publication bleu/vert, la prévisualisation et le retour arrière ;
- [`docs/mcp.md`](docs/mcp.md) — serveur MCP et connexion distante ;
- [`docs/gamedata-coverage.md`](docs/gamedata-coverage.md) — couverture de
  l'extraction des données du jeu.

## Licence

Privé. Tous droits réservés Rose Griffon.
