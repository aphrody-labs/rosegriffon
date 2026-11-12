---
name: steam-linux-proton
description: This skill should be used when the user asks to "run a Windows game on Linux with Proton", "enable PROTON_LOG", "fix a broken Proton prefix", "install GE-Proton", "use proton-cachyos", "set Steam launch options with %command%", "run a game in gamescope", "debug a Steam Linux Runtime container", "run protontricks for an app id", "check ProtonDB reports", or "set up Steam on Arch, CachyOS or SteamOS". For Windows install layout, steam-client-windows applies.
---

# Steam on Linux, Proton and gamescope

Use this skill to diagnose and configure Steam games on Linux: runtimes (pressure-vessel, scout, soldier, sniper), Proton builds and compatibilitytools.d, Wine prefixes, translation layers (DXVK, VKD3D-Proton), gamescope, distribution packaging, SteamOS and the Steam Deck. Work on the remote Linux hosts, not on the Windows workstation, and never run heavy builds locally.

Use the plugin MCP tools first: `local_apps` to list installed apps and their libraries, `app_paths` to resolve `steamapps/common/<installdir>` and `steamapps/compatdata/<appid>`, `read_vdf` to read `compatibilitytool.vdf` and other non-secret VDF files (refused files: [../steam-local-inspect/SKILL.md](../steam-local-inspect/SKILL.md), Rules). The tools live in `plugins/steam/servers/steam-mcp.ts`; the Rust equivalents are in `apps/rosegriffon/crates/bun-steam/src/proton.rs` and `apps/rosegriffon/crates/bun-steam/src/install.rs`.

## 1. Locate Steam

The Steam root lookup order (native, Flatpak, Snap) is documented once in [../steam-local-inspect/references/layout.md](../steam-local-inspect/references/layout.md). `~/.steam/root` is a symlink to the default root (https://wiki.archlinux.org/title/Steam, Directory structure, accessed 2026-11-12). Libraries and manifests use the same `libraryfolders.vdf` / `appmanifest_*.acf` format as on Windows (see [../steam-client-windows/SKILL.md](../steam-client-windows/SKILL.md)).

## 2. Steam Runtime

From the steam-runtime README:

- Steam Runtime 1 `scout`: the `LD_LIBRARY_PATH` runtime ("legacy runtime 1.0"). "Steam Linux Runtime 1.0 (scout)" combines a soldier container with scout libraries.
- Steam Runtime 2 `soldier`: container runtime, "Steam Linux Runtime 2.0 (soldier)", used by Proton 5.13, 6.3 and 7.0.
- Steam Runtime 3 `sniper`: container runtime, "Steam Linux Runtime 3.0 (sniper)", used by Proton 8, 9 and 10. App id 1628350 (`proton.rs` `STEAM_LINUX_RUNTIME_SNIPER_APP_ID`).
- Steam Runtime 4: "Steam Linux Runtime 4.0", used by Proton 11 and newer.
- Proton 5.0 and earlier use the scout `LD_LIBRARY_PATH` runtime.

The container launcher is pressure-vessel, "a container launching tool" (https://github.com/ValveSoftware/steam-runtime/blob/master/doc/reporting-steamlinuxruntime-bugs.md). The tools install as `steamapps/common/SteamLinuxRuntime_<name>`; `bun-steam` classifies any directory starting with `SteamLinuxRuntime` as a runtime (`apps/rosegriffon/crates/bun-steam/src/proton.rs` `classify`). For container debugging read `doc/steamlinuxruntime-known-issues.md` and `doc/reporting-steamlinuxruntime-bugs.md` in the steam-runtime repo before guessing env vars.

## 3. Proton

Valve Proton is a Steam tool app. App ids from `proton.rs` `VALVE_PROTON_APPS`: Proton Experimental 1493710, Proton Hotfix 2180100, Proton 10.0 3658110, Proton 9.0 2805730, Proton 8.0 2348590. Anti-cheat runtimes (doc comments in `apps/rosegriffon/crates/bun-steam/src/proton.rs`, lines 319-321): EasyAntiCheat 1826330, BattlEye 1161040.

Per-game state lives in `steamapps/compatdata/<appid>/`; `pfx/` inside it is the Wine prefix (`pfx/drive_c/users/steamuser/...`). Source: `apps/rosegriffon/crates/bun-steam/src/proton.rs` (what `app_paths` resolves); the Arch wiki also names `steamapps/compatdata` as the per-game save directory (https://wiki.archlinux.org/title/Steam, accessed 2026-11-12). The Proton README does not document these paths.

Runtime options from the Proton README (env var, with the compat-config name in parentheses where given):

- `PROTON_LOG=1`: write a debug log to `$PROTON_LOG_DIR/steam-$APPID.log`; `PROTON_LOG_DIR` defaults to `$HOME`.
- `PROTON_USE_WINED3D` (`wined3d`): OpenGL wined3d instead of DXVK for d3d9/10/11.
- `PROTON_NO_ESYNC` (`noesync`), `PROTON_NO_FSYNC` (`nofsync`): disable eventfd / futex synchronisation.
- `PROTON_DISABLE_NVAPI` (`disablenvapi`), `PROTON_HIDE_NVIDIA_GPU` (`hidenvgpu`, report NVIDIA as AMD).
- `PROTON_NO_D3D11`, `PROTON_USE_XALIA`, `PROTON_WAIT_ATTACH`, `PROTON_CRASH_REPORT_DIR`.
- Setting a variable to `0` disables the option; unset uses the default.

`PROTON_ENABLE_NVAPI`, `PROTON_ENABLE_WAYLAND`, `PROTON_ENABLE_HDR` are not in the Valve README (proton_10.0 and experimental_10.0 branches); they are documented by GE-Proton (section 4). Do not suggest them for Valve Proton without checking the installed build.

For persistent overrides across games, rename `user_settings.sample.py` to `user_settings.py` (Proton README) in the Proton install directory (e.g. `steamapps/common/Proton 9.0`). Force a tool per game with Properties > Compatibility > "Force the use of a specific Steam Play compatibility tool" (https://wiki.archlinux.org/title/Steam, accessed 2026-11-12). `proton.rs` maps Valve tool directories to their internal tool names (`Proton 9.0` -> `proton_9`).

## 4. GE-Proton and proton-cachyos

- GE-Proton (GloriousEggroll): extract `GE-Proton<ver>-<arch>.tar.gz` into `compatibilitytools.d/` under the Steam root (roots per install type: [../steam-local-inspect/references/layout.md](../steam-local-inspect/references/layout.md)), restart Steam, select it per game.
- GE-only options: `PROTON_ENABLE_WAYLAND` (alias `PROTON_USE_WAYLAND`, Wine Wayland driver), `PROTON_ENABLE_HDR` (legacy; `0` disables HDR reporting), `PROTON_FORCE_HDR`, `PROTON_ENABLE_NVAPI`, `PROTON_FSR4_UPGRADE`, `PROTON_NO_NTSYNC` (NTSync is automatic when the kernel supports it) (https://github.com/GloriousEggroll/proton-ge-custom README, fetched 2026-11-12).
- proton-cachyos: "builds on Proton introducing experimental features, third-party tools and more"; binary packages for use with the Steam Linux Runtime are in the repository releases (https://github.com/CachyOS/proton-cachyos README, fetched 2026-11-12). On CachyOS it ships in `cachyos-gaming-meta` (section 8).
- Custom tools carry `compatibilitytool.vdf` (`compatibilitytools/compat_tools/<internal name>/display_name`) and a `version` file. Extra search paths come from `STEAM_EXTRA_COMPAT_TOOLS_PATHS` (`proton.rs` `compat_tool_dirs`).

## 5. Wine, DXVK, VKD3D-Proton

- DXVK: Vulkan translation of D3D8/9/10/11. Manual install into a plain Wine prefix: 64-bit DLLs to `system32`, 32-bit to `syswow64`, `native` overrides for `d3d8`, `d3d9`, `d3d10core`, `d3d11`, `dxgi` in `winecfg`; undo with `wineboot -u`. Knobs: `DXVK_HUD` (`1` = `devinfo,fps`, `full`), `DXVK_LOG_LEVEL` (`none|error|warn|info|debug`), `DXVK_CONFIG_FILE`, `DXVK_CONFIG`, `DXVK_SHADER_CACHE`, `DXVK_SHADER_CACHE_PATH` (https://github.com/doitsujin/dxvk README, fetched 2026-11-12).
- VKD3D-Proton: D3D12 on Vulkan (`d3d12.dll`, `d3d12core.dll`; needs DXVK 2.1+ for DXGI). Knobs: `VKD3D_CONFIG` (e.g. `vk_debug`, `single_queue`), `VKD3D_DEBUG` (`none|err|info|fixme|warn|trace`), `VKD3D_LOG_FILE`, `VKD3D_SHADER_CACHE_PATH` (`0` disables) (https://github.com/HansKristian-Work/vkd3d-proton README, fetched 2026-11-12).
- Proton builds both from its own tree (`make dxvk` / `make vkd3d-proton`) and switches renderers with `PROTON_*` options such as `PROTON_USE_WINED3D` (https://github.com/ValveSoftware/Proton README, branch proton_10.0, fetched 2026-11-12); configure them that way instead of copying DLLs into a `compatdata` prefix.

## 6. Launch options

Format: `VAR=value ... [wrapper] %command%` (`apps/rosegriffon/crates/bun-steam/src/proton.rs`, launch options builder). Examples:

- `PROTON_LOG=1 %command%`
- `PROTON_USE_WINED3D=1 %command%`
- `gamemoderun %command%` (Feral GameMode; install `gamemode` and `lib32-gamemode`, join the `gamemode` group; check with `gamemoded -s`; https://wiki.archlinux.org/title/GameMode, accessed 2026-11-12)
- `game-performance %command%` (CachyOS: switches power-profiles-daemon to performance for the session; https://wiki.cachyos.org/configuration/gaming/)
- `gamescope -w 1920 -h 1080 -W 3440 -H 1440 -b -- %command%`

## 7. gamescope

Options from the gamescope README (https://github.com/ValveSoftware/gamescope, fetched 2026-11-12): `-W`/`-H` gamescope output resolution (ignored in embedded mode, default 1280x720), `-w`/`-h` game resolution (default to `-W`/`-H`), `-r` FPS limit, `-f` fullscreen, `-S integer` scaling, `-b` borderless. Nested mode runs on a desktop inside its own Xwayland; embedded mode drives DRM/KMS directly, as on the Deck. `--hdr-enabled` enables HDR10, `--expose-wayland` allows Wayland clients, `--adaptive-sync` enables VRR, `--mangoapp` replaces MangoHud, `-F fsr|nis` upscales, `--force-grab-cursor` fixes cursor capture (https://wiki.archlinux.org/title/Gamescope, accessed 2026-11-12). `-e` enables Steam integration, as in `gamescope -e -- steam -tenfoot` for a Big Picture session (https://wiki.archlinux.org/title/Steam, accessed 2026-11-12).

## 8. Distributions

- Arch: enable `[multilib]` and install `steam`; pick the 32-bit Vulkan driver for the GPU vendor at the prompt (pacman defaults alphabetically to `lib32-nvidia-utils`, which breaks Vulkan on other vendors) and install the 32-bit OpenGL driver (https://wiki.archlinux.org/title/Steam, accessed 2026-11-12). Add `gamescope` and `gamemode` / `lib32-gamemode` as needed.
- CachyOS: `cachyos-gaming-meta` (libraries, `proton-cachyos`) and `cachyos-gaming-applications` (gamescope, MangoHud, GOverlay, Steam, Heroic, Lutris; https://wiki.cachyos.org/configuration/gaming/). Kernels: the default `linux-cachyos` uses EEVDF (https://github.com/CachyOS/linux-cachyos README); BORE is in `linux-cachyos-bore`, `-deckify`, `-lts`, `-hardened`, `-rt-bore` (https://wiki.cachyos.org/features/kernel/, accessed 2026-11-12).
- SteamOS / Steam Deck: install desktop apps with Flatpak (Discover); the system image is read-only, `sudo steamos-readonly disable` makes it writable after setting a password with `passwd`, and anything installed outside Flatpak (for example with pacman) may be wiped by the next SteamOS update (https://help.steampowered.com/en/faqs/view/671A-4453-E8D2-323C, accessed 2026-11-12).

## Additional Resources

- `references/troubleshooting.md`: ordered checklist for a game that fails to start under Proton.
- protontricks and ProtonDB (license, link-only rule): [`../steam-community-tools/references/tools.md`](../steam-community-tools/references/tools.md) (Ecosystem applications).

## Sources

- https://github.com/ValveSoftware/Proton (README, branches proton_10.0 and experimental_10.0)
- https://github.com/ValveSoftware/steam-runtime (README)
- https://github.com/ValveSoftware/gamescope (README)
- https://github.com/GloriousEggroll/proton-ge-custom (README)
- https://wiki.cachyos.org/configuration/gaming/
- https://github.com/CachyOS/proton-cachyos (README, fetched 2026-11-12)
- https://github.com/doitsujin/dxvk (README)
- https://github.com/HansKristian-Work/vkd3d-proton (README)
- https://help.steampowered.com/en/faqs/view/671A-4453-E8D2-323C (Steam Deck desktop FAQ, accessed 2026-11-12)
- https://wiki.archlinux.org/title/Steam, /title/Gamescope, /title/GameMode (read in Chrome, accessed 2026-11-12)
- https://wiki.cachyos.org/features/kernel/ and https://github.com/CachyOS/linux-cachyos (README)
- https://github.com/ValveSoftware/steam-runtime/blob/master/doc/reporting-steamlinuxruntime-bugs.md
- `apps/rosegriffon/crates/bun-steam/src/proton.rs`, `apps/rosegriffon/crates/bun-steam/src/install.rs`, `apps/rosegriffon/crates/bun-steam/src/launch.rs`
