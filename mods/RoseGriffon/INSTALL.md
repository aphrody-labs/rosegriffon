# Install and rollback

The package is the working mod built by `scripts/build.sh` in `var/ie-work/rosegriffon-mod`
(1 file: kit `u11600010`). It is built from your own game install and
is not redistributable: it contains modified game files.

**Play offline only.** The game runs Easy Anti-Cheat. Modified data may be flagged in online
modes. Do not install while the game is running.

## 1. Build and check

```bash
NIE_GAME_DIR=".../INAZUMA ELEVEN Victory Road" RG_ASSETS=C:/src/rosegriffon/packages/rg-assets/public \
  bash mods/RoseGriffon/scripts/build.sh          # ends with "verdict valide"
```

## 2. Dry run (writes nothing)

```bash
target/release/nie.exe mod install --a-blanc -d var/ie-work/rosegriffon-mod
```

Expected output, checked on 2026-11-05:

- would back up `data/cpk_list.cfg.bin` to `data/cpk_list.cfg.bin.nie-vanilla`
- would copy 1 file into the game directory
- `rien n'a été écrit` (nothing written)

Record the vanilla checksum before installing:

```bash
sha256sum ".../INAZUMA ELEVEN Victory Road/data/cpk_list.cfg.bin"
# 2026-11-05 build: 0eb7a77140a1bb27… (13,014,672 bytes)
```

## 3. Install

```bash
target/release/nie.exe mod install -d var/ie-work/rosegriffon-mod
```

## 4. Rollback

```bash
# Restores the vanilla cpk_list byte for byte and deletes the copied mod files
target/release/nie.exe mod uninstall -d var/ie-work/rosegriffon-mod
sha256sum ".../INAZUMA ELEVEN Victory Road/data/cpk_list.cfg.bin"   # must match the recorded checksum
```

If `nie` is unavailable, rollback by hand: copy `data/cpk_list.cfg.bin.nie-vanilla` over
`data/cpk_list.cfg.bin`, then delete the copied mod file under `data/`. As a last resort, Steam
"Verify integrity of game files" restores everything.
