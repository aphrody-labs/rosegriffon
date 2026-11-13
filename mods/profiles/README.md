# Modpack profiles

`complete.toml` is a local IEVR (Inazuma Eleven: Victory Road, PC) modpack profile: the Inazuma-Eleven-Fantasy
collection (Shadorossa, VR-Framework 3.15, submodule `../Inazuma-Eleven-Fantasy` at `031de201`) plus our
`../RoseGriffon` club pack. It is configuration only: it lists the enabled mods, the load order, the option values
the profile expects and every intended override. It does not copy any mod. The collection has no licence, so its
files are never copied, merged or edited from here.

Check it:

```bash
bun tools/ie/modpack-check.ts                      # mods/profiles/complete.toml by default
bun tools/ie/modpack-check.ts mods/profiles/complete.toml --json
```

The checker verifies that every mod exists, that `requires` are met (ids, former ids, versions, `provides` tokens),
that no declared conflicts are both enabled, the `[VRFW.TitleArt] own` owners, VRFW.image/1 sprites and textures
written by several mods (per atlas, sprite and language; files switched off by `when` are skipped), match camera
presets, option ids and menu slots, theme accent values, and text rows. An overlap passes only when the profile
declares it in `[[override]]` with the winner loading later. Result on 2026-11-05: `clean (errors 0, warnings 0,
intended 4, upstream 0)`. The 2,918 image entries of the enabled mods have no overlaps except the two logo sprites
below.

## Contents (43 mods)

- **Framework:** VRFW (pinned first).
- **Content and modes:** InazumaFantasy, HissatsuRevamp, InaRogue, BattleBayDeluxe, CareerMode, ChronicleDeluxe,
  ExtraOpenings, LostCutscenes, MissingVoice, StrikersShots, StrikersTitles, IECross, SynergiesReworked.
- **CharacterReforged** and its 10 modules: AuraOverhaul, BetterEquipment, ClassicCards, ClassicEquipment,
  ClassicRecruitment, ClassicTraining, PersonalPassives, SpiritStaminaPoints, TeamKeshinSummons, TransformationItems.
- **HissatsuReforged** and its 2 modules: HissatsuEffects, HissatsuLevelUp.
- **FootballReforged** and its 11 modules: AIRoles, Challenges, DuelAuras, Friendlies, Furor, GoalkeeperBarrier,
  HomeStadium, LegendaryAI, Pressing, SkillDuel, StoppageTime. LegendaryAI is `default_enabled = false` in its
  module table. The author's own `enabled.toml` turns it on, so this profile does too. Turn it off for vanilla AI.
- **Interface:** BetterUI, BetterQoL.
- **Club pack:** RoseGriffon, last in the order.

The order is the collection's `load_order.toml` (last = highest priority), with these changes: DebugTools and
better_menu removed, the stale id `new_techniques` replaced by HissatsuRevamp (enabled upstream but missing from the
order; its files are written by `new_techniques_build.py`), and RoseGriffon appended. Many modules come before their
parent in the upstream order. The loader loads requirements first anyway, so this order is kept as the author
tested it. The checker lists these cases as info.

## Conflicts and resolutions

| Overlap                                                                                              | Mods                                                       | Resolution                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[VRFW.TitleArt] own = true`                                                                         | InazumaFantasy, RoseGriffon                                | Intended. The flag only switches off VRFW's own title art (`vrfw_title_art.toml`, `vrfw_title_clouds.toml`), and both mods want it off. Which logo shows depends on the sprite order (next row).                                                  |
| Sprite `logo02` of `title00_03_02` (press-start logo) and `title02_01` (mode-menu logo), 9 languages | InazumaFantasy < RoseGriffon                               | RoseGriffon loads last, so the Rose Griffon logo wins. InazumaFantasy keeps its press-start key art (`bg_sky01_st`, star layers, cleared characters) and the ending logo `ed_logo01`, which still shows the Inazuma Fantasy logo.                 |
| Mode-menu wallpaper `bg_title02_02` (`title02_00`)                                                   | RoseGriffon only                                           | No overlap. BetterMenu would hide this background, so it is excluded.                                                                                                                                                                             |
| Whole-match chase camera (`VRFW.match_camera/1`, same camera rows)                                   | BetterQoL `side`, RoseGriffon `broadcast`                  | Only one can be on. The profile sets `BetterQoL.camera = 0` (Original) and `RoseGriffon.broadcast_camera = 1`. StrikersShots `shot` / `chain` are drive presets requested at priority 10 during shots only, so they still take over during shots. |
| Theme engine accent values (one shared `theme_engine.ui_theme` row)                                  | VRFW `dark` 1..3, RoseGriffon `rose_griffon` 1..3          | Real collision, fixed in our own mod: RoseGriffon accents are now 11..13 (`scripts/vrfw_emit.ts` and the generated `content/themes/rose_griffon.toml`). The profile selects 11 (Rose Griffon main).                                               |
| Menu theme recolouring                                                                               | RoseGriffon theme vs the `dark_rules` of 7 collection mods | No conflict. The `dark_rules` files apply only to theme id `dark`, and only one theme accent is active at a time.                                                                                                                                 |
| Kit `u11600010`                                                                                      | RoseGriffon (via `nie mod install`, not VRFW)              | No mod in the collection uses it. `c11600010` (Victorio Cryptix) is a character id, not this kit.                                                                                                                                                 |
| Text                                                                                                 | RoseGriffon `text/keys.toml`                               | No collision possible: VRFW.text_key/1 ids are `crc32("<prefix>.<key>")`. RoseGriffon has no VRFW.text/2 rows.                                                                                                                                    |
| Option ids and slots                                                                                 | `RoseGriffon.broadcast_camera` (game_settings #110)        | Unique id, free slot.                                                                                                                                                                                                                             |

Known gap: RoseGriffon's broadcast preset and option are declared, but the match Lua graft that requests the preset
at kick-off is not written yet (see `../RoseGriffon/README.md`). Until it exists, the profile's camera setting gives
the retail camera. That graft should request its preset at priority 0..9 (5 suggested), below StrikersShots' 10, so
shot views keep working.

## Excluded

| Mod                                    | Reason                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DebugTools                             | Its `config.toml` sets `[flags] all = true`, which forces on every debug switch of every active mod: VRFW reveal_all, all_chains, free_gacha, and InaRogue unlock_all, all_players, tools. These are cheats, not content. |
| better_menu (folder BetterMenu 0.7.32) | Its author calls it a test mod, and it is off in the author's `enabled.toml`. It replaces the main menu with a 3D clubhouse scene, which hides RoseGriffon's mode-menu wallpaper.                                         |

## Community mods worth adding (links only, not evaluated in game)

From the read-only GameBanana API (game 20069, IEVR PC) on 2026-11-05. All of these ship raw `data/` replacements
for the IEVR Mod Manager, not VRFW mods. Several replace `data/cpk_list.cfg.bin`, which is the same file
`nie mod install` rewrites for the Rose Griffon kit, so only one tool can own it at a time. Check each one against
the release notes before combining.

| Mod                                                                                                                                                              | What it adds                                               | Notes                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [VR Sub Continuity BETA](https://gamebanana.com/mods/652259)                                                                                                     | Player, technique and team names from the IE Wiki (EN)     | Built for 4.0.1, not updated; replaces `cpk_list.cfg.bin` and text cfg.bin. BetterQoL's "Original names by team" covers part of this. CC BY-NC-ND.                               |
| [Chronicle Mode - Skip Story Match](https://gamebanana.com/mods/641663)                                                                                          | A story match counts as won after 4 goals                  | One `game_quest_config` cfg.bin. May overlap ChronicleDeluxe.                                                                                                                    |
| [Victory Road Rival Overdrive 5.0](https://gamebanana.com/mods/717365)                                                                                           | Offline leagues and cups, extra teams, "Rival Instinct" AI | Replaces AI cfg.bin and Lua. Conflicts with FootballReforged / LegendaryAI, and the Vanilla edition needs a modified launcher. Use it instead of this profile, not alongside it. |
| [FFI Themed BB Mod 7.1.2](https://gamebanana.com/mods/708708)                                                                                                    | National IE3 / Orion teams in the Battle Bay               | Overlaps BattleBayDeluxe's Battle Bay team list.                                                                                                                                 |
| Kit packs: [LaLiga 3.1.1](https://gamebanana.com/mods/653308), [Serie A](https://gamebanana.com/mods/659117), [Orion's Kits](https://gamebanana.com/mods/651402) | Real-club kits                                             | Check that none replaces `u11600010`.                                                                                                                                            |

More links are in [`../README.md`](../README.md) (IEVR Mod Manager, Ultimate Victory Road, which is discontinued,
and others).

## Install

Installation is a separate step and has not been done. By the user's decision nothing is installed into the game
directory: the deliverable is this profile plus an installable package with rollback. For the Rose Griffon kit
(`nie mod install`, with dry run, vanilla `cpk_list.cfg.bin` checksum and `nie mod uninstall`), see
[`../RoseGriffon/INSTALL.md`](../RoseGriffon/INSTALL.md). The VRFW parts of every mod are read by the VRFW loader
from its mods folder, using this profile's enabled set and order (the loader's `enabled.toml` /
`load_order.toml`). Play offline only: the game runs Easy Anti-Cheat.
