# aphrody-nie-sql

Shared bounded SQL boundary for NIE host tools. It supports read-only SQLite file access, a conservative SQL read policy, parameterized PostgreSQL reads over TLS, and the SQLite/PostgreSQL migration registry used by host services. PostgreSQL connections set the server session read-only; development-only plaintext PostgreSQL access is explicit.

The crate is carried over from `bun-os/crates/aphrody-nie-sql` with its upstream license. It is native host infrastructure and is not used by the portable format parsers.
