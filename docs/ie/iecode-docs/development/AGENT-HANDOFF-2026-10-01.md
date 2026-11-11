<!-- SPDX-License-Identifier: Apache-2.0 -->

# Agent handoff — IEVR/IECODE side of the 2026-10-01 Aphrody session

A Claude lead session in the Aphrody monorepo changed GitHub, SQL and data
policy across the ecosystem. No IEVR/NIE source code was modified. This file
carries everything that concerns IECODE so Codex or agy can continue without
that session. The Aphrody-side handoff is
`~/aphrody/docs/plans/infra/sql-convergence-handoff.md`.

## Owner directives (binding for IECODE too)

- Never commit under an agent or model name; no `Co-Authored-By` or
  "Generated with" trailers. Commit identity `aphrody-code <contact@aphrody.com>`.
- No AI application or bot on GitHub repositories or organizations; no AI
  mentions in public products (site, bot, non-dev apps, SEO); never publicly
  detail internal libraries, MCP servers, skills, plugins or architecture.
- Every GitHub repository stays private until development is finished. The
  project is non-commercial during development; every licence is acceptable for
  now and is decided at distribution (keep recording licences in
  `LICENSES.md`/`THIRD_PARTY.md`).
- Autonomous (YOLO) execution, but within this repository's AGENTS.md layout,
  documentation classification (`docs/documentation.json`) and gates.

## GitHub state

- `aphrody-dev` is the owner account; `aphrody-code` is the legacy account.
  Both are authenticated in `gh` on WSL, vps and dbfr.
- `iecode`, `nie`, `iepy`, `iecode-cpp` and the IEVR-related forks remain under
  `aphrody-code` (not transferred; only `aphrody*` repos moved to
  `aphrody-labs`). All were set or confirmed **private** on 2026-10-01
  (`nie` and the public forks such as `bevy`, `wasmtime`, `winit`, `iced`,
  `dust`, `emu.nintendo.wii.gecko`, `idb-rs` were public and are now private).
  Transferring IECODE repos to `aphrody-labs` is an open owner decision.
- `origin` here is `https://github.com/aphrody-code/iecode.git` (HTTPS through
  `gh auth git-credential`). SSH alias `github-dev` exists for aphrody-dev; the
  `aphrody-code` SSH key is not registered (token lacks `admin:public_key`).

## SQL and data policy that applies here

Decision record: `~/aphrody/docs/decisions/infra/sql-convergence.md`.

- SQLite writes only with an engine ≥ 3.51.3 (bundled rusqlite 0.40 / Bun
  3.53.2); the system `sqlite3` 3.45.1 must not write WAL databases.
- Rust: `rusqlite` bundled + `sqlite-vec` 0.1.9; `tokio-postgres` +
  `deadpool-postgres` + rustls for PostgreSQL; no sqlx/sea-orm in a workspace
  that already links rusqlite 0.40. The shared Aphrody crate `aphrody-sql`
  (`~/aphrody/crates/infra/sql`) is the intended owner once validated.
- Only two production PostgreSQL databases remain: `rg` (vps) and
  `shenron_site` (dbfr). Training metadata goes to the Neon project `aphrody`
  (empty until its code and migrations exist).

## Files in this checkout touched by the policy

| Path                         | Note                                                                                                                                                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `var/rg-latest.dump` (27 MB) | RG PostgreSQL dump, byte-identical to `vps:/var/backups/postgres/rg-2026-10-01T03-15.dump`. It does not belong to IECODE; the Aphrody dedup worker may remove it once the unique backup (`~/.aphrody/private/backups/aphrody-unique/2026-10-01/`) is verified. Do not depend on it. |
| `var/mirror.sqlite` (180 MB) | Not RG/Shenron data; untouched by the session. Classify its owner before any cleanup.                                                                                                                                                                                               |

## Next steps for IECODE agents

1. Check `~/aphrody/docs/operations/infra/db-dedup-2026-10-01.md` for the final
   fate of `var/rg-latest.dump`.
2. When IECODE adds or changes SQLite/PostgreSQL code, follow the decision
   record above and prefer `aphrody-sql` once it passes the Aphrody lead's Cargo
   checks.
3. Keep the root ledger (`PLAN.md`) and `docs/REMAINING-WORK.md` as the source
   of priorities; this handoff adds no new IEVR feature work.
