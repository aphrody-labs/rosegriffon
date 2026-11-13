# aphrody-nie-launcher

Native host launcher, save/package tooling, EAC patch diagnostics, team export support, and mod package coordination for Inazuma Eleven: Victory Road.

This crate is host-only because it accesses files, SQLite, and OS services. The `nie` CLI aggregates its operations through `aphrody-nie-cli`.
