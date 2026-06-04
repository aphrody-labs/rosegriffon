# Couverture des données de jeu IEVR — matrice maître (objectif `/goal`)

> Objectif : **indexer, mapper, typer, analyser, extraire et peupler en DB proprement** TOUTE la donnée du jeu
> (items, teams, uniformes, passifs, skills, auras, emblèmes, telop/video waza, textures & modèles chr,
> drop-rates par élément, shops, tous les cfg.bin, tous les lua, tout le code C).
> Ancré au réel : `/home/ubuntu/niers/data/common/gamedata/**` (sources), `packages/inagle/src/parsers/**` (66 parseurs),
> `packages/inagle/src/cli-push.ts` (push Supabase), tables `inagle_*` Supabase. **Aucune valeur inventée.**

## Sources réelles

- **19 371** `*.cfg.bin.json` sous `/home/ubuntu/niers/data` (dont ~16k `ev*`/`Subtitle_ev*` = scripts d'événements/cutscenes).
- **common/gamedata/** organisé par catégorie : `item shop capsule formation party command soccer skill skill_view
  character chara_bank uniform craft boost_grp quest mission dungeon movie motion live2d banner gallery formation …`
- **677** scripts Lua (`/home/ubuntu/niers/data/lua_scripts/{decompiled,analysis}`, classés `p0-critical/p1-gameplay/p2-other`).
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
| **Uniformes** | `uniform_config` | uniform-config | `inagle_uniforms` (384) | **FAIT** |
| **Shops** | `shop_config` | shop-config | `inagle_shops` (2331) | **FAIT** |
| **Tricks** | `trick_config` | trick-config | `inagle_tricks` (9) | **FAIT** |
| **Tactiques spéciales** | `special_tactics_*` | special-tactics-config | `inagle_special_tactics` (85) | **FAIT** |
| **Telop waza** | `skill_telop_info_config` | **telop-waza (nouveau)** | `inagle_telop_waza` (926) | **FAIT** |
| **Video waza** | `event_movie_config` | **video-waza (nouveau)** | `inagle_video_waza` (4) | **FAIT** |
| **Emblèmes** | `emblem_resource` | **emblems (nouveau)** | `inagle_emblems` (2) | **FAIT** |
| **Stadiums** | `stadium_*` | stadium-config | `inagle_stadiums` (81) | **FAIT** |
| **Nameplates** | `user_name_plate_config` | nameplate-config | `inagle_nameplates` (54) | **FAIT** |
| **Super-tactiques** | `super_tactics_config` | super-tactics-base-config | `inagle_super_tactics` (23) | **FAIT** |
| **Team-build** | `team_build_config` | team-build-config | `inagle_team_build` (86) | **FAIT** |
| **Skill-technic** | `skill_technic_config` | skill-technic-config | `inagle_skill_technic` (14) | **FAIT** |
| **Boost groups** | `boost_player_group_config` | boost-player-group-config | `inagle_boost_groups` (5) | **FAIT** |
| **Constellations** | `players_universe_config` | constellation | `inagle_constellations` (30) | **FAIT** |
| **Star-signs** (pool drop/signe) | `players_universe_config`+basara | star-sign | `inagle_star_signs` (5080) | **FAIT** |
| **Trophées** | `trophy_config` | trophy-config | `inagle_trophies` (228) | **FAIT** |
| **Missions** | `mission_config` (1 placeholder réel) | mission-config | `inagle_missions` (1) | **FAIT** (config = placeholder ; vrai contenu = `inagle_quests`) |
| Textures chr (g4tx) | CPK assets | — (iecode C#) | — (assets, pas DB) | iecode (embed GLB FAIT) |
| Modèles chr (g4mg/g4md/g4sk) | CPK assets | — (iecode/niers) | — (assets) | iecode/niers partiel |
| Drop-rates par élément | `soccer_drop_config`, `item_emission_rarity_table`, `win_treasure_lot_table` | drops-parser (partiel) | `inagle_drops_*` | **FAIT** |
| Lua (677) | `lua_scripts/**` | analyse p0/p1/p2 | `inagle_lua_scripts` (666) | **FAIT** |
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
| **B1** | Catégories nommées : uniformes, shops, tricks, tactiques spéciales, telop waza, video waza, emblèmes → table + parseur + push + COUNT + câblage | `rg/packages/inagle` + Supabase | **FAIT** (`8ec292d` ; 384/2331/9/85/926/4/2 vérifiés ; RLS+policy `Public Read` 7/7 ; type-check vert) |
| **B2** | Reste parseur→DB (8 catégories) | `rg/packages/inagle` + Supabase | **FAIT** (`99e3c25` ; 23/14/86/5/30/5080/228/1 vérifiés ; RLS+`Public Read` 8/8 dès création ; type-check vert ; bonus fix parser constellation) |
| **B3** | **Taux de drop** : audit configs drop + existant `inagle_drops_*`, combler le vrai gap | `rg/packages/inagle` + Supabase | **FAIT** (`d54cdf5` ; `inagle_drop_rates` **177** vérifié REST = 10 emission + 54 spirit + 113 treasure ; RLS ; AUCUNE dimension élément-attribut dans les octets → « élément » du /goal = chaque item/objet) |
| **B4** | **Lua** : indexer/typer les ~677 scripts (`inagle_lua_scripts`) + analyse statique | `rg` (`inagle/src/lua/`) + Supabase | **FAIT** (agy `bea3687`/`bc6c9ff` ; `inagle_lua_scripts` **666** vérifié REST ; `parsers/lua.ts` + `PostgresAdapter` + câblé `cli-push`) |
| **B5** | **Assets chr** : extraire/indexer g4tx + g4mg/g4md/g4sk → manifest/DB + index arbre du jeu → Redis | `iecode` (C#) + `niers` (nie-formats) | **EN COURS** (arbre du jeu→Redis FAIT `0ba8a8a` : 250800 fichiers/921 CPK db3 `iev:*` ; **extraction CPK** FAIT `c91faeb` : `CpkReader.extract`+`Vfs.read` ; niers cpk+g4sk `a0e5333` ; reste : décoder g4tx/g4mg→manifest) |
| **B6** | Événements : `ev*`/`Subtitle_ev*` (~16k) → index/typage des scripts d'event (dialogues, video waza in-game) | `rg` + Supabase | **FAIT** (`7e0cb0e` ; 3 familles réelles tracées : `Subtitle_ev*`=timing 5 vars, `text/<lang>/event/ev*`=TEXT_INFO localisé, `ev*_map`=washa 17 vars, jointes par hash Int signé ; `inagle_events`=**4708** + `inagle_event_subtitles`=**2093** vérifiés REST count=exact, dont **1572** lignes texte FR non-null, 521 NULL légitimes lyrics ; RLS+`Public Read` ; type-check vert ; texte stocké brut tags `<MNT:>`/furigana préservés) |
| **B7** | Code C : niers continue (nie-wasm, câblage runtime sim, levier feuilles) | `niers` | EN COURS (axe séparé) |

## Moteur de workflows dynamiques (cadence autonome)

Le `/goal` (Stop hook) maintient la session active. Cadence : **lancer un MAX de workflows dynamiques en parallèle sur
des domaines DISJOINTS** (`rg/packages/inagle`+Supabase ⟂ `niers` ⟂ `iecode` C#) pour éviter les conflits de fichiers
(`cli-push.ts` est mono-fichier → un seul workflow le câble à la fois ; les migrations Supabase sont idempotentes
`IF NOT EXISTS`). Boucle par batch : **dispatch workflow → vérifier les `COUNT(*)`/builds RÉELS soi-même (ne pas croire
l'agent) → committer le vérifié → marquer le batch FAIT ici → enchaîner**. Anti-hallucination systématique : toute
valeur/colonne adossée au vrai config/octet ; sinon NON_FAIT motivé. Plan tenu à jour dans CE fichier + mémoire
`project-gamedata-extraction-goal`.
