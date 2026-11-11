# IECODE .NET tooling

This source snapshot was migrated from `bun-os/apps/iecode-dotnet` for the IE/IEVR RE and modding workspace. It includes the core formats/crypto/archive code, CLI, FFI, asset viewers, save editor, map tools, IEVR mod manager, and tests. Source references and project structure are preserved.

Build-output directories (`bin/`, `obj/`) and Git metadata were omitted. The checked-in `Gui/IevrManager/cpk_list/*.bin` files are versioned game-format fixtures used by the mod manager and remain alongside the source. The upstream MIT license is included as [`LICENSE.upstream`](LICENSE.upstream).

The original project is multi-project .NET 10. It is preserved as source; it is not yet wired into the Bun/Cargo workspace build graph.
