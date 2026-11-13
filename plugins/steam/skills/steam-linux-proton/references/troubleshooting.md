# Proton game does not start: checklist

Run in order on the Linux host. Stop at the first step that explains the failure.

1. Resolve paths with `app_paths <appid>`: install dir and `steamapps/compatdata/<appid>/pfx` (`packages/gaming/src/steam.ts` `appPaths`).
2. Confirm the manifest is installed: `read_vdf` on `appmanifest_<appid>.acf`, then decode `StateFlags` with the bit table in [../../steam-local-inspect/references/layout.md](../../steam-local-inspect/references/layout.md).
3. Confirm the tool and its runtime are installed: each Proton version needs its Steam Linux Runtime (mapping and app ids in [../SKILL.md](../SKILL.md), section 2).
4. Set `PROTON_LOG=1 %command%`, launch once, read the tail of `~/steam-<appid>.log` (or `$PROTON_LOG_DIR`). Search for `err:`, missing DLLs, and Vulkan device creation errors.
5. Graphics: try `PROTON_USE_WINED3D=1` to separate DXVK from game issues; for D3D12 set `VKD3D_DEBUG=warn` and `VKD3D_LOG_FILE`. Check the 32-bit Vulkan driver matches the GPU vendor (Arch note in [../SKILL.md](../SKILL.md), section 8).
6. Sync: try `PROTON_NO_FSYNC=1`, then `PROTON_NO_ESYNC=1`; on GE-Proton also `PROTON_NO_NTSYNC=1`.
7. NVIDIA-specific: `PROTON_HIDE_NVIDIA_GPU=1` or `PROTON_DISABLE_NVAPI=1` (Valve); `PROTON_ENABLE_NVAPI=1` (GE).
8. Switch build: Proton Experimental, then GE-Proton, then proton-cachyos.
9. Recreate the prefix as a last resort: back up `compatdata/<appid>/pfx/drive_c/users/steamuser` (saves), delete `compatdata/<appid>`, relaunch. Ask before deleting anything with non-cloud saves.
10. Anti-cheat titles also need the EasyAntiCheat or BattlEye runtime (app ids in [../SKILL.md](../SKILL.md), section 3).

Sources: Proton README (https://github.com/ValveSoftware/Proton), steam-runtime README (https://github.com/ValveSoftware/steam-runtime), GE-Proton README (https://github.com/GloriousEggroll/proton-ge-custom), vkd3d-proton README (https://github.com/HansKristian-Work/vkd3d-proton), Arch wiki Steam page (https://wiki.archlinux.org/title/Steam), `crates/steam-depot/src/proton.rs`.
