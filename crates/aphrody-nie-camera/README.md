# aphrody-nie-camera

Port of the Inazuma Eleven: Victory Road camera RE package. It preserves the pure-Rust camera state/controller model, G4CM animation codec, typed camera configuration parsers, RE map and optional process-memory instrumentation. The `host` feature exposes SQLite indexing, process scan/read/write helpers, and the `nie-cam` CLI; those operations target a user-selected running game process and are not enabled in the format-only build.

```powershell
cargo build -p aphrody-nie-camera --no-default-features
cargo build -p aphrody-nie-camera --features host --bin nie-cam
```

The source package's license terms are retained in [LICENSE](LICENSE). This is a source-code migration; game binaries and copyrighted assets are not included.
