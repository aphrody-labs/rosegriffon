# Steam on Linux

This repository uses `aphrody-nie-steam` for Steam depot access. It does not automate the
graphical Steam client: it authenticates against Steam's native protocol and writes a
Steam-compatible install tree. A legally owned copy of IEVR is still required.

## Paths

The prepared Linux layout is:

| Purpose                              | Path                                                           |
| ------------------------------------ | -------------------------------------------------------------- |
| Steam client and libraries           | `/home/ubuntu/.local/share/Steam`                              |
| IEVR install and VFS root            | value of `IEVR_GAME_DIR` (VPS: `/home/ubuntu/src/iecode/data`) |
| nie Steam refresh-token store        | `/home/ubuntu/.local/share/nie/steam-tokens.json`              |
| Wine/Proton runtime, logs and caches | `/home/ubuntu/.local/share/nie/runtime`                        |
| Wine prefix                          | `/home/ubuntu/.local/share/nie/runtime/proton-prefix/pfx`      |

Non-secret paths and app/depot IDs are kept in the private file
`~/.config/nie/steam.env` (mode `0600`). Steam passwords and Guard codes must be
provided only through the protected interactive session environment; never put
them in that file, command arguments, logs, or the repository. The token store
is created separately with mode `0600` under a directory with mode `0700`.

## Inspect, authenticate, and download

Inspect the app and content depot without downloading:

```bash
set -a; . ~/.config/nie/steam.env; set +a
target/debug/aphrody-nie-steam --depot "$NIE_STEAM_DEPOT" list "$NIE_STEAM_APP_ID"
```

The first credential login may require `STEAM_GUARD_CODE` or mobile confirmation.
The update script reads the non-secret config file, checks the target has at least
75,000,000,000 free bytes, authenticates with NIE, then starts the resumable
download in a named tmux session. It removes password and Guard values from the
environment before launching that session. A successful login stores a refresh
token, so later runs do not need the password:

```bash
scripts/tools/steam-update.sh
tmux -S "$HOME/.local/share/nie/steam-update.sock" attach -t ievr-download
```

The download is resumable and verifies existing files by default. The script
refuses to start if a session of the same name already exists or the destination
does not have enough free space. Do not pass `--no-verify` unless a full redownload
is intentional. The content depot is `2799861` for app `2799860`; the constants are
defined by `aphrody-nie-steam`, not by this document.

For the Bun pipeline, the equivalent command is `bun run sync:gamedata`. It uses
`IEVR_GAME_DIR`, `STEAM_TOKEN_STORE`, and the same native Rust downloader.

## Proton and Wine

The system Wine package is only a fallback. The supported path for running the real
Windows binary uses the Proton runtime shipped with the downloaded game under
`$NIE_GAME_PATH/files`.

### The native path: `nie live`

`aphrody_nie_trace::proton` carries this chain in Rust, so acquisition, execution and memory
reading are one binary rather than three shell scripts:

```bash
nie live env          # every resolved path and the exact launch environment
nie live doctor       # each prerequisite, and which one is missing (non-zero if any)
nie live setup        # build the prefix from Proton's default_pfx
nie live run          # launch nie.exe under Proton, as a child of nie
nie live probe --rva 0xF600CA --len 64
```

`--game-dir` here is **not** `NIE_GAME_DIR`. Two roots coexist: `NIE_GAME_DIR` is the tree
whose VFS `nie` reads, while `NIE_GAME_PATH` is the Steam install — the only one carrying
`files/`, and therefore Proton.

`probe` exists because of a permission rule that the shell scripts satisfied by accident.
Under `kernel.yama.ptrace_scope=1`, `process_vm_readv(2)` is allowed only against a
**descendant of the reading process**. `boot-nie-direct.sh` made the _shell_ that ancestor,
so `nie mem` only worked when launched from that same shell. `nie live run` followed by a
separate `nie mem` does not inherit that property: the second process is nobody's ancestor.
`probe` launches and reads in one process, where the rule holds by construction — no
`CAP_SYS_PTRACE`, no `setcap`, and so no disturbance of the Vulkan environment.

### The shell path

The scripts remain, and `nie-wine-setup.sh` additionally starts Xvfb and openbox, which the
Rust port deliberately does not:

```bash
set -a; . ~/.config/nie/steam.env; set +a
scripts/dev/nie-wine-setup.sh
```

The setup copies Proton's default prefix by value, installs DXVK/vkd3d DLLs, creates
`c:`/`z:` mappings, and prepares Xvfb/openbox for a headless display. It must fail
until the game has supplied `files/bin/wine`; that failure means the download is not
complete, not that system Wine should replace Proton.

`STEAM_COMPAT_CLIENT_INSTALL_PATH` points at the native Steam root and
`STEAM_COMPAT_DATA_PATH` at the nie Proton prefix area. The environment is ready
for Proton after the game files arrive; no fake Proton tree is created in advance.

## Headless verification

The deterministic Rust simulation does not require Steam or game assets:

```bash
cargo run -p aphrody-nie-headless -- match
```

After the download, set `NIE_GAME_DIR` from the private environment file and use
`aphrody-nie-headless detect/menu`, `aphrody-nie-game --capture`, or `aphrody-nie-play` for asset-backed checks.
A headless simulation is not a run of the original `nie.exe`.

## Operational boundaries

- Never put Steam credentials, Guard codes, or refresh tokens in tracked files or command
  arguments.
- `aphrody-nie-steam` writes the target tree directly; it does not modify Steam's GUI library
  database or claim that the original game is runnable until `data/cpk_list.cfg.bin` and
  the Proton files are present.
- Running the full sync is an explicit action: it can consume tens of gigabytes and must
  be followed by a meaningful file/VFS check, not only an exit code.
