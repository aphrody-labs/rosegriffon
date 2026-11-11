# Index Canonique de la Documentation Inazuma Eleven & Rose Griffon

Cet index structure et référence l'ensemble de la documentation technique, d'architecture, d'ingénierie inverse et d'exécution du monorepo **Rose Griffon** et de la suite **Inazuma Eleven** (`iecode`, `nie`, `niers`, `ievr`, `cpp`, `dotnet`).

---

## 1. Documentation d'Architecture et Conception Globale
- [Architecture Unifiée IEVR](file:///C:/src/apps/rosegriffon/docs/architecture-unifiee-ievr.md) : Modèle complet de convergence du jeu, du runtime Wasm et des APIs.
- [Spécifications Générales NIE](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/ARCHITECTURE.md) : Conception du moteur, pipeline de simulation déterministe, et intégration VFS.
- [Conventions du Monorepo](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/architecture/MONOREPO-CONVENTIONS.md) : Organisation stricte Rust 2024 et Bun v1.4.4.
- [Cartographie des Capacités NIE](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/NIE-CAPABILITY-MAP.md) : Matrice des 47 sous-commandes de la forge et du CLI.

---

## 2. REA (Reverse Engineer Anything), PE64 & Ghidra SRE
- [Ingénierie Inverse nie.exe](file:///C:/src/apps/rosegriffon/docs/re/nie-exe-re.md) : Analyse PE64, alignement des sections et détection des symboles.
- [Extraction RTTI MSVC](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/nie-rtti-classes.txt) : Hiérarchie complète des classes et vtables de `nie_eacpatched.exe`.
- [Pipeline de Désassemblage et SRE](file:///C:/src/apps/rosegriffon/docs/re/pipeline.md) : Décodage x86-64 via `iced-x86`, tables `.pdata` et call-graph.
- [Suite de Plugins Ghidra](file:///C:/src/apps/rosegriffon/docs/re/ghidra-plugin-suite.md) : Analyseurs headless, pont Sleigh et décompilateur.
- [Computer Use & Traçage RE](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/COMPUTER-USE-RE-TRACE.md) : Traçage non-destructif de la mémoire live.

---

## 3. Formats de Données Criware & Level-5
- [Formats de Fichiers IEVR](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/FORMATS.md) : Spécifications CPK, G4MD (modèles 3D), G4TX (textures DDS), G4MT (matériaux) et G4SK (squelettes).
- [Spécifications Level-5 LVL5](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/lvl5.md) : Conteneurs T2B (`cfg.bin`), tables `@UTF` et compression CRILAYLA.
- [Explorateur et Structure du VFS](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/VFS.md) : Indexation des 255 628 entrées sur les 936 paquets CPK du jeu.
- [Couverture Vidéo et Audio](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/VIDEO-STACK.md) : Démultiplexage Sofdec2 / USM et décodeurs HCA / ADX (`cri_audio`).

---

## 4. Composants IECODE (C++, .NET C#, Rust & Bun)
- [IECODE C++](file:///C:/src/apps/rosegriffon/tools/iecode-cpp) : Implémentations natives des parseurs et bindings haute performance.
- [IECODE .NET C#](file:///C:/src/apps/rosegriffon/apps/iecode-dotnet) : Solution `IECODE.sln` (.NET 9 / C# 13), CLI, Core, GUI et pont FFI.
- [IECODE Homebrew](file:///C:/src/apps/rosegriffon/packages/iecode-homebrew) : Toolchain homebrew DS/3DS et compilateurs de formats consoles.
- [IECODE Scripts](file:///C:/src/apps/rosegriffon/tools/iecode-scripts) : Automatisation et ingestion de dumps.
- [CLI unifié IECODE](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/cli-ie.md) : Guide de commande exhaustif.

---

## 5. Rendu 3D, WGPU, WebGPU & WebAssembly
- [Convergence du Rendu](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/architecture/RENDERER-CONVERGENCE.md) : Rastériseur déterministe CPU pur Rust vs pipeline WGPU.
- [Contrôleur de Caméra G4CM](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/CAMERA-G4CM.md) : Matrices de projection, champs de vue et cinématiques.
- [Design UI & Canvas](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/DESIGN-UI.md) : Intégration du composant canvas 60 FPS dans Next.js 16.
- [Spécifications Avatar et Chara-Edit](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/AVATAR.md) : Recettes de presets, morphologie et personnalisation 3D.

---

## 6. Steam, Intégration Système & Mode En Ligne
- [Architecture Steam](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/architecture/STEAM-ARCHITECTURE.md) : Intégration `bun-steam`, découverte des bibliothèques et lancement.
- [Steam sur Linux & Proton](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/STEAM-LINUX.md) : Compatibilité ntsync, runtimes EAC et configuration Proton.
- [Mode En Ligne NIE](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/NIE-ONLINE-MODE.md) : Simulation réseau déterministe, protocole Inacode et ranked.
- [Gestion des Sauvegardes](file:///C:/src/apps/rosegriffon/docs/ie/iecode-docs/nie/IEVR-SAVE-EDITOR-PORT.md) : Déchiffrement et édition des sauvegardes IEVR (format Lives).
