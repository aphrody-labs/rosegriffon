# Actualités Mondiales & Écosystème SRE / Modding Inazuma Eleven: Victory Road (2026)

Document de veille consolidé pour le moteur de données `nie` et l'encyclopédie `rosegriffon.fr`.

---

## 1. Mises à Jour Officielles Level-5 (Japon & Global)

- **Patch Notes & DLC Roadmap** :
  - **Version 4.0.0 / 4.0.1 (Février 2026 - Orion & Lumen DLC)** :
    - Route _Orion (Part One)_ dans le mode Chronique.
    - Introduction de la rareté **Fabled** pour les avatars et amélioration des recettes de création d'équipes personnalisées.
  - **Version 6.0.0 (Juin 2026 - New Kick-Off DLC)** :
    - Lancement physique accompagnant la **Nintendo Switch 2**.
    - Système de **Synergies** (buffs d'équipe inter-personnages).
    - Joueurs saisonniers pour les tournois classés en ligne (Ranked).
  - **Version 7.0.0 / 7.1.2 (Juillet 2026 - Contenders for Glory DLC)** :
    - Équilibrage des tactiques, super-techniques et pénalités anti-triche / ragequit.
- **Annonce Majeure LEVEL5 VISION 2026** :
  - Confirmation officielle de la suite directe : _**Inazuma Eleven: Bold Revolution**_ avec le nouveau protagoniste Shane Starfall (_Nagi Furuhoshi_).

---

## 2. Écosystème de Modding & Outils Communautaires (GameBanana & RE)

- **Hubs GameBanana Actifs** :
  - **IEVR PC & Switch Hubs** :
    - _IEVR Mod Manager_ : Injection et gestion des conteneurs `.utmod` et mods d'archives.
    - _Voice Editor_ : Remplacement des banques audio Criware HCA/ADX.
    - _Victory Road Overload Creator_ & _Victory Road Rival Overdrive_ : Ligues hors-ligne, custom cups et équipes d'invités.
    - Packs de textures et shaders menus / kits d'uniformes.
- **Correspondance avec les Outils NIE** :
  - `nie launcher` : Gère le chiffrement des équipes et l'injection de conteneurs compatibles.
  - `nie viola` : Analyse, fusionne et reconstruit les archives CPK.
  - `nie vfs` : Explore et inspecte les 255 628 fichiers de l'installation Steam officielle.

---

## 3. Couverture Communautaire Hispanophone et Internationale

- Activité compétitive majeure sur les tournois Inacode et communautés espagnoles / latino-américaines (tournois en BO1 / BO3 avec règles suisses intégrées dans `rg-cron/src/achillea-taches.ts`).
- Suivi automatisé dans `packages/rg-cron/src/tasks/ie-crawl` (flux Twitter `@inazuma_project`, `@LEVEL5_times`, blogs de développement d'Akihiro Hino).
