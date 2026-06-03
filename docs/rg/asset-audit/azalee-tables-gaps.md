# Audit tables `inagle_*` (Supabase `isbkaeltubqittywibeh`) — 2026-06-03

Comptes obtenus via `count(*)` réel (le résumé `list_tables` était périmé/sous-estimé).

## Comptes & colonnes-assets

| Table | Lignes (count réel) | Colonne(s) asset | Avec image | Sans image |
|---|---:|---|---:|---:|
| `inagle_characters` | 6148 (5710 codes distincts) | `image_url` | **0** | **6148** |
| `inagle_skills` | 1002 | `image_url` | 16 (dx11 réel, db-2) | 986 (telop absent du dump, NULL+`has_telop=false`) |
| `inagle_items` | 1668 | `image_url` (path relatif) | 1668 | 0 |
| `inagle_auras` | 9 | `image_url`, `asset_code` | 9 | 0 |
| `inagle_keshins` | 289 | `image_url`, `asset_code` | 251 | **38** (était 66 ; db-1 a rempli 28) |
| `inagle_souls` | 56 | `image_url` | 56 | 0 |
| `inagle_miximax` | 70 | `image_url`,`asset_code`,`icon_code` | 69 | 1 |
| `inagle_passives` | 128 | `image_url` | **0** | **128** |
| `inagle_icon_inventory` | **38222** | `path` | inventaire | — |
| `inagle_img_inventory` | **12787** | `path` | inventaire | — |
| `inagle_media_assets` | 314 | `path` | — | — |
| `inagle_nameplates` | 54 | `image_path` | — | — |
| `inagle_costumes` | 576 | — | — | — |
| `inagle_capsules` | 740 | — | — | — |
| `inagle_gallery` | 360 | `img_path`,`thumb_path` | — | — |
| `inagle_game_assets` | **0** | `path` | **vide (manifest CDN jamais peuplé)** | — |

## Trous de données (VÉRIFIÉ)

1. **`inagle_characters.image_url` = NULL pour les 6148 lignes.** L'image est construite côté
   front par `getCharacterFaceUrl(internal_code)` à partir du code, pas stockée. Acceptable
   tant que le CDN sert les faces ; mais aucune validation que le visage existe (un perso
   sans `face/` → fallback `/ievr.webp` silencieux).

2. **`inagle_characters.stats` (jsonb) = vide sur les 6148 lignes.** Les stats vivent
   uniquement dans les colonnes `stat_*` / `stat_lv1_*`. Le mapper lit `stats.lv99` en fallback
   → fallback toujours vide. Pas bloquant (colonnes scalaires OK) mais la colonne JSON est
   morte → soit la peupler, soit la documenter comme dépréciée.

3. **`inagle_characters.skills` (jsonb) vide pour 423 lignes** (perso sans techniques liées).

4. **`inagle_characters` : 58 sans `name_fr`, 157 sans `description_fr`.** **STATUÉ (iecode-2,
   2026-06-03)** : résolution hash→FR vérifiée OK (`chara_base[3]`→`chara_text/fr` pour le nom,
   `chara_base[19]`→`chara_description_text/fr` pour la desc ; couvre 89 %/79 % de chara_base, ce
   qui correspond aux lignes déjà peuplées). Les 53 cids sans nom / 116 cids sans desc restants
   **n'ont aucune source** : leur hash vaut 0 ou pointe vers une clé absente de **fr ET en ET ja**.
   Ce sont des entités **non-joueur/internes** (npc mob, spirit_element/token, edit_avatar, kt, an,
   variantes cosmétiques c11xxx/c0502xxx, orphelins sans `internal_code`). Le jeu ne leur attribue
   pas de texte localisé → **NULL volontaire**, pas de backfill possible sans inventer du contenu.

5. **`inagle_keshins` : 38/289 sans `image_url`** (était 66 ; db-1 en a rempli 28 via
   `asset_code`). **Correction d'audit (VÉRIFIÉ 2026-06-03)** : l'affirmation « `asset_code`
   NULL » est **fausse**. Les 38 lignes restantes sans `image_url` ont **toutes** leur
   `asset_code` (`COUNT(image_url IS NULL AND asset_code IS NOT NULL)` = 38, `… IS NULL` = 0).
   Au global : 240/289 ont un `asset_code`, les 49 NULL sont précisément des lignes qui ont
   **déjà** une `image_url` — donc le manque d'image n'est PAS corrélé à un `asset_code` NULL.
   Le vrai blocage des 38 : leur `asset_code` (codes `aura_soul` ≥ 610, variantes `_b1/_h1/_h2`,
   codes non-ronds) **n'a pas de fichier correspondant dans le dump `dx11`** (cf. roadmap db-1
   du plan). Ce n'est donc pas un mapping `asset_code` manquant, mais une absence de PNG source.

6. **`inagle_passives` : 128/128 sans `image_url`. STATUÉ (db-4) — pas d'asset jeu, UI sans
   visuel assumée.** Vérification réelle du dump (`/home/ubuntu/.local/share/Steam/iecode/
   inazuma/data/dx11/`, 3.7G) : `menu/200_icon/` ne contient que `01_icon_emblem`,
   `02_icon_item`, `13_icon_tactics` ; aucun dossier `*passive*` (ni `*support*`/`*ability*`/
   `*trait*`) nulle part dans l'arbre. Les 128 passives n'ont donc **aucun asset dédié dans le
   jeu** — ce n'est pas un mapping manquant. Côté front, `apps/azalee/app/passive/page.tsx`
   n'utilise aucune image de jeu : il rend des icônes Lucide par catégorie. La colonne
   `image_url` reste donc volontairement NULL ; aucune ré-extraction à tenter.

7. **`inagle_skills.image_url` — FAIT (db-2, 2026-06-03).** Les 1002 lignes ne pointent plus
   vers le légacy mort. Cross-référence **fichier-par-fichier** du dump
   `220_img/telop_waza/fr/` (310 PNG, tous en forme doublée `{code}_{code}.png`) : seuls **16**
   codes de la table ont un telop réel — `whk00050/00080/00090/00100/00110` et
   `who00010/00020/00030/00040/00060/00070/00080/00090/00100/00110/00190`. Ces 16 →
   `image_url = /dx11/menu/220_img/telop_waza/fr/{code}_{code}.png` (HTTP 200 live vérifié 16/16),
   `has_telop = true`. Les **986** restants → `image_url = NULL`, `has_telop = false`.
   ATTENTION : contrairement à l'hypothèse initiale (« tous les `wh*` présents »), la **majorité**
   des `whs*` (419) et `whd*` (187) — ainsi que la quasi-totalité des `whk*`/`who*` — n'ont
   **aucun** fichier telop dans le dump (974 `wh*` en DB, 16 fichiers seulement ; les 67 `wht*`
   du dump sont un autre jeu, titres romanisés hors `internal_code`).

   **FAIT (db-3, 2026-06-03) — gating front fermé.** Le résolveur `getSkillImageUrl`
   (`apps/azalee/src/lib/images/utils.ts`) utilise désormais un **gate POSITIF** : allowlist
   exhaustive `SKILLS_WITH_TELOP` des **16** codes réellement présents (après normalisation du
   suffixe variant `_<lettres>`, ex. `who00060_or` → `who00060`). Tout code hors liste (986)
   renvoie `PLACEHOLDERS.skill` (`/ievr.webp`) au lieu de fabriquer une URL `{code}_{code}.png`
   garantie 404. Cela couvre TOUS les appels directs `getSkillImageUrl(id)` (search.ts l.710,
   MoveCard, SkillDetail, OverrideSkillSection) et le fallback `d.image_url || getSkillImageUrl`
   (search.ts l.405). Aligné sur `has_telop` (16 true / 986 false). type-check azalee = 0 erreur.
   Vérifié live : `rhd10010` & `whs00010` (hors liste) → placeholder ; `who00010` → telop **200**.
   `inagle_skills.has_telop` documenté via `COMMENT ON COLUMN` (db-3).

8. **`inagle_items.image_url` = path relatif `200_icon/02_icon_item/{name}.webp`** alors que les
   fichiers réels portent le préfixe `icon_item{NN}_`. Mapping à corriger / manifest à compléter.

9. **Tables vides volontaires ou à peupler** (count réel 0, fonctionnalités non livrées) :
   `inagle_formations`, `inagle_tactics`, `inagle_heroes`, `inagle_coordinators`,
   `inagle_basara`, `inagle_awakenings`, `inagle_drops_tables/_treasures`,
   `inagle_stadiums`, `inagle_phase_titles`, `inagle_scene_archives`, `inagle_mode_changes`,
   `inagle_override_skills`, `inagle_custom_passives`, `inagle_manager_passives`,
   `inagle_passive_generation/_scaling`, `inagle_kizuna_items`, `inagle_chat_emotes`,
   `inagle_performances`, `inagle_activity_photos`, `inagle_game_assets`.

## Sécurité (signalé par l'advisor Supabase)

**RLS DÉSACTIVÉE** sur `public.inagle_rag_chunks` et `public.inagle_game_assets` → lisibles/
modifiables par n'importe qui avec la clé anon. À corriger (activer RLS + policies lecture
publique read-only), hors périmètre de ce plan mais à remonter.

> SQL de remédiation (NE PAS appliquer sans policies, sinon accès bloqué) :
> `ALTER TABLE public.inagle_rag_chunks ENABLE ROW LEVEL SECURITY;`
> `ALTER TABLE public.inagle_game_assets ENABLE ROW LEVEL SECURITY;`

## Note clé anon en dur

`apps/azalee/lib/api-client.ts` contient une **clé anon Supabase en dur** (fallback). Anon =
publique par design, mais à externaliser proprement en env pour la rotation.
