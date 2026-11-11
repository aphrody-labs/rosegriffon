# IECODE C++ unification

## One build surface

`iecode_native` is the single native aggregation target. It depends on exactly
two CMake components:

| Component    | Source owner                       | Output role                                                       |
| ------------ | ---------------------------------- | ----------------------------------------------------------------- |
| `iecode_cpp` | `src/iecode-cpp`                   | Portable IECODE parsers, formats, VFS, conversion and CLI support |
| `melonds`    | `src/iecode-cpp/emulation/melonds` | Pinned GPL Nintendo DS runtime subsystem                          |

The root `iecode` target depends on `iecode_native`, root Cargo workspace
tests and .NET solution tests. It does not explicitly build a separate Rust
IECODE CLI or package the NIE FFI artifact. This gives every native consumer one target and one root vcpkg
manifest without pretending that incompatible source ownership is a shared
library.

## Source boundary

`src/iecode-cpp` is the managed owner for the native IECODE toolkit. Imported
Rust-fork support sources retain the locations their manifests consume. Its
`emulation/melonds` subtree retains a pinned upstream GPL source
snapshot and its notices; local integration adaptations must remain documented. The old WinDS/DS32 duplicate tree was removed from the checkout and
remains available only through Git history.

This boundary removes duplicate emulator trees while preserving a reviewable
upstream update path. The combined native emulator artifact is GPL-family
licensed; portable interfaces remain explicit through the Rust/C ABI or a
documented C++ adapter with fixtures.

## Build and validation

```sh
cmake --preset unified
cmake --build --preset unified --parallel 2
cmake --build build/unified --target iecode_native --parallel 2
```

The headless configuration intentionally sets `BUILD_QT_SDL=OFF`,
`ENABLE_OGLRENDERER=OFF`, and `ENABLE_GDBSTUB=OFF` for melonDS. Qt/SDL remains
an explicit vcpkg feature, never an implicit dependency of the portable build.

## Rules for future C++ work

- Preserve existing native game-format, archive, VFS and conversion owners.
  New portable shared behavior defaults to Rust; expose it through an explicit
  ABI instead of adding a duplicate native implementation.
- Keep upstream revision and local integration changes documented for
  `emulation/melonds`; retain GPL notices and review updates against fixtures.
- Do not revive the removed WinDS/DS32 tree as a build input.
- Add a test or ABI fixture before moving a capability across language owners.
