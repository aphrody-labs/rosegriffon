# Audit assets référencés dans le code UI (2026-06-03)

Périmètre : `apps/website/src` et `apps/azalee` (composants/pages). Recherche des références
`next/image src=`, `<img src=`, `url(...)`/background, `next/font/local`, paths `public/`,
URLs `cdn.rosegriffon.fr`.

## Website (`apps/website`)

Les chemins d'assets référencés statiquement existent tous dans `apps/website/public/` et
sont servis par l'origine (vérifié 200 en prod). **Aucun manquant** côté website UI statique.

Refs vérifiées présentes : `RG_Logo_V2.5.webp`, `RG_Logo_V2.5_NB.webp`, `azale.webp`,
`rgtv/rgtv.webp`, `overlay.webp`, `overlay2.webp`, `stand.webp`, `emote.webp`,
`achillea/logo1.svg`, `avatarRG/avatarRG.webp`, `avatarRG/tutoRouge.webp`,
`gaelle_lagoatte_pfp.webp`, `RG_roy_LC.webp`.

Note : le website **n'active pas** `NEXT_PUBLIC_CDN_URL` en prod (sinon ces assets seraient
404, cf. `missing-cdn.md`). Le `cdn-loader.ts` est donc un no-op en l'état → OK.

## Azalee (`apps/azalee`) — la quasi-totalité des assets est dynamique (DB → résolveur)

Les images de contenu ne sont pas des `src=` statiques : elles sont construites à l'exécution par
`apps/azalee/src/lib/images/utils.ts`. Toutes les fonctions ci-dessous pointent vers
`cdn.rosegriffon.fr/dx11/menu/**` ou `…/static/azalee/menu/**` → **404 en prod** (cf. CDN).

| Fonction | Cible construite | État prod |
|---|---|---|
| `getCharacterFaceUrl` | `…/dx11/menu/icon_chr/face/{base}_l_{base}_1_l00.png` | **404** (P0) |
| `getCharacterUniformUrl` / `…BackUrl` | `…/icon_chr/uniform/{u}_l_{u}_{1,2}.png` | **404** (P0) |
| `getSkillImageUrl` | `…/220_img/telop_waza/fr/{code}_{code}.png` | **404** + mapping faux (P0/P1) |
| `getItemImageUrl` | `…/200_icon/02_icon_item/{id}.png` (+ manifest) | **404** + préfixe `icon_itemNN_` manquant (P0/P1) |
| `getEmblemImageUrl` | `…/200_icon/01_icon_emblem/{em}_{em}.png` | **404** (P0) |
| `getAuraImageUrl` | `…/icon_chr/aura_fs|aura_soul/{a/k}_l_{}_l00.png` | **404** (pattern OK sur disque) (P0) |
| `getMiximaxIconUrl` | `…/icon_chr/aura_mixi/{code}_l_{code}_l00.png` | **404** (P0) |
| `resolveAuraTelopUrl` | `…/220_img/telop_waza/fr/{bucket}_{bucket}.png` | **404** (P0) |
| `resolveAssetUrl` (legacy `/storage/v1/object/public/menu/…`) | rewrite → dx11 dump | **404** (P0) |
| `getSkillVideoUrl` / `getCharacterModel360Url` | `{ASSET_URL}/zukan-assets-mirror/…` | non vérifié (probable absent) |

### Assets UI statiques azalee (icônes element/rarity/move) — OK

`public/spirit_type/{fire,wind,forest,mountain}.webp`, `public/rarity/{normal,experimente,…}.webp`,
`public/move/{tir,dribble,defense,gardien,girl,boy}.webp`, `public/emote/*` → présents, servis 200.

### Placeholders

`PLACEHOLDERS.{character,item,skill}` = `/ievr.webp` (existe). Donc tout asset jeu 404 retombe
sur le logo IEVR → l'app ne casse pas visuellement mais perd 100 % des vignettes de contenu.

## Mismatchs résolveur → nom de fichier (VÉRIFIÉ sur le dump disque)

Même CDN rétabli, certaines fonctions ne tomberont pas sur le bon fichier :

1. **Items** : résolveur produit `{id}.png` mais le fichier réel est `icon_item{NN}_{id}.png`
   (ex. `icon_item02_btl_re000001.png`). Le `item-image-manifest.json`
   (`apps/azalee/data/item-image-manifest.json`) est censé corriger ça mais seul le *fallback*
   est faux → vérifier la couverture du manifest.
2. **Telop techniques** : `getSkillImageUrl('rhd10010')` → `rhd10010_rhd10010.png` **inexistant**.
   Le dossier `telop_waza/fr` (310 fichiers) n'utilise QUE des codes `a*`/`k*` (aura/keshin),
   **pas** les codes techniques `rhd*`. Mapping technique→telop manquant (gap données).
