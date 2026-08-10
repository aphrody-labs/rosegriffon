# Navigateur CPK (azalee) — architecture du miroir de fichiers IEVR

> **Cap** : azalee n'est pas qu'un wiki de données, c'est aussi un **navigateur + une API complets des
> fichiers du jeu**. Les **250 800 entrées** des archives CPK d'*Inazuma Eleven: Victory Road* (textures,
> modèles 3D, sons, vidéos, configs, données) sont parcourables comme un arbre de fichiers, et leur
> contenu est **décodé à la volée par le CDN** (jamais de dump statique).

Ancré au réel (2026-06-06, vérifié) :

- Index Redis db3 `iev:file:index` (HASH `path → cpk`) : `HLEN` = **250 800**.
- Répartition top-level : **common 193 540** / **dx11 57 260** (le reste — `movie`, `font` — est rare).
- Artefact tracké : `apps/azalee/data/cpk-index.ndjson.gz` (~3,9 Mo).
- Service de décodage : `cdn.rosegriffon.fr` (g4tx→png live :8788 ; `/model-full/` :8790).

## Chaîne complète

```
Redis db3 iev:file:index (250 800)         ← vérité terrain (indexée par iecode/niers)
        │  scripts/build-cpk-index.ts
        ▼
apps/azalee/data/cpk-index.ndjson.gz       ← artefact tracké git (~3,9 Mo, 1 ligne [path, cpk])
        │  lib/cpk/index.ts (1er accès, runtime Bun)
        ▼
SQLite de cache /tmp/azalee-cpk/cpk-index.sqlite  ← matérialisé au runtime (tmpfs, NON tracké)
        │  listDir / listDirPaged / fileMeta
        ▼
/api/cpk  (JSON)   +   /cpk/[[...path]]  (RSC arbre + fiche fichier)
        │  assetUrl / thumbUrl (lib/cpk/shared.ts, client-safe)
        ▼
cdn.rosegriffon.fr  ← décode le CONTENU (g4tx→png, g4md→glb, …) live depuis les CPK
```

## Pourquoi NDJSON gz → SQLite runtime (et pas un .sqlite tracké)

Un SQLite plein (8 colonnes + index couvrants sur 250 k lignes) pèse **~93 Mo** — trop lourd pour git, et
les `*.sqlite` sont gitignorés globalement (règle monorepo). On tracke donc un **NDJSON gzippé compact**
(`[path, cpk]` par ligne, ~3,9 Mo) et la lib runtime **matérialise** la table `cpk_index` au premier accès.

Avantages (tous des pièges déjà rencontrés) :

- **Pas de binaire 93 Mo en git.**
- **Pas de symlink** vers un dump hors-racine → évite l'outage Turbopack (refus des symlinks hors racine,
  cf. CLAUDE.md parent).
- **Survit au fresh-checkout** (build standalone) : l'artefact est dans `data/` (vrai dossier tracké).

## ⚠ Le SQLite de cache vit sur `/tmp` (tmpfs), pas sur le disque root

`lib/cpk/index.ts` écrit le SQLite matérialisé dans `os.tmpdir()` (`/tmp/azalee-cpk/`, **tmpfs en RAM**) et
**non** dans `.next/`/`data/`. Raison : le **disque root du VPS est tendu** ; un SQLite de cache de ~90 Mo +
WAL sur le root pourrait saturer pendant un build/run. `/tmp` est volatile (reconstruit au prochain boot →
re-matérialisé au 1er accès, coût ~1-2 s). Override possible via `CPK_CACHE_DIR` (et `CPK_INDEX_PATH` pour
la source). Le cache se reconstruit automatiquement si le NDJSON gz est plus récent que le `.sqlite`
(`statSync(...).mtimeMs`).

`bun:sqlite` est chargé via un **require littéral sous garde `typeof Bun`** (Turbopack tolère le specifier
littéral marqué external mais refuse un require computé) ; la page/route est `force-dynamic` (jamais
prerendue) → le require ne s'exécute qu'au runtime Bun de prod. Même garde que `lib/supabase/sqlite-client.ts`.

## Frontière server-only / client-safe (stricte)

| Module | Touche | `import "server-only"` ? | Importable depuis `"use client"` ? |
| --- | --- | --- | --- |
| `lib/cpk/index.ts` | `bun:sqlite`, Node fs/zlib | **OUI** | NON |
| `lib/cpk/materialize.ts` | `bun:sqlite` (schéma/insert) | non (le script générateur l'importe aussi hors Next) | NON |
| `lib/cpk/shared.ts` | rien (types + URL CDN purs) | non | **OUI** |

> Règle générale azalee : un module `"use client"` ne doit **jamais** importer une valeur d'une lib qui
> touche sqlite/supabase-server/Node, sinon le bundle navigateur casse (`Can't resolve 'tls'`/`fs`). Le
> data-fetch SQLite vit côté serveur ; les helpers purs (mapping `(path, ext) → URL CDN`, labels, preview
> kind) vivent dans `*-shared.ts`. Même pattern que les 7 `lib/wiki/<x>.ts` + `<x>-shared.ts`.

## Décomposition de l'index (`lib/cpk/materialize.ts`)

Chaque chemin `data/dx11/menu/.../c.g4tx` + son CPK est décomposé en colonnes :

| Colonne | Sens |
| --- | --- |
| `path` | chemin complet (avec préfixe `data/`) |
| `top` | 1er segment logique (préfixe `data/` retiré) → `common` / `dx11` / `movie` / `font` |
| `sub` | 2e segment logique |
| `dir` | répertoire parent (sans le nom de fichier) |
| `name` | nom de fichier |
| `ext` | extension sans point, en minuscules |
| `cpk` | archive CPK contenant le fichier |
| `depth` | nombre de segments |

Index couvrants posés : `idx_cpk_dir` (fichiers directs d'un répertoire), `idx_cpk_path` (lookup `fileMeta`
+ détection « est-ce un dossier »), `idx_cpk_top_sub` (navigation top-level). Listing d'arbre en O(log n).

## API `/api/cpk`

`runtime = "nodejs"` + `dynamic = "force-dynamic"` (bun:sqlite, pas Edge). Cache court `s-maxage=300`.

| Requête | Réponse |
| --- | --- |
| `GET /api/cpk?path=<dir>[&limit=&offset=]` | `{ dir, dirs[], files[], fileTotal, fileOffset }` — sous-dossiers complets (compte récursif) + **page** de fichiers directs (`listDirPaged`, défaut `limit=1000`, plafond `5000`) |
| `GET /api/cpk?path=<file>&meta=1` | métadonnées du fichier + `assetUrl`/`thumbUrl` CDN |
| `GET /api/cpk?q=<terme>` | recherche par sous-chaîne de nom (bornée à 200) |

Garde-fou : tout `path` contenant `..` → 400 (borné au sous-arbre `data/`).

**Pagination serveur réelle** (et non un slice client) : un répertoire peut avoir des dizaines de
milliers de fichiers directs (`common/sound/ja` ≈ 15 443). La grille (`CpkFolderView`) charge une
page puis fetch `&offset=` à « Afficher plus » ; l'arbre (`CpkTree`/`tree.ts`) borne à `TREE_FILE_CAP`
(500) fichiers par dossier et pousse une sentinelle « … N de plus » qui ouvre le dossier dans la grille.

## Route `/cpk/[[...path]]`

Catch-all (`force-dynamic`, pas de prerender de 250 k chemins). Pour un chemin donné :

- **Fichier** (feuille de l'index) → l'explorateur ouvre la fiche `CpkFilePreview` (preview par type).
- **Répertoire** → l'explorateur ouvre la grille/liste paginée du dossier.
- **Inexistant** (ni fichier ni répertoire peuplé, hors racine) → `notFound()` (validé serveur via
  `listDirPaged(indexPath, 1, 0)` : 404 si zéro sous-dossier ET zéro fichier).

Le rendu est porté par l'îlot client `CpkExplorer` (arbre virtualisé + onglets + grille + preview) ;
la page serveur ne fait que la validation 404 et les `generateMetadata`. Fil d'Ariane cliquable
(dernier segment = emplacement courant, non cliquable), racine `/cpk` (common + dx11 avec comptes).

## Preview par type (`lib/cpk/shared.ts` + `CpkFilePreview.tsx`)

`cpkPreviewKind(ext)` classe l'extension → rendu :

| Famille | Extensions | Rendu | URL CDN |
| --- | --- | --- | --- |
| `image` | `g4tx` | `<img>` / vignette WebP | `/dx11/<reste>.png` (g4tx→png live), thumb `?w=400&format=webp` |
| `model` | `g4md`, `g4mg` | viewer 3D `<model-viewer>` (si code éligible) | `/model-full/<code>.glb` (assemblage corps+visage+uniforme) ou `/model/<code>.glb` |
| `text` | `txt json xml csv lua cfg ini yml yaml` | bloc texte | — |
| `config` | `bin objbin fxbin mevbin cfg.bin` | décodé en JSON / fiche binaire | — |
| `sound` | `acb awb hca wav at9` | player audio | — |
| `movie` | `usm mp4 webm bk2` | player vidéo | — |
| `raw` | reste | lien brut | `/g4tx/<path>` (route raw-decode, peut 404) |

Mapping `assetUrl` **validé par probe HTTP** (vérité terrain) : g4tx (100 % sous `data/dx11/`) → 200
image/png ; g4md/g4mg → `/model-full/…glb` 200 (codes `c0xxxxxxx`/`k*` ; ex. `c11250030`, `k000010`,
`c05021090` mesurés 200, ~175-436 Ko, textures embarquées). Codes non assemblables (props, décor, `n*`
uniforme isolé) → lien `/model/<code>.glb` sans assemblage full.

## Régénérer l'index

```bash
bun apps/azalee/scripts/build-cpk-index.ts          # → data/cpk-index.ndjson.gz (depuis Redis db3)
  --out=<path>      # sortie NDJSON gz (défaut: data/cpk-index.ndjson.gz)
  --redis-db=<n>    # base Redis (défaut: 3, ou $IEV_REDIS_DB)
  --sqlite          # écrit AUSSI un .sqlite plein (debug ; data/cpk-index.sqlite)
```

Au prochain accès runtime, le SQLite de cache `/tmp` se reconstruit (mtime du NDJSON > mtime du cache).
