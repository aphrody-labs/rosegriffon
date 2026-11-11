# NIE source ownership

NIE crates are grouped directly under `crates/nie/` and retain ownership of
their product capabilities. IECODE does not keep parallel placeholder crates
for NIE emulation, geometry, reverse engineering, SQL, task scheduling or video.

The imported NIE crates resolve their shared dependencies through the root Cargo
workspace. New shared behavior belongs in its existing product owner; introduce
a separate cross-product library only when it has a measured independent API
and implementation.
