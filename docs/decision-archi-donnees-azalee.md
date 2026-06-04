# Décision : architecture de données azalée

Statut : PROPOSÉE — 2026-06-05. Cible : `apps/azalee` (wiki IEVR, self-host VPS, NON Vercel).

## 1. Contexte

Azalée est un wiki IEVR public, read-heavy, servi en self-host sur 1 VPS via `azalee-web.service` (Next 16 standalone, port 3003, build = `bash scripts/ship-azalee.sh` qui contourne le crash SIGILL/code 132 de Next16+Bun à l'exit). La donnée de jeu = ~44-63 tables `inagle_*` STATIQUES (ne changent qu'à un re-dump du jeu) : ~6148 personnages (5204 base_slug), ~1002 skills, ~1668 items, auras/keshins/tactics, etc. → des milliers de pages adressables.

Source de vérité = inagle (TS) → Supabase. État réel constaté dans le code :

- **Miroir SQLite embarqué** (`data/backups/supabase-*.sqlite`, ~104 Mo) + **`SqliteQueryBuilder`** (494 LOC, `lib/supabase/sqlite-client.ts`) qui RÉ-IMPLÉMENTE À LA MAIN la surface PostgREST (eq/neq/ilike/or/range/count, vues `*_clean` émulées via GROUP BY name_fr, json_extract pour `->>`, parser `.or()` splitTopLevel maison).
- **Proxy** (`lib/supabase/server.ts` l.105) : SEULES les tables `inagle_*` sont servies depuis SQLite ; tout le reste (auth, RAG, RPC, éditorial) reste sur Supabase. Fallback Postgres silencieux sur exception.
- **Rendu** : `/skill /item /aura /tactic` toutes en `force-dynamic` ; `/chara` plafonné `slice(0,50)` sur 5204, `revalidate=3600`. Donnée immuable servie en dynamique runtime.

Fragilités Supabase DOCUMENTÉES et confirmées : `DATABASE_URL` pointe l'hôte direct IPv6-only (`getaddrinfo ENOTFOUND` / login 500), env « sensitive » scellé en blob `eyJ2Ijo` (filtré dans server.ts l.14/20). Le miroir local sert justement à DÉCOUPLER de ça.

Fragilités du miroir confirmées : `SQLITE_DB_PATH` défini NULLE PART → `getSqlitePath()` (l.23) prend « le fichier au nom le plus récent » (`b.localeCompare(a)`), non-déterministe. Risque MATÉRIEL constaté : 2 snapshots tronqués de 14 Mo présents à l'instant dans `data/backups/` à côté du 104 Mo. AUCUN timer/cron de refresh n'existe (seuls shenron-*/rpbey-* présents = modèles). PII inutilement embarquée (le backup dump `information_schema` sans exclude → account/session/user/profiles/orders/patreon_* snapshotés mais jamais lus).

## 2. Axes de durabilité évalués

Maintenabilité (tuer le PostgREST maison) · Fraîcheur/automatisation (fini les snapshots périmés) · Performance (latence wiki) · Résilience (découplage Supabase) · Simplicité ops (1 VPS) · Coût/temps de build · Pérennité (peu de churn).

## 3. Options comparées

(a) Supabase direct runtime · (b) Postgres local VPS · (c) SSG/ISR statique seul · (d) SQLite réparé + auto-refresh + Drizzle · (e) Hybride (c)+(d) durcis. Voir tableau comparatif.

## 4. Décision

**On retient (e) l'hybride.** Trois chantiers orthogonaux, chacun adossé à une recherche :

1. **Couche data → Drizzle ORM** (tue les 494 LOC d'émulation PostgREST). Seule option couvrant nativement la contrainte dual-runtime d'azalée : `drizzle-orm/node-sqlite` (DatabaseSync) au BUILD sous `/usr/bin/node` v22 (next-build.sh l.25/37, Bun crashe le prerender) ET `drizzle-orm/bun-sqlite` au RUNTIME sous azalee-web.service, MÊME schéma, swap derrière le garde `typeof Bun` DÉJÀ présent (sqlite-client.ts l.55-85). Schéma introspecté une fois via `drizzle-kit pull` (donnée statique → 0 churn entre dumps).
2. **Sync → industrialiser le miroir** (tue le snapshot périmé) : épingler `SQLITE_DB_PATH` (chemin stable `mirror.sqlite`) + timer systemd post-`inagle push` (sync incrémental watermark + WAL → reload à chaud SANS restart) + swap atomique + purge de rétention. Modèle = shenron-neon-sync.timer existant.
3. **Rendu → ISR** (tue le rendu dynamique de donnée immuable) : pages-détail wiki de `force-dynamic` vers `revalidate=false` + invalidation on-demand, `dynamicParams=true`, pré-rendu borné (PAS de SSG complet : milliers de pages × build SIGILL = inacceptable).

Supabase reste : (i) fallback durci (pooler Supavisor session-mode IPv4) pour le wiki ; (ii) source de vérité UNIQUE pour RAG pgvector, 6 RPC PostgREST, auth Better Auth, éditorial/social (non découplables par le miroir, par design).

## 5. Justification (durabilité)

- **Résilience (axe prioritaire)** : double découplage — HTML ISR caché + data locale SQLite. Une fiche cachée ne touche ni miroir ni Supabase à la requête → immunité aux fragilités IPv6/env scellé/login 500.
- **Maintenabilité** : Drizzle supprime l'émulation PostgREST fragile (parser .or() splitTopLevel, *_clean GROUP BY, NULLS FIRST/LAST) ; typage introspecté de bout en bout.
- **Fraîcheur** : timer + WAL = fraîcheur ~minute sans restart ni péremption ; invalidation ISR on-demand au swap.
- **Pérennité** : ISR stable depuis v13 ; Drizzle dual-runtime natif ; SQLite = format portable lisible par niers (Rust) → aligné sur la convergence Rust long terme sans coupler azalée au Cloud fragile. Kysely écarté (SqliteDialect core = better-sqlite3 only + pin 0.28.2 gelé-interdit-au-bump).
- **Ops** : 1 timer + 1 var d'env + 1 purge, homogène avec l'infra cron existante (1 seul VPS, pas de Redis, pas de 2e Postgres).

## 6. Chemin de migration (prod-safe, non destructif)

Voir `migration_path` : Phase 0 (épinglage + DATABASE_URL pooler + purge tronqués, réversible) → Phase 1 (valider épinglage, restart isolé) → Phase 2 (timer auto-refresh) → Phase 3 (exclure PII du dump) → Phase 4 (Drizzle derrière façade, 0 touche aux 1445 call-sites) → Phase 5 (ISR route par route) → Phase 6 (retirer la façade). Chaque phase validée en prod avant la suivante, rollback trivial par phase. JAMAIS de ship/restart en masse, JAMAIS `rm -rf .next/cache` d'un émetteur servi.

## 7. Risques

Voir `risks` : swap sous connexion readonly (reload WAL à chaud vs rename d'inode), parité sémantique de la façade Drizzle (diff vs oracle SqliteQueryBuilder), fallback Supabase durci indispensable, build Next16 fragile, écart volumétrie skills 1002 vs 2900 à vérifier par COUNT, disque à 94% (purge obligatoire), drizzle-kit pull à régénérer au re-dump, invalidation ISR à câbler explicitement au timer.
