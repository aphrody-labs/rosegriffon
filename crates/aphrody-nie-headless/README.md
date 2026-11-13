# aphrody-nie-headless

Headless CLI runner for Inazuma Eleven: Victory Road (`nie.exe` Level-5 "Lives" engine).

Provides format detection, deterministic football match simulation, save file editing, menu screen PNG captures, and full memory core dumping.

## Subcommands

### 1. `detect`

Inspects an extracted game asset, identifies its format (@UTF, CPK, CRILAYLA, RDBN, G4TX, G4MD) and emits a JSON descriptor.

```bash
aphrody-nie-headless detect path/to/asset.bin --indent 2
```

### 2. `match`

Runs a full 90-minute deterministic football match simulation (kickoff, pass, dribble, duel, shoot, goal) and outputs a terse 1-line score summary (`home=... away=... résultat=... horloge=...`).

```bash
aphrody-nie-headless match --home Raimon --away "Teikoku Gakuen" --seed 42
```

### 3. `save-edit`

Decrypts, modifies, and re-encrypts IEVR save containers with XOR stream cipher key resolution and CRC32 verification.

```bash
aphrody-nie-headless save-edit --slot 002AB8F4-USERDATALIVE --level 99 --coins 999999 --out edited_save.bin
```

### 4. `capture-menus`

Captures all game menu screens (boot, title, main_menu, save_editor, match_ui, formation) as an animated PNG sequence accompanied by a `timeline.json` manifest.

```bash
aphrody-nie-headless capture-menus --out-dir var/capture_frames --width 1280 --height 720 --frames-per-menu 10 --fps 30
```

### 5. `memory-dump`

Dumps the structured JSON memory map and binary core image of `nie.exe` (PE header, `.text`, `.rdata`, `SAVE_MANAGER`, `GAME_HEAP_MATCH`).

```bash
aphrody-nie-headless memory-dump --out-bin var/nie_core.bin --out-json var/nie_map.json
```

### 6. `pipeline`

Executes the end-to-end headless pipeline: save editor operation, memory map generation, and menu screen capture.

```bash
aphrody-nie-headless pipeline --out-dir var/headless_run
```
