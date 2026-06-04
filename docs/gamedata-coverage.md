# Couverture des données de jeu IEVR — matrice maître (objectif `/goal`)

> Objectif : **indexer, mapper, typer, analyser, extraire et peupler en DB proprement** TOUTE la donnée du jeu
> (items, teams, uniformes, passifs, skills, auras, emblèmes, telop/video waza, textures & modèles chr,
> drop-rates par élément, shops, tous les cfg.bin, tous les lua, tout le code C).
> Ancré au réel : `/home/ubuntu/data/common/gamedata/**` (sources), `packages/inagle/src/parsers/**` (66 parseurs),
> `packages/inagle/src/cli-push.ts` (push Supabase), tables `inagle_*` Supabase. **Aucune valeur inventée.**

## Sources réelles

- **19 371** `*.cfg.bin.json` sous `/home/ubuntu/data` (dont ~16k `ev*`/`Subtitle_ev*` = scripts d'événements/cutscenes).
- **common/gamedata/** organisé par catégorie : `item shop capsule formation party command soccer skill skill_view
  character chara_bank uniform craft boost_grp quest mission dungeon movie motion live2d banner gallery formation …`
- **677** scripts Lua (`/home/ubuntu/data/lua_scripts/{decompiled,analysis}`, classés `p0-critical/p1-gameplay/p2-other`).
- **Code C** : `nie.exe` reversé par **niers** (52 783 fonctions réelles, 92,43 % classifiées — repo séparé `/home/ubuntu/niers`).
- **Assets binaires** (textures/modèles) : g4tx/g4mg/g4md/g4sk dans les CPK — traités côté **iecode** (embed g4tx→GLB fait).

## Matrice de couverture (catégorie → source → parseur inagle → table DB → statut)

| Catégorie | Config source | Parseur inagle | Table `inagle_*` | Statut |
|---|---|---|---|---|
| Personnages | `chara_param`, `chara_base`, … | chara-param, chara-base… | `inagle_characters` | **FAIT** |
| Skills (techniques) | `skill_config` | skill-config, real-skill-config | `inagle_skills` | **FAIT** |
| Auras | `aura_skill_config` | change-aura-skill-config | `inagle_auras` | **FAIT** |
| Passifs | `passive_skill_config(+effect)` | passive-skill-(effect-)config | `inagle_passives` | **FAIT** |
| Items | `item_config` | item-config | `inagle_items` | **FAIT** |
| Formations | `rpg_battle_formation_config` | formation-config | `inagle_formations` | **FAIT** |
| Teams | `team_*` | belong-team, opponent-team | `inagle_teams`,`inagle_opponent_teams` | **FAIT** |
| Capsules (gacha) | `capsule_config` | capsule-config | `inagle_capsules` | **FAIT** |
| Drops | `soccer_drop_config`, treasure | drops-parser | `inagle_drops_battles/tables/treasures` | **FAIT** |
| EXP / Growth | `chara_exp_table`, growth | chara-exp-table, growth-table | `inagle_exp_table`,`inagle_growth_tables` | **FAIT** |
| Keshin/Soul/Miximax/Awakening | divers | playstyle, star-sign… | `inagle_keshins/souls/miximax/awakenings` | **FAIT** |
| Costumes / Gallery / Quests / Mode-changes | divers | chara-costume, gallery, quest… | `inagle_costumes/gallery/quests/mode_changes` | **FAIT** |
| **Uniformes** | `uniform_config` | **uniform-config (existe)** | — | **GAP : pousser** |
| **Shops** | `shop_config` | **shop-config (existe)** | — | **GAP : pousser** |
| **Tricks** | `trick_config` | **trick-config (existe)** | — | **GAP : pousser** |
| **Tactiques spéciales** | `special_tactics_*` | **special-tactics-config (existe)** | — | **GAP : pousser** |
| **Super-tactiques** | `super_tactics_*` | **super-tactics-base-config (existe)** | — | **GAP : pousser** |
| **Team-build** | `team_build_config` | **team-build-config (existe)** | — | **GAP : pousser** |
| **Skill-technic** | `skill_technic_config` | **skill-technic-config (existe)** | — | **GAP : pousser** |
| **Stadiums** | `stadium_*` | **stadium-config (existe)** | — | **GAP : pousser** |
| **Nameplates** | `user_name_plate_config` | **nameplate-config (existe)** | — | **GAP : pousser** |
| **Boost groups** | `boost_grp` | **boost-player-group-config (existe)** | — | **GAP : pousser** |
| **Constellations / Star-signs / Trophées / Missions** | divers | constellation, star-sign, trophy, mission (existent) | — | **GAP : pousser** |
| **Emblèmes de teams** | (à localiser) | — | — | **GAP : parser + table** |
| **Telop waza** | `skill_telop_info_config` | — | — | **GAP : parser + table** |
| **Video waza** | `event_movie_config` | — | — | **GAP : parser + table** |
| Textures chr (g4tx) | CPK assets | — (iecode C#) | — (assets, pas DB) | iecode (embed GLB FAIT) |
| Modèles chr (g4mg/g4md/g4sk) | CPK assets | — (iecode/niers) | — (assets) | iecode/niers partiel |
| Drop-rates par élément | `soccer_drop_config`, `item_emission_rarity_table`, `win_treasure_lot_table` | drops-parser (partiel) | `inagle_drops_*` | **À VÉRIFIER (par élément)** |
| Lua (677) | `lua_scripts/**` | analyse p0/p1/p2 | — | **GAP : indexer/typer** |
| Code C (nie.exe) | RE niers | niers (pdata/disasm/propagate) | sqlite niers | **FAIT 92,43 %** |

## Constat

L'essentiel du socle est **FAIT** (22 tables `inagle_*` peuplées). Le gros du `/goal` = **fermer l'écart parseur→DB** :
**~14 parseurs existent déjà** mais ne sont **pas poussés** en table `inagle_*`, et **3 catégories** (emblèmes, telop waza,
video waza) demandent un **nouveau parseur**. Plus : vérifier les drop-rates **par élément**, indexer/typer les **677 Lua**.

## Plan (phases, exécutées en workflows vérifiés contre le réel)

1. **Push DB des parseurs existants** (P0) : pour chaque GAP « pousser » — concevoir la table Supabase (migration),
   câbler `cli-push.ts`, exécuter le push, **vérifier le `COUNT(*)`** réel. Catégories : uniformes, shops, tricks,
   special/super-tactiques, team-build, skill-technic, stadiums, nameplates, boost-groups, constellations,
   star-signs, trophées, missions.
2. **Nouveaux parseurs** (P0) : emblèmes (localiser le config), telop waza (`skill_telop_info_config`),
   video waza (`event_movie_config`) → parseur + type + table + push + vérif.
3. **Drop-rates par élément** (P1) : confirmer/compléter `drops-parser` pour ventiler par élément
   (`item_emission_rarity_table`, `win_treasure_lot_table`).
4. **Lua** (P1) : indexer + typer les 677 scripts (table `inagle_lua_scripts` : nom, version, catégorie p0/p1/p2,
   symboles/fonctions, hash).
5. **Assets chr** (P2) : textures/modèles g4tx/g4mg via iecode → index/manifest exploitable.
6. **Code C** : niers continue (déjà 92,43 %).

> Chaque livrable est classé **FAIT / INCOMPLET / NON_FAIT** et vérifié contre la donnée réelle (parseur exécuté,
> `COUNT(*)` Supabase, octets du config). Voir aussi `docs/iecode-inagle-supabase.md` (audit consolidé).

## Batches (découpage exécutable en workflows dynamiques)

| Batch | Contenu | Domaine (évite conflits) | Statut |
|---|---|---|---|
| **B1** | Catégories nommées : uniformes, shops, tricks, tactiques spéciales, telop waza, video waza, emblèmes → table + parseur + push + COUNT + câblage | `rg/packages/inagle` + Supabase | **EN COURS** (`wjxs0t2vo`) |
| **B2** | Reste parseur→DB : super-tactiques, skill-technic, team-build, stadiums, nameplates, boost-groups, constellations, star-signs, trophées, missions | `rg/packages/inagle` + Supabase | À FAIRE |
| **B3** | Drop-rates **par élément** : `soccer_drop_config` + `item_emission_rarity_table` + `win_treasure_lot_table` ventilés par élément → `inagle_drop_rates` | `rg/packages/inagle` + Supabase | À FAIRE |
| **B4** | **Lua** : indexer/typer les 677 scripts (`inagle_lua_scripts` : nom, version, catégorie p0/p1/p2, fonctions/symboles, hash) + analyse statique | `rg` (module lua dédié) + Supabase | À FAIRE |
| **B5** | **Assets chr** : déchiffrer CPK (clé `0x1717E18E`) → extraire/indexer textures g4tx + modèles g4mg/g4md/g4sk → manifest/DB | `iecode` (C#) + `niers` (nie-formats) | À FAIRE |
| **B6** | Événements : `ev*`/`Subtitle_ev*` (~16k) → index/typage des scripts d'event (dialogues, video waza in-game) | `rg` + Supabase | À FAIRE |
| **B7** | Code C : niers continue (nie-wasm, câblage runtime sim, levier feuilles) | `niers` | EN COURS (axe séparé) |

## Moteur de workflows dynamiques (cadence autonome)

Le `/goal` (Stop hook) maintient la session active. Cadence : **lancer un MAX de workflows dynamiques en parallèle sur
des domaines DISJOINTS** (`rg/packages/inagle`+Supabase ⟂ `niers` ⟂ `iecode` C#) pour éviter les conflits de fichiers
(`cli-push.ts` est mono-fichier → un seul workflow le câble à la fois ; les migrations Supabase sont idempotentes
`IF NOT EXISTS`). Boucle par batch : **dispatch workflow → vérifier les `COUNT(*)`/builds RÉELS soi-même (ne pas croire
l'agent) → committer le vérifié → marquer le batch FAIT ici → enchaîner**. Anti-hallucination systématique : toute
valeur/colonne adossée au vrai config/octet ; sinon NON_FAIT motivé. Plan tenu à jour dans CE fichier + mémoire
`project-gamedata-extraction-goal`.
