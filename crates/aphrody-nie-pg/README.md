# aphrody-nie-pg

Decodes Inazuma Eleven: Victory Road `cfg.bin` assets into typed RDBN/T2B rows without a JSON intermediate. The default library feature is offline and database-free; enable `postgres` to build the transactional PostgreSQL importer and `aphrody-nie-pg` CLI.

```sh
cargo check -p aphrody-nie-pg
cargo check -p aphrody-nie-pg --features postgres
cargo run -p aphrody-nie-pg --features postgres -- --help
```

The importer stores only in schema `nie`, uses SHA-256 to skip unchanged files and applies each file transactionally. The upstream CLI uses `NoTls`, so use it only with a local trusted PostgreSQL endpoint. The decoder itself is available through `decode` with no database dependency.
