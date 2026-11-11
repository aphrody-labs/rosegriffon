# IECODE Homebrew CLI wrapper

This Bun command forwards its arguments to the native `aphrody-homebrew` backend. The backend
crate is expected at `crates/aphrody-homebrew/Cargo.toml`; it is not shipped in this package.

The wrapper searches for `aphrody-homebrew` on `PATH`. To select a specific installed
executable, set `IECODE_HOMEBREW_BINARY` to its path or command name. If the crate exists in
the workspace and no executable is installed, the wrapper runs it with Cargo. If none of
these backends is available, the command exits nonzero with the missing dependency path.

```powershell
$env:IECODE_HOMEBREW_BINARY = "<path-to-aphrody-homebrew>"
bun run homebrew -- doctor
```
