# Migration Rust de l'outillage Inazuma Eleven

Objectif : tout l'outillage Inazuma Eleven (NIE, IEVR, Azalee, Achillea) passe en Rust pur, multiplateforme, sans dépendance à Discord ni à Next.js. NIE devient un moteur multi-jeux géré comme un gestionnaire de paquets (`crates/nie-pkg`).

Ce qui reste en TypeScript (Bun) : auth, db, api, serveur, contrats, couche Discord, wiki communautaire hors Victory Road. La communauté et l'organisation Rose Griffon restent sur Discord + Next.

## Règle de frontière

- Rust possède : formats de jeu, données de jeu, rendu, éditeurs, moteur, wiki IEVR, logique compétitive Achillea, UI des outils.
- TS possède : identité (`rg-auth`), persistance (`rg-db`), surface HTTP (`apps/rg-website/src/app/api`), contrats (`achillea-contract`, `rg-types`), Discord (`apps/rg-bot`, `rg-discord-sync`), site communautaire.
- Rust parle à TS uniquement par HTTP/JSON sur des contrats versionnés. Les types Rust sont générés depuis les contrats TS (JSON Schema exporté par `achillea-contract`), jamais l'inverse ni à la main.
- Aucune fonctionnalité Inazuma ne doit exiger un compte Discord ni une page Next : l'auth passe par l'API (OAuth/OIDC générique, Discord n'étant qu'un fournisseur parmi d'autres).

## Inventaire actuel

Rust (workspace racine, `Cargo.toml`, 56 membres) :

- `crates/aphrody-nie-*` (47 crates) : `formats` (CPK, CRILAYLA, cfg.bin, famille G4*, USM, menus), `save`, `render`/`render3d`, `wasm`, `ui`, `editor`, `game`, `runtime`, `lua`, `mcp`, `wiki`, `zukan`, `pg`, `sql`, `net`, `launcher`, `play`, etc.
- `crates/bun-steam` (dépôt Steam), `crates/re`, `crates/yolo-re-*`, `crates/yre-worker` (RE), `crates/shenron-gpu`, `crates/aphrody-softraster`.
- Nouveau : `crates/nie-pkg` (registre + manifestes), `crates/nie-pkg-ui` (PoC Dioxus).

TypeScript (fichiers .ts/.tsx hors node_modules) :

| Unité | Fichiers | Rôle | Décision |
|---|---|---|---|
| `packages/inagle` | 303 | API de données IEVR, parseurs | Rust (`aphrody-nie-formats` + nouveau `nie-data`) |
| `packages/azalee` | 135 | wiki IEVR : PG, index CPK, recherche, CLI | Rust (`aphrody-nie-wiki`, `aphrody-nie-pg`, `aphrody-nie-index`) |
| `packages/inagle-cross` | 9 | schémas masterdata IE Cross | Rust (module `nie-data::cross`) |
| `packages/ieverse` | 13 | catalogue média IE | Rust (registre média dans `nie-pkg` ecosystem) |
| `packages/achillea-core` | 60 | Elo, classement, sanctions, licences | Rust (`achillea-core` crate, cible wasm pour le site) |
| `packages/achillea-client` | 32 | client HTTP Achillea | Rust (client généré) ; reste TS pour le site communautaire |
| `packages/achillea-contract` / `-types` | 14 / 37 | contrats | Restent TS (source), export JSON Schema |
| `packages/nie-ui` / `nie-web` | 17 / 2 | UI web émulateur, bindings wasm | Rust (Dioxus), suppression des wrappers TS à terme |
| `packages/bun-engine-formats` | 21 | formats moteur | Rust (déjà couvert par `aphrody-nie-formats`, à dédupliquer) |
| `packages/iecode-homebrew` | 2 | toolchains DS/DSi/3DS | Rust (`nie-pkg` backends ds/3ds) |
| `packages/filmcraft`, `hyperframes`, `remotion` | 16 | vidéo | Hors périmètre Inazuma (outils médias), inchangés |
| `packages/rg-cron` (`tasks/ie-crawl`, `zukan-videos`, `achillea-*`) | 89 | crawl Level-5, news IE, tâches Achillea | crawl Level-5 et zukan en Rust (`nie-crawl`), tâches Achillea liées DB restent TS jusqu'à phase 4 |
| `packages/rg-auth`, `rg-db`, `rg-types`, `rg-config`, `rg-i18n` | 94 | socle | Restent TS |
| `packages/rg-discord-sync`, `apps/rg-bot` | 381 | Discord | Restent TS ; les 196 fichiers du bot qui touchent IE deviennent des clients HTTP de l'API, sans logique de jeu |
| `apps/rg-website` (Next) | 1169 | site | `wiki/*` IEVR, `achillea/*`, `play/`, `save/`, `api/cpk`, `api/inazuma`, `api/save` sortent vers Rust ; communauté, news, shop, profil restent |
| `apps/iecode-dotnet` | 962 .cs | IECODE C# (archives, crypto, NdsSharp, GameData, Gui) | Port Rust module par module ; NdsSharp alimente le backend DS |
| `apps/cli`, `apps/mcp` | 4 | CLI/MCP TS | Remplacés par `aphrody-nie-cli` / `aphrody-nie-mcp` |

Sources RE et références : `docs/lvl5.md` (cartographie outils Level-5, formats 3DS XPCK/XMTN/IMGC vs G4* d'IEVR), `docs/ie/iecode-docs/` (217 fiches), `docs/re/`, crawler Level-5 `packages/rg-cron/src/tasks/ie-crawl/level5.ts` et `level5-blog.ts`.

## Ce qui bouge

1. Données de jeu : `inagle` + `azalee` + `inagle-cross` -> crates Rust, export Parquet/JSON pour l'API TS (l'API sert, Rust produit).
2. Wiki Victory Road : pages Next `apps/rg-website/src/app/wiki/*` -> app Dioxus fullstack (SSR + hydratation wasm), déployable sur n'importe quel hôte statique/conteneur.
3. Achillea : logique `achillea-core` en Rust (wasm pour le navigateur, natif pour le serveur), UI Achillea en Dioxus ; la persistance et l'API restent TS.
4. NIE : moteur multi-jeux, `nie-pkg` comme point d'entrée (registre, install/verify/update, matrice), backends par plateforme (ds, 3ds, wii, switch, ps4/ps5, pc, mobile).
5. iecode C# -> Rust : priorité archives/crypto/GameData, puis NdsSharp.
6. Crawl Level-5 / zukan -> crate `nie-crawl` (reqwest + scraper), planifié par `rg-cron` via HTTP.

## Ce qui reste

- TS : auth, db, api, serveur, contrats, Discord, site communautaire (news, feed, shop, profil, sondages, wiki communautaire hors Victory Road).
- Discord et Next restent pour la communauté et l'organisation uniquement.

## Risques

- Déduplication `bun-engine-formats` / `inagle` / `aphrody-nie-formats` : risque de divergence tant que les deux vivent ; tests de parité sur fixtures avant suppression.
- Contrats : un JSON Schema faux casse silencieusement Rust ; contrôle CI `schema -> types -> round-trip`.
- Plateformes consoles : NIE ne distribue aucun contenu ; `install` enregistre et hache un dump possédé par l'utilisateur.
- Dioxus native (Blitz) bloqué aujourd'hui par `image =0.25.6` (blitz-dom 0.2) vs 0.25.10 dans le workspace ; desktop passe par webview tant que Dioxus 0.8 n'est pas stable.
