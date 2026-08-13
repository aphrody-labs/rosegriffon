# @rosegriffon/bot

Bot Discord du projet Rose Griffon : slash commands publiques (communauté,
éditorial, agenda, boutique, archive X), commandes de données de jeu IEVR
(wiki Azalée, archives CPK, CDN, RAG) et arbres réservés `/staff` et
`/administration`, plus la génération de cartes canvas.

Restauré depuis `vps@c4d47a683^:apps/rg-bot/`, modernisé pour le monorepo
`~/rg/` (Turborepo + Bun + catalog).

> **Aucun de ces bots n'est déployé aujourd'hui.** La source est conservée et
> compile, mais l'unité `rg-bot.service` n'existe plus sur le VPS et la
> synchronisation des membres passe par le cron. Ne pas remettre en service
> sans demande explicite.

## Deux bots, un seul code

Le même programme sert **deux** bots Discord : celui du serveur Rose Griffon et
celui du serveur Azalée. Pas deux dossiers, pas une copie — un second
**profil**, lancé par un second service systemd avec un autre jeton.

Le profil se choisit par `RG_PROFIL_BOT` : `rg` par défaut, `azalee` pour le
second bot. Il décide du jeton lu, des guildes où les commandes sont
enregistrées, des commandes chargées, de la marque des embeds, et du salon
d'annonce des nouveaux posts X ainsi que du nom de son curseur. Base, cache,
services internes et tout `src/lib/` sont partagés ; le jeton et le curseur ne
le sont jamais.

**Ne jamais dupliquer un fichier de `src/commands/` pour en faire une variante
« azalee ».** Toute différence entre les deux bots passe par le registre de
profils (`src/lib/profil.ts`, module pur couvert par `bun:test`) — sinon chaque
correctif futur devrait être appliqué deux fois, et ne le serait pas.

Mise en service du second bot (application Discord, intents, URL d'invitation
et permissions, jeton, démarrage, vérification) :
[`docs/bot-azalee.md`](../../docs/bot-azalee.md). Unité systemd :
[`infra/systemd/azalee-bot.service`](../../infra/systemd/azalee-bot.service).

## Commandes

```bash
bun install              # depuis la racine du monorepo
cd apps/bot
cp .env.example .env     # remplir DISCORD_BOT_TOKEN + DATABASE_URL + SUPABASE_*

bun dev                  # bun --watch
bun start                # one-shot
bun run build            # → dist/index.js
bun run type-check       # tsc --noEmit
bun run test             # bun test src
bun run lint             # oxlint src (lint:fix pour corriger)
bun run smoke:admin      # smoke test services + RBAC + audit (requiert DB live)
bun run smoke:canvas     # smoke test canvas (génère /tmp/rg-{staff,profil,events}.png)
```

⚠ Toujours lancer depuis `apps/bot` (ou avec ce répertoire comme
`WorkingDirectory`) : Bun lit le `tsconfig.json` du répertoire courant, et
c'est celui-ci qui porte `experimentalDecorators` + `emitDecoratorMetadata`.
Depuis la racine du dépôt, discordx meurt sur « TypeError: undefined is not an
object (evaluating 'descriptor.value') ».

## Architecture

```
src/
├── index.ts              entry — Client discordx, intents, imports de commandes, login
├── commands/             une racine par domaine (arbre exact = les imports d'index.ts)
│   ├── …                 commandes publiques (communauté, éditorial, données de jeu, archive X)
│   ├── staff/            consultation réservée à l'équipe
│   └── administration/   écriture réservée aux administrateurs
├── events/
│   ├── ready.ts          @Once(clientReady) → sync membres si BOT_SYNC_MEMBRES=1
│   └── memberEvents.ts   @On(guildMemberAdd|Update|userUpdate) → syncOneMember
├── services/
│   ├── admin.ts          queries dashboard admin (cached 30s/60s via lib/cache)
│   ├── website.ts        queries publiques (team, profile, chroniques, events, planning, …)
│   ├── tweets.ts         archive X : liste, réglage de notification, curseur
│   ├── tweetsNotifier.ts drain des nouveaux posts → embeds dans le salon d'annonce
│   ├── syncMembers.ts    upsert discord_members + sync user.image via account bridge
│   └── teamPhotos.ts     sync avatars staff (team_members) — 3 tables propagées
├── lib/
│   ├── profil.ts         registre des profils (rg | azalee) — jeton, guildes, modules, marque, annonce
│   ├── db.ts             expose `supabase` (@rosegriffon/db service) + `sql` (Bun.SQL)
│   ├── azalee.ts         client HTTP typé de l'API Azalée (:8807) — jamais bun:sqlite ici
│   ├── api.ts            client HTTP /api/bot/v1/* du site Next (alternative à db direct)
│   ├── cache.ts          Redis (Bun.RedisClient) + fallback in-memory
│   ├── rbac.ts           requireRgAdmin/Strict — résout discord_id → profile.role
│   ├── audit.ts          logAdminAction → admin_audit_log
│   ├── embeds.ts         rgEmbed + utils format (truncate, fmtDate, DAYS_FR, …)
│   ├── *-format.ts       logique pure de rendu, couverte par `bun test`
│   └── canvas/           génération PNG via @aphrody-code/canvas
│       ├── theme.ts      palette + fonts (ensureFonts)
│       ├── cards.ts      renderProfileCard, renderTeamGrid, renderEventList, …
│       └── utils.ts      helpers Canvas2D (rounded rect, wrapped text, circular img, …)
└── scripts/
    ├── smoke-admin.ts    smoke services + RBAC + audit (CI-friendly)
    └── smoke-canvas.ts   smoke canvas (écrit dans /tmp/rg-*.png)
```

Toute logique décidable sans Discord ni base (rendu d'une ligne, bornage des
pages, encodage de l'état des boutons) vit dans un module `lib/*-format.ts`
pur, couvert par `bun:test` — les fichiers de `commands/` ne font que du
câblage.

## Liens monorepo

- [`@rosegriffon/db`](../../packages/db) — client typé de la base self-host (browser/server/service + types `Database` générés)
- [`@rosegriffon/azalee`](../../packages/azalee) — bibliothèque du wiki IEVR ; le bot en consomme le sous-chemin `/remote`
- [`@rosegriffon/config`](../../packages/config) — tsconfig (`tsconfig-bun.json`), oxlintrc, eslint base

## Couche DB — Bun.SQL + client Supabase-compatible

Le bot utilise **deux** chemins d'accès selon le contexte de la requête :

- **`supabase`** (de `@rosegriffon/db/service`) : client service-role typé.
  Préférer pour les requêtes simples (`from().select()`, `.insert()`, `.rpc()`)
  — bénéficie du type-checking sur les colonnes via `Database`.
- **`sql`** (de `bun`) : connexion Postgres directe via `DATABASE_URL`. Préférer
  pour le SQL complexe (CTE, fenêtres, jointures multi-niveaux) où le query
  builder serait verbeux ou impossible.

Les deux pointent sur la **même** base : le PostgreSQL 18 auto-hébergé du VPS
(le projet Supabase Cloud a été abandonné, cf.
[`docs/self-host-supabase.md`](../../docs/self-host-supabase.md)). Le client
`supabase` passe par PostgREST, `sql` attaque Postgres directement. Voir
`src/lib/db.ts`.
