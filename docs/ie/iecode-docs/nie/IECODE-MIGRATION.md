# NIE migration boundary

NIE product code remains owned by the crates under `crates/nie/`. The former
small IECODE wrapper crates for geometry, task scheduling, video, SQL, generic
reverse engineering and emulator metadata are not dependencies of this tree.

NIE packages use their product owners directly. Shared capabilities should be
added to an existing NIE crate or imported from a maintained Aphrody owner with
a real implementation and a resolvable source path.

The commercial license is retained in [LICENSE](LICENSE). The local native FFI
owner is [aphrody-nie-ffi](../../crates/nie/aphrody-nie-ffi); its library target
is `iecode`. Root Bun membership does not include the former NIE web application
or its old JavaScript packages. Retained NIE docs are domain reference material,
not evidence that those hosts were migrated or deployed here.
