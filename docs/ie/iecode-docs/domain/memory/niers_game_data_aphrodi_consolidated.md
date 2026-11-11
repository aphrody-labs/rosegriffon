# Nie CLI & Game Data Consolidation — Aphrodi, Zeus Team, God Knows & Level-5 VFS

> **Document de Mémoire Souverain** — Aphrody Workspace Memory Engine
> **Date de Consolidation :** 2026-09-09
> **Sources Primaires :** Nie CLI (`niers`), Inagle Engine (`rg/packages/inagle`), Level-5 Nie VFS (`nie-formats`), Ghidra Symbols & Extraction CPK.

---

## 1. Monitoring & Inventaire des Sorties Nie CLI (`/home/ubuntu/niers/` & Local)

L'architecture Nie CLI produit et maintient des artefacts dérivés et des manifestes dans `data/` et `var/`.

### 1.1. Artefacts et Métriques dans `var/`

- **`var/couverture-site.json`** :
  - Version moteur : `0.5.9` (généré `2026-09-07T02:37:56Z`).
  - Routes montées : **84 routes** API & VFS actives.
  - Couverture fonctionnelle : **578 capacités totales**, **0 manquant** (`manquant = 0`), **282 servies**, **295 internes**, **1 bloqué**.
  - Poids d'analyse couvert : 255 843 points de validation.
- **`var/README.md` (Inventaire des artefacts générés)** :
  - `niers.sqlite` (~237 Mo) : Base relationnelle et FTS5 dérivée de `niers seed` + `niers rebuild`.
  - `model-crc-manifest.ndjson` (~3,5 Mo) : Dérivé par `niers uniform-map --models` sur les CPK.
  - `uniform-model-map.ndjson` (~655 Ko) : Correspondance unifiée Inagle et modèles 3D.
  - `g4tx-manifest.ndjson` & `xval.ndjson` (~166 Ko) : Validation croisée du décodeur de textures DX11.
  - `model-cache/` : Cache de modèles 3D servis à la volée par `nie-model-serve`.
  - `zukan/` (~272 Mo) : Répertoire encyclopédique de scraping Inazuma Eleven VR.

### 1.2. Manifestes et Données de Jeu dans `data/`

- **`data/azalee/`** :
  - `skills-cutin.json` (1,88 Mo) & `skills-cutin-served.json` (1,89 Ko) : Indexation complète des cut-ins et télops des techniques spéciales.
  - `passives-full.json` (2,16 Mo) : Index exhaustif des talents passifs et multiplicateurs de build.
  - `character-model-manifest.json` (72,5 Ko) & `character-face-manifest.json` (68,1 Ko) : Cartographie des identifiants personnages vers les maillages 3D.
  - `cpk-index.ndjson.gz` (911 Ko) & `icon-texture-index.ndjson.gz` (18,6 Ko) : Décompression et indexation des 254 000 entrées VFS.
  - `game-text-dialogue.ndjson.gz` (2,12 Mo) & `game-text-names.ndjson.gz` (3,47 Mo) : Localisation FR/JA/EN extraite des `cfg.bin`.
- **`data/menu/`** :
  - 41 captures d'écran et inventaires d'interfaces utilisateur (`manifest.json`, `screen-inventory.json`, `lua-inventory.json`).
- **`data/oc/`** :
  - `catalog.json` & `astro-lor/` : Enregistrement des personnages originaux et variantes communautaires.

---

## 2. Fiche Technique — Aphrodi (Byron Love / 亜風炉 照美)

Capitaine divin du Collège Zeus, ailier de feu et milieu de terrain de classe mondiale.

### 2.1. Identifiants & Définition Système

- **Nom International :** Byron Love (EN/FR)
- **Nom Japonais :** 亜風炉 照美 (あふろ てるみ) — アフロディ (Aphrodi)
- **CharaID Racine :** `0x37D7ACFB`
- **Code Modèle 3D Interne (VFS) :** `c01001010` (visage / tête / chevelure `_hairF`)
- **Élément Primaire :** Bois / Forêt (Forest / 木)
- **Position d'origine :** Milieu de Terrain (MF) / Attaquant (FW)

### 2.2. Variantes & Paliers de Rareté

| Variante / Rareté         | CharaParamId | Position | Kick (Lv99) | Ctrl (Lv99) | Tech (Lv99) | Phy (Lv99) | Press (Lv99) | Agi (Lv99) | Int (Lv99) | Équipe(s)             |
| ------------------------- | ------------ | -------- | ----------- | ----------- | ----------- | ---------- | ------------ | ---------- | ---------- | --------------------- |
| **Aphrodi Normal MF**     | `0x9E23A289` | MF       | 160         | 174         | 169         | 140        | 141          | 129        | 155        | Zeus (IE1, ARES)      |
| **Aphrodi Normal FW**     | `0xC68B09DE` | FW       | 177         | 173         | 156         | 139        | 135          | 130        | 155        | Zeus (IE1, ARES)      |
| **Aphrodi Normal (Alt)**  | `0x339905CF` | MF       | 160         | 174         | 169         | 140        | 141          | 129        | 155        | Zeus (IE1, ARES)      |
| **Aphrodi Kirkwood**      | `0x55A3AF6E` | MF       | 160         | 174         | 169         | 140        | 141          | 129        | 155        | Kirkwood (木戸川清修) |
| **Aphrodi Zeus Ares**     | `0x63F5B1D9` | MF       | 160         | 174         | 169         | 140        | 141          | 129        | 155        | Zeus (ARES)           |
| **Aphrodi Héros (Divin)** | `0x209B996D` | MF       | 238         | 258         | 250         | 210        | 211          | 195        | 230        | Zeus                  |
| **Aphrodi Héros (Alt)**   | `0x09532D9F` | MF       | 238         | 258         | 250         | 210        | 211          | 195        | 230        | Zeus                  |
| **Aphrodi BASARA**        | `0x12B74634` | MF       | **238**     | **258**     | **250**     | **210**    | **211**      | **195**    | **230**    | Zeus                  |
| **Thaddeus Archon**       | `0xD5ACAA9D` | FW       | 190         | 179         | 164         | 132        | 129          | 129        | 143        | Solaria-Zeus (V)      |

_Progression des statistiques (Normal MF) :_

- **Niveau 1 :** Kick 11 | Control 12 | Technique 12 | Physical 10 | Pressure 11 | Agility 9 | Intelligence 12
- **Niveau 50 :** Kick 100 | Control 109 | Technique 105 | Physical 87 | Pressure 88 | Agility 81 | Intelligence 97
- **Niveau 99 :** Kick 160 | Control 174 | Technique 169 | Physical 140 | Pressure 141 | Agility 129 | Intelligence 155

### 2.3. Set de Compétences Apprises (Learnset Canon)

1. **Niveau 1 — Dust Kick (Frappe poussiéreuse / ホッピングトリック) :** ID `0x62294D90` (Dribble, Conso 40 TP, Puissance 30-200)
2. **Niveau 13 — God Knows (Savoir suprême / ゴッドノウズ) :** ID `0x1C8CE2B8` (Tir signature, Conso 70 TP, Puissance 70-440)
3. **Niveau 20 — Heaven's Time (Instant céleste / ヘブンズタイム) :** ID `0x0D368F6B` (Dribble temporel divin, Conso 80 TP, Puissance 85-540)
4. **Niveau 30 — God Break (Tir solaire / ゴッドブレイク) :** ID `0x7577A26A` (Tir transcendant, Conso 80 TP, Puissance 85-540)

---

## 3. Roster Complet — Collège Zeus (世宇子中 / Zeus Team)

L'effectif mythologique complet extrait de la base Inagle/Niers (34 entrées de joueurs répertoriées).

### 3.1. Les 11 Titulaires Divins (Formation 4-3-3 Canon Football Frontier)

| Numéro / Rôle  | Nom FR / International  | Nom Japonais / Surnom    | ID Paramètre | CharaID      | Élément  | Stat Lv99 (Kick/Ctrl/Tech/Phy/Press/Agi/Int) |
| -------------- | ----------------------- | ------------------------ | ------------ | ------------ | -------- | -------------------------------------------- |
| **#1 - GK**    | Paul Siddon Poséidon    | 歩星 呑一 (ポセイドン)   | `0x86FAF9FF` | `0x2F0EF78D` | Montagne | 133 / 146 / 137 / 157 / 164 / 166 / 150      |
| **#2 - DF**    | Apollo Light Apollon    | 阿保露 光 (アポロン)     | `0xADD7AA3C` | `0x0423A44E` | Forêt    | 131 / 136 / 132 / 164 / 170 / 140 / 190      |
| **#3 - DF**    | Jeff Iron Héphaïstos    | 部灰 炎 (ヘパイス)       | `0xB4CC9B7D` | `0x1D38950F` | Feu      | 131 / 136 / 132 / 164 / 170 / 140 / 190      |
| **#4 - DF**    | Lane War Arès           | 荒須 乱 (アレス)         | `0xFB8D0DBA` | `0x527903C8` | Montagne | 131 / 136 / 132 / 164 / 170 / 140 / 190      |
| **#5 - DF**    | Danny Wood Dionysos     | 手魚 激 (ディオ)         | `0xE2963CFB` | `0x4B623289` | Vent     | 131 / 136 / 132 / 164 / 170 / 140 / 190      |
| **#6 - MF**    | Artie Mishman Artémis   | 在手 実弓 (アルテミス)   | `0xC9BB6F38` | `0x604F614A` | Vent     | 155 / 179 / 181 / 132 / 130 / 130 / 160      |
| **#7 - MF**    | Arion Matlock Hermès    | 経目 須商 (ヘルメス)     | `0xD0A05E79` | `0x7954500B` | Forêt    | 155 / 179 / 181 / 132 / 130 / 130 / 160      |
| **#8 - MF**    | Wesley Knox Athéna      | 明天名 智 (アテナ)       | `0x573842B6` | `0xFECC4CC4` | Forêt    | 155 / 179 / 181 / 132 / 130 / 130 / 160      |
| **#9 - FW**    | Jonas Demetrius Déméter | 出右手 豊 (デメテル)     | `0x4E2373F7` | `0xE7D77D85` | Feu      | 177 / 173 / 156 / 139 / 135 / 130 / 155      |
| **#10 - MF/C** | Byron Love Aphrody      | 亜風炉 照美 (アフロディ) | `0x9E23A289` | `0x37D7ACFB` | Forêt    | 160 / 174 / 169 / 140 / 141 / 129 / 155      |
| **#11 - FW**   | Henry House Héra        | 平良 貞 (ヘラ)           | `0x873893C8` | `0x2ECC9DBA` | Feu      | 177 / 173 / 156 / 139 / 135 / 130 / 155      |

### 3.2. Remplaçants et Panthéon Complémentaire

- **#12 - GK :** Iggy Russ Icare (位家 路主 / イカロス) — `0xAC15C00B`, Élément Vent (Rareté Expérimenté)
- **#13 - FW :** Gus Heeley Achille (安芸 玲須 / アキレス) — `0xB50EF14A`, Élément Montagne (Rareté Expérimenté)
- **#14 - DF :** Harry Closs Héraclès (経洛 玲州 / ヘラクレス) — `0xFA4F678D`, Élément Feu
- **#15 - DF :** Andy Chronic Chronos (黒野 時夫 / クロノス) — `0xE35456CC`, Élément Forêt
- **#16 - MF :** Ned Yousef Méduse (目戸 宇左 / メドゥーサ) — `0xC879050F`, Élément Montagne
- **Gardiens additionnels :** Ross DJ (`0x48D8E21A`), Alexander Scrivener (`0x95A22E1E`), Susanoo (`0xE79AC81F`), Tartarus (`0x2E812820`), Chaos (`0xE09360C3`).
- **Défenseurs additionnels :** Oyamatsumi (`0x83F60D1B`), Pan (`0xFF439369`), Paieon (`0x379A1961`), Eros (`0xA91934EF`), Tajikarao (`0xFE81F95E`), Hemera (`0xF9885182`).
- **Milieux additionnels :** Harmonia (`0xCCB79BDC`), Uzume (`0x9B2F566D`), Atlas (`0xD46EC0AA`), Zelus (`0xB1C06F99`), Hecate (`0x9AED3C5A`), Izanami (`0x8234672C`).
- **Attaquants additionnels :** Izanagi (`0xCD75F1EB`), Takemikazuchi (`0xB00205AE`), Perseus (`0x6237DBEE`), Staples (`0x8CB91F5F`).

---

## 4. Hissatsu Divines — God Knows, Heaven's Time & God Break

Spécifications techniques exactes des super-techniques issues du moteur de combat Nie.

### 4.1. God Knows (Savoir suprême / ゴッドノウズ)

- **ID Binaire :** `0x1C8CE2B8`
- **Code Interne :** `whs00340`
- **Élément :** Vent (Wind / 風 - ID `1`)
- **Catégorie :** Tir (Shoot / シュート - ID `1`)
- **Consommation TP :** 70 TP
- **Puissance :** `70 - 440` (min: 70, max: 440)
- **Temps de Recharge (Recast) :** 90 secondes
- **Taux de Faute :** 0%
- **Type de Croissance :** Type 3 — Grade G (`G2 / G3 / G4 / G5`)
- **Partenaires :** Aucun (Technique Solo)
- **Description FR :** _"Même les lois de l'univers sombrent dans l'oubli. Une telle puissance ne peut être que l'œuvre du divin."_
- **Description JA :** _"宇宙の法則すらも忘却の彼方に消失させる。その圧倒的なパワーは まさに神の所業か。"_
- **Chemin Asset VFS (Télop de Cut-in) :** `220_img/telop_waza/fr/whs00340_0.webp`

### 4.2. God Alone Knows (Savoir ultime / ゴッドノウズ・インパクト)

- **ID Binaire :** `0xDF7E6AE1`
- **Code Interne :** `whs02900`
- **Élément :** Vent (Wind / 風 - ID `1`)
- **Catégorie :** Tir (Shoot / シュート - ID `1`)
- **Consommation TP :** 100 TP
- **Puissance :** `100 - 640` (min: 100, max: 640)
- **Temps de Recharge (Recast) :** 90 secondes
- **Taux de Faute :** 0%
- **Type de Croissance :** Type 6
- **Partenaires :** Aucun (Technique Solo)
- **Description FR :** _"Invoquez la beauté et le tonnerre du ciel pour faire trembler la terre et marquer l'aube d'un nouveau mythe."_
- **Description JA :** _"天の美しさと雷の激しさに 大地が震撼。このゴールが 新たな神話の始まりを告げる。"_
- **Chemin Asset VFS (Télop de Cut-in) :** `220_img/telop_waza/fr/whs02900_0.webp`

### 4.3. Heaven's Time (Instant céleste / ヘブンズタイム)

- **ID Binaire :** `0x0D368F6B`
- **Code Interne :** `whs00350`
- **Élément :** Vent (Wind / 風)
- **Catégorie :** Dribble (Dribble / ドリブル)
- **Consommation TP :** 80 TP
- **Puissance :** `85 - 540`
- **Effet Secondaire :** Fige le temps dans l'aire de jeu, contourne immédiatement les duels défensifs avec projection cinématique.
- **Chemin Asset VFS (Télop de Cut-in) :** `220_img/telop_waza/fr/whs00350_0.webp`

### 4.4. God Break (Tir solaire / ゴッドブレイク)

- **ID Binaire :** `0x7577A26A`
- **Élément :** Vent (Wind / 風)
- **Catégorie :** Tir (Shoot / シュート)
- **Consommation TP :** 80 TP
- **Puissance :** `85 - 540`
- **Effet :** Évolution céleste où les ailes divines concentrent l'énergie solaire avant une frappe supersonique descendante.

---

## 5. Cartographie & Architecture VFS (Level-5 Nie VFS)

Le système de fichiers virtuel (`nie-formats::vfs::Vfs`) reproduit exactement l'architecture d'accès bas niveau du binaire `nie.exe`.

### 5.1. Résolution des Montages

Le VFS unifie deux sources physiques transparentes :

1. **Montage Packs (`Vfs::init`) :**
   - Charge le fichier d'index maître chiffré `data/cpk_list.cfg.bin`.
   - Déchiffrement à double variante :
     - **AES-256-CBC** (builds Steam récents, clé extraite par reverse engineering).
     - **Clé fixe Viola** (`decrypt_block(..., VIOLA_FIXED_KEY)` pour dumps legacy).
     - Chaque déchiffrement est validé par l'analyseur structurel durci `cfgbin_parse`.
   - Indexe plus de **254 000 entrées de fichiers** réparties dans les archives `packs/*.cpk`.
2. **Montage Dump / Loose (`Vfs::init_loose`) :**
   - Bascule automatique si `cpk_list.cfg.bin` est absent mais qu'un répertoire `data/common/` ou `data/dx11/` existe sur le disque.
   - Les chemins logiques internes correspondent exactement aux chemins réels du système de fichiers.

### 5.2. Formats et Conteneurs Spécifiques Level-5

- **`.g4md` (Level-5 3D Model Data) :**
  - Contient les maillages géométriques (vertices, UVs, tangentes, skinning 4-weights).
  - Hiérarchie d'os (skeleton / bone armatures) et volumes d'englobement (AABB/OBB).
- **`.g4mg` (Level-5 Material & Geometry Config) :**
  - Spécifications de rendu DirectX 11, liaisons de shaders et maps de textures PBR (albedo, normal, metallic, roughness, ambient occlusion).
- **`.g4pkm` (Level-5 Package Motion) :**
  - Paquets de pistes d'animation squelettiques (keyframes quaternions, courbes Bézier des mouvements de course, frappes et célébrations).
- **`.cfg.bin` (Level-5 Binary Configuration) :**
  - Formats RDBN (bases de données relationnelles tabulaires) et T2B (arborescences typées avec chaînes internées).

### 5.3. Chemins d'Assets Résolus dans le VFS pour Aphrodi & Zeus

- **Visage & Modèle Joueur :**
  - `200_icon/10_icon_chr/face/0x37D7ACFB_l_0x37D7ACFB_1_l00.webp`
  - `data/dx11/_chr/c01001010.g4md` (corps et maillot du Collège Zeus)
  - `data/dx11/_hairF/hairF_c01001010.g4md` (chevelure dorée caractéristique d'Aphrodi)
- **Télops & Effets de Super-Techniques :**
  - `220_img/telop_waza/fr/whs00340_0.webp` (God Knows)
  - `220_img/telop_waza/fr/whs02900_0.webp` (God Alone Knows)
  - `220_img/telop_waza/fr/whs00350_0.webp` (Heaven's Time)
- **Tables de Données Canoniques :**
  - `data/common/gamedata/character/chara_param.cfg.bin` (paramètres des 5 991 personnages)
  - `data/common/gamedata/skill/skill_param.cfg.bin` (paramètres des techniques)
  - `data/common/gamedata/team/team_param.cfg.bin` (composition des équipes)

### 5.4. Cache Mémoire LRU (`CpkCache`)

- Budget mémoire par défaut : **16 Gio** (`NIE_CPK_CACHE_BUDGET_GIB`).
- Éviction LRU automatique conservant les CPK chauds en RAM pour garantir des temps d'accès sub-milliseconde lors des simulations de match et des requêtes RAG.
