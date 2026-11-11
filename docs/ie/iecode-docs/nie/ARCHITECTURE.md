# NIE architecture and migration reference

## Current IECODE ownership — 2026-10-01

IEVR/Victory Road Rust libraries live in `crates/nie/aphrody-nie-*` and are
members of the single root Cargo workspace. Shared general capabilities are
resolved from the root dependency catalog, including sibling Aphrody crates.
The root Bun workspace owns the present JS/TS packages and applications.
`apps/web` is the DS/Wii emulator frontend; the historical `apps/nie-web` site
and Inacord deployment described below are not present applications here.
C#, native C/C++ and Python keep their owners defined by root instructions.

Root `AGENTS.md`, `PLAN.md` and the documentation index define active
architecture and gates. Use `cargo metadata --no-deps` to enumerate current
members; old test counts and deployment measurements below are dated evidence.

## Historical NIE architecture (retained migration evidence)

> Imported NIE design and measurements. Its old repository-relative paths,
> crate groups, Just commands and deployment claims do not describe the current
> IECODE workspace. Package names retained below map to current NIE crate owners.

Une implémentation maintenue d'IEVR sous une racine. Ce document dit **qui fait quoi** et
**ce qu'il ne faut jamais fusionner**. Le détail de l'absorption historique est dans
[`IECODE-MIGRATION.md`](IECODE-MIGRATION.md).

## Les arbres maintenus

| Arbre                          | Racine               | Volume          | Build   |
| ------------------------------ | -------------------- | --------------- | ------- |
| Rust — moteur, forge et outils | `crates/`            | workspace Cargo | `cargo` |
| TypeScript/Bun                 | `packages/`, `apps/` | workspaces Bun  | `bun`   |

`just all-build` · `just all-test` · `just all-check` pilotent ces deux chaînes.

## Inacord boundary

Inacord is the IEVR workspace of the nie web page (`/inacord`, `apps/nie-web`), served by
`nie-site`. Its Tauri desktop host was removed on 2026-09-26: the single desktop is aphrody-ui
`crates/aphrody-app`, which never depends on nie and reaches the game only through the `nie.*`
tools of aphrody-ai `aphrody-mcp` (process boundary). The generic Aphrody pet/pixel commands moved
to aphrody-app; the IEVR explorer helpers (mods, saves, raw CPK, Lua sessions, Blender) left with
the host and remain available through `nie-site`, the CLI and MCP.

## Doctrine — un rôle, un langage

| Langage    | Rôles                                                        |
| ---------- | ------------------------------------------------------------ |
| **Rust**   | la seule CLI, GUI, core lib, wasm, RE, byte-exact et runtime |
| **Bun/TS** | types, contrats WebView et UI                                |

Règles qui en découlent :

- `aphrody-nie-formats::g4tx_decode` reste Rust : sans lui, wasm n'a pas d'images.
- Porter une capacité se justifie par la doctrine ou par une contrainte technique (byte-exact,
  wasm, dépendance native) — jamais par le goût du langage.

## La CLI unique

```bash
nie decode <src>    # fichier ou arborescence → JSON / PNG (rayon)
nie viola dump ...  # extraction VFS native
nie steam sync ...  # acquisition Steam native
```

Il n'existe plus de délégation vers un binaire C++, une assembly .NET, CMake ou vcpkg.

## Les crates Rust

**46 workspace members** (measured 2026-09-25: `ls -d crates/{forge,engine,tools}/*/` gives
9 forge + 25 engine + 12 tools = 46 crates; `members` in the root
`Cargo.toml`), grouped by role below. The `tests` column is a SNAPSHOT, not an invariant: it dates
from 2026-09-08 (`aphrody-nie-wasm` said 32 where 66 were real) and rows added since carry `—`. Read it as
an order of magnitude; the source is `cargo test -p <crate> --lib`. `crates/archive/*` (2 crates,
not among the 47) is **outside the workspace**: `nie-engine` is excluded explicitly
(`exclude = […]` in the root `Cargo.toml` — ~15 000 lines ported from decompiled C, 434
`// EXTERN:` markers, consumed by no live crate); `nie-rs` never appeared in `members` (its own
standalone `Cargo.lock`, originating in the external `iecode-re` tool, not a nie deliverable).
Both stay read-only porting references, never built by `cargo build --workspace`.

The former six-crate cross-repository extraction is historical. Current NIE
packages use canonical `crates/nie/aphrody-nie-*` owners and root workspace
dependencies; shared `aphrody-re` remains an Aphrody dependency. No publication
or registry credential is required to keep these workspace path dependencies.
See `IECODE-MIGRATION.md` for the import ledger.

### `crates/forge/*` — produire le binaire (9)

| Crate               | Rôle                                                                                                                      | Tests |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----: |
| `aphrody-nie-pe`    | Lecture/écriture byte-exacte du PE64 + découpage du fichier en unités de forge                                            |    24 |
| `aphrody-nie-asm`   | Encodeur x86-64 dialecte MSVC — réassemble les corps depuis `forge/asm/*.s`                                               |    23 |
| `aphrody-nie-forge` | Boucle `split`/`lift`/`cc`/`build`/`verify`/`report`, mesure la part produite                                             |    33 |
| `aphrody-nie-re`    | RTTI MSVC, indexation goblin/iced-x86, propagation de labels sur le call-graph                                            |    73 |
| `aphrody-nie-index` | Base de connaissance SQLite (`var/nie.sqlite`)                                                                            |     4 |
| `aphrody-nie-seed`  | Import du savoir fusionné (index Ghidra, RTTI, formats iecode, hash→nom inagle)                                           |    24 |
| `aphrody-nie-queue` | Frontière BFS dédupliquée (redis), workers parallèles sur fonctions non résolues                                          |     0 |
| `aphrody-nie-dump`  | Façade `nie.exe` (image base, `NieStatic`) sur `aphrody_re::minidump` (aphrody-os), lecteur de minidump Windows générique |     6 |
| `aphrody-nie-trace` | RE en direct : lecture de la mémoire d'un `nie.exe` en cours d'exécution                                                  |    93 |

### `crates/engine/*` — le moteur (25)

| Crate                                            | Rôle                                                                                                                       | Tests |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----: |
| `aphrody-nie-formats`                            | Parsers Level-5 (CPK, cfg.bin, G4*, CriLayla, Criware), `no_std`-friendly                                                  |   386 |
| `aphrody-nie-data`                               | Modèles de données du jeu (skills, auras, chara_param, items, growth)                                                      |  1445 |
| `aphrody-nie-core`                               | Logique reversée (ballon, IA tactique, FSM de match, gardien, stats, CRand)                                                |   311 |
| `aphrody-nie-lua`                                | VM Lua 5.2 réelle (mlua, PUC-Rio 5.2.4 vendored) + analyse statique tree-sitter                                            |   107 |
| `aphrody-nie-camera`                             | Modèle et contrôleurs de caméra portés (`CCameraCtrl*`), codec G4CM, pilotage live                                         |    33 |
| `aphrody-nie-app`                                | Machine à états d'écran (`GameState`) + rendu abstrait (trait `Renderer`)                                                  |    17 |
| `aphrody-nie-game`                               | Hôte GUI natif wgpu — rend les vrais assets                                                                                |    24 |
| `aphrody-nie-render3d`                           | Renderer 3D : charge un GLB réel et le rend en perspective                                                                 |    17 |
| `aphrody-nie-runtime`                            | Boucle intégrée monde + physique + rendu top-down → frames/MP4                                                             |     6 |
| `aphrody-nie-play`                               | Front headless/golden : rejoue `aphrody-nie-app`, écrit PNG/MP4 déterministes                                              |     0 |
| `aphrody-nie-headless`                           | Front headless sans fenêtre, résumé JSON par format                                                                        |    18 |
| `aphrody-nie-save`                               | Déchiffrement, lecture et édition des saves (XOR clé CRC32)                                                                |    57 |
| `aphrody-nie-explore`                            | Aperçu/description des entrées VFS par format                                                                              |    41 |
| `aphrody-nie-viola`                              | Modding Level-5 (dump/pack/merge/crypto Criware), périmètre outil « Viola »                                                |    51 |
| `nie-ui`                                         | Source unique typée des jetons de design du jeu (OKLCH, géométrie, mouvement) → CSS                                        |    35 |
| `aphrody-identity` (aphrody, crates/ui/identity) | Runtime typé du pet « Codex Aphrody v2 » (atlas RGBA, animations, directions)                                              |    56 |
| `aphrody-nie-ffi`                                | Frontière C-ABI — **seul natif chargé côté TS**                                                                            |    13 |
| `aphrody-nie-wasm`                               | Bindings WebAssembly du savoir vérifié                                                                                     |    66 |
| `aphrody-nie-lua-web`                            | La VRAIE VM Lua du jeu dans le navigateur — cible `wasm32-unknown-emscripten`                                              |     0 |
| `aphrody-nie-viewer-web`                         | Le viewer 3D seul, backend WebGL 2, chargé à la demande sans WebGPU                                                        |     0 |
| `aphrody-nie-ocgen`                              | Génération 3D d'un personnage original depuis des références mesurées                                                      |     0 |
| `aphrody-nie-render`                             | Rendering facade: 2D, CPU/GPU 3D, GUI and wasm                                                                             |     — |
| `aphrody-nie-bevy`                               | Bevy integration: real G4TX/G4MD/G4MG become Bevy `Image`/`Mesh` assets through asset loaders                              |     — |
| `aphrody-nie-net`                                | Online mode: room lobby, matchmaking, deterministic rollback/lockstep synchronisation                                      |     — |
| `aphrody-nie-pg`                                 | VFS `cfg.bin` (RDBN, T2B) into PostgreSQL schema `nie`, binary `COPY`, no JSON step — see the data-ownership section below |     — |

### `crates/tools/*` — outillage (12)

| Crate                                         | Rôle                                                                                                                          | Tests |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----: |
| `aphrody-nie-cli`                             | Binaire `nie` — la seule CLI utilisateur, pilote aussi la boucle RE et la frontière redis                                     |    24 |
| `aphrody-nie-mcp`                             | Binding MCP Rust natif (`rmcp`) des commandes partagées de `nie`                                                              |     7 |
| `nie-site`                                    | Serveur HTTP nie (Axum 0.8) : le jeu wasm en `/`, bundle `nie-web`, `/api/v1`, VFS `/f` `/b`, proxy `aphrody-nie-model-serve` |   275 |
| `aphrody-nie-model-serve`                     | Serveur HTTP live d'assemblage GLB IEVR (corps+face+uniforme depuis CPK, cache disque)                                        |    13 |
| `aphrody-nie-inventory` (`ievr-tools` binary) | Historical IEVR inventory tools; its PE inspector is supplied by `aphrody-re` through a compatible re-export                  |     8 |
| `aphrody-nie-launcher`                        | Native launcher, save editor and mod-package manager (`.utmod`, save coordination)                                            |     — |
| `aphrody-nie-computer-use`                    | Capture et inspection locale bornée des images utilisées par les workflows d'observation                                      |     6 |
| `aphrody-nie-steam`                           | Acquisition Steam native (download/dump de dépôts IEVR), remplace SteamKit2                                                   |    35 |
| `aphrody-nie-zukan`                           | Ingesteur de l'encyclopédie officielle Level-5 Inagle (JP/FR/EN)                                                              |    53 |
| `aphrody-nie-wiki`                            | Exploration game-data IEVR depuis le miroir SQLite (personnages, skills, items, équipes)                                      |     0 |
| `aphrody-nie-editor`                          | Éditeur 3D NIE natif, viewport GPU partagé DirectX 12/Vulkan/OpenGL                                                           |     1 |
| `aphrody-nie-bench`                           | Banc de mesure des hot paths Rust et des contrats de format                                                                   |     2 |

## Les ponts

| Pont                                  | Sens      | Point d'entrée                                                                                |
| ------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `packages/nie`                        | Rust → TS | `aphrody_nie_ffi` via `bun:ffi` (préchargé par `bunfig.toml`) — **seul** natif chargé côté TS |
| `scripts/tools/data/sync-gamedata.ts` | TS → Rust | `nie steam` puis `nie viola`                                                                  |
| `packages/nie-bridge`                 | Rust ↔ TS | contrat WebSocket entre le serveur Rust `aphrody-nie-mcp` et la page Inacord de nie web       |

`crates/archive/nie-rs` est du décompilé porté en Rust, hors workspace et compilé
par personne : matière de RE, pas un pont.

## Data ownership

- **The Rust site and wiki are the only IEVR data owners.** IEVR parsing, query rules, mirror
  access, API projections, CLI behaviour and native IPC belong to `aphrody-nie-data`, `aphrody-nie-formats`,
  `aphrody-nie-core`, `aphrody-nie-wiki`, `nie-site` and `aphrody-nie-cli`. Bun is limited to thin
  host bindings and non-IEVR integrations: it never queries the IEVR mirror directly and never
  calls a remote wiki. The deleted Azalée application, `packages/azalee`, `packages/azalee-tools`
  and the IEVR Inagle package are not compatibility targets (decision recorded 2026-09-09 in the
  archived plan).
- **`aphrody-nie-pg` writes only PostgreSQL schema `nie`** (`nie.rdbn_list`, `nie.rdbn_value`,
  `nie.t2b_entry`, `nie.t2b_var`; binary `COPY`, no `jsonb`, incremental and transactional per
  file by SHA-256). Readers get exactly one grant, the role `nie_reader` (NOLOGIN, `USAGE` +
  `SELECT`), and the crate's integration test proves that role cannot write. rg's
  `public.inagle_*` tables, `public.inagle_cfgbin` included, are never touched from here; wiring
  Azalée is `GRANT nie_reader TO <azalee role>`, done with the owner on the production database.
  Measured 2026-09-23 against PostgreSQL 18: replaying 1 209 files rewrites nothing;
  `font_color.cfg.bin` gives 448 cells in 64 rows.
- **Trust the `vfs:` line, not `NIE_GAME_DIR`.** `open_game` silently falls back to this
  repository's `data/` when `NIE_GAME_DIR` points nowhere, so an import can succeed against the
  wrong tree. `aphrody-nie-pg import` prints the VFS it actually opened; read that line before reading its
  counts.

## Fusions interdites

Quatre duplications sont **volontaires**. Les collapser corrompt le byte-exact en silence, avec
des tests qui restent verts.

1. **`crc32` vs `crc32_nie`** — deux fonctions distinctes. `crc32` (complément final : noms
   `cfg.bin`, clés de fichier CPK, type-id ECS, CRC de save) ≠ `crc32_nie` (accumulateur brut
   sans complément : model-id CPK, lookup g4tx). Les fusionner corrompt silencieusement l'un des
   deux chemins.
2. **`g4sk::mat_mul`** reste scalaire local, jamais glam/FMA : il est validé golden sur fixtures
   réelles (skinning), un réordonnancement f32 casse le golden.
3. **`StatBlock` de `aphrody-nie-wiki`** (2 segments f64) diverge volontairement de celui de `aphrody-nie-core`
   (3 segments f32) : le miroir SQLite n'a pas le palier lv30.
4. **Conventions d'axe vertical opposées** — `aphrody-nie-core` traite `y` comme hauteur, `aphrody-nie-runtime`
   traite `z` comme hauteur. `aphrody-nie-geom::Vec3` unifie le _type_ mais **pas** la sémantique : chaque
   crate garde sa convention dans son code. Ne jamais convertir implicitement d'un système vers
   l'autre — la similarité de layout ne vaut pas équivalence sémantique. Idem `Vec2` :
   `g4mg::{u,v}` (UV) ≠ `{x,y}` (terrain).

## Contraintes de structure

- Bun ne charge **que** `aphrody_nie_ffi` (Rust). C'est délibéré : `bunfig.toml` précharge `nie-plugin`,
  donc tout natif joint à cette chaîne ferait échouer n'importe quelle commande `bun` du dépôt dès
  qu'il n'est pas construit.

## RE anchors

The knowledge base (`var/nie.sqlite`) tables that correspond to each architectural layer:

- `function` — 117 068 entries, the complete function inventory of `nie.exe`
- `rtti_class` and `rtti_base` — MSVC RTTI hierarchy (1 745 classes with inheritance)
- `xref` — call-graph edges, the backbone of the propagation in `aphrody-nie-re`
- `coverage` — classification snapshots, the metric `nie rebuild` writes
- `pdata_func` — 55 351 `.pdata` entries, the authoritative function boundaries
- `hash_name` — CRC-32 ↔ string resolution, populated by `nie seed-ui`
- `symbol` — resolved symbols beyond Ghidra's initial export
- `anchor` — manually confirmed function↔name bindings
- `forge_unit` — binary subdivision for byte-exact production

The archive crate `nie-engine` (`crates/archive/nie-engine/src/cfgbin.rs`) carries 434
`// EXTERN:` markers referencing `FUN_140d862f0`, `FUN_1416709b0`, `FUN_14005b8b0`,
`FUN_140e33460`, `FUN_140e085b0`, `FUN_14047f670`, `FUN_140480430`, `FUN_140435320`,
`FUN_1404784a0`, `FUN_140435ae0`, `FUN_140452ac0`, `FUN_1415f4e20`, `FUN_14160a910`,
`FUN_141608cd0`, `FUN_14043b3c0` among others — these are the cfg.bin loader's external
dependencies, each pointing to a real function in the reference binary.

## Les couches, mesurées (2026-09-20)

Un diagramme de couches est une affirmation vérifiable. Celle-ci l'est désormais par une porte :

```sh
bun --bun scripts/validation/layers.ts          # vérifie, sort non-zéro sur régression
bun --bun scripts/validation/layers.ts --write  # réimprime la table depuis la mesure
```

Elle fige le rang **mesuré** — le plus long chemin de dépendances internes — et non un rang
voulu. Mesuré le 2026-09-20 : **50 crates, 9 rangs (N0..N8), aucune dépendance qui remonte.**

Re-measured 2026-09-25 (`bun scripts/validation/layers.ts`): **47 crates, 9 ranks (N0..N8)** —
the crates moved to `../../iecode` left the graph, `aphrody-nie-pg` and `aphrody-nie-render` joined it — and the gate **fails with 3
problems**: `aphrody-nie-pg` and `aphrody-nie-render` carry no rank, and `aphrody-nie-inventory` is declared N1 where the
measure gives N0. The ranked table lives in the script; `--write` regenerates it from the
measurement.

### Ce qu'une version antérieure du diagramme affirmait, et qui ne tenait pas

| Affirmé                                                                                             | Mesuré                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 41 crates                                                                                           | **50**. Absents du diagramme : `aphrody-re`, `aphrody-nie-inventory`, `aphrody-identity` (Aphrody), `aphrody-nie-bevy`, `aphrody-nie-computer-use`, `aphrody-nie-dump`, `aphrody-nie-queue`, `aphrody-nie-tasks`, `aphrody-nie-zukan`                |
| 6 couches                                                                                           | **9 rangs**                                                                                                                                                                                                                                          |
| couches étanches unidirectionnelles                                                                 | la **fondation dépend vers le haut par défaut** : `aphrody-nie-core → aphrody-nie-data`, `aphrody-nie-formats → aphrody-nie-lua`, plus `aphrody-nie-ffi → aphrody-nie-wiki` et `aphrody-nie-wasm → aphrody-nie-model-serve`, toutes non optionnelles |
| `src-tauri` hors du workspace, table `[workspace]` vide, pour éviter le conflit `links = "sqlite3"` | `src-tauri` **est** membre (`Cargo.toml:18`) et n'a aucune table `[workspace]`. `cargo check -p inacord` sort **0** : le conflit ne se manifeste pas. Il est membre **non par défaut**, ce qui n'est pas la même chose qu'être dehors                |

**Aucune de ces dépendances n'est un défaut.** `aphrody-nie-formats` décode le bytecode Lua par
`aphrody-nie-lua`, source unique du décodeur : c'est le bon choix. Ce qui était faux, c'est le **rang**
assigné à ces crates — la règle « extract before you bind » tient, c'est la carte qui ne
correspondait pas au terrain.

### Une exception, documentée plutôt que tue

Une **dev-dependency** peut remonter sans rien casser : elle rejoint le graphe des tests, pas
celui de la bibliothèque. `aphrody-nie-lua` (N1) emprunte ainsi `aphrody-nie-formats` (N2) pour lire de vrais
`.lua.bin` du jeu dans ses goldens ; inverser cette dépendance obligerait à dupliquer le VFS.
La porte laisse passer ce cas en le nommant.

Cargo interdit déjà les cycles dans le graphe de compilation : « aucune dépendance cyclique »
est vrai par construction et n'a pas besoin d'être testé.

### Ce qui reste invérifiable ici

Les **215 688 unités de forge** sont corroborées par quatre documents du dépôt
(`AGENTS.md`, le plan archivé
[`PLAN-2026-09-08-to-25.md`](https://github.com/aphrody-code/nie/blob/c3fa2af/docs/archive/plans/2026-09-25/PLAN-2026-09-08-to-25.md) ×2, la skill
`re-workflow`) mais leur source vivante,
`var/forge/cover.json`, **est absente de cette machine** — `var/` ne porte que des artefacts
régénérables. Ce qui est présent, `data/forge/registry.json`, compte **34 entrées** et est ancré
sur `b1fa04ea365868e5…`, qui est bien le binaire cible. Le chiffre n'est donc ni confirmé ni
infirmé par la mesure : il est régénérable, pas consultable en l'état.
