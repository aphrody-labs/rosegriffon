---
name: gaming-stack
description: This skill should be used when the user asks about "the gaming stack of src", "ay gaming", "which Proton, Wine, DXVK or vkd3d-proton source do we use", "Vulkan layers or ICDs on this host", "DirectX 12 / Agility SDK of a game", "install Proton or steamcmd headless on prd or fr1", "run a Windows exe with Proton outside Steam", "Bazzite, SteamOS or CachyOS images", or "what may be forked or redistributed under which license". For Steam client layout, steam-client-windows and steam-local-inspect apply; for Proton troubleshooting, steam-linux-proton.
argument-hint: "[status|proton|layers|dx|forks|steamcmd|run] [appid|exe]"
allowed-tools: Bash, Read
---

# Gaming stack of the monorepo

One owner per function (map: `docs/gaming/OWNERSHIP.md` in aphrody-labs/src):

- Rust, low level: `crates/steam-depot` (VDF text and binary, appinfo.vdf, ACF, libraryfolders,
  compat tools, Proton launch env, depot client). CLI: `ay steam <root|libraries|apps|vdf|compat|host|env>`, JSON.
- Bun: `packages/gaming` (`@aphrody/gaming`): SteamID, links, path map, Vulkan, DirectX, steamcmd,
  Proton runner. CLI: `ay gaming`. The `steam` plugin MCP imports it.
- Sources (`third_party/<name>`, forks in aphrody-labs, pins in `src.lock.json`): Proton, wine,
  dxvk, vkd3d-proton, gamescope, mesa, Vulkan-Headers, Vulkan-Loader, Vulkan-ValidationLayers,
  Vulkan-Tools, SPIRV-*, DirectX-Headers, DirectXShaderCompiler, bazzite, steamos-manager,
  steam-runtime-tools, steam-devices, GameNetworkingSockets, umu-launcher, MangoHud, gamemode,
  steamroom. One Wine, one Proton, one DXVK: variants are remotes and fork branches
  (`ay gaming forks` lists them).
- Image infra: `infra/gaming/` (downloads manifest of the proprietary pieces, image sources).

## Procedure

1. Host view: `ay gaming status` (Steam root, apps, compat tools, Vulkan, DirectX, steamcmd).
2. Proton builds and their DXVK / vkd3d-proton DLLs: `ay gaming proton`.
3. Vulkan: `ay gaming layers` (ICD and layer manifests from the loader search paths;
   `--info` adds `vulkaninfo --summary`, which is the driver view on Windows).
4. DirectX: `ay gaming dx` (DXGI adapters and D3D12 runtime files on Windows, Agility SDK
   `D3D12/D3D12Core.dll` per installed game).
5. Headless Proton on Linux (prd, fr1), reproducible:
   - `ay gaming steamcmd install` (official bootstrap from `infra/gaming/downloads.toml`, size checked);
   - `ay gaming steamcmd app-update proton-experimental --dir /srv/steam/proton-exp` (`--user <account>`
     uses steamcmd's cached login; no password on the command line; `--dry-run` prints the script);
   - `ay gaming run <exe> --prefix /srv/pfx/<app> --tool-path /srv/steam/proton-exp [--app <id>] [-- args]`:
     umu-run when installed, else `<proton>/proton waitforexitandrun` with `ay steam env`; `--dry-run`.
   On Windows `ay gaming run` starts the exe natively.
6. Upstream updates of the forks: `ay upstream status` (stacks in `infra/upstream/stacks.toml`, daily timer).

## Rules

- Proprietary pieces are never committed or redistributed: Steam client, steamcmd, Steam Runtime
  images, Proton binaries from Steam, Steamworks SDK. Only wrappers, the official download manifest,
  docs and skills live in the repo.
- Credential files (`config.vdf`, `loginusers.vdf`, `local.vdf`, `ssfn*`) are refused by `ay steam vdf`.
- Never build on the workstation: CI, or fr1 with `nice -n 19`; on prd take the heavy lock and keep
  the load under nproc/2.

## Sources

- `third_party/umu-launcher/README.md` (WINEPREFIX, GAMEID, STORE, PROTONPATH)
- `third_party/Proton/proton` (`waitforexitandrun`), `third_party/Proton/Makefile` (files/lib/wine/dxvk, vkd3d-proton)
- `third_party/Vulkan-Loader/docs/LoaderLayerInterface.md`, `LoaderDriverInterface.md` (manifest search paths)
- `crates/steam-depot/src/proton.rs` (VALVE_PROTON_APPS, launch plan), `infra/gaming/downloads.toml`
