# Matrice des fonctionnalités

Source de vérité : `crates/nie-pkg/registry/games.toml`. Le tableau ci-dessous est généré par `nie-pkg matrix` (ne pas éditer à la main, relancer la commande).

Statuts : `full` livré en Rust, `partial` livré partiellement (souvent encore en TS ou C#), `planned` prévu, `none` hors périmètre.

## Jeux x fonctionnalités

| Game | Platforms | dump_verify | asset_extract | text_extract | translation_patch | save_edit | team_builder | wiki_data | nie_runtime | netplay | mod_loader |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Inazuma Eleven (`ie1`) | ds, 3ds | full | planned | planned | planned | planned | planned | partial | none | none | none |
| Inazuma Eleven 2: Firestorm / Blizzard (`ie2`) | ds | full | planned | planned | planned | planned | planned | partial | none | none | none |
| Inazuma Eleven 3: Lightning Bolt / Bomb Blast / Team Ogre Attacks (`ie3`) | ds, 3ds | full | planned | planned | planned | planned | planned | partial | none | none | none |
| Inazuma Eleven Strikers (`strikers`) | wii | full | planned | planned | planned | none | planned | partial | none | planned | none |
| Inazuma Eleven Strikers 2012 Xtreme (`strikers-2012`) | wii | full | planned | planned | planned | none | planned | partial | none | planned | none |
| Inazuma Eleven GO Strikers 2013 (`go-strikers-2013`) | wii | full | planned | planned | planned | none | planned | partial | none | planned | none |
| Inazuma Eleven GO: Light / Shadow (`go1`) | 3ds | full | partial | planned | planned | planned | planned | partial | none | none | none |
| Inazuma Eleven GO Chrono Stones: Wildfire / Thunderflash (`go2`) | 3ds | full | partial | planned | planned | planned | planned | partial | none | none | none |
| Inazuma Eleven GO Galaxy: Big Bang / Supernova (`go3`) | 3ds | full | partial | planned | planned | planned | planned | partial | none | none | none |
| Inazuma Eleven Cross (`cross`) | mobile | partial | partial | partial | none | none | planned | partial | none | none | none |
| Inazuma Eleven: Victory Road (`ievr`) | pc, switch, switch2, ps4, ps5 | full | full | full | planned | full | partial | full | partial | none | planned |

## Jeux x plateformes

| Jeu | DS | 3DS | Wii | Switch | Switch 2 | PS4 | PS5 | PC | Mobile |
|---|---|---|---|---|---|---|---|---|---|
| ie1 | 2008 | 2014 (eShop, non vérifié) | | | | | | | |
| ie2 | 2009 | | | | | | | | |
| ie3 | 2010 | 2013 (EU) | | | | | | | |
| strikers | | | 2011 | | | | | | |
| strikers-2012 | | | 2011 | | | | | | |
| go-strikers-2013 | | | 2012 | | | | | | |
| go1 | | 2011 | | | | | | | |
| go2 | | 2012 | | | | | | | |
| go3 | | 2013 | | | | | | | |
| cross | | | | | | | | | 2026 (non vérifié) |
| ievr (alias ares) | | | | 2025 | 2025 (non vérifié) | 2025 | 2025 | 2025 (Steam 2799860) | |

## Écosystème par jeu

- DS (ie1, ie2, ie3) : émulateur melonDS, Kuriimu2 ; données C# existantes `apps/iecode-dotnet/Core/NdsSharp`.
- 3DS (ie3 EU, go1-3) : Azahar, Kuriimu2, formats XPCK/XMTN/IMGC (`docs/lvl5.md`).
- Wii (Strikers) : Dolphin.
- Victory Road : `packages/inagle`, `packages/azalee`, `crates/aphrody-nie-formats` (CPK, G4*), `crates/aphrody-nie-save`, `crates/bun-steam`, crawl Level-5 `packages/rg-cron/src/tasks/ie-crawl`.
- Cross : `packages/inagle-cross`.

## Non vérifié

Champs `verified = false` du registre : ie1 3DS, cross mobile, ievr Switch 2. Les statuts `partial` de `wiki_data` pour les anciens jeux reflètent des pages existantes du wiki sans import de données structurées. À confirmer contre une source primaire avant la phase 3.
