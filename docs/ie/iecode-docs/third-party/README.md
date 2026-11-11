# Third-party documentation and notices

This is the documentation index for external and upstream code included in
IECODE. The root [`THIRD_PARTY.md`](../../THIRD_PARTY.md) is the operational
component inventory and [`LICENSES.md`](../../LICENSES.md) records license
obligations. Keep both files at the repository root because the license audit
and repository entry points consume them there.

## Documentation

- [`Emulator and domain upstream references`](../upstream/README.md)
- Bevy/wgpu fork history, build tools and engine documentation are maintained
  in the independent archived GPU research repository, not IECODE.
- [`Gecko documentation`](../gecko/)
- [`Ruzu operational guides`](../ruzu/)
- [`Lua source documentation`](../lua-src/)

## Notices kept beside source

Source-level notices remain with retained emulator imports and
`src/iecode-cpp/third_party/`. Notices for emulator source merged into
`crates/emu/` live in [`docs/licenses/`](../licenses/). Bevy package manifests
and registry dependency metadata declare their dual license. The root license checks cover active source roots.
Example and fixture READMEs stay beside their assets.
