---
name: steam-linux-proton
description: This skill should be used when the user asks to "run a Windows game on Linux with Proton", "enable PROTON_LOG", "find the compatdata prefix", "install GE-Proton", "use proton-cachyos", "set Steam launch options with %command%", "run a game in gamescope", "debug a Steam Linux Runtime container", "which runtime does Proton use", "set up Steam on Arch or CachyOS", or mentions pressure-vessel, sniper, soldier, scout, compatibilitytools.d, DXVK, VKD3D-Proton, SteamOS or the Steam Deck.
---

# Steam on Linux, Proton and gamescope

Use this skill to diagnose and configure Steam games on Linux: runtimes, Proton builds, Wine prefixes, translation layers, gamescope and distribution packaging. Work on the remote Linux hosts, not on the Windows workstation, and never run heavy builds locally.

Use the plugin MCP tools first: `local_apps` to list installed apps and their libraries, `app_paths` to resolve `steamapps/common/<installdir>` and `steamapps/compatdata/<appid>`, `read_vdf` to read `localconfig.vdf` (launch options) and `compatibilitytool.vdf`. `read_vdf` refuses `config.vdf` because it holds login tokens; read `CompatToolMapping` there only with a targeted grep that prints that block and nothing else. The tools live in `servers/steam-mcp.ts`; the Rust equivalents are in `crates/bun-steam/src/proton.rs` and `install.rs`.

## 1. Locate Steam

`bun-steam` probes, among others, `~/.local/share/Steam`, `~/.steam/steam`, the Flatpak roots `~/.var/app/com.valvesoftware.Steam/.local/share/Steam` and `~/.var/app/com.valvesoftware.Steam/.steam/steam` (also in `third_party/steam-ecosystem/steamlocate-rs/src/locate/linux.rs`) and Snap `~/snap/steam/common/.local/share/Steam` (`crates/bun-steam/src/install.rs` `find_steam_installations`). `~/.steam/steam` and `~/.steam/root` are symlinks to the real root on native installs (unverified). Libraries and manifests use the same `libraryfolders.vdf` / `appmanifest_*.acf` format as on Windows (see the `steam-client-windows` skill).

## 2. Steam Runtime

From the steam-runtime README:

- Steam Runtime 1 `scout`: the `LD_LIBRARY_PATH` runtime ("legacy runtime 1.0"). "Steam Linux Runtime 1.0 (scout)" combines a soldier container with scout libraries.
- Steam Runtime 2 `soldier`: container runtime, "Steam Linux Runtime 2.0 (soldier)", used by Proton 5.13, 6.3 and 7.0.
- Steam Runtime 3 `sniper`: container runtime, "Steam Linux Runtime 3.0 (sniper)", used by Proton 8, 9 and 10. App id 1628350 (`proton.rs` `STEAM_LINUX_RUNTIME_SNIPER_APP_ID`).
- Steam Runtime 4: "Steam Linux Runtime 4.0", used by Proton 11 and newer.
- Proton 5.0 and earlier use the scout `LD_LIBRARY_PATH` runtime.

The container launcher is pressure-vessel (named in other steam-runtime docs; not in the README fetched, unverified). The tools install as `steamapps/common/SteamLinuxRuntime_<name>`; `bun-steam` classifies any directory starting with `SteamLinuxRuntime` as a runtime (`proton.rs` `classify`). For container debugging read the docs under `docs/` in the steam-runtime repo before guessing env vars.

## 3. Proton

Valve Proton is a Steam tool app. App ids from `proton.rs` `VALVE_PROTON_APPS`: Proton Experimental 1493710, Proton Hotfix 2180100, Proton 10.0 3658110, Proton 9.0 2805730, Proton 8.0 2348590. Anti-cheat runtimes: EasyAntiCheat 1826330, BattlEye 1161040.

Per-game state lives in `steamapps/compatdata/<appid>/`; `pfx/` inside it is the Wine prefix (`pfx/drive_c/users/steamuser/...`). The Proton README does not mention these paths; treat the layout as unverified from that source, but it is what `app_paths` resolves.

Runtime options from the Proton README (env var, with the compat-config name in parentheses where given):

- `PROTON_LOG=1`: write a debug log to `$PROTON_LOG_DIR/steam-$APPID.log`; `PROTON_LOG_DIR` defaults to `$HOME`.
- `PROTON_USE_WINED3D` (`wined3d`): OpenGL wined3d instead of DXVK for d3d9/10/11.
- `PROTON_NO_ESYNC` (`noesync`), `PROTON_NO_FSYNC` (`nofsync`): disable eventfd / futex synchronisation.
- `PROTON_DISABLE_NVAPI` (`disablenvapi`), `PROTON_HIDE_NVIDIA_GPU` (`hidenvgpu`, report NVIDIA as AMD).
- `PROTON_NO_D3D11`, `PROTON_USE_XALIA`, `PROTON_WAIT_ATTACH`, `PROTON_CRASH_REPORT_DIR`.
- Setting a variable to `0` disables the option; unset uses the default.

`PROTON_ENABLE_NVAPI`, `PROTON_ENABLE_WAYLAND`, `PROTON_ENABLE_HDR` are not in the Valve README (proton_10.0 and experimental_10.0 branches); they are documented by GE-Proton (section 4). Do not suggest them for Valve Proton without checking the installed build.

For persistent overrides across games, copy `user_settings.sample.py` to `user_settings.py` in the Proton install directory (e.g. `steamapps/common/Proton 9.0`). Force a tool per game in the Compatibility tab; Steam records the choice in `config/config.vdf` under `CompatToolMapping` (key path per `proton.rs`; exact tree unverified).

## 4. GE-Proton and proton-cachyos

- GE-Proton (GloriousEggroll): extract `GE-Proton<ver>-<arch>.tar.gz` into `~/.steam/steam/compatibilitytools.d/` (Flatpak: `~/.var/app/com.valvesoftware.Steam/.local/share/Steam/compatibilitytools.d/`; Snap: `~/snap/steam/common/.steam/steam/compatibilitytools.d/`), restart Steam, select it per game.
- GE-only options: `PROTON_ENABLE_WAYLAND` (alias `PROTON_USE_WAYLAND`, Wine Wayland driver), `PROTON_ENABLE_HDR` (legacy; `0` disables HDR reporting), `PROTON_FORCE_HDR`, `PROTON_ENABLE_NVAPI`, `PROTON_FSR4_UPGRADE`, `PROTON_NO_NTSYNC` (NTSync is automatic when the kernel supports it).
- proton-cachyos: based on Proton `bleeding-edge` with wine-staging patches and codecs; pacman package `proton-cachyos` (in `cachyos-gaming-meta`) or `proton-cachyos-slr`; GitHub `CachyOS/proton-cachyos`.
- Custom tools carry `compatibilitytool.vdf` (`compatibilitytools/compat_tools/<internal name>/display_name`) and a `version` file. Extra search paths come from `STEAM_EXTRA_COMPAT_TOOLS_PATHS` (`proton.rs` `compat_tool_dirs`).

## 5. Wine, DXVK, VKD3D-Proton

- DXVK: Vulkan translation of D3D8/9/10/11. Manual install into a plain Wine prefix: 64-bit DLLs to `system32`, 32-bit to `syswow64`, `native` overrides for `d3d8`, `d3d9`, `d3d10core`, `d3d11`, `dxgi` in `winecfg`; undo with `wineboot -u`. Knobs: `DXVK_HUD` (`1` = `devinfo,fps`, `full`), `DXVK_LOG_LEVEL` (`none|error|warn|info|debug`), `DXVK_CONFIG_FILE`, `DXVK_CONFIG`, `DXVK_SHADER_CACHE`, `DXVK_SHADER_CACHE_PATH`.
- VKD3D-Proton: D3D12 on Vulkan (`d3d12.dll`, `d3d12core.dll`; needs DXVK 2.1+ for DXGI). Knobs: `VKD3D_CONFIG` (e.g. `vk_debug`, `single_queue`), `VKD3D_DEBUG` (`none|err|info|fixme|warn|trace`), `VKD3D_LOG_FILE`, `VKD3D_SHADER_CACHE_PATH` (`0` disables).
- Proton bundles both; do not install them into a `compatdata` prefix by hand.
- Plain Wine prefixes: `WINEPREFIX=~/.wine-foo winecfg` (WineHQ wiki not fetched; unverified).

## 6. Launch options

Format: `[env vars] [wrappers] %command% [game args]`. Everything after the first `%command%` is passed to the game; never repeat it. Examples:

- `PROTON_LOG=1 %command%`
- `PROTON_USE_WINED3D=1 %command%`
- `gamemoderun %command%` (Feral gamemode; Arch wiki blocked, unverified)
- `game-performance %command%` (CachyOS: switches power-profiles-daemon to performance for the session)
- `gamescope -w 1920 -h 1080 -W 3440 -H 1440 -b -- %command%`

## 7. gamescope

Options from the README: `-W`/`-H` gamescope output resolution (ignored in embedded mode, default 1280x720), `-w`/`-h` game resolution (default to `-W`/`-H`), `-r` FPS limit, `-f` fullscreen, `-S integer` scaling, `-b` borderless. Nested mode runs on a desktop inside its own Xwayland; embedded mode drives DRM/KMS directly, as on the Deck. `--hdr-enabled`, `-e`/`--steam` and `gamescope-session` are not in the README (unverified).

## 8. Distributions

- Arch: `steam` is in `[multilib]`; install the matching `lib32-` Vulkan driver (`lib32-vulkan-radeon`, `lib32-vulkan-intel`, `lib32-nvidia-utils`) plus `gamescope`, `gamemode` (Arch wiki blocked by Anubis; unverified).
- CachyOS: `cachyos-gaming-meta` (libraries, `proton-cachyos`) and `cachyos-gaming-applications` (gamescope, MangoHud, GOverlay, Steam, Heroic, Lutris). Kernel `linux-cachyos` with the BORE scheduler (not on the fetched page; unverified).
- SteamOS 3 / Steam Deck: Arch-based "Holo", read-only root toggled by `steamos-readonly disable|enable`, A/B image updates via `steamos-update` / `atomupd`, `steamos-devkit` client for deploy (all unverified: `ValveSoftware/SteamOS` is only an issue tracker and documents none of this).

## Additional Resources

- `references/troubleshooting.md`: ordered checklist for a game that fails to start under Proton.

## Sources

- https://github.com/ValveSoftware/Proton (README, branches proton_10.0 and experimental_10.0)
- https://github.com/ValveSoftware/steam-runtime (README)
- https://github.com/ValveSoftware/gamescope (README)
- https://github.com/GloriousEggroll/proton-ge-custom (README)
- https://wiki.cachyos.org/configuration/gaming/
- https://github.com/doitsujin/dxvk (README)
- https://github.com/HansKristian-Work/vkd3d-proton (README)
- https://github.com/ValveSoftware/SteamOS (issue tracker only)
- https://wiki.archlinux.org/title/Steam and /title/Gamescope (blocked on fetch)
- `C:/src/apps/rosegriffon/crates/bun-steam/src/proton.rs`, `install.rs`, `launch.rs`
