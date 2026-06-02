# Plan de Développement Rose Griffon (PLAN.md)

Ce document présente l'état actuel et la feuille de route du monorepo **Rose Griffon** (Next.js 16.2 / React 19.2 / Bun 1.3 / Supabase / Redis / Turborepo).

Il détaille l'état d'avancement de chaque application et package, avec les fonctionnalités terminées (✅) et planifiées/en attente (⏳).

---

## 1. Vue d'Ensemble de l'Architecture

Le monorepo `/home/ubuntu/rg` est structuré pour dissocier les applications hébergées sur Vercel des services s'exécutant sur le VPS (comme le bot Discord et le démon Cron).

```mermaid
graph TD
    subgraph Apps
        A[@rose-griffon/azalee]
        B[@rose-griffon/website]
        C[@rose-griffon/bot]
    end
    subgraph Services VPS
        D[@rose-griffon/cron]
    end
    subgraph Packages Partagés
        E[@rose-griffon/ui]
        F[@rose-griffon/db]
        G[@rose-griffon/auth]
        H[@rose-griffon/types]
        I[@rose-griffon/config]
        J[@rose-griffon/patreon-bun]
        K[@rose-griffon/assets]
        L[@rose-griffon/inagle]
    end

    A --> E & F & G & L & H
    B --> E & F & G & J & H
    C --> F & H & G
    D --> F & G & L & H
```

---

## 2. Applications (apps/)

### 📱 @rose-griffon/azalee

_Wiki Inazuma Eleven Victory Road (déployé sur `azalee.rosegriffon.fr` via le VPS port 3003 / Nginx)_

- **Description** : Moteur de wiki communautaire et base de données de jeu interactive.
- **État d'avancement** :
  - ✅ Intégration de la stack Next.js 16.2.6 (App Router) et React 19.2.6 stable.
  - ✅ Écriture et édition des articles du wiki via un éditeur de texte riche basé sur Lexical.
  - ✅ Gestion des rôles éditoriaux et accès restreints via `@rose-griffon/auth`.
  - ✅ Intégration des composants graphiques partagés de `@rose-griffon/ui`.
  - ✅ Visualisation dynamique des statistiques et calculs complexes via `@rose-griffon/inagle`.
  - ✅ Module de tri et gestion de l'ordre d'affichage des listes avec `@dnd-kit/core`.
  - ✅ Outil de découpe et de compression d'images côté client.
  - ✅ Suivi de production complet avec Sentry, Vercel Speed Insights, Analytics et Google APIs.
  - ✅ Outils de modération et de traduction en masse pour les administrateurs et réviseurs du wiki.
  - ✅ **Résolution du doublon Mark Evans et variantes** : Regroupement dynamique par `charaId` (fusionnant toutes les versions et loadouts d'un même avatar de personnage de façon unique) et dédoublonnement interne des variantes par position/élément/rareté avec préservation des données de fiche enrichie (`sheetData`).
  - ✅ **Optimisation drastique des latences du Wiki** : Parallelisation des requêtes multi-tables pour les auras et de la résolution des noms de techniques (`Promise.all`), et consolidation des requêtes de repli de `getSkill` en une unique requête SQL `.or()`. Latence divisée par 30 (< 100ms par page).
  - ✅ **Résolution du flou de rendu visuel** : Suppression des animations et transitions de type `filter: blur(...)` et des propriétés `will-change` dans `globals.css` qui désactivaient l'antialiasing sous-pixel du navigateur sur les cartes et la section statistiques de la page d'accueil.
  - ✅ **Centrage mobile de la bannière Achillea** : Correction de l'image de titre via flexbox (`justify-center md:justify-start`) et remplacement de l'image absolue par un composant image responsive.
  - ✅ **Centrage mobile du FormSelector** : Centrage horizontal des vignettes de formulaires et élargissement automatique du conteneur de fiches de personnage (`w-full sm:flex-1`) sur mobile.
  - ✅ **Optimisation de la mise en cache ISR (Incremental Static Regeneration) pour le Zukan** : Pré-génération statique via `generateStaticParams()` pour les 1 051 fiches de personnages à la compilation, éliminant les requêtes à la base de données en production.
  - ✅ Système de recherche hybride combinant recherche floue (uFuzzy) et vectorielle (RAG).

### 🌐 @rose-griffon/website

_Site principal communautaire et portail membres (déployé sur `rosegriffon.fr` via Vercel)_

- **Description** : Site vitrine, boutique, et hub pour la communauté de Rose Griffon.
- **État d'avancement** :
  - ✅ Stack Next.js 16 App Router et React 19 stable configurée.
  - ✅ Gestion d'articles, actualités et patch-notes via l'éditeur TipTap.
  - ✅ Section équipe ("Équipe") et page "Rose Griffon TV" pour la diffusion de streams.
  - ✅ Module de boutique et paiements sécurisés via Stripe.
  - ✅ Espace profil membre étendu avec personnalisation (badges, bannières).
  - ⏳ Boutique en ligne avec gestion de paniers persistants en Redis.
  - ⏳ Module de commentaires en temps réel sous les articles et flux de diffusion.

### 🤖 @rose-griffon/bot (Retiré & Migré dans @rose-griffon/cron)

_Le bot Discord autonome a été retiré et migré dans le démon de tâche de fond `rg-cron` pour des raisons de performance et de simplicité._

- **Description** : Migration de la synchronisation des données (membres, rôles, staff) et de la télémétrie utilisateur en temps réel au sein du cron.
- **État d'avancement** :
  - ✅ **Migration de la synchronisation** : Intégration de la synchronisation des rôles, membres et photos staff dans `packages/cron`.
  - ✅ **Télémétrie en temps réel** : Implémentation du suivi des présences, des activités et des salons vocaux, diffusée en temps réel via WebSocket.
  - ✅ **Serveur d'annonces compatible** : Migration du serveur d'annonces HTTP (port 3006) dans `packages/cron` pour conserver la compatibilité avec l'API existante.
  - ✅ **Suppression du bot interactif** : Retrait du framework lourd `discordx` et des commandes slash au profit d'un client `discord.js` léger et natif.

---

## 3. Packages (packages/)

### ⚙️ @rose-griffon/cron

_Daemon de planification, crawling et RAG (VPS simple process)_

- **Description** : Démon d'arrière-plan exécutant des routines périodiques de maintenance et de crawl.
- **État d'avancement** :
  - ✅ Planification centralisée via `Bun.cron`.
  - ✅ Serveur HTTP et WebSocket (port 3005) diffusant le journal de logs live.
  - ✅ Serveur TCP IPC (port 4001) pour requêtes de santé et queries RAG.
  - ✅ Protection par secret d'API et cookies de session administrateur (Better Auth).
  - ✅ Interface interactive Swagger UI et spec OpenAPI générée à la volée.
  - ✅ Déclenchement manuel des tâches via ligne de commande CLI (`--run <task>`).
  - ✅ Tâches planifiées et implémentées :
    - ✅ **db** (`db.ts`) : Pousser les données parsed par `inagle` dans la base Supabase.
    - ✅ **cdn** (`cdn.ts`) : Synchroniser les médias et ressources vers le CDN statique.
    - ✅ zukan (`zukan.ts`) : Crawling stealth de l'ordre officiel des personnages du zukan avec support de `waitForSelector`.
    - ✅ news (`news.ts`) : Récupération multi-langues des topics (FR, EN, JA, ES, DE, IT, ZH-TW, ZH-CN, PT-BR) et patch notes officiels (EN, JA pour Steam, Switch, Xbox).
    - ✅ re (`re.ts`) : Collecte des informations de Inazuma Eleven RE (FR, EN, JA).
    - ✅ cross (`cross.ts`) : Extraction de données pour Inazuma Eleven Cross (FR, EN, JA).
    - ✅ level5 (`level5.ts`) : Veille sur les annonces LEVEL-5 Corporate liées à Inazuma Eleven.
    - ✅ level5Blog (`level5-blog.ts`) : Crawling du blog de développement LEVEL-5 (5つ星工房日記 / Five-Star Workshop) en JA, EN, ZH-TW, ZH-CN.
    - ✅ twitter (`twitter.ts`) : Synchronisation de `@Azalee_IE`, filtrage des RTs et reconstruction des threads.
    - ✅ rag (`rag.ts`) : Vectorisation automatique du contenu extrait de l'ensemble des locales de topics et de blogs pour indexation dans Redis.
    - ✅ **publish** (`api.ts`) : Publication des articles programmés.
    - ✅ **patreon** (`api.ts`) : Synchronisation des tiers d'abonnements Patreon.
    - ✅ **warm** (`api.ts`) : Chauffage régulier du cache ISR Next.js des applications.
  - ✅ Rotation automatique de proxies pour contourner les limitations d'API et anti-bots (X/Level-5) avec repli résilient.
  - ⏳ Amélioration du chunking sémantique des documents pour le RAG.
  - ⏳ Sources additionnelles pour le crawling (Reddit, Discord).

### 🎨 @rose-griffon/ui

_Bibliothèque de composants UI partagés_

- **Description** : Composants visuels unifiés shadcn/ui en style New York adaptés pour Tailwind CSS v4.
- **État d'avancement** :
  - ✅ Configuration moderne pour Tailwind CSS v4.
  - ✅ Plus de 57 composants UI exportés (Dialog, Select, VAUL drawer, Carousel, Table, etc.).
  - ✅ Thémisation clair/sombre via `next-themes`.
  - ✅ Intégration de recharts pour la data-viz et react-hook-form pour les formulaires.
  - ⏳ Optimisation fine pour React Compiler 19.
  - ⏳ Audit complet d'accessibilité (WCAG/A11y).

### 🗄️ @rose-griffon/db

_Couche d'accès à la base de données unifiée_

- **Description** : Connectivité unifiée Supabase, client Redis et types générés.
- **État d'avancement** :
  - ✅ Types typés issus du schéma Supabase (`types.gen.ts`).
  - ✅ Clients dédiés : `createBrowserClient`, `createServerClient` et `createSupabaseServiceClient`.
  - ✅ Client Redis (`redis.ts`) avec support vectoriel pour le RAG et cache générique.
  - ✅ Module helper pour le bucket de stockage Supabase.
  - ✅ Remplacement du typage `Record<string, unknown>` de `CookieStore` par `CookieOptions` de `@supabase/ssr`.
  - ✅ Découplage complet des dépendances Bun dans les composants côté browser.

### 🔑 @rose-griffon/auth

_Wrapper d'authentification et guards de sécurité_

- **Description** : Système d'authentification et de gestion de session unifié utilisant Better Auth.
- **État d'avancement** :
  - ✅ Intégration de Better Auth avec la base de données Supabase.
  - ✅ Résolution intelligente de profil (`resolveProfile`) gérant Discord et email fallback.
  - ✅ Guards serveur pour Next.js (`createAdminGuard`, `createRoleGuard`).
  - ✅ Synchronisation des nouveaux utilisateurs et rôles par défaut via `ensureUserProfile`.
  - ⏳ Module de gestion des organisations multi-tenant.
  - ⏳ Support de la double authentification (2FA/MFA).

### 📊 @rose-griffon/types

_Schémas de validation et types métier communs_

- **Description** : Source unique de vérité pour les types métier et schémas Zod.
- **État d'avancement** :
  - ✅ Union types pour les rôles utilisateur (`RgRole`).
  - ✅ Types définis pour les articles, visiteurs, flux de streaming, événements et équipes.
  - ✅ Regroupement de tous les schémas de validation Zod sous un unique module.

### 🛠️ @rose-griffon/config

_Outils de qualité de code et configurations partagées_

- **Description** : Outils de standardisation et règles de build pour l'ensemble du monorepo.
- **État d'avancement** :
  - ✅ Presets TypeScript standardisés (`tsconfig-base.json`, `tsconfig-bun.json`, `tsconfig-nextjs.json`).
  - ✅ Règles de validation avec ESLint et Oxlint (`eslint-base.mjs`, `oxlintrc.json`).
  - ✅ Configuration unifiée de presets pour Tailwind CSS.
  - ✅ **Résolution des dépréciations signalées sous TypeScript 6.0** : Retrait du flag `ignoreDeprecations` de tous les fichiers TSConfig et correction des types.
  - ⏳ Migration globale de toutes les configurations ESLint vers le format de configuration plat (Flat Config).

### 🎟️ @rose-griffon/patreon-bun

_Client API Patreon V2 typé pour Bun_

- **Description** : Fork local typé pour requêter l'API V2 de Patreon sans surcoût.
- **État d'avancement** :
  - ✅ Implémentation du client d'API Patreon V2 typé.
  - ✅ Outils d'écoute et de traitement des webhooks (exemples express/cloudflare).
  - ✅ Prise en charge de la liaison de compte OAuth.
  - ⏳ Consolidation du système de rafraîchissement des tokens OAuth.

### 📦 @rose-griffon/assets

_Ressources graphiques et statiques partagées_

- **Description** Centralisation des images, polices et logos pour les apps Next.js et le bot.
- **État d'avancement** :
  - ✅ Structure d'exportation de fichiers statiques prête.
  - ⏳ Pipeline de compression automatisé pour réduire le poids des images.
  - ⏳ Script d'invalidation automatique du cache CDN de production.

### 🎮 @rose-griffon/inagle

_API universelle et parses de données de jeu Inazuma Eleven_

- **Description** : Outil d'extraction, d'analyse et de calcul des données d'IEVR.
- **État d'avancement** :
  - ✅ Parsing des fichiers binaires et de configuration de jeu (items, skills, characters).
  - ✅ Module Basara pour l'agrégation de statistiques.
  - ✅ Calculateur de statistiques de personnage dynamique.
  - ✅ Script de synchronisation DB (`cli-push.ts`).
  - ⏳ Support de nouvelles versions de fichiers lors des futures mises à jour du jeu.
  - ⏳ Simulateur interactif de composition d'équipe.

---

## 4. Plan d'Action & Prochaines Étapes Opérationnelles

### Phase 1 : Consolidation des fondations TypeScript & Config

1. ✅ **[db] Typage de CookieStore** : Remplacé par `CookieOptions` dans `packages/db/src/server.ts` pour éliminer le cast d'options de cookie dans le site web.
2. ✅ **[bot] Nettoyage des dépendances** : Retiré `tsyringe` de `apps/bot/package.json` et centralisé les variables de configuration (GUILD_ID, thèmes, etc.) dans `apps/bot/src/lib/config.ts`.
3. ✅ **[config] TS 6.0 Warnings** : Retrait du flag `ignoreDeprecations: "6.0"` dans la configuration TypeScript commune.

### Phase 2 : Optimisation et robustesse du Crawler et RAG (@rose-griffon/cron)

1. ✅ **Fiabilisation de la connexion Redis** : Correction des déconnexions intempestives Redis (`ERR_REDIS_CONNECTION_CLOSED`) lors du RAG Sync en ajustant le cycle de vie du socket de Bun.
2. ✅ **Amélioration du crawler Twitter et rendu UI** : Extraction des entités média distantes sur X, reconstruction ordonnée des threads, et structuration complète des colonnes `media` et `raw_tweets` pour le rendu dynamique des threads dans l'UI d'Azalée.
3. ✅ **Résilience réseau** : Intégrer un système de rotation de proxies dans `@rose-griffon/cron` pour prémunir le crawl officiel Zukan, Level-5 et X/Twitter contre les blocages d'IP (avec retry-loop et injection de flag chrome).
4. **Qualité RAG** : Améliorer le chunking des documents récoltés pour affiner la pertinence des résultats de recherche sémantique.

### Phase 3 : Nouvelles fonctionnalités applicatives

1. ✅ **Profils membres** : Espace membre personnalisé sur le site avec gestion de cosmétiques (choix de bannières prédéfinies et jusqu'à 3 badges avec icônes dynamiques).
2. ✅ **Dashboard Wiki** : Mise en ligne des outils d'édition et de modération en masse pour Azalée (interface interactive de traduction en masse pour les personnages, techniques, équipes et objets).

### Phase 4 : Optimisation Base de Données et Cache Hybride (Azalée)

1. ✅ **Intégration du cache SQLite local pour les lectures du wiki** :
   - Branché sur les requêtes de lecture statiques (dans `server.ts` et `api-client.ts`) sur le fichier SQLite local généré par `backup:supabase`.
   - Les écritures utilisateur (authentification Better Auth, profils, logs d'audit) restent connectées à Supabase Cloud Postgres.
   - **Bénéfice** : Latence réseau de 0ms sur les pages de données de jeu et économie massive de requêtes sur Supabase.
2. ✅ **Automatisation du cycle de vie du cache** :
   - Routine automatique en tâche cron configurée dans `@rose-griffon/cron` (exécution quotidienne à 2h UTC pour la synchronisation Inagle et la sauvegarde SQLite).
3. ✅ **Optimisation massive des performances du traducteur et de la compilation bytecode** :
   - Mise en cache des objets `RegExp` compilés pour le glossaire et ajout d'un contrôle de présence rapide via `.includes()` (early exit) réduisant les compilations d'expressions régulières par 1 000.
   - Parallélisation des E/S et du parsing JSON dans le générateur de glossaire via `Promise.all` et traitement AST en une seule passe pour `extractNouns`.
   - Optimisation de l'exécutable compilé via le cache de bytecode natif Bun (`--bytecode`) divisant par 2 le temps de démarrage du CLI en production, avec sourcemaps `zstd` embarqués (`--sourcemap`).
4. ✅ **Résolution du fallback d'API Skills et indexation par IDs hexadécimaux** :
   - Redirection automatique du chargeur de Skills API vers les entrées précompilées locales (`packages/inagle/src/entries`) quand le dossier de données de production `/home/ubuntu/data/entities` n'existe pas.
   - Suppression définitive de l'avertissement de module manquant `@streamparser/json` à l'exécution de l'exécutable standalone compilé.
   - Indexation bidirectionnelle des techniques par identifiant textuel (`skillIDStr`) et par adresse hexadécimale (`skillID`), résolvant l'affichage des noms des Super Moves dans les fiches de personnages.
   - Amélioration de l'interaction utilisateur dans le REPL interactif en autorisant l'exécution immédiate des commandes lors de l'annulation d'un prompt de sélection multiple.

### Phase 5 : Sécurité & Stratégie de Sauvegarde Externe

1. ✅ **Script de backup PG18 automatisé** :
   - Mettre en place un script de sauvegarde globale (schéma + rôles + données) via pg_dump / pg_dumpall natifs, découpé en trois fichiers (`roles.sql`, `schema.sql`, `data.sql`) et compressé.
   - Exporter ces sauvegardes logiques PostgreSQL 18 vers un espace de stockage externe (type AWS S3 ou serveur froid externe) pour se prémunir de toute perte de données dynamique (utilisateurs, logs, profils).

### Phase 6 : Déploiement, Stabilisation & Nettoyage (Juin 2026)

1. ✅ **Résolution globale du type-check et shims de dépendance** :
   - Isolation du shim de types `@aphrody-code/bxc` dans des configurations spécifiques à la compilation/typecheck (`tsconfig.build.json` pour `inagle` et `tsconfig.typecheck.json` pour `cron`).
   - Retrait du shim de la configuration commune `tsconfig-base.json` et locale `tsconfig.json` de runtime pour éviter les erreurs d'initialisation de variables par le JIT de Bun.
   - Résolution des résolutions de chemins `@/*` dans `apps/website`, `apps/azalee` et `apps/bot` en fixant localement le paramètre `"baseUrl": "."` dans leurs TSConfig respectifs.
   - Compilation robuste du binaire `packages/cron/dist/rg-cron` en marquant `@aphrody-code/bxc` comme dépendance externe.
2. ✅ **Build et Déploiement robustes Next.js (Next 16 / Turbopack)** :
   - Déploiement de l'application principale Website (`apps/website`) en production sur Vercel à partir de la racine du monorepo.
   - Déploiement de l'application self-host Azalée (`apps/azalee`) en production sur le VPS (port `3003`) avec le script de contournement `next-build.sh` pour intercepter les crashs Bun à l'exit et garantir la présence de `server.js` standalone.
3. ✅ **Gestion et Nettoyage des Services VPS** :
   - Mise à jour et installation du démon Cron de production (`rg-cron.service`) pour exécuter le démon à l'aide de `bun run src/index.ts` depuis le répertoire `packages/cron` (JIT propre résolvant les vrais modules).
   - Retrait définitif et désactivation complète du bot Discord (`rg-bot.service`) du VPS à la demande.

