<!-- SPDX-License-Identifier: Apache-2.0 -->

# bun-steam

Rust half of the Bun OS Steam owner; the Bun half (CLI `bun-steam`, steamcmd driving, Proton
installs) is [`packages/bun-steam`](../../packages/bun-steam).

| Module        | Scope                                                                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vdf`         | Text KeyValues parser/writer, binary KeyValues parser/writer (`shortcuts.vdf`), `appinfo.vdf` v39-v41 and `packageinfo.vdf` readers. Pure, `wasm32`-friendly.                                                    |
| `install`     | Steam install discovery (Linux, Flatpak, Snap, Windows, WSL, macOS), `libraryfolders.vdf`, `appmanifest_*.acf`, installed-game scans.                                                                            |
| `config`      | `loginusers.vdf`, `config.vdf` `CompatToolMapping`, cached-session presence (`ConnectCache`), `HKCU\Software\Valve\Steam` / `registry.vdf`, library add and app move plans.                                      |
| `proton`      | Compatibility tool discovery, GE-Proton / proton-cachyos asset selection (x86-64-v3), Valve Proton tool app ids, Proton launch environment (ntsync, caches, llvmpipe, gamemode, official EAC/BattlEye runtimes). |
| `remote_play` | `remoteclients.vdf` devices without secret fields, streaming logs.                                                                                                                                               |
| `launch`      | `steam://rungameid/<id>` and URI validation.                                                                                                                                                                     |
| `depot`       | Depot planning (always); CM depot client with feature `depot` and the `bun-steam-depot` binary.                                                                                                                  |
| `emulator`    | In-process Steamworks API emulator (feature `emulator`).                                                                                                                                                         |

Credentials: no module prompts for, logs or prints a password or token value, except the
`bun-steam-depot login` command, which reads the password and the Steam Guard code from the TTY
(echo off) and keeps them in memory only. Persisted: refresh token, account name and steamid, in
the store chosen by `STEAM_TOKEN_STORE` (`file` = `$STEAM_HOME/steam-tokens.json` mode 0600,
`env`, `cloudflare` Workers KV, `github` Actions secret). Each run renews the access token and
writes a rotated refresh token back; exit code 2 means a new `login` is needed. `config` reports
cached sessions as booleans only. See [`docs/auth.md`](../../docs/auth.md).

`bun-steam-depot` (feature `depot`) replaces steamcmd for our use: `login <user>`, `update`
(resume: valid files skipped), `verify` (every file hashed against the manifest), `list`,
`auth status`, `auth export --to <store>`. Windows depots are selected with `--os windows` on any
host OS. Container: `infra/docker/steam-depot`.

Shared fixtures in `tests/fixtures` (`text.vdf`, `shortcuts.vdf`, `types.bin.vdf` and their
`*.expected.json`) are parsed by both implementations.

```sh
bun scripts/cargo.ts exec -- test -p bun-steam
bun scripts/cargo.ts exec -- build -p bun-steam --features depot --bin bun-steam-depot
```
