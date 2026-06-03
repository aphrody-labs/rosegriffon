# Plan consolidé iecode + inagle — assets & données (2026-06-03)

> Audit complet des assets manquants (UI website/azalee, CDN, tables `inagle_*`) et roadmap
> priorisée du pipeline iecode (extraction RE) + inagle (parsing/données).
> Listes brutes : `docs/asset-audit/{missing-ui,missing-cdn,azalee-tables-gaps}.md`.
> Distinction stricte **vérifié** vs **supposé** dans tout le document.

---

## 1. État actuel

### iecode (toolkit RE IEVR — C# .NET + pont Bun)

Dump du jeu Steam `2799860`, parse des formats LEVEL-5. Plans existants sous `iecode/re/` :

| Plan | État | Résumé |
|---|---|---|
| `menu-azalee-plan.md` | **fait (partiel)** | Menu pixel-perfect : G4TX → PNG lossless OK (40 157 textures), cfg.bin OK, Lua décompilé ; **OBJB + transforms G4PKM à parser** |
| `azalee-menu-webgpu-plan.md` | **fait** | Exporter → lua-runtime → renderer WebGPU ; shaders DXBC→WGSL + atlas de police + outline faits |
| `unify-iecode-rg-plan.md` | **fait** | Monorepo unifié `@rose-griffon/*`, branche `unify-iecode` |
| `rag/UNIFIED-RAG-PLAN.md` | **fait** | RAG pgvector (`inagle_rag_chunks` = 546 chunks) |
| `research/coverage-100-plan.md` | **en cours (90.3 %)** | 226 456/250 800 fichiers CPK couverts ; gaps : g4pk, p3lip, acb/awb, objbin, usm, g4cm, g4md, vfx, mevbin |
| `strict-typing-plan.md` | **en cours** (autre agent — NE PAS TOUCHER) | typage strict |

Dump dx11 extrait et présent sur le VPS de build :
`/home/ubuntu/.local/share/Steam/iecode/inazuma/data/dx11/` — **40 471 PNG, 3.7 Go**
(symlink `packages/inagle/data/dx11`). Cross-référence : `packages/inagle/data/asset-cross-reference.json`
(17 353 assets, 35 958 sources).

### inagle (données Supabase `inagle_*`)

Couverture data réelle : 6148 personnages, 1002 techniques, 1668 objets, 289 keshins, 56 souls,
70 miximax, 128 passives, 208 équipes, 740 capsules, 576 costumes ; inventaires d'assets
`inagle_icon_inventory` (38 222) + `inagle_img_inventory` (12 787). Détails et trous :
`docs/asset-audit/azalee-tables-gaps.md`.

---

## 2. Constat critique (P0) — le CDN ne sert AUCUN asset de jeu

**Vérifié** : `cdn.rosegriffon.fr` (nginx, `51.77.147.152`) renvoie **404 sur tout** (racine,
`/dx11/`, `/static/`, `/public/`, `/_next/`). Or **tout** le contenu visuel d'azalee
(faces, uniformes, telop techniques, items, keshins/souls/auras, miximax, emblèmes, menu) est
résolu vers `cdn.rosegriffon.fr/dx11/menu/**` par `apps/azalee/src/lib/images/utils.ts`.
→ **100 % des vignettes de contenu azalee sont en 404 en prod**, fallback `/ievr.webp`.

Le contenu **existe** (dump 3.7 Go sur le VPS) : c'est un **problème de déploiement/infra**, pas
d'extraction. Le légacy Supabase Storage (`/storage/v1/object/public/menu/…`, 1002 skills) est
**mort (400)** aussi.

Les `public/` du **website** et d'**azalee** (logos, icônes UI element/rarity/move) sont, eux,
servis correctement par l'origine (200). Le website n'active pas le CDN en prod → non impacté.

---

## 3. Tableau des assets manquants par source

| # | Source | Symptôme (vérifié) | Sévérité | Action |
|---|---|---|:--:|---|
| 1 | **CDN dx11 (azalee jeu)** | ~~404 global sur `cdn.rosegriffon.fr/dx11/menu/**`~~ → **FAIT (2026-06-03)** : alias nginx corrigé `steamcmd/`→`iecode/inazuma/data/dx11/` ; `curl -sI .../dx11/menu/icon_chr/face/c01000010_l_c01000010_1_l00.png` = **200** (image/png, 26848 o) ; conf **versionnée** dans `infra/nginx/cdn.rosegriffon.conf` (cdn-3, anti-dérive) | **P0** | ~~Déployer/synchroniser le dump dx11~~ Cause unique = alias nginx pointant vers `steamcmd/` (inexistant) ; corrigé vers `…/iecode/inazuma/data/dx11/` (40 471 PNG servis), `nginx -t` + reload OK ; conf déployée copiée dans le repo (`infra/nginx/`) pour tracer le fix et éviter la perte (cdn-3) |
| 2 | **CDN static menu** | ~~`…/static/azalee/menu/**` 404 (dossier vide)~~ → **FAIT (2026-06-03)** : surface retirée (option a) ; `/var/www/cdn/static/azalee/menu/` (0 fichier) supprimé, aucun outil cdn-sync n'y déploie. Le contenu vit déjà dans le dump dx11 servi par (1) → `curl .../dx11/menu/200_icon/01_icon_emblem/em010001_em010001.png` = **200**. Reste côté azalee-code : re-pointer le fallback `resolveAssetUrl` `MENU_BASE`→`MENU_DUMP_BASE` | **P0** | ~~alias nginx + upload~~ Décidé : ne plus dépendre de `/static/azalee/menu` (rien à y déployer) ; dossier vide retiré. `MENU_BASE` (utils.ts) reste utilisé par 2 fallbacks → à rediriger vers `/dx11/menu` côté azalee-code |
| 3 | **Légacy Supabase Storage** | bucket `menu` → 400 | P0 | Cible morte : confirmer que le rewrite front (→ dx11) suffit une fois (1) fait ; sinon migrer les paths DB |
| 4 | **Items (mapping)** | résolveur `{id}.png` ≠ fichier `icon_item{NN}_{id}.png` | P1 | Compléter `apps/azalee/data/item-image-manifest.json` (couvrir les 1668 items) OU corriger le fallback |
| 5 | **Telop techniques** | `telop_waza/fr` n'a pas de `rhd*` (codes `a*`/`k*` seulement) | P1 | Établir le mapping technique→telop, OU confirmer absence dans le dump complet et masquer l'image |
| 6 | **Keshins sans image** | 66/289 `image_url` NULL | P1 | Re-mapper via `asset_code` → `icon_chr/aura_fs/k{N}` |
| 7 | **Passives sans image** | 128/128 `image_url` NULL | P2 | **FAIT (db-4)** — vérifié dump (3.7G) : `200_icon/` = emblem/item/tactics uniquement, aucun `*passive*` ; pas d'asset jeu. UI `passive/page.tsx` rend des icônes Lucide (sans visuel jeu, assumé). `image_url` NULL volontaire, aucune ré-extraction. Cf. `azalee-tables-gaps.md §6` |
| 8 | **`inagle_characters.stats` jsonb vide** | 6148 lignes, colonne morte | P2 | Peupler depuis `stat_*` au re-parse inagle, ou documenter dépréciée |
| 9 | **Localisation FR partielle** | 58 sans `name_fr`, 157 sans `description_fr` | P2 | Compléter la résolution hash→texte FR (iecode `common/text/fr`) |
| 10 | **`inagle_game_assets` vide** | manifest CDN jamais peuplé (0 ligne) | P1 | Générer le manifeste assets (path + existence) pour valider URL avant render |
| 11 | **Website `public/`** | aucun manquant (200 en origine) | — | RAS |

---

## 4. Trous de données inagle à combler

- `inagle_characters.stats` jsonb vide (6148) — peupler ou déprécier.
- `inagle_characters.skills` vide pour 423 lignes.
- `name_fr` (58) / `description_fr` (157) manquants.
- `inagle_keshins.image_url` NULL (66), `inagle_miximax` (1).
- `inagle_passives.image_url` NULL (128/128) — **STATUÉ db-4 : pas d'asset jeu (aucun `*passive*` dans le dump), UI sans visuel assumée ; NULL volontaire**.
- `inagle_skills.image_url` tous légacy (1002) → re-pointer vers dx11 ou stocker le vrai code telop.
- Tables vides à peupler si features prévues : `formations`, `tactics`, `heroes`, `coordinators`,
  `awakenings`, `mode_changes`, `stadiums`, `drops_tables/_treasures`, `nameplates` (54 dispo non
  exposées ?), `chara_menu_resource` (92 dispo), etc. (liste complète : audit tables).
- **`inagle_game_assets` (0)** : générer un manifeste {path → existe sur CDN} à partir du dump +
  `asset-cross-reference.json` pour permettre la validation d'URL côté inagle.

---

## 5. Roadmap priorisée

### iecode (extraction / pipeline)

1. **P0 — Publier le dump dx11 sur le CDN.** Restaurer la conf nginx du vhost `cdn.rosegriffon.fr`
   (alias `/dx11/` → `…/iecode/inazuma/data/dx11/`, `/public/` ; `/static/azalee/menu/` retiré — cf. asset #2) et synchroniser
   les 3.7 Go (rsync vers `51.77.147.152`). Vérifier ensuite les URLs résolveur (faces/auras OK,
   items/telop à valider). C'est l'action à plus fort impact (débloque 100 % des visuels azalee).
2. **P1 — Générer `inagle_game_assets`** (manifeste {path, bucket, existe}) depuis le dump +
   `asset-cross-reference.json` ; sert de table de vérité pour les mappings front.
3. **P1 — Réconcilier les nommages** items (`icon_item{NN}_`) et telop techniques ; compléter
   `item-image-manifest.json` ; documenter les codes telop disponibles vs codes techniques.
4. **P2 — Résoudre hash→texte FR** pour les 58+157 lignes manquantes (`common/text/fr`).
5. **Continuer `coverage-100-plan.md`** (90.3 % → 100 %) : g4pk, objbin (déverrouille aussi le
   menu pixel-perfect), acb/awb. Hors chemin critique assets visibles.

### inagle (données)

6. **P0 (après 1)** — re-pointer `inagle_skills.image_url` (1002) vers les chemins dx11 réels OU
   garder le rewrite front ; supprimer la dépendance au Storage Supabase mort.
7. **P1 — partiel (db-1)** : `inagle_keshins.image_url` rempli pour 28/66 via `asset_code`
   (`was{N}` → `aura_soul/a{N pad6}`, format legacy `200_icon/10_icon_chr/aura_soul/...webp`
   rewrité par le résolveur azalee vers le dump dx11 PNG). Filtrage strict sur existence
   fichier : les 38 restants n'ont PAS de fichier dans le dump (`aura_soul` s'arrête à
   `a000560` → codes ≥ 610 absents ; variantes `_b1/_h1/_h2` et codes non-ronds 041/241/291/
   301-303 sans PNG dédié). Audit erroné sur ce point : tous les `was*` ne sont pas dans le dump.
   Vérif live : `curl 200` sur `.../aura_soul/a000020|a000240|a000530_l_..._l00.png`.
8. **P2** — peupler/déprécier `inagle_characters.stats` ; combler `skills` (423).
9. **Sécurité (hors plan, à remonter)** — **fait** (db-5) : RLS activé sur
   `inagle_rag_chunks` + `inagle_game_assets` avec policy `SELECT USING (true)` pour
   `anon`/`authenticated` (migration `enable_rls_readonly_inagle_rag_chunks_game_assets`).
   Lecture anon vérifiée (546 chunks visibles), `get_advisors(security)` ne signale plus
   `rls_disabled_in_public` sur ces tables. Reste : externaliser la clé anon en dur de
   `apps/azalee/lib/api-client.ts`.

### Validation

- **[fait — cdn-4, 2026-06-03]** Re-run de l'échantillon CDN de `docs/asset-audit/missing-cdn.md` :
  les 5 surfaces réellement résolues (face, telop, item icon `icon_item02_`, aura_fs k000290,
  emblem em0001) renvoient toutes **200** (`content-type: image/png`, `cache-control: immutable`).
  Voir le tableau « Re-run 2026-06-03 » du doc audit. Reste à checker visuellement `/chara`,
  `/skill`, `/item` en prod (hors périmètre cdn-infra).
- Diff pixel menu (harnais headless lavapipe vs rendu azalee) une fois OBJB/G4PKM exportés
  (cf. `menu-azalee-plan.md §5`).

---

## 6. Synthèse chiffrée (vérifié)

- **Assets jeu azalee en 404 prod : 100 %** (faces 6148, telop skills 1002, items 1668, keshins
  289, souls 56, miximax 70, auras 9, emblèmes/menu) — cause unique : CDN dx11 non déployé.
- **Trous tables inagle** : stats jsonb 6148 vides, keshins 66 sans img, passives 128 sans img,
  FR 58 noms / 157 descriptions manquants, `inagle_game_assets` vide.
- **Website UI** : 0 manquant.
- **Source disponible** : dump dx11 40 471 fichiers / 3.7 Go présent sur le VPS, prêt à publier.
