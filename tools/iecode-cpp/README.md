# IECODE C++ toolkit

This directory is the C/C++ surface of the unified IECODE workspace. Rust owns the canonical
portable capability API; C/C++ supplies native parsers, conversion tools and compatibility
implementations behind the common CMake/FFI boundary. IEVR/Victory Road runtime ownership stays
in the sibling `nie` workspace.

## Scope

- `src/`: C/C++ parsers, converters, CLI, decompilation helpers, and tests.
- `cmake/`, `CMakeLists.txt`, `vcpkg.json`: native build configuration.
- `bench/cpp/`: benchmark harness.
- `mods/strikers2013-xtreme/`: Kamek/CodeWarrior PowerPC sources of the Inazuma Eleven GO
  Strikers 2013 Xtreme mod. It is built with its own `build.py` toolchain, is outside the CMake
  source glob, and its managed playlist helper lives in `src/IECODE/Gui/PlaylistMaker`.

This repository contains no game dumps or generated VFS data.

## Build the native core

The vcpkg manifest keeps this package's dependencies in the opt-in `iecode-cpp` feature so
other workspace consumers do not install them accidentally. Enable that feature when
configuring CMake:

```powershell
cmake -S packages/iecode-cpp -B packages/iecode-cpp/build `
  -DCMAKE_TOOLCHAIN_FILE="$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" `
  -DVCPKG_MANIFEST_FEATURES=iecode-cpp
cmake --build packages/iecode-cpp/build --config Debug
```

Without `-DVCPKG_MANIFEST_FEATURES=iecode-cpp`, vcpkg sees an empty default feature set and
CMake later fails at the first required dependency (`CLI11`).
