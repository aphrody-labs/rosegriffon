# Inazuma Eleven mods

This directory tracks mod sources as Git submodules and links to community releases. Binary game assets are not mirrored here; use the original authors' download pages and follow each mod's game/version compatibility notes.

## Mod package conventions

There is no single package format shared by all mod platforms. This workspace's `mod-package` schema is a platform-neutral interchange manifest for game/build targets, install mapping, provenance, semantic versions and SHA-256 payload verification. Keep each platform's native manifest when publishing:

| Ecosystem                                                                                   | Native convention                                                                          | Use here                                                                                             |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [Thunderstore](https://wiki.thunderstore.io/mods/creating-a-package)                        | ZIP with root `manifest.json`, `README.md`, `icon.png`, version and dependency identifiers | Build a separate Thunderstore archive and preserve its manifest/dependency format                    |
| [Modrinth](https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack) | `.mrpack` ZIP with root `modrinth.index.json` and optional overrides                       | Preserve the `.mrpack` index and override folder layout                                              |
| [Vortex](https://github.com/Nexus-Mods/Vortex/wiki/How-to-package-a-game-extension)         | Game extension package with `info.json`, `gameart.png` and `index.js`; SemVer              | Treat the extension as installer integration, distinct from the game mod payload                     |
| [Nexus Mods](https://www.nexusmods.com/) / GameBanana                                       | Platform listing and uploaded archive; game-specific install conventions                   | Keep README, supported game/build, install paths, conflicts, license and source URL with the release |

For a distributable release, include a README, changelog, license/attribution, explicit supported game builds, dependency/conflict declarations, reversible install/uninstall steps, and hashes for files. Never package copyrighted base-game files unless the rightsholder permits redistribution; prefer original assets or patch/delta files. The validator checks path traversal, duplicate destinations and payload hashes; it does not install or execute mod content.

## Source submodules

- [Inazuma Eleven Fantasy](https://github.com/Shadorossa/Inazuma-Eleven-Fantasy) — Shadorossa's Victory Road mod. Clone/update through Git submodules.

## Community releases and tools

| Project                                   | Game              | What it provides                                                                      | Source                                                                   |
| ----------------------------------------- | ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Inazuma Eleven Heroes Mod                 | GO Galaxy         | Adds Heroes content to GO Galaxy                                                      | [GameBanana](https://gamebanana.com/mods/627212)                         |
| Ultimate Victory Road (archived/outdated) | Victory Road      | Gameplay, player balance, skills and mechanics overhaul; author marks it discontinued | [Nexus Mods](https://www.nexusmods.com/inazumaelevenvictoryroad/mods/9)  |
| FFI Themed BB Mod                         | Victory Road      | Replaces BB teams with national teams from IE3 and Orion                              | [Nexus Mods](https://www.nexusmods.com/inazumaelevenvictoryroad/mods/11) |
| IEVR Mod Manager                          | Victory Road      | .NET mod/profile manager for organizing and applying local mods                       | [GitHub](https://github.com/Adr1GR/IEVR_Mod_Manager)                     |
| Lynx                                      | GO Light / Shadow | Open-source C# editor for character, skills, scripts, maps and saves                  | [GitHub](https://github.com/Tiniifan/Lynx)                               |
| Inazuma Mods Library                      | Multiple          | Community catalog for mods, fan games and tutorials                                   | [Library](https://inazuma-eleven.fr/mods/)                               |

## Shadorossa repositories

GitHub's public repository API was queried with `sort=stargazers` on 2026-11-04. These are the IE-related repositories in descending star count at that time; the low counts are shown as returned and are not presented as broad popularity rankings.

| Repository                                                                           | Stars at lookup | Focus                                                          |
| ------------------------------------------------------------------------------------ | --------------: | -------------------------------------------------------------- |
| [Inazuma-Eleven-Fantasy](https://github.com/Shadorossa/Inazuma-Eleven-Fantasy)       |               1 | Victory Road mod source (submodule above)                      |
| [Inazuma-Fantasy-VR](https://github.com/Shadorossa/Inazuma-Fantasy-VR)               |               0 | Victory Road project                                           |
| [InazumaElevenVictoryDraft](https://github.com/Shadorossa/InazumaElevenVictoryDraft) |               0 | Victory Road draft project                                     |
| [PokerLeven](https://github.com/Shadorossa/PokerLeven)                               |               0 | Inazuma Eleven fan mod for Balatro                             |
| [VR-ModLoader](https://github.com/Shadorossa/VR-ModLoader)                           |               0 | Victory Road mod loader                                        |
| [Reorganizer](https://github.com/Shadorossa/Reorganizer)                             |               0 | Repository listed by the author; inspect its README before use |
| [Miximax-skin-editor](https://github.com/Shadorossa/Miximax-skin-editor)             |               0 | Mixi Max skin editing                                          |

GameBanana discovery is available as `bun run re gamebanana search <query>` and MCP tools `gamebanana_search` / `gamebanana_mod`; see [the GameBanana skill](../skills/gamebanana/SKILL.md).

## Inazuma Mods Library popular listings

The library exposes a public `api/mods?sort=popular` listing. The following first-page titles and view counts were recorded on 2026-11-04; they are a discovery snapshot, not a permanent ranking.

| Project                                     | Game/platform                | Views at lookup | Listing                                                                                             |
| ------------------------------------------- | ---------------------------- | --------------: | --------------------------------------------------------------------------------------------------- |
| Inazuma Eleven Victory Road DS              | IE1 / Nintendo DS            |          22,840 | [Project](https://inazuma-eleven.fr/mods/mod.html?slug=inazuma-eleven-victory-road-ds)              |
| Inazuma Eleven Strikers: Infinity           | GO Strikers 2013 / PC        |          18,451 | [Project](https://inazuma-eleven.fr/mods/mod.html?slug=inazuma-eleven-strikers-infinity)            |
| Inazuma Souls 3                             | IE3 / Nintendo DS            |          15,243 | [Project](https://inazuma-eleven.fr/mods/mod.html?slug=inazuma-souls-3)                             |
| Inazuma Eleven Go: Temporal Heroes          | Chrono Stones / Nintendo 3DS |          13,536 | [Project](https://inazuma-eleven.fr/mods/mod.html?slug=inazuma-eleven-go-temporal-heroes)           |
| Inazuma Souls 2                             | IE2 / Nintendo DS            |          10,575 | [Project](https://inazuma-eleven.fr/mods/mod.html?slug=inazuma-souls-2)                             |
| Inazuma Eleven Origins                      | IE1 / Nintendo DS            |           7,170 | [Project](https://inazuma-eleven.fr/mods/mod.html?slug=inazuma-eleven-origins)                      |
| Samurai Eleven                              | Inazuma Eleven GO / PC       |           6,583 | [Project](https://inazuma-eleven.fr/mods/mod.html?slug=samurai-eleven)                              |
| Inazuma Eleven 123 La leyenda de Mark Evans | IE 123 / Nintendo 3DS        |           5,835 | [Project](https://inazuma-eleven.fr/mods/mod.html?slug=inazuma-eleven-123-la-leyenda-de-mark-evans) |
| Inazuma Eleven: Card Frontier               | Fan game / PC                |           5,734 | [Project](https://inazuma-eleven.fr/mods/mod.html?slug=inazuma-eleven-card-frontier)                |
| Inazuma Souls                               | IE1 / Nintendo DS            |           5,576 | [Project](https://inazuma-eleven.fr/mods/mod.html?slug=inazuma-souls)                               |

The links above point to the authors' or community hosts. Availability, compatibility and popularity change over time; verify the release notes before installing. Do not combine overlapping gameplay/data replacements without checking file conflicts.
