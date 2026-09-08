# Documentation — monorepo Rose Griffon

Index de la documentation partagée. Convention du dépôt : `*.md` est gitignoré
**sauf** `docs/**`, les `README.md` de paquet et quelques exceptions listées
dans `.gitignore` — c'est donc ici que vit toute la doc de fond.

> Les **conventions** (commits en français sur une ligne, Bun obligatoire,
> pièges critiques) vivent dans le `CLAUDE.md` racine, non versionné. Cet
> index ne les duplique pas.

## Architecture et données

| Doc | Portée |
| --- | --- |
| [REPO_MAP.md](REPO_MAP.md) | Cartographie du monorepo : applications, paquets, dépendances croisées. Généré par `bun run docs:map`. |
| [database.md](database.md) | Base de données et cache hybride : Postgres self-host ↔ miroir SQLite embarqué. |
| [decision-archi-donnees-azalee.md](decision-archi-donnees-azalee.md) | Décision d'architecture : passage de la couche données d'Azalée sur Drizzle. |
| [architecture-unifiee-ievr.md](architecture-unifiee-ievr.md) | Vue d'ensemble de la chaîne IEVR : extraction, stockage, rendu. |

## Wiki Azalée et bibliothèque

| Doc | Portée |
| --- | --- |
| [azalee-lib.md](azalee-lib.md) | `@rosegriffon/azalee` : cœur du wiki en bibliothèque Bun (racine client-safe, `/server`, `/remote`). |
| [azalee-tauri.md](azalee-tauri.md) | Recette d'intégration Tauri : sidecar Bun compilé, CSP, cycle de vie, mode dégradé. |
| [azalee-plan-correctifs.md](azalee-plan-correctifs.md) | Audit vérifié du wiki (navigation, URLs, référencement, interface, trous de données) et plan de correction, avec ce qui est livré et ce qui reste. |
| [wiki-filters.md](wiki-filters.md) | Filtres du wiki et contournement des colonnes NULL de `inagle_skills`. |
| [cpk-browser.md](cpk-browser.md) | Navigateur des 250 800 fichiers des archives CPK : index, routes, prévisualisation. |
| [tools/README.md](tools/README.md) | Outils communautaires (comparateur, équipe aléatoire, traducteur). |

## Données du jeu (extraction)

| Doc | Portée |
| --- | --- |
| [gamedata-coverage.md](gamedata-coverage.md) | **Plan durable** de couverture de l'extraction : ce qui est parsé, poussé, ce qui manque. |
| [inagle.md](inagle.md) | `@rosegriffon/inagle` : parser binaire CPK/G4TX, API, pipeline. |
| [iecode-inagle-supabase.md](iecode-inagle-supabase.md) | Chaîne complète iecode → inagle → Supabase : tables, correspondances, procédures. |
| [chr.md](chr.md) | Format des modèles de personnage et assemblage 3D. |
| [lvl5.md](lvl5.md) | Formats propriétaires Level-5 : CPK, G4TX, cfgbin, gaiji. |

## Exploitation

| Doc | Portée |
| --- | --- |
| [PROD-STATUS.md](PROD-STATUS.md) | État vérifié de la production, surfaces retirées et règles pour les agents. |
| [deploy.md](deploy.md) | Déploiement et exploitation : services, procédures, diagnostic, interdits. |
| [deploiement-sans-coupure.md](deploiement-sans-coupure.md) | Publication bleu/vert : slots, versions, prévisualisation, et les trois pièges qui cassent une prod pendant un déploiement. |
| [self-host-supabase.md](self-host-supabase.md) | Sortie de Supabase : PostgreSQL local, PostgREST, Storage et Realtime auto-hébergés. |
| [bot-azalee.md](bot-azalee.md) | Second bot Discord (serveur Azalée) sur le même code que le bot Rose Griffon : profils, jeton, invitation, curseur d'annonce. |
| [bot-communaute.md](bot-communaute.md) | Niveaux sur la courbe du jeu, jetons Kizuna, collection de joueurs, tickets en fils privés. Hiérarchie stricte des récompenses de rôle et discrétion par défaut. |
| [bot-multicomptes.md](bot-multicomptes.md) | Rapprochement des comptes d'une même personne : indices observables, poids, seuils, verdicts du staff, et ce qui a été volontairement écarté. |
| [bot-format.md](bot-format.md) | Charte de présentation des deux bots : trousse `lib/ui`, couleurs, icônes, pagination, limites de l'API, patron d'une commande. |
| [bot-commandes.md](bot-commandes.md) | Catalogue définitif des slash commandes des deux bots : inventaire complet, bots tiers du serveur, convention de nommage, plan de bascule. |
| [bot-administration.md](bot-administration.md) | Surface web du bot : contrat de types partagé, serveur d'administration en boucle locale, API et pages `/admin/bot` + `/admin/cron`. |
| [campagnes-hashtag.md](campagnes-hashtag.md) | Campagnes à hashtag : récolte X + Discord, tolérance aux fautes de frappe, relais vers le salon de suivi. |
| [insta.md](insta.md) | Instagram : pourquoi aucune récolte automatique n'est possible, la vérification oEmbed, le dépôt manuel et la table dédiée. |
| [mcp.md](mcp.md) | Serveur MCP du monorepo : mise en service, connexion distante, portées. |
| [rag-unified.md](rag-unified.md) | Recherche sémantique unifiée : embeddings auto-hébergés, graphe de liens, ingestion. |
| [stockage-secondaire.md](stockage-secondaire.md) | Archive froide sur le second VPS : pourquoi elle a existé, ce qui en est revenu le 21/8/2026, et ce qui ne doit jamais être déporté. |
| [achillea-services.md](achillea-services.md) | Topologie, secrets hors Git, ports, sondes et contrat d'upload Supabase d'Achillea. |
| [achillea-storage-migration.md](achillea-storage-migration.md) | Runbook sûr et reprenable pour migrer les octets Storage Cloud d'Achillea vers sa pile locale isolée. |

## Écosystème

| Doc | Portée |
| --- | --- |
| [achillea.md](achillea.md) | Intégration d'Achillea (troisième site) : API, CDN, SEO, liens croisés. |

## Référence externe (générée — ne pas éditer)

La tâche cron `external-docs`
(`packages/cron/src/tasks/ie-crawl/external-docs.ts`) récupère ces
documentations pour le RAG et les régénère dans `reference/`. Toute édition
manuelle y sera écrasée.

| Doc | Source |
| --- | --- |
| [reference/awesome-markdown.md](reference/awesome-markdown.md) | `github.com/mundimark/awesome-markdown` |
| [reference/bun-markdown.md](reference/bun-markdown.md) | `github.com/oven-sh/bun` |
| [reference/better-auth-readme.md](reference/better-auth-readme.md) | `better-auth.com` |
| [reference/better-auth-session.md](reference/better-auth-session.md) | `better-auth.com` (sessions) |
| [reference/discordjs-readme.md](reference/discordjs-readme.md) | `discord.js.org` |
| [reference/turborepo-readme.md](reference/turborepo-readme.md) | `turborepo.dev` |
| [reference/inazuma-index-readme.md](reference/inazuma-index-readme.md) | index communautaire IEVR |
| [reference/secteur-v-readme.md](reference/secteur-v-readme.md) | communauté Secteur V |

## Vérifier la documentation

```bash
bun run docs:map           # régénère REPO_MAP.md depuis les package.json
bun run docs:check-links   # liens internes cassés
bun run docs:lint          # markdownlint
bun run docs:build         # les trois d'affilée
```
