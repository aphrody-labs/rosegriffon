# @rose-griffon/bot

Bot Discord Rose Griffon — slash commands publiques (event, planning, chronique, profil, staff, member, azalee) + admin (stats, user, article, event, stream, settings, team) + sync membres → DB Supabase + génération cartes canvas.

Restauré depuis `vps@c4d47a683^:apps/rg-bot/`, modernisé pour le monorepo `~/rg/` (Turborepo + Bun + Supabase + catalog).

## Commandes

```bash
bun install              # depuis la racine du monorepo
cd apps/bot
cp .env.example .env     # remplir DISCORD_BOT_TOKEN + SUPABASE_*

bun dev                  # bun --watch
bun start                # one-shot
bun run build            # → dist/index.js
bun run type-check       # tsc --noEmit
bun run lint             # oxlint --type-aware
bun run smoke:admin      # smoke test services + RBAC + audit (requiert DB live)
bun run smoke:canvas     # smoke test canvas (génère /tmp/rg-{staff,profil,events}.png)
```

## Architecture

```
src/
├── index.ts              entry — Client discordx, intents, login
├── commands/
│   ├── azalee.ts         /azalee derniers — articles du wiki IEVR
│   ├── chronique.ts      /chronique {list,read,search} — articles website
│   ├── event.ts          /event prochains — événements à venir (canvas)
│   ├── member.ts         /member find — recherche membre Discord
│   ├── planning.ts       /planning [jour] — streams hebdo
│   ├── profil.ts         /profil <user|me> — fiche profil (canvas)
│   ├── staff.ts          /staff <équipe> — grille team_members (canvas)
│   ├── sync.ts           /sync — force re-sync members (admin)
│   └── admin/            commands réservées role=admin|staff
│       ├── stats.ts      dashboard counts (profiles, articles, events, …)
│       ├── user.ts       /admin-user {list,get,setrole}
│       ├── article.ts    /admin-article {list,publish,unpublish,delete}
│       ├── event.ts      /admin-event {list,create,update,delete}
│       ├── stream.ts     /admin-stream {list,add,delete}
│       ├── settings.ts   /admin-settings {list,get,set}
│       └── team.ts       /admin-team {list,activate,deactivate,delete}
├── events/
│   ├── ready.ts          @Once(ready) → sync all members + setInterval(SYNC_INTERVAL_MS)
│   └── memberEvents.ts   @On(guildMemberAdd|Update|userUpdate) → syncOneMember
├── services/
│   ├── admin.ts          queries dashboard admin (cached 30s/60s via lib/cache)
│   ├── website.ts        queries publiques (team, profile, chronicles, events, planning, …)
│   ├── syncMembers.ts    upsert discord_members + sync user.image via account bridge
│   └── teamPhotos.ts     sync avatars staff (team_members) — 3 tables propagées
├── lib/
│   ├── db.ts             expose `supabase` (@rose-griffon/db service) + `sql` (Bun.SQL legacy)
│   ├── api.ts            client HTTP /api/bot/v1/* du site Next (alternative à db direct)
│   ├── cache.ts          Redis (Bun.RedisClient) + fallback in-memory
│   ├── rbac.ts           requireRgAdmin/Strict — résout discord_id → profile.role
│   ├── audit.ts          logAdminAction → admin_audit_log
│   ├── embeds.ts         rgEmbed + utils format (truncate, fmtDate, DAYS_FR, …)
│   └── canvas/           génération PNG via @aphrody-code/canvas
│       ├── theme.ts      palette + fonts (ensureFonts)
│       ├── cards.ts      renderProfileCard, renderTeamGrid, renderEventList, …
│       └── utils.ts      helpers Canvas2D (rounded rect, wrapped text, circular img, …)
└── scripts/
    ├── smoke-admin.ts    smoke services + RBAC + audit (CI-friendly)
    └── smoke-canvas.ts   smoke canvas (écrit dans /tmp/rg-*.png)
```

## Liens monorepo

- [`@rose-griffon/db`](../../packages/db) — client Supabase partagé (browser/server/service + Database types générés)
- [`@rose-griffon/config`](../../packages/config) — tsconfig (`tsconfig-bun.json`), oxlintrc, eslint base

## Couche DB — Bun.SQL + Supabase client

Le bot utilise **deux** chemins d'accès DB selon le contexte de la query :

- **`supabase`** (de `@rose-griffon/db/service`) : client Supabase service-role typé. Préférer pour les queries simples (`from().select()`, `.insert()`, `.rpc()`) — bénéficie du type-checking sur les colonnes via `Database`.
- **`sql`** (de `bun`) : connexion Postgres directe via `DATABASE_URL` (pooler Supabase). Préférer pour les queries SQL complexes (CTE, fenêtres, jointures multi-niveaux) où le query builder Supabase serait verbeux ou impossible.

Les deux clients pointent sur la **même DB Supabase**. Voir `src/lib/db.ts`.
