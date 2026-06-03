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

## 2. Constat critique (P0) — le CDN ne servait AUCUN asset de jeu → **RÉSOLU (2026-06-03)**

**Cause racine réelle (VÉRIFIÉE)** : `cdn.rosegriffon.fr` (nginx, `51.77.147.152`) renvoyait
**404** sur `/dx11/**`. Or **tout** le contenu visuel d'azalee (faces, uniformes, telop
techniques, items, keshins/souls/auras, miximax, emblèmes, menu) est résolu vers
`cdn.rosegriffon.fr/dx11/menu/**` par `apps/azalee/src/lib/images/utils.ts`.

Ce n'était **ni** une conf nginx perdue **ni** des fichiers jamais synchronisés (hypothèses de
l'audit initial, **infirmées**). La conf existait ET contenait un bloc `location ^~ /dx11/`,
mais son `alias` pointait vers `…/steamcmd/…` (**chemin inexistant**) au lieu du dump réel
`…/iecode/inazuma/data/dx11/` (40 471 PNG / 3.7 Go **déjà** présents sur l'hôte). Le correctif
est donc un **one-liner** (re-pointer l'`alias` + `nginx -t` + `reload`), **pas** un rsync de
3.7 Go. Vérif live post-fix : `curl -sI .../dx11/menu/icon_chr/face/c01000010_l_c01000010_1_l00.png`
→ **200** (`image/png`, 26 848 o). Conf corrigée versionnée dans
`infra/nginx/cdn.rosegriffon.conf` (cdn-3). Le légacy Supabase Storage
(`/storage/v1/object/public/menu/…`, 1002 skills) était **mort (400)** aussi (traité db-2).

Les `public/` du **website** et d'**azalee** (logos, icônes UI element/rarity/move) sont, eux,
servis correctement par l'origine (200). Le website n'active pas le CDN en prod → non impacté.

---

## 3. Tableau des assets manquants par source

| # | Source | Symptôme (vérifié) | Sévérité | Action |
|---|---|---|:--:|---|
| 1 | **CDN dx11 (azalee jeu)** | ~~404 global sur `cdn.rosegriffon.fr/dx11/menu/**`~~ → **FAIT (2026-06-03)** : alias nginx corrigé `steamcmd/`→`iecode/inazuma/data/dx11/` ; `curl -sI .../dx11/menu/icon_chr/face/c01000010_l_c01000010_1_l00.png` = **200** (image/png, 26848 o) ; conf **versionnée** dans `infra/nginx/cdn.rosegriffon.conf` (cdn-3, anti-dérive) | **P0** | ~~Déployer/synchroniser le dump dx11~~ Cause unique = alias nginx pointant vers `steamcmd/` (inexistant) ; corrigé vers `…/iecode/inazuma/data/dx11/` (40 471 PNG servis), `nginx -t` + reload OK ; conf déployée copiée dans le repo (`infra/nginx/`) pour tracer le fix et éviter la perte (cdn-3) |
| 2 | **CDN static menu** | ~~`…/static/azalee/menu/**` 404 (dossier vide)~~ → **FAIT (2026-06-03)** : surface retirée (option a) ; `/var/www/cdn/static/azalee/menu/` (0 fichier) supprimé, aucun outil cdn-sync n'y déploie. Le contenu vit déjà dans le dump dx11 servi par (1) → `curl .../dx11/menu/200_icon/01_icon_emblem/em010001_em010001.png` = **200**. **azalee-code FAIT (2026-06-03, azalee-1)** : `MENU_BASE` ré-aliasé sur `MENU_DUMP_BASE` (`/dx11/menu`) dans `apps/azalee/src/lib/images/utils.ts` → les 2 fallbacks de `resolveAssetUrl` (lignes 73/78) + l'export `MENU_BUCKET_URL` ne pointent plus sur le dossier 404. `tsc` OK, rebuild `ship-azalee.sh`. | **P0** | ~~alias nginx + upload~~ Décidé : ne plus dépendre de `/static/azalee/menu` (rien à y déployer) ; dossier vide retiré. Fallback azalee redirigé vers `/dx11/menu` (azalee-1) |
| 3 | **Légacy Supabase Storage** | ~~bucket `menu` → 400 (1002 skills `image_url`)~~ → **FAIT (db-2, 2026-06-03)** : 0 URL légacy restante dans `inagle_skills`. Sur les 1002, seuls **16** codes (`whk00050/80/90/100/110`, `who00010-110/190`) ont un fichier telop réel dans le dump → re-pointés vers `/dx11/menu/220_img/telop_waza/fr/<code>_<code>.png` (16/16 = HTTP 200 live). Les **986** autres (majorité `whs*`/`whd*` + `rh*`/`swap`) n'ont **aucun** telop dans le dump → `image_url = NULL` + `has_telop = false` (absence documentée, plus d'URL morte stockée ; lié db-3 pour le gating front) | **P0** | ~~migrer les paths DB~~ Fait : re-point dx11 pour les 16 présents, NULL pour les 986 absents |
| 4 | **Items (mapping)** | ~~résolveur `{id}.png` ≠ fichier `icon_item{NN}_{id}.png`~~ → **FAIT (azalee-2, 2026-06-03)** : `item-image-manifest.json` régénéré depuis le listing réel du dump → **1107 entrées toutes vérifiées sur disque** (828 icônes `02_icon_item` préfixées `icon_item{NN}_` + 274 emblèmes `01_icon_emblem` `{code}_{code}` + 5 alias `test_gd*`→`gd110*`). Couvre **1025/1667** `internal_code` ; les 642 restants n'ont **aucun** PNG dans le dump (`ti*`, `coi_*`, objets terrain, `ht*` techniques = telop seulement). Ancien manifest = 1459 entrées dont **662 polluées** (codes `wh*` non-items pointant `220_img/telop_waza/en`) supprimées. Fallback `getItemImageUrl` corrigé : ne produit plus `02_icon_item/{id}.png` (préfixe `{NN}` indérivable → 404 garanti) mais renvoie `PLACEHOLDERS.item`. **Vérif live** : `curl icon_item02_btl_re000001.png` = **200**, `curl btl_re000001.png` (ancien fallback) = **404**, 30/30 URLs manifest échantillonnées = **200**. `tsc` OK | P1 | ~~Compléter `item-image-manifest.json` OU corriger le fallback~~ Fait : régénéré depuis le dump réel + fallback → placeholder |
| 5 | **Telop techniques** | `telop_waza/fr` n'a pas de `rhd*` (codes `a*`/`k*` seulement) | P1 | **FAIT (db-3, 2026-06-03)** — absence confirmée dans le dump complet : `220_img/telop_waza/fr/` = 310 fichiers, prefixes `a*`/`k*`/`aura*`/`wh*`/`mode*` uniquement, **0** `rh*`/`shd*`/`swap_*`. Les 28 codes techniques (19 `rh[dkos]*` + 9 `swap_skill_waza_*`) marqués sans telop : `inagle_skills.has_telop=false` + `image_url=NULL` volontaire (commenté en DB). Résolveur `getSkillImageUrl` court-circuite ces codes vers `PLACEHOLDERS.skill` (plus de 404). `curl rhd10010_rhd10010.png` = **404** (garanti), `who00010_who00010.png` = **200**. Cf. `azalee-tables-gaps.md §7` |
| 6 | **Keshins sans image** | **38/289** `image_url` NULL (était 66 ; db-1 a rempli 28). **Correction audit (VÉRIFIÉ 2026-06-03)** : pas un cas « `asset_code` NULL » — les 38 ont **toutes** leur `asset_code` (0 NULL parmi elles ; au global 240/289 ont un code, et les 49 sans code ont déjà une image). Blocage réel = leur code n'a pas de PNG dans le dump `dx11` | P1 | Reste (db-1) : confirmer l'absence dans le dump complet — pas un mapping `asset_code` à refaire |
| 7 | **Passives sans image** | 128/128 `image_url` NULL | P2 | **FAIT (db-4)** — vérifié dump (3.7G) : `200_icon/` = emblem/item/tactics uniquement, aucun `*passive*` ; pas d'asset jeu. UI `passive/page.tsx` rend des icônes Lucide (sans visuel jeu, assumé). `image_url` NULL volontaire, aucune ré-extraction. Cf. `azalee-tables-gaps.md §6` |
| 8 | **`inagle_characters.stats` jsonb vide** | ~~6148 lignes, colonne morte~~ → **FAIT (db-6, 2026-06-03)** : colonne **dépréciée** (`COMMENT ON COLUMN` posé). Données réelles dans les scalaires `stat_*` (lv99, 6148/6148) et `stat_lv1_*` (lv1, 6138/6148). Les 2 mappers (`api-client.ts` + `wiki-service.ts`) ne lisent plus le fallback `stats.lv99/lv1` (toujours vide) → uniquement scalaires ; `api-client` expose désormais aussi `stats.lv1`. **skills (423 vides)** : NORMAL, pas de gap de jointure — 412 PNJ/non-controllables sans learnset (sur 6093 non-controllables, 5681 EN ONT) + 11 variantes dupliquées dont la canonique porte le learnset ; `COMMENT` posé. Learnsets = attribut par-variante (`[{skillId, learnLevel}]`), définitions dans `inagle_skills` | **P2** | Décidé : déprécier (pas peupler — éviterait la dérive avec les scalaires source de vérité) ; mappers adaptés |
| 9 | **Localisation FR partielle** | 58 sans `name_fr`, 157 sans `description_fr` | P2 | **STATUÉ (iecode-2, 2026-06-03)** : résolution hash→FR vérifiée OK (`chara_base[3]`=hash nom→`chara_text/fr`, `chara_base[19]`=hash desc→`chara_description_text/fr` ; couvre 89 % noms / 79 % desc de chara_base). Les 53 cids sans nom / 116 cids sans desc restants sont **non résolvables car aucun texte n'existe** (hash=0 ou clé absente de **fr ET en ET ja**) : ce sont des entités **non-joueur/internes** (28 npc mob, 8 spirit_element, 4 kt, 3 an, 2 spirit_token, 8 orphelins sans `internal_code` pour les noms ; +15 edit_avatar, +35 variantes c11xxx/c0502xxx cosmétiques pour les desc). **NULL volontaire**, aucune donnée de jeu à backfiller (pas d'invention de texte) |
| 10 | **`inagle_game_assets` vide** | ~~manifest CDN jamais peuplé (0 ligne)~~ → **FAIT (iecode-1, 2026-06-03)** : manifeste de vérité peuplé = **40 471 lignes** (1 par fichier réel du dump dx11 servi par le CDN, `exists=true`), colonnes `path` (relatif `/dx11/`), `bucket` (icon_chr 36 664 / 220_img 2389 / 200_icon 1375 / 210_minimap 41 / movie 2), `kind`, `size`, `buildid=22792000`. Vérif croisée : `path=menu/icon_chr/face/c01000010_l_c01000010_1_l00.png` → `size=26848` en DB == `content-length: 26848` du `curl 200` CDN. Script : `scripts/inagle/pipeline/generate-game-assets-manifest.ts` (walk dump → upsert). Couverture cross-ref par code-feuille = 6448/17341 (37,2 %). RLS anon SELECT déjà en place. **Consommé côté azalee (azalee-3, FAIT 2026-06-03)** : `inagle_game_assets` n'était lue NULLE PART dans `apps/azalee`. Ajout de `scripts/build-character-face-manifest.ts` qui dump la liste exhaustive des codes de base ayant une face variant-1 (`path ~ '^menu/icon_chr/face/<base>_l_<base>_1_l00.png$'` → **5677** codes) vers `apps/azalee/data/character-face-manifest.json`. `getCharacterFaceUrl` (`src/lib/images/utils.ts`) gate désormais sur ce set : un code absent renvoie `PLACEHOLDERS.character` au lieu d'une URL 404 silencieuse résorbée par `<Image onError>`. Aligné sur le pattern existant (`SKILLS_WITH_TELOP`, `ITEM_IMAGE_MANIFEST`). `tsc --noEmit` 0 erreur ; test runtime : `c01003490` → URL, `c99999999` → placeholder. Vérif live : `curl 200` sur la face d'un code listé (`c01000010`), `curl 404` sur un code absent (`c01000011`). | P1 | ~~Générer le manifeste~~ Généré : table-of-truth des URL servies, lookup exact sur `path` avant render (évite les 404 → `/ievr.webp`) ; **consommé en pré-render face (azalee-3)** |
| 11 | **Website `public/`** | aucun manquant (200 en origine) | — | RAS |
| 12 | **Viewer 3D 360° (`zukan-assets-mirror`)** | ~~`getCharacterModel360Url` + `getSkillVideoUrl` ciblent `{CDN_URL}/zukan-assets-mirror/…` → 404 live ; `CharacterModelViewer.tsx` monté via `CharacterTable` → viewer cassé en prod~~ → **FAIT (azalee-1, 2026-06-03)** : le miroir n'existe **nulle part** — `curl https://azalee.rosegriffon.fr/zukan-assets-mirror/3d/k%2Fp%2Fg%2Fpgc9ollbn5e/face/0.webp` = **404**, et la source amont `https://zukan.inazuma.jp/3d/…/face/0.webp` = **404** aussi (rien à re-pointer). Flag `ZUKAN_3D_MIRROR_AVAILABLE=false` ajouté dans `apps/azalee/src/lib/images/utils.ts` : `getCharacterModel360Url` → `PLACEHOLDERS.character`, `getSkillVideoUrl` → `""`. Bouton 360° **démonté** côté UI (`CharacterTable.tsx` : `ZUKAN_3D_MIRROR_AVAILABLE && zukanHash && …`). La vignette perso (CloudFront `dxi4wb638ujep.cloudfront.net/1/{hash}.png`) reste **200** (intacte). `tsc` OK, rebuild `ship-azalee.sh`. | **P1** | ~~Gater les 2 résolveurs + désactiver le bouton 360°~~ Fait : flag `ZUKAN_3D_MIRROR_AVAILABLE` (off) → placeholder + bouton démonté ; aucun 404. Repasser le flag à `true` quand un vrai miroir existera. |

---

## 4. Trous de données inagle à combler

- `inagle_characters.stats` jsonb vide (6148) — **STATUÉ db-6 : DÉPRÉCIÉE** (COMMENT posé) ; source de vérité = scalaires `stat_*`/`stat_lv1_*` ; mappers `api-client.ts`+`wiki-service.ts` ne lisent plus le fallback jsonb.
- `inagle_characters.skills` vide pour 423 lignes — **STATUÉ db-6 : NORMAL** (412 non-controllables sans learnset + 11 variantes dupliquées dont la canonique porte le learnset) ; pas un gap de jointure (5681/6093 non-controllables ont des skills). COMMENT posé.
- `name_fr` (58) / `description_fr` (157) manquants — **STATUÉ (iecode-2)** : non résolvables (aucun texte FR/EN/JA pour ces entités non-joueur : npc mob, spirit, edit_avatar, variantes cosmétiques c11xxx). NULL volontaire.
- `inagle_keshins.image_url` NULL (**38**, était 66 ; db-1 a rempli 28) — **correction audit** : les 38 ont toutes leur `asset_code` (pas un cas « `asset_code` NULL ») ; blocage = absence de PNG dans le dump. `inagle_miximax` (1).
- `inagle_passives.image_url` NULL (128/128) — **STATUÉ db-4 : pas d'asset jeu (aucun `*passive*` dans le dump), UI sans visuel assumée ; NULL volontaire**.
- `inagle_skills.image_url` — **FAIT (db-2)** : 0 légacy restante. 16/1002 re-pointés `/dx11/menu/220_img/telop_waza/fr/<code>_<code>.png` (HTTP 200 vérifié), 986/1002 `NULL` + `has_telop=false` (telop absent du dump).
- Tables vides à peupler si features prévues : `formations`, `tactics`, `heroes`, `coordinators`,
  `awakenings`, `mode_changes`, `stadiums`, `drops_tables/_treasures`, `nameplates` (54 dispo non
  exposées ?), `chara_menu_resource` (92 dispo), etc. (liste complète : audit tables).
- ~~**`inagle_game_assets` (0)**~~ → **FAIT (iecode-1)** : manifeste {path, bucket, exists, size, kind,
  buildid} peuplé = 40 471 lignes (1 par fichier réel du dump dx11 servi). Couverture cross-ref
  loggée (37,2 % par code-feuille, non persistée car les `assetPath` G4TX ≠ noms PNG aplatis servis).

---

## 5. Roadmap priorisée

### iecode (extraction / pipeline)

1. **P0 — FAIT (cdn-3, 2026-06-03) — servir le dump dx11 sur le CDN.** **Correction de cause
   racine** : ce n'était **ni** une conf perdue **ni** un dump à synchroniser (les 40 471 PNG /
   3.7 Go étaient **déjà** sur l'hôte `51.77.147.152`). La conf existait ET avait un bloc
   `/dx11/`, mais l'`alias` pointait vers `…/steamcmd/…` (inexistant) au lieu de
   `…/iecode/inazuma/data/dx11/`. Correctif = **one-liner** : re-pointer l'`alias` + `nginx -t` +
   `systemctl reload nginx` — **aucun rsync de 3.7 Go**. (`/static/azalee/menu/` retiré — cf. asset
   #2.) Vérif live : faces/emblem/aura/telop → **200**. Conf corrigée versionnée
   (`infra/nginx/cdn.rosegriffon.conf`). Action à plus fort impact (a débloqué 100 % des visuels
   azalee).
2. **P1 — Générer `inagle_game_assets`** — **FAIT (iecode-1, 2026-06-03)** : manifeste {path, bucket,
   exists, size, kind, buildid} = 40 471 lignes peuplées via `scripts/inagle/pipeline/generate-game-assets-manifest.ts`
   (walk dump → upsert) ; table de vérité des URL servies pour valider avant render.
3. **P1 — Réconcilier les nommages** items (`icon_item{NN}_`) et telop techniques ; compléter
   `item-image-manifest.json` ; documenter les codes telop disponibles vs codes techniques.
4. **P2 — Résoudre hash→texte FR** — **STATUÉ (iecode-2, 2026-06-03)** : mécanisme vérifié
   (`chara_base[3]`→`chara_text/fr`, `chara_base[19]`→`chara_description_text/fr`) ; les 58 noms /
   157 desc restants n'ont **aucune source** (hash=0 ou clé absente de fr/en/ja) car ce sont des
   entités non-joueur (mobs, spirits, edit_avatar, variantes cosmétiques). NULL volontaire, pas de
   backfill possible sans inventer du texte.
5. **Continuer `coverage-100-plan.md`** (90.3 % → 100 %) : g4pk, objbin (déverrouille aussi le
   menu pixel-perfect), acb/awb. Hors chemin critique assets visibles.

### inagle (données)

6. **P0 — FAIT (db-2, 2026-06-03)** : `inagle_skills.image_url` (1002) sorti du Storage Supabase
   mort. Dump croisé fichier-par-fichier (`telop_waza/fr`, 310 PNG) : seuls **16** codes ont un
   telop réel (`whk00050/80/90/100/110`, `who00010-110/190`) → re-pointés
   `/dx11/menu/220_img/telop_waza/fr/<code>_<code>.png` (16/16 HTTP 200 live via CDN). Les **986**
   restants (`whs*`/`whd*` dominants + `rh*`/`swap`) n'ont aucun telop dans le dump →
   `image_url = NULL` + `has_telop = false`. 0 URL `/storage/v1/object/public/menu/` subsistante.
7. **P1 — partiel (db-1)** : `inagle_keshins.image_url` rempli pour 28/66 via `asset_code`
   (`was{N}` → `aura_soul/a{N pad6}`, format legacy `200_icon/10_icon_chr/aura_soul/...webp`
   rewrité par le résolveur azalee vers le dump dx11 PNG). Filtrage strict sur existence
   fichier : les 38 restants n'ont PAS de fichier dans le dump (`aura_soul` s'arrête à
   `a000560` → codes ≥ 610 absents ; variantes `_b1/_h1/_h2` et codes non-ronds 041/241/291/
   301-303 sans PNG dédié). Audit erroné sur ce point : tous les `was*` ne sont pas dans le dump.
   Vérif live : `curl 200` sur `.../aura_soul/a000020|a000240|a000530_l_..._l00.png`.
   **azalee-code FAIT (2026-06-03, azalee-3)** : strip des suffixes de variante keshin/soul/armed
   dans `getAuraImageUrl` + `resolveAuraTelopUrl` (`apps/azalee/src/lib/images/utils.ts`). Les
   `asset_code` réels portent des suffixes hétérogènes (`_b1`/`_h1`/`_h2` alpha-num, `_1` digit,
   `_st0701`/`_st0901` stage — confirmés en DB : 9+9+9 `_h/_b`, 16 `_1`, 4 `_st*`) que l'ancien
   `replace(/_\d+$/, "")` ne couvrait pas (les `_b1` restaient collés → code faux). Remplacé par un
   helper `auraBaseNum()` partagé qui ne garde que les chiffres suivant le préfixe `w[ksad][a-z]`
   (ex. `was00240_b1` → `a000240`, `wks02020_st0701` → `k002020`), aligné sur le fichier disque
   base-only `{base}_l_{base}_l00.png`. `tsc --noEmit` 0 erreur. Vérif live : `curl 200` sur
   `aura_soul/a000240_l_..._l00.png`, `aura_fs/k002040_l_..._l00.png` et leurs telops
   `220_img/telop_waza/fr/{a000240,k002040}_{...}.png`.
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

- **Assets jeu azalee : 404 prod RÉSOLU (cdn-3, 2026-06-03).** Cause unique = **alias nginx mal
  pointé** (`…/steamcmd/…` inexistant → `…/iecode/inazuma/data/dx11/`), **pas** un dump non
  déployé ni une conf perdue. Correctif = one-liner (alias + reload), pas de rsync 3.7 Go. Faces
  6148, telop skills, items, keshins, souls, miximax, auras, emblèmes/menu → servis (200 live).
- **Trous tables inagle** : stats jsonb 6148 vides (db-6 : dépréciée), keshins **38** sans img
  (était 66 ; correction audit : les 38 ont leur `asset_code`, blocage = pas de PNG dans le dump),
  passives 128 sans img (db-4 : pas d'asset jeu), FR 58 noms / 157 descriptions manquants.
  `inagle_game_assets` : **peuplé (iecode-1, 40 471 lignes)**.
- **Website UI** : 0 manquant.
- **Source disponible** : dump dx11 40 471 fichiers / 3.7 Go présent sur le VPS, **servi** par le
  CDN (alias `/dx11/` corrigé).
