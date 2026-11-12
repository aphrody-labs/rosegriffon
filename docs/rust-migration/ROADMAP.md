# Roadmap

Chaque phase se termine sur des critères vérifiables. Builds Rust lourds sur le vps.

## Phase 0 : socle paquets (fait en PoC)

- `crates/nie-pkg` : registre TOML embarqué, manifestes par jeu, `list/info/matrix/install/verify/update/remove`, BLAKE3.
- `crates/nie-pkg-ui` : écran bibliothèque Dioxus (SSR testé, desktop compilé).
- Sortie : `cargo test -p nie-pkg -p nie-pkg-ui` vert sur le vps (8 tests), clippy propre. Atteint.

## Phase 1 : contrats et données

- Export JSON Schema depuis `achillea-contract` et `rg-types` ; génération des types Rust (`typify`) dans `crates/rg-contract`.
- `nie-data` : port de `inagle` (parseurs) sur `aphrody-nie-formats` ; `inagle-cross` en module.
- Sortie : tests de parité TS vs Rust sur les fixtures d'`inagle` (même JSON octet pour octet), round-trip schéma en CI.

## Phase 2 : wiki Victory Road en Rust

- App Dioxus fullstack `apps/nie-wiki` (route par catégorie : chara, skill, tactic, item, stade, ...), données servies par l'API TS.
- Recherche : index Rust (`aphrody-nie-index`) compilé en wasm.
- Sortie : parité des 30 sections de `apps/rg-website/src/app/wiki`, Lighthouse >= 95, redirections 301 depuis les URL Next, aucune import `next` dans le code IEVR.

## Phase 3 : NIE multi-jeux

- Backends `nie-pkg` : `ds` (port NdsSharp depuis `apps/iecode-dotnet`), `3ds` (XPCK/XMTN/IMGC), `wii`, `switch`, `ps`, `pc` (Steam 2799860 via `bun-steam`), `mobile`.
- Registre distant signé (minisign) avec révisions ; `nie-pkg update` tire le registre.
- Sortie : chaque ligne de FEATURE-MATRIX passe `dump_verify = full` avec un dump réel ; `asset_extract` >= partial pour ie1, go1, strikers, ievr.

## Phase 4 : Achillea

- `achillea-core` en Rust (Elo, classement, sanctions, licences, votes) avec tests de parité contre la version TS.
- UI Achillea en Dioxus ; l'API et la DB restent TS.
- Sortie : même classement sur l'historique de prod rejoué ; `apps/rg-website/src/app/achillea` supprimé, redirections en place.

## Phase 5 : découplage Discord / Next

- `rg-bot` ne garde que des commandes clientes de l'API, aucune logique de jeu.
- Crawl Level-5 / zukan en `nie-crawl`, `rg-cron` ne fait que planifier.
- `apps/cli`, `apps/mcp` TS retirés au profit de `aphrody-nie-cli` / `aphrody-nie-mcp`.
- Sortie : `rg -l "discord|next/" crates/` vide ; une fonctionnalité Inazuma utilisable sans compte Discord ; build et déploiement sur au moins deux fournisseurs (conteneur Alpine + hébergement statique).

## Phase 6 : desktop et mobile natifs

- Dioxus 0.8 (natif Blitz) une fois `image` aligné, ou GPUI pour l'éditeur lourd si le profilage le justifie (voir DESIGN.md).
- Sortie : binaires Windows, macOS, Linux, Android signés depuis la CI.
