# `/avatar` — l'éditeur d'avatar d'IEVR rejoué sur azalée

La page `apps/azalee/app/avatar/` reconstitue l'écran `chara_edit` d'**Inazuma Eleven: Victory
Road** à partir des fichiers du jeu. Rien n'y est rédigé à la main : le catalogue vient de
`niers avatar export`, les sprites des atlas du jeu, les libellés de `menu_text`.

Ce document dit **d'où vient chaque élément**, **comment l'écart au vrai jeu se mesure**, et
**ce qui reste faux et pourquoi**. Tout chiffre cité est reproductible par la commande donnée.

---

## 1. Les sources

| Élément | Source | Servi par |
| --- | --- | --- |
| Catalogue (502 parts, 470 couleurs, 218 curseurs, 38 visages, 96 voix, 24 personnalités) | `niers avatar export` | `/avatar/catalog.json` |
| Vignettes de parts | atlas `menu/200_icon/21_icon_avatar/` | `/avatar/icon/<nom>.png` |
| Sprites d'écran | atlas `dx11/menu/…` du jeu | `/dx11/menu/…/<région>.png` |
| Libellés | `menu_text` (hash → texte) | `/ui/text.png?t=…&fg=…` |
| Palette de texte | `FONT_COLOR` | `/ui/theme.json` |
| Modèle 3D | pièces `common/chr/_face/20_EDIT/`, recomposées | `/model-avatar/<pièces>.glb` |

Les trois familles de CRC-32 qui cohabitent dans le catalogue (`resourceName*` → modèle,
`textureName` → icône de vignette, `presetID` → recette) sont décrites en tête de
`app/avatar/page.tsx`. La structure des grilles et des rubriques est dans `app/avatar/structure.ts`.

### Le layout est la source d'autorité pour les sprites

`var/avatar-ui/layouts/chara_edit_menu.json` (côté `niers`, produit par
`nie-game --menu chara_edit_menu --from-setting --runtime --export-layout`) énumère les 18 objets
de l'écran avec, pour chacun, l'atlas que le jeu y pose. C'est **lui** qu'il faut consulter avant
de choisir un sprite — pas la ressemblance d'un nom.

Exemple vécu : le bandeau du bas utilisait `20_cmn/cmn03/cmd_back_base01` et
`cmd_press_btn_base_on01`, dont le nom promettait un bouton de retour et un bouton d'action. Ce
sont en réalité des **fonds cyan**, d'où les deux rectangles turquoise là où le jeu montre des
pilules blanches. Le layout, lui, désigne `mainmenu01_10_return_arrow_button_guide` et
`mainmenu01_12_next_button_guide` — soit `mainmenu01_10` (136 × 68, pilule claire à flèche bleue)
et `mainmenu01_12` (304 × 68, pilule blanche dont l'alpha plafonne à 60 %).

---

## 2. Comment l'écart se mesure

La référence n'est pas une capture trouvée en ligne : c'est **le jeu lancé ici**. Depuis
`niers/scripts/nie-wine-setup.sh`, `nie.exe` tourne sous Wine sur ce VPS (sans GPU, rendu lavapipe)
et l'écran voulu est capturé en 1920 × 1080. Les captures vivent hors dépôt —
`niers/var/refs-avatar/live/` — puisque ce sont des assets © LEVEL-5.

```bash
# 1. capturer la page publique, à la même résolution que la référence
bun --bun apps/azalee/scripts/shot.ts https://azalee.rosegriffon.fr/avatar /tmp/az.png

# 2. comparer, région par région
niers img diff /tmp/az.png var/refs-avatar/live/chara_edit_style_01.png --roi roi.json
```

`roi.json` découpe l'écran en cinq régions nommées, parce qu'un score global masque toujours une
zone parfaite et une zone fausse :

```json
[{"nom":"barre_haut","rect":[0,0,1920,130],"kind":"nommee"},
 {"nom":"ergot_onglet","rect":[750,118,430,62],"kind":"nommee"},
 {"nom":"panneau_droit","rect":[1210,190,700,775],"kind":"nommee"},
 {"nom":"barre_bas","rect":[0,990,1920,90],"kind":"nommee"},
 {"nom":"scene_avatar","rect":[0,180,1210,810],"kind":"nommee"}]
```

---

## 3. Ce que la mesure a donné

État de départ, puis état servi aujourd'hui (écran *Style*, 1920 × 1080) :

| Région | px | SSIM avant | SSIM après | ΔE moyen après |
| --- | ---: | ---: | ---: | ---: |
| **global** | 2 073 600 | 0,6482 | **0,7074** | 10,40 |
| `scene_avatar` | 980 100 | 0,6212 | **0,7347** | 9,53 |
| `panneau_droit` | 542 500 | 0,6801 | 0,6801 | 10,05 |
| `barre_haut` | 249 600 | 0,5612 | **0,5733** | 16,01 |
| `barre_bas` | 172 800 | 0,5537 | **0,5967** | 9,90 |
| `ergot_onglet` | 26 660 | 0,4971 | 0,4978 | 8,41 |

Trois corrections expliquent l'écart, chacune sourcée :

1. **L'emprise du modèle 3D.** Elle était estimée (730 × 907 px) ; elle est maintenant *mesurée*.
   Deux captures du même écran — l'une avant que l'avatar soit chargé, l'autre après —
   différenciées puis seuillées donnent sa boîte englobante : **215 × 609 px à (533, 381)**, stable
   du seuil 25 % au seuil 35 %. L'ancienne boîte faisait cadrer `model-viewer` sur toute la
   hauteur, d'où une tête démesurée au milieu de la scène. À elle seule cette correction vaut
   +0,11 de SSIM sur la moitié de l'image.
2. **Les deux boutons du bandeau du bas**, remplacés par ceux que le layout désigne (§1), et
   l'échelle du bloc de commandes portée au facteur relevé sur la capture : le jeu l'étale sur
   975 px (x 380 → 1355) contre 625 px ici, soit ×1,56 — d'où `1,15vw → 1,8vw`.
3. **La tuile de l'onglet actif** : `icon_base01` de `mainmenu90_02_2`, un parallélogramme bleu de
   352 × 264 dont seuls ~64 % de la hauteur sont opaques. Sans elle, l'onglet actif ne se
   distinguait que par son icône pleine.

### Ce qui a été essayé puis retiré

Recaler la languette du libellé d'onglet sur l'emprise relevée à l'œil (22 % × 5,7 % au lieu de
26 % × 4,2 %) **dégrade** la région : `ergot_onglet` passe de 0,4971 à 0,4860. Le sprite
`edit_type_base01` n'a pas les mêmes marges transparentes que la forme visible du jeu ; recaler la
boîte sans recaler le sprite déplace l'erreur au lieu de la réduire. Le changement a été annulé et
la raison écrite dans le code, pour qu'on ne le retente pas.

---

## 4. Ce qui reste faux, et pourquoi

> Aucun de ces points n'est une approximation qu'on pourrait « améliorer un peu » : ce sont des
> chaînes dont il manque un maillon **établi**. Les combler en devinant produirait une page qui a
> l'air plus juste tout en affirmant une donnée de jeu inventée.

**Le modèle 3D n'a pas de corps.** La page assemble le visage de la morphologie courante
(`_facebase/…`) et les parts choisies. Le corps vit dans `_base/` (11 fichiers :
`base_normal_00…03`, `base_small_00`, `base_big_00`, `base_bigman_00/01`, `base_bigwoman_00`,
`base_elderlyman_00`, `base_elderlywoman_00`) et se distingue nettement du visage — 97 os
référencés contre 44. Mais **rien ne relie les 8 morphologies du catalogue** (`male`, `female`,
`small`, `smallfat`, `tall`, `tallmuscle`, `muscle`, `big`) **à ces 11 fichiers** : aucune
catégorie du catalogue ne référence `_base/`, et le CRC-32 de `base_normal_00` (`4C0FC910`)
n'apparaît nulle part dans `data/common/gamedata/`. Relever le corps *actif* dans la mémoire du
jeu ne tranche pas non plus : les onze noms y sont chargés ensemble.

**Le modèle 3D n'a pas de textures.** Le GLB rendu par `/model-avatar/` contient 0 image et
0 texture, un seul matériau `Default`. Ce n'est pas un oubli d'assemblage : les matériaux des
pièces (`hairF_10`, `base_eye_10`, `parts_mouth_10`, `eye_10_normal_00`…) **n'ont aucun `.g4tx`
correspondant dans le VFS**, et la recherche de `customTex` n'y rend rien. La texture d'un avatar
est composée à l'exécution à partir des couleurs choisies — c'est cohérent avec un éditeur dont la
teinte de peau, d'yeux et de cheveux est paramétrique. Poser une texture ici serait en inventer une.

**Le panneau de droite n'a pas bougé** (0,6801) : il n'a pas encore été travaillé. C'est la
prochaine cible chiffrée, avec `barre_haut` (0,5733).

**Deux dimensions de liste sont désormais connues** — relevées dans la mémoire du jeu vivant par
`niers mem lua-field listRowNum --numeric -r 6`, et recoupées par la capture de l'écran :

| Écran | `listNum` | `listRowNum` | `listLineNum` | `pageNum` |
| --- | ---: | ---: | ---: | ---: |
| `chara_edit_parts_menu` | 9 | 3 | 3 | 2 |
| `chara_edit_menu` | 40 | 2 | 6 | 4 |

`listRowNum` est le nombre d'éléments par rangée, `listLineNum` le nombre de rangées visibles. La
grille 3 × 3 de *Face Presets* (vignettes `01`…`09`) confirme la première ligne ; pour la seconde,
40 éléments à 2 × 6 par page donnent bien 4 pages.

---

## 5. Rejouer

```bash
# la page
curl -s -o /dev/null -w '%{http_code}\n' https://azalee.rosegriffon.fr/avatar     # 200

# le catalogue qui l'alimente
curl -s -o /dev/null -w '%{http_code} %{size_download}o\n' \
  https://cdn.rosegriffon.fr/avatar/catalog.json                                  # 200, ~856 Ko

# la mesure (nécessite les captures de référence, hors dépôt)
niers img diff /tmp/az.png var/refs-avatar/live/chara_edit_style_01.png --roi roi.json

# produire une nouvelle référence : lancer le vrai jeu
niers/scripts/nie-wine-setup.sh
niers/scripts/nie-wine-run.sh explorer /desktop=nie,1920x1080 ./nie_eacpatched.exe
```

Le détail du reverse de `chara_edit` (hachages, catalogue, rendu, relevés mémoire) vit dans
`niers/docs/AVATAR.md`.
