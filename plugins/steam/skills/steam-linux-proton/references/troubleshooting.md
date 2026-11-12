# Proton game does not start: checklist

Run in order on the Linux host. Stop at the first step that explains the failure.

1. Resolve paths with `app_paths <appid>`: install dir, `steamapps/compatdata/<appid>/pfx`, selected compat tool.
2. Confirm the manifest is installed: `read_vdf` on `appmanifest_<appid>.acf`, `StateFlags` must include 4 and not 2 (see `steam-client-windows`).
3. Confirm the tool and its runtime are installed: Proton 8-10 need `SteamLinuxRuntime_sniper` (app 1628350); Proton 11+ need Steam Linux Runtime 4.0 (steam-runtime README).
4. Set `PROTON_LOG=1 %command%`, launch once, read the tail of `~/steam-<appid>.log` (or `$PROTON_LOG_DIR`). Search for `err:`, missing DLLs, and Vulkan device creation errors.
5. Graphics: try `PROTON_USE_WINED3D=1` to separate DXVK from game issues; for D3D12 set `VKD3D_DEBUG=warn` and `VKD3D_LOG_FILE`. Check the 32-bit Vulkan driver is present (unverified for Arch package names).
6. Sync: try `PROTON_NO_FSYNC=1`, then `PROTON_NO_ESYNC=1`; on GE-Proton also `PROTON_NO_NTSYNC=1`.
7. NVIDIA-specific: `PROTON_HIDE_NVIDIA_GPU=1` or `PROTON_DISABLE_NVAPI=1` (Valve); `PROTON_ENABLE_NVAPI=1` (GE).
8. Switch build: Proton Experimental, then GE-Proton, then proton-cachyos.
9. Recreate the prefix as a last resort: back up `compatdata/<appid>/pfx/drive_c/users/steamuser` (saves), delete `compatdata/<appid>`, relaunch. Ask before deleting anything with non-cloud saves.
10. Anti-cheat titles also need the EAC (1826330) or BattlEye (1161040) runtime (`crates/bun-steam/src/proton.rs`).

Sources: Proton README (https://github.com/ValveSoftware/Proton), steam-runtime README, GE-Proton README, vkd3d-proton README, `crates/bun-steam/src/proton.rs`.
