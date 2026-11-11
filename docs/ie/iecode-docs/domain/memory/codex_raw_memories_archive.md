# Raw Memories

Merged stage-1 raw memories (stable ascending thread-id order):

## Thread `01a079e6-95af-7e91-b897-7e4cc2ec28f7`

updated_at: 2026-09-07T03:43:14+00:00
cwd: \\?\C:\Users\aphro\niers
rollout_path: C:\Users\aphro\.codex\archived_sessions\rollout-2026-09-07T05-25-49-01a079e6-95af-7e91-b897-7e4cc2ec28f7.jsonl
rollout_summary_file: 2026-09-07T03-25-49-jFcP-yolo_install_improve_and_codex_cleanup.md

---

description: YOLO was installed globally and improved/tested successfully; Codex cleanup removed most optional state but remains blocked by locked SQLite databases and Git caches.
task: install and improve YOLO, then purge Codex local plugins/MCP/skills/history state
task_group: codex-environment-maintenance
task_outcome: partial
cwd: C:\Users\aphro\niers
keywords: YOLO, yolo-grind.ts, bun, recursive-scan, Codex, plugins, MCP, skills, memories, sessions, SQLite-lock, clean-agents.md
---

### Task 1: Install and improve YOLO

task: Install YOLO globally from the pinned GitHub commit, test it on `niers`, and improve the local YOLO repository.
task_group: YOLO installation and runner maintenance
task_outcome: success

Preference signals:

- The user explicitly requested global Codex installation, real testing on `niers`, and direct improvement in the local repository -> future runs should execute the full install/test/improve workflow rather than only provide instructions.
- The user’s request implied autonomous execution; the rollout used local tooling proactively and avoided creating commits unless requested.

Reusable knowledge:

- The pinned commit `e484d770b47d2b6ab8e4ecf7d858bacdcd48d9b2` resolved to `origin/main` and was installed at `C:\Users\aphro\.codex\skills\yolo`.
- The installed `SKILL.md` hash matched the pinned Git object: `eb7498be1947df5db037f0f61921408139f8ef5e`.
- Initial `yolo-grind.ts` scanned only root entries, missing nested `crates`, `apps`, and `packages`. It was changed to recursively scan up to 10,000 files while excluding `.git`, `.coord`, `.turbo`, `node_modules`, `target`, `var`, `dist`, `build`, and `coverage`.
- The runner now exports `detectPolyglot`, `parseOpenTasks`, and `runGrind`; `runGrind(root)` resolves paths without changing the caller’s working directory, and extension checks are case-insensitive.
- `bun run verify` completed with typecheck success and 49 tests passing, 0 failing. The `niers` scan detected 18 language families and did not modify the `niers` Git worktree.

Failures and how to do differently:

- The standard Python launcher `py -3` was unavailable on Windows; `uv run --no-project python ...` successfully ran the Codex skill installer.
- The installer URL form required an explicit path; using `--repo aphrody-code/YOLO --path . --ref e484d770... --name yolo` succeeded.
- The first added discovery test incorrectly assumed the YOLO repository itself contained `Cargo.toml`; it was corrected to use a temporary nested fixture.

References:

- Install command: `uv run --no-project python C:\Users\aphro\.codex\skills\.system\skill-installer\scripts\install-skill-from-github.py --repo aphrody-code/YOLO --path . --ref e484d770b47d2b6ab8e4ecf7d858bacdcd48d9b2 --name yolo`
- Modified files: `C:\Users\aphro\YOLO\scripts\yolo-grind.ts`, `C:\Users\aphro\YOLO\tests\yolo.test.ts`
- Validation command: `bun run verify`

### Task 2: Purge Codex local state

task: Reduce Codex global usage by removing optional plugins, MCP servers, skills, memories, session history, persona, and global context while preserving authentication and the user worktree.
task_group: Codex local-state cleanup
task_outcome: partial

Preference signals:

- The user asked to purge plugins, MCP, skills, memory, session history, “soul/persona” and global context -> future cleanup should inventory these categories explicitly and report exact retained exceptions.
- The user asked to document all remaining work in `clean-agents.md` -> blockers and exact paths should be written to a durable repository file, not only reported conversationally.

Reusable knowledge:

- The cleanup removed optional plugin caches/marketplaces, custom skills, memories directory, archived and old sessions, history JSONL/index/import files, OAuth lock files, global-state backups, custom MCP configuration, persona/avatar/suggestion/import settings, and global `AGENTS.md`.
- Configuration was reduced to the OpenAI-bundled core plugin blocks and `node_repl`; authentication and core queue/state files were preserved.
- The current session file was preserved: `C:\Users\aphro\.codex\sessions\2026\09\07\rollout-2026-09-07T05-25-49-01a079e6-95af-7e91-b897-7e4cc2ec28f7.jsonl`.
- WinClean’s `delete_path` was the successful native deletion route after direct PowerShell deletion was blocked by policy.
- Remaining locked files include `thread_history_1.sqlite` and WAL/SHM files, `logs_2.sqlite` and WAL/SHM files, `memories_1.sqlite` and WAL/SHM files, and `goals_1.sqlite` and WAL/SHM files. Non-core Git caches remained under `plugins\cache\claude-plugins-official`, `plugins\cache\ghidra-suite-marketplace`, and `.marketplace-plugin-source-staging`.
- Process inventory showed `codex.exe` PID 26056 and `codex-code-mode-host.exe` PID 29840. Repeated deletion attempts returned sharing violations/access denied, so the processes were not forcibly terminated.

Failures and how to do differently:

- Do not force-kill the active Codex process or bypass Windows security controls to remove locked databases. Fully exit Codex, then retry deletion using exact absolute paths.
- The cleanup is not complete until the locked SQLite files and Git caches are absent and a final inventory confirms only intended core components remain.

References:

- Remaining-work file: `C:\Users\aphro\niers\clean-agents.md`
- Exact blocker: `The process cannot access the file ... because it is being used by another process.`
- Official retention evidence used: OpenAI Help Center article “How to archive and delete Codex chats in the ChatGPT app”; deleted chats are unrecoverable locally and may take up to 30 days for server-side deletion.

## Thread `01a07a15-1fef-7590-888c-0477805bdb84`

updated_at: 2026-09-07T05:29:34+00:00
cwd: \\?\C:\Users\aphro\winclean
rollout_path: C:\Users\aphro\.codex\sessions\2026\09\07\rollout-2026-09-07T06-16-39-01a07a15-1fef-7590-888c-0477805bdb84.jsonl
rollout_summary_file: 2026-09-07T04-16-39-JSFm-winclean_skills_cleanup_commit_push_main_consolidation.md

---

description: Cleaned WinClean skills/configuration, committed a very large prepared repository state, pushed it, and consolidated Dependabot PRs into a new default main branch.
task: winclean repository cleanup, plugin configuration, commit/push, branch and PR consolidation
task_group: winclean-git-and-plugin-maintenance
task_outcome: success
cwd: C:\Users\aphro\winclean
keywords: winclean, skills, plugin-validation, claude-mcp, codex-plugin, git-commit, git-push, dependabot, main, release.yml, merge-conflict
---

### Task 1: Skills and context cleanup

task: Remove non-Windows/non-WinClean skills and normalize repository skill context.
task_group: repository-hygiene
task_outcome: partial

Preference signals:

- The user asked to remove all skills/context outside Windows, C#, WinClean, computer use, PowerShell, AOT, C++, Microsoft, MCP, and A2A -> similar cleanup requests should first produce a precise deletion manifest and explicitly flag destructive scope.

Reusable knowledge:

- An overly broad regex cleanup deleted valid `SKILL.md` content; restoring affected directories from `HEAD` recovered the files. Use structure-aware edits and validate file counts/content after automated cleanup.
- Plugin validation succeeded with `claude plugin validate plugins/winclean` and `claude plugin validate plugins/pwsh`.

Failures and how to do differently:

- Do not run broad “remove everything after heading” regexes over heterogeneous Markdown skills.

References:

- Remaining skills were primarily under `plugins/winclean/skills` and `plugins/pwsh/skills` for Windows, C#, C++, PowerShell, Microsoft, MCP, and reverse-engineering topics.

### Task 2: Commit and push

task: Commit and push the prepared repository state.
task_group: git-release
task_outcome: success

Preference signals:

- User said `commit etpush` -> after checking branch/remote, proceed with commit/push but warn before publishing unusually large mixed changes.

Reusable knowledge:

- Branch/remote: `master` -> `origin` (`https://github.com/aphrody-code/winclean.git`).
- Commit: `e46b1b05` / `feat: unify WinClean stack and refresh tooling`.
- Push verified local and remote `master` matched.
- `.coord/heartbeat-winclean.txt` was intentionally left untracked.

Failures and how to do differently:

- The commit contained about 16,702 files and 5.3 million deletions. Treat this scale as a confirmation trigger in future runs.

References:

- `git push origin master`
- Final pushed SHA: `e46b1b050458a48f0cd4f96cf0c304bdfd63a0fa`

### Task 3: Merge PRs and branches into main

task: Merge all branches/PRs and divergence into `main`.
task_group: github-branch-consolidation
task_outcome: success

Preference signals:

- User explicitly requested merging all branches, PRs, and divergence into `main` -> complete the GitHub-side consolidation, not just a local merge.

Reusable knowledge:

- Created and pushed `main`; merged Dependabot PRs #1–#5.
- Conflict in `.github/workflows/release.yml` was resolved by keeping `actions/checkout@v6` and `actions/download-artifact@v8`.
- GitHub would not retarget PRs already fully contained in `main`; merging them into `master` first, then merging `origin/master` into `main`, resulted in all PRs marked `MERGED`.
- Final default branch and remote synchronization verified: `main` at `abb43a30fe7c415f6b01c40645a62556d16d2761`, `origin/HEAD -> origin/main`, and `origin/master` is an ancestor of `main`.

Failures and how to do differently:

- `git push -u origin main` initially failed due to a tool invocation syntax error; retrying with a correctly formed command succeeded.
- GitHub PR retargeting failed with “There are no new commits between base branch 'main' and head branch”; use merge-into-original-base then integrate that base history into `main`.

References:

- Conflict file: `.github/workflows/release.yml`
- Final branch check: `git ls-remote --symref origin HEAD refs/heads/main refs/heads/master`
- PRs: #1 checkout v6, #2 setup-python v6, #3 download-artifact v8, #4 cache v5, #5 upload-artifact v7

## Thread `01a07a35-e412-7c11-9ef1-f3597bd2b8d0`

updated_at: 2026-09-07T05:49:58+00:00
cwd: \\?\C:\Users\aphro\niers
rollout_path: C:\Users\aphro\.codex\sessions\2026\09\07\rollout-2026-09-07T06-52-27-01a07a35-e412-7c11-9ef1-f3597bd2b8d0.jsonl
rollout_summary_file: 2026-09-07T04-52-27-AAzC-niers_plan_execution_and_legacy_toolchain_migration.md

---

description: Large niers plan execution and IECODE C++/.NET removal; build gates passed, but feature-parity/no-loss assurance remained unverified
task: execute PLAN.md and prove no feature loss after removing legacy IECODE trees
task_group: niers monorepo migration and verification
task_outcome: partial
cwd: C:\Users\aphro\niers
keywords: PLAN.md, IECODE-MIGRATION, Rust, Bun, C++, C#, cargo, clippy, bun, Windows DLL lock, feature parity, legacy removal
---

### Task 1: Execute plan gates and repair cross-platform test issues

task: Run the active plan’s verification gates and fix actionable failures.
task_group: niers build/test workflow
task_outcome: partial

Preference signals:

- The user required all of `PLAN.md` to be completed and marked closed -> future agents must audit every explicit requirement and not redefine success around passing subsets.

Reusable knowledge:

- `nie-cli` is bin-only: `cargo test -p nie-cli --lib --tests` reports `no library targets found`; use `cargo test -p nie-cli --bins --tests`.
- `nie_ffi.dll` was locked by Bun PID `30012`; `tasklist /m nie_ffi.dll` identified it. Stopping that specific PID allowed `cargo build -p nie-ffi` to finish.
- Windows Bun tests must not assume POSIX `rm`/`mkdir`; replacing those with `node:fs/promises` fixed the shell portability issue. Symlink tests correctly skip when Windows `ln -sfn` copies instead of creating a link.
- Verified gates included `cargo test -p nie-site --lib --tests` (316 passed, 1 ignored; 21 integration passed), `cargo clippy -p nie-cli --bins --tests -- -D warnings`, `cargo check --workspace --tests`, Bun typecheck, Bun tests, and docs check.

Failures and how to do differently:

- The plan still contained open/incomplete items and user decisions; passing selected gates did not prove the whole plan complete.
- Bun aggregate tests initially failed on no-test packages, a bridge handshake race, POSIX cleanup commands, and SQLite handle cleanup; these were fixed, but the full-plan status remained broader than the repaired tests.

References:

- `tasklist /m nie_ffi.dll` -> `bun.exe 30012 nie_ffi.dll`.
- `cargo test -p nie-cli --bins --tests` -> 20 passed, 0 failed.
- `bun run docs:check` -> 302 Markdown files, 222 internal links, 0 failures.

### Task 2: Remove legacy IECODE toolchains and document migration

task: Remove tracked C++/.NET trees and legacy delegation/build workflows while preserving niers capabilities.
task_group: repository migration and architecture documentation
task_outcome: partial

Preference signals:

- When the user asked “assure moi que niers nesubit aucuneperte en termede feature”, this indicates feature preservation must be explicitly demonstrated with a capability-by-capability matrix, not inferred from green builds.

Reusable knowledge:

- Commits `c17b9c0c` and `7fdf6040` removed the tracked C++/C# trees, CMake/vcpkg/.NET files, benchmarks, `nie-cli` delegation, and the source-rename helper.
- `git ls-files src csharp bench/cpp bench/cs cmake CMakeLists.txt CMakePresets.json IECODE.sln NuGet.config vcpkg.json` returned `legacy_tracked=0` after migration.
- Rust/Bun tests and typechecks passing prove current-tree health, not parity with removed implementations.
- `docs/IECODE-MIGRATION.md` and `PROVENANCE.md` were introduced/updated as the migration ledger, but the rollout did not independently verify their completeness against every removed command, API, parser, and test.

Failures and how to do differently:

- Do not claim “no feature loss” from deletion plus compilation. Before removal, inventory every legacy command/API/test/format; map each to a maintained Rust/Bun owner; run equivalent behavioral tests; archive or verify the historical repositories; then compare the inventories after removal.
- The transcript did not provide authoritative verification that the claimed historical repositories were actually pushed, so remote archival should be treated as unverified until checked.
- The final user assurance task was effectively incomplete: the agent began an audit but produced no completed feature-parity evidence before the context ended.

References:

- Commit: `c17b9c0c Retire legacy IECODE toolchains` (`902 files changed`, `140281 deletions`).
- Commit: `7fdf6040 Remove obsolete legacy workflow helpers`.
- User wording: `assure moi que niers nesubit aucuneperte en termede feature`.
- Critical distinction: `legacy_tracked=0` proves removal only; it does not prove feature equivalence.

## Thread `01a07a59-12db-7192-8a32-7d708cdbfdc9`

updated_at: 2026-09-07T06:18:14+00:00
cwd: \\?\C:\Users\aphro\winclean
rollout_path: C:\Users\aphro\.codex\sessions\2026\09\07\rollout-2026-09-07T07-30-53-01a07a59-12db-7192-8a32-7d708cdbfdc9.jsonl
rollout_summary_file: 2026-09-07T05-30-53-VRs5-winclean_linux_crossplatform_migration_and_vps_packaging.md

---

description: WinClean was extended with a verified Ubuntu/Linux cross-platform slice and deployment packaging; actual OVH deployment remained blocked by missing SSH target details.
task: cross-platform WinClean migration and Ubuntu NativeAOT deployment preparation
task_group: winclean-crossplatform-linux
task_outcome: partial
cwd: C:\Users\aphro\winclean
keywords: Ubuntu-24.04, WSL2, .NET 10, PowerShell 7, NativeAOT, linux-x64, MCP stdio, systemd, OVH, SSH, Build-Linux.ps1
---

### Task 1: Update and verify PLAN.md

task: establish an evidence-backed WinClean refactor baseline
task_group: repository-planning
task_outcome: success

Reusable knowledge:

- `PLAN.md` was updated with verified repository facts: 80 tracked C# files, 15 projects after additions, Windows solution membership, standalone projects, build/test baseline, and Linux checkpoint.
- Windows verification: Core/MCP/CLI Debug builds passed with 0 warnings/errors; Windows tests passed 68 with 2 registry-dependent skips.

Failures and how to do differently:

- The first patch misplaced a JSON observation after the baseline section; inspect Markdown structure after automated patching.

References:

- `PLAN.md`
- `dotnet test src/Winclean.slnx -c Debug --no-restore --verbosity minimal`

### Task 2: Implement Ubuntu/Linux support

task: add native Linux Core, CLI, tests, and MCP support without breaking Windows
task_group: cross-platform-dotnet
task_outcome: success

Preference signals:

- User explicitly requested a Windows 11 + Linux monorepo with Ubuntu/WSL as the first target -> preserve separate OS adapters and do not expose Windows-only APIs as portable behavior.

Reusable knowledge:

- Added `src/Winclean.Mcp.Linux` as a separate NativeAOT stdio server; the existing Windows MCP remains Windows-specific.
- Linux Release build via `scripts/build/Build-Linux.ps1` completed with 0 warnings/errors across seven projects; five Linux tests passed.
- `Winclean.Cli.Legacy` now uses Linux adapters and reports Windows-only commands safely instead of invoking them.
- Microsoft Learn confirmed Ubuntu package installation for .NET 10, Microsoft-repository installation for PowerShell 7, Linux-side project placement for WSL performance, and RID-specific NativeAOT publishing.

Failures and how to do differently:

- CA1812 initially failed the Linux MCP build; annotate SDK-discovered MCP tool classes with the appropriate suppression.
- `InternalsVisibleTo` must be placed in an MSBuild `ItemGroup`, not a `PropertyGroup`.

References:

- `src/Winclean.Mcp.Linux/Program.cs`
- `src/Winclean.Mcp.Linux/Winclean.Mcp.Linux.csproj`
- `src/Winclean.Tests.CrossPlatform/`
- `scripts/build/Build-Linux.ps1`

### Task 3: Package and deploy to OVH

task: prepare and validate Linux runtime deployment, then deploy to the real VPS
task_group: linux-deployment
task_outcome: partial

Preference signals:

- User clarified the target is “ubuntu direct ovh”, not Ubuntu WSL -> distinguish local WSL validation from the real OVH host in all future status reports.

Reusable knowledge:

- `scripts/deploy/package-linux.sh` publishes the CLI and Linux MCP NativeAOT binaries, runs `test-linux-mcp.sh`, and creates a tarball.
- `scripts/deploy/install-linux-runtime.sh` installs user-local timestamped releases and switches `~/.local/lib/winclean/current`; it does not alter system services, firewall, or credentials.
- `scripts/deploy/test-linux-mcp.sh` keeps stdin open via a Bash coprocess, sends a newline-delimited JSON-RPC `initialize`, and verifies a response containing `winclean-linux`.
- Archive, ELF, CLI, install, and MCP smoke tests passed in Ubuntu-24.04 WSL2.

Failures and how to do differently:

- Real OVH deployment was not completed because no usable SSH host/account was available. Windows SSH key files existed, but WSL had no SSH config or host alias. Obtain the VPS hostname/IP and SSH username before attempting `scp`/`ssh`; never infer or invent them.

References:

- `scripts/deploy/package-linux.sh`
- `scripts/deploy/install-linux-runtime.sh`
- `scripts/deploy/test-linux-mcp.sh`
- Passing output: `MCP stdio initialize smoke passed.`
- Suggested remote command: `ssh <user>@<vps-host> ~/.local/bin/winclean-mcp-linux`

## Thread `01a07a87-0888-7850-9940-4dbba2ae3bca`

updated_at: 2026-09-07T08:25:02+00:00
cwd: \\?\C:\Users\aphro\bxc
rollout_path: C:\Users\aphro\.codex\sessions\2026\09\07\rollout-2026-09-07T08-21-05-01a07a87-0888-7850-9940-4dbba2ae3bca.jsonl
rollout_summary_file: 2026-09-07T06-21-05-HYMi-bxc_cleanup_release_v099_partial_deploy.md

---

description: Bxc cleanup and v0.9.9 release completed locally and pushed, but npm publication, GitHub artifacts, and VPS synchronization were blocked by external credentials/infrastructure issues
task: bxc repository cleanup, package workspace consolidation, release bump, npm publish, GitHub release, VPS deploy
task_group: C:\Users\aphro\bxc release workflow
task_outcome: partial
cwd: C:\Users\aphro\bxc
keywords: bxc, bun, workspaces, rust-bridge, zigquery, npm, GitHub Actions, billing lock, 2FA, VPS, SSH timeout, v0.9.9
---

### Task 1: Repository cleanup and workspace normalization

task: audit and clean Bxc repository structure, remove stale generated package directories, and make workspaces explicit
task_group: repository cleanup
task_outcome: success

Preference signals:

- The user explicitly requested deduplication/removal of obsolete docs, vendors, submodules, and package consolidation; future runs should inventory first and distinguish tracked source from ignored generated residue.

Reusable knowledge:

- Repository root: `C:\Users\aphro\bxc`.
- No Git submodules and no `.gitmodules` were present.
- Six ignored directories contained only generated `node_modules` and were removed: `packages/frames`, `packages/fut`, `packages/ietv`, `packages/wonderbot`, `packages/worldbeyblade`, `packages/zukan`.
- Four explicit workspaces remain: `packages/next-playwright`, `packages/test`, `packages/x`, `packages/xai`.
- `src/ffi/zigquery.ts` is already a Rust-backed compatibility layer; avoid reviving the legacy ZigQuery build shim without evidence.

Failures and how to do differently:

- Several complex PowerShell one-liners failed with parser errors; simpler commands or `git clean -fdX -- <paths>` worked for ignored generated directories.
- Do not blindly merge divergent historical branches. `origin/windows` and `origin/win32` contained large divergent histories; `origin/master` was already ancestor-equivalent to `main`; no open PRs existed.

References:

- Commit: `b66f77c chore: make package workspaces explicit`
- Check command: `bun run workspace:check`
- Successful output: `Workspace layout OK (4 explicit packages; no Git submodules).`

### Task 2: Synchronized version bump and Git release

task: bump package versions, update release docs/changelog, commit, push main, and tag release
task_group: release management
task_outcome: success

Reusable knowledge:

- Versions used: `@aphrody/bxc@0.9.9`, `@aphrody/x@1.2.3`, `@aphrody/xai@1.1.3`, `@aphrody/bxc-test@0.2.3`, `@aphrody/next-playwright@0.2.3`.
- Internal dependency order for publication is `@aphrody/x`, `@aphrody/xai`, `@aphrody/bxc`, `@aphrody/bxc-test`, `@aphrody/next-playwright`.
- `bun scripts/publish-workspaces.ts --dry-run` performs topological ordering and registry checks.
- `bun pm pack --dry-run` verified a 230-file, 1.94 MB npm tarball for `0.9.9`.

References:

- Commit: `f764cb7 chore(release): bump packages to 0.9.9`
- Push verification: `origin/main` resolved to `f764cb7a57890035369a41b924aa784eb267829b`.
- Tag: annotated `v0.9.9`, dereferencing to `f764cb7`.
- Validation: `bun run typecheck` passed; `bun run lint` exited 0 with warnings; `bun run test` completed with `1068 pass / 14 skip / 0 fail`.

### Task 3: npm publication, GitHub release, and VPS deployment

task: publish all packages, trigger release artifacts, and synchronize/deploy the VPS
task_group: external release and deployment
task_outcome: fail

Preference signals:

- The user asked for “commit vraiment tout”, final push, deployment of all packages, and VPS synchronization; future agents should report each external side effect independently rather than treating local Git success as deployment success.

Reusable knowledge:

- GitHub Actions runs for tag `v0.9.9` were blocked because the account was locked for a billing issue; release artifacts were not built.
- Local npm publish attempted in topological order but failed on `@aphrody/x@1.2.3` with: `403 Forbidden ... Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.` It then correctly marked dependent packages blocked; `0 published, 5 failed`.
- SSH command `ssh -o BatchMode=yes -o ConnectTimeout=8 vps-tunnel ...` timed out: `ssh: connect to host vps-tunnel port 22: Connection timed out`.
- New package versions remained absent from npm after the failure.
- Credentials pasted into the conversation are compromised. Never save them to disk, memory, Git config, `.npmrc`, or use them; revoke and replace via secure GitHub/npm login flows.

Failures and how to do differently:

- Resolve GitHub billing/runners before rerunning `publish` and `release` workflows.
- Configure an npm granular token with 2FA bypass or use interactive web login; do not paste tokens into chat.
- Confirm a valid non-secret VPS hostname/SSH alias and local key authentication before running `scripts/bxc-control.sh deploy`.
- The canonical Linux VPS deploy path is documented in `DEPLOY.md`; do not attempt to claim VPS deployment from Windows without successful SSH and post-deploy checks.

References:

- Workflows: `.github/workflows/publish.yml`, `.github/workflows/release.yml`
- Deploy script: `scripts/bxc-control.sh deploy`
- Deploy guide: `DEPLOY.md`
- GitHub runs: `34099997442` (publish failed), `34099997398` (release cancelled after runner billing failure)

## Thread `01a07ab6-9148-7eb1-b8ad-3c40582c24ef`

updated_at: 2026-09-07T07:40:56+00:00
cwd: \\?\C:\Users\aphro\shenron
rollout_path: C:\Users\aphro\.codex\sessions\2026\09\07\rollout-2026-09-07T09-13-00-01a07ab6-9148-7eb1-b8ad-3c40582c24ef.jsonl
rollout_summary_file: 2026-09-07T07-13-00-6WoD-shenron_production_audit_cleanup_db_sync_deploy.md

---

description: Audit et livraison partielle de Shenron: validations locales et bot/MCP réussis, nettoyage des reliquats Drive/LLM, synchronisation PG↔SQLite vérifiée; build site encore non confirmé à la fin
task: production-readiness-audit-cleanup-db-sync-deploy
task_group: shenron-operations
task_outcome: partial
cwd: C:\Users\aphro\shenron
keywords: shenron, production-ready, Bun, CRLF, Turbopack, error-1450, systemd, drive-sync, shenron-llm, PostgreSQL, SQLite, neon-sync, neon-pull, blue-green, dbfr
---

### Task 1: Validation et build

task: auditer le dépôt et prouver la readiness
task_group: shenron-operations
task_outcome: partial

Reusable knowledge:

- `bun run lint` réussi avec 0 erreur; `bun run type-check` réussi 3/3; `bun run test:all` réussi 7 scopes/25 fichiers, avec tests live du site ignorés.
- CRLF cassait Bash sous Linux dans `apps/bot/scripts/build-dashboard-css.sh`; `.gitattributes` avec `*.sh text eol=lf` et `*.bash text eol=lf` corrige le problème.
- Une archive ignorée de 1,1 Go sous `var/remote-assets` déclenchait Turbopack error 1450; la déplacer hors du workspace permet au build de progresser.
- Le build site final n’était pas confirmé à la fin; ne pas annoncer production-ready sans slot nginx et healthchecks finaux.

Failures and how to do differently:

- `scripts/deploy-site.sh --pull` échouait en SSH non interactif avec `bun: not found`; le wrapper a été corrigé pour exporter `$HOME/.bun/bin` dans le commit `9cc3ab47`.

References:

- `96444de6` état initial; `9cc3ab47` correctif wrapper Bun.

### Task 2: Nettoyage des reliquats

task: supprimer les services/scripts réellement obsolètes
task_group: shenron-operations
task_outcome: success

Preference signals:

- L’utilisateur a demandé de supprimer « toutes trace » des services périmés; auditer les références et l’état systemd avant suppression est attendu, plutôt que supprimer les unités actives indistinctement.

Reusable knowledge:

- Suppression et push de `shenron-drive-sync.service`, `.timer`, script, docs et lien `docs/drive`; le VPS confirme `LoadState=not-found`.
- `shenron-llm.service` était inactif, désactivé, absent de `deploy/systemd` et explicitement hors production; supprimé du VPS, puis `LoadState=not-found`.
- Services encore utilisés/référencés (`relecture-ocr`, sync DB, players, stream-resolve, watchdog) ont été conservés.

References:

- Commit `403a5c2f`: reverse-sync robuste, suppression Drive-sync.
- Commit `11b687b2`: suppression des dernières traces Drive et LLM.

### Task 3: Synchronisation DB

task: synchroniser SQLite, PostgreSQL local et wiki replica
task_group: shenron-database-operations
task_outcome: success

Reusable knowledge:

- Arrêter `shenron-neon-sync.timer` et `shenron-neon-pull.timer` avant toute synchronisation.
- Forward SQLite→PG: `28 tables mirrorées · 34623 lignes · 0 mismatch`.
- Reverse PG→SQLite: `18 tables wiki traitées · 0 anomalie(s)`; compteurs vérifiés, notamment `db_characters 1323`, `db_planets 62`, `db_episodes 826`, `db_assets 1078`.
- Les noms `neon-*` sont historiques; `DATABASE_URL` confirmé local PostgreSQL. Les timers ont été réactivés et sont `active/waiting`, `enabled`.

References:

- `apps/bot/scripts/sync-sqlite-to-neon.ts`
- `apps/bot/scripts/sync-neon-to-sqlite.ts`
- `/home/ubuntu/.shenron-neon.env` (ne jamais afficher sa valeur)

### Task 4: Déploiement bot/MCP/site

task: déployer et sonder les services de production
task_group: shenron-deployment
task_outcome: partial

Reusable knowledge:

- Bot `403a5c2f`: `shenron.service` actif et `/auth/me` HTTP 200.
- MCP: `/health` HTTP 200 avec `upstream=ok`.
- Le site utilise un build bleu/vert avec `BUILD_CPUS=2 BUILD_STATIC_CONCURRENCY=4`; le build était encore actif à la fin, donc le résultat final du site reste non confirmé.

Failures and how to do differently:

- Attendre la fin de `deploy-site.ts`, puis vérifier le slot nginx actif, les deux unités site, homepage publique et endpoints avant de déclarer le déploiement réussi.

References:

- `scripts/deploy-shenron.sh --pull`
- `scripts/deploy-mcp.sh --pull`
- `scripts/deploy-site.sh`
- `9cc3ab47`

## Thread `01a07ae3-2094-7a22-8137-48cf566766af`

updated_at: 2026-09-07T11:07:46+00:00
cwd: \\?\C:\Users\aphro\niers
rollout_path: C:\Users\aphro\.codex\sessions\2026\09\07\rollout-2026-09-07T10-01-40-01a07ae3-2094-7a22-8137-48cf566766af.jsonl
rollout_summary_file: 2026-09-07T08-01-40-6rCv-niers_cleanup_migration_vps_deployment.md

---

description: Completed broad niers cleanup, migrated deployment to vps, repaired a stale post-migration systemd path, and refreshed nginx/APT with verified public health.
task: niers cleanup, monorepo VPS deployment, nginx apt refresh, migration service repair
task_group: niers-monorepo-vps-operations
task_outcome: success
cwd: C:\Users\aphro\niers
keywords: git-cleanup, PowerShell, ignored-files, blue-green-deploy, ssh-vps, nginx, apt, systemd, azalee-api, nie-site, nie-miroir
---

### Task 1: Cleanup and obsolete-file removal

task: Remove retired files/services and safely clean ignored artifacts.
task_group: repository-cleanup
task_outcome: success

Preference signals:

- The user repeatedly requested broad cleanup, deletion of obsolete docs/scripts, and commits; future cleanup should search references and commit verified batches.
- The user clarified to preserve useful assets/dumps while targeting test outputs, logs, caches, and duplicates; use preview-first cleanup with protected roots.

Reusable knowledge:

- 32 retired files were committed as `59bc0189`; stale service references were committed as `a25c18a4`.
- Safe ignored-file scan found 75,522 files, 1.75 GB, and 2,654 duplicate groups; the safe cleanup pass found 0 eligible deletions.
- Protected roots include `data`, `var`, `.venv`, `target`, `node_modules`, dumps, backups, and extracted assets.

Failures and how to do differently:

- Recursive deletion was blocked by policy; do not rely on direct destructive PowerShell commands.
- Bash validation using Windows absolute paths produced false failures; run from Git Bash/MSYS with relative paths.

References:

- `scripts/cleanup-var.ps1`
- `scripts/scan-gitignored.ps1`
- `scripts/cleanup-gitignored-safe.ps1`
- Commits: `e703f2c6`, `02e9b45a`, `491be19f`

### Task 2: Migration regression fix and VPS deployment

task: Deploy the migrated monorepo to SSH VPS and verify production.
task_group: deployment

task_outcome: success

Reusable knowledge:

- Use `bun scripts/ops/deploy.ts deploy all --keep=2` for blue/green deployment and bounded release retention.
- Deployment verified Azalée, Rosegriffon, `nie-site`, and `nie-model-serve` active; public health endpoints returned 200.
- `nie-miroir.service` is oneshot: `inactive/dead` after successful completion is normal. Successful extraction reported 219 tables and 165,249 rows.
- Aphrody health reported version 0.5.11, 255,308 VFS entries, 936 CPKs, and `vfs_contenu=true`.

References:

- Prior deployed revision: `e22368a848de447c67a1e42358ec8c7bd2c6f68e`
- `sprite_cell_id` fix in `crates/engine/nie-lua/src/menu_host.rs`

### Task 3: APT/nginx refresh and stale service repair

task: Refresh packages, purge nginx cache, restart nginx/services, and fix post-migration failures.
task_group: VPS-maintenance

task_outcome: success

Reusable knowledge:

- Always run privileged `sudo nginx -t`; unprivileged validation can falsely fail on certificate permissions.
- APT upgraded `libpfm4`; `libaudit*` remained phased and `nodejs` held back.
- After migration, `azalee-api` failed because its unit referenced missing `packages/azalee/src/server/main.ts`. The real entrypoint is `packages/azalee-tools/src/server/main.ts`.
- Final fix commit: `b124aa40 fix: point azalee api service at migrated package`; the unit was installed remotely and `azalee-api` became active.

Failures and how to do differently:

- PowerShell quoting around SSH commands caused parser errors and unreliable status output. Prefer carefully single-quoted remote commands and avoid local shell interpolation.

References:

- `deploy/systemd/azalee-api.service`
- `packages/azalee-tools/src/server/main.ts`
- Error: `Module not found "packages/azalee/src/server/main.ts"`
- Final verified services: nginx, azalee-api, azalee-web, website-web, nie-site, nie-model-serve all active.

## Thread `01a07afb-0bac-7403-82b6-3a3a41456d65`

updated_at: 2026-09-07T10:18:17+00:00
cwd: \\?\C:\Users\aphro\bxc
rollout_path: \\?\C:\Users\aphro\.codex\sessions\2026\09\07\rollout-2026-09-07T10-27-48-01a07afb-0bac-7403-82b6-3a3a41456d65.jsonl
rollout_summary_file: 2026-09-07T08-27-48-6NtH-bxc_deploy_npm_github_vps_sync.md

---

description: Déploiement BXC réussi sur VPS, publication npm complète, mais release GitHub v0.9.9 encore incomplète
task: deploy-and-publish-bxc-end-to-end
task_group: C:\Users\aphro\bxc / VPS production / npm / GitHub
task_outcome: partial
cwd: C:\Users\aphro\bxc
keywords: bxc-site, nginx, systemd, 127.0.0.1:8084, bxc-control.sh, ProtectHome, CRLF, npm, Bun, publish-workspaces, 2FA, GitHub release, v0.9.9, env.txt
---

### Task 1: Déploiement VPS et vitrine publique

task: deploy bxc-site and synchronize VPS
task_group: VPS production deployment
task_outcome: success

Preference signals:

- L’utilisateur a demandé de « configurer tout de bout en bout côté VPS et côté PC » -> pour des déploiements similaires, auditer les deux côtés et fournir des validations effectives.

Reusable knowledge:

- `bxc-site` écoute sur `127.0.0.1:8084`; nginx termine TLS.
- `scripts/deploy/bxc-site.service` exécute `/home/ubuntu/bxc/rust-bridge/target/release/bxc-site` sous `ubuntu`.
- Le service doit utiliser `ProtectHome=read-only`, pas `ProtectHome=true`, car le binaire est sous `/home/ubuntu`; `ProtectHome=true` a causé `status=203/EXEC`.
- `bxc-control.sh` en CRLF a causé `env: $'bash\\r': No such file or directory`; convertir en LF sur Linux avant exécution.
- Le déploiement recommandé est:
  `cd ~/bxc/rust-bridge && cargo build --release -p bxc-site --locked`
  `cd ~/bxc && ./scripts/bxc-control.sh deploy`

Failures and how to do differently:

- Vérifier le vhost réellement chargé avec `sudo nginx -T`; le routage initial de `bxc.aphrody.com` pointait vers `127.0.0.1:8083` et produisait `502`.
- Avant `git pull --ff-only` sur un checkout de production, préserver/committer les fichiers modifiés et non suivis.

References:

- VPS SSH: alias `ovh-vps-ubuntu-direct`, checkout `/home/ubuntu/bxc`.
- Fichiers: `scripts/deploy/bxc-site.service`, `scripts/deploy/nginx-bxc.conf`, `scripts/bxc-control.sh`, `docs/DEPLOY-BXC-SITE.md`.
- Final: services `bxc`, `bxc-crawler`, `bxc-site`, `nginx` actifs; nginx config valide; HTTPS routes `/healthz`, `/robots.txt`, `/.well-known/security.txt` retournent 200.

### Task 2: Configuration et publication npm/Bun

task: configure npm/Bun auth and publish workspaces
task_group: npm package publishing
task_outcome: success

Preference signals:

- L’utilisateur a indiqué que « le fix npm est dans documents.env » et a demandé un fix « durablement et globalement npm et bun » -> chercher ce fichier, utiliser le secret sans l’afficher, et configurer l’authentification au niveau utilisateur.

Reusable knowledge:

- `C:\Users\aphro\Documents\env.txt` est un fichier texte libre de 5 lignes, pas un dotenv standard; il contient une ligne identifiant un token npm.
- Le token a fonctionné après injection temporaire et a été configuré dans `C:\Users\aphro\.npmrc` ainsi que dans `NPM_CONFIG_TOKEN`, `NPM_TOKEN`, `BUN_AUTH_TOKEN` au niveau utilisateur.
- Les ACL du `.npmrc` ont finalement été limitées au compte Windows courant via PowerShell `Get-Acl`/`Set-Acl`; l’appel initial `icacls` avait une syntaxe invalide.
- `bun pm whoami --registry https://registry.npmjs.org` retourne `yohan971`.
- `bun scripts/publish-workspaces.ts` publie dans l’ordre topologique et a publié: `@aphrody/x@1.2.3`, `@aphrody/xai@1.1.3`, `@aphrody/bxc@0.9.9`, `@aphrody/bxc-test@0.2.3`, `@aphrody/next-playwright@0.2.3`.

Failures and how to do differently:

- Sans token, npm renvoie `403 Forbidden` avec: `Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.`
- Ne jamais stocker, afficher ou mémoriser le token; utiliser `[REDACTED_SECRET]`.

References:

- Résultat: `5 publié(s), 0 sauté(s), 0 en échec`.
- Vérification: `bun pm view @aphrody/bxc version --registry https://registry.npmjs.org` -> `0.9.9`.

### Task 3: README, GitHub et release

task: synchronize project documentation and GitHub metadata
task_group: repository synchronization and release
task_outcome: partial

Preference signals:

- L’utilisateur a demandé de synchroniser le README, l’URL du site et « tous les paramètres GitHub du repo avec l’état réel du projet » -> comparer les données distantes avant modification et revalider après.

Reusable knowledge:

- GitHub repo public: `https://github.com/aphrody-code/bxc`; default branch `main`; homepage `https://bxc.aphrody.com/`; non archivé.
- README mis à jour avec l’URL publique, la version stable `0.9.9`, et les liens npm/GitHub Releases.
- Paramètres observés: Issues/Projects/Wiki activés, Discussions désactivées, merge commit/rebase/squash autorisés, suppression automatique des branches désactivée.
- Le VPS a été synchronisé au commit `a546537`; sauvegarde des changements précédents: `/tmp/bxc-preserve-20260907101731`.
- La release `v0.9.9` n’est pas finalisée: `isDraft=true`, et la dernière vérification n’a trouvé qu’un asset `bxc-darwin-arm64`. Vérifier tous les uploads avant de publier la release.
- L’audit final a trouvé `packages/fut/` non suivi côté VPS/PC; clarifier cet élément avant prochain commit/publication.

Failures and how to do differently:

- Ne pas annoncer une release GitHub terminée tant que `gh release view v0.9.9 --json isDraft,assets` ne confirme pas les assets attendus et `isDraft=false`.

References:

- Release actuelle: `https://github.com/aphrody-code/bxc/releases/tag/untagged-9207c8ce888932634d40`.
- Vérification: `gh release view v0.9.9 --json isDraft,assets,url` -> brouillon, 1 asset observé.
- Site public final: `https://bxc.aphrody.com/healthz` -> `200 ok`; `/robots.txt` et `/.well-known/security.txt` -> `200`.

## Thread `01a07b12-8594-7871-829c-4f262e809e27`

updated_at: 2026-09-07T11:48:24+00:00
cwd: \\?\C:\Users\aphro\bxc
rollout_path: \\?\C:\Users\aphro\.codex\sessions\2026\09\07\rollout-2026-09-07T10-53-26-01a07b12-8594-7871-829c-4f262e809e27.jsonl
rollout_summary_file: 2026-09-07T08-53-26-NyJ1-bxc_site_portal_deployment_and_ssh_host_verification.md

---

description: Rewrote and deployed the BXC Rust/Axum product portal; established validated SSH/deployment workflow and real host aliases.
task: bxc-site-portal-deploy-and-ssh-verification
task_group: bxc deployment and infrastructure
task_outcome: success
cwd: C:\Users\aphro\bxc
keywords: bxc-site, axum, rust, downloads, self-update, package-manager, api-v1, systemd, nginx, dbfr, ovh-vps, vps, ssh, wsl
---

### Task 1: BXC public portal and distribution API

task: Rewrite `bxc-site` around real repo capabilities.
task_group: Rust/Axum product site
task_outcome: success

Preference signals:

- User requested cross-platform downloads, auto-update API, package-manager API, docs, Markdown, and vital APIs based on “le vrai code du repo” -> derive public claims from manifests, workflows, and actual CLI surfaces.
- User said to forget old references and verify “ovh-vps et dbfr dans ma config ssh” -> inspect live SSH config before deployment.

Reusable knowledge:

- `bxc-site` serves on `127.0.0.1:8084`; nginx is intended to terminate TLS.
- Portal routes include `/`, `/downloads`, `/docs`, `/docs/auto-update`, `/docs/package-manager`, `/docs/markdown`, `/docs/api`, `/version`, `/healthz`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and security.txt.
- `/api/v1/*` is read-only distribution metadata, Bearer-authenticated, and fails closed with `503` when `BXC_SITE_API_TOKEN` is unset; invalid tokens return `401`.
- Supported release targets: Linux x64/arm64, macOS x64/arm64, Windows x64.
- Validation passed: `cargo test -p bxc-site --locked` (10 tests), `cargo clippy -p bxc-site --all-targets --all-features --locked -- -D warnings`, format, diff check, release build, and local smoke test.

Failures and how to do differently:

- Initial `/downloads` test failed with 404 as expected; implement route before claiming completion.
- When editing large Rust HTML raw strings, ensure delimiter hashes are correct and run `cargo fmt` immediately.
- Add `serde` and `serde_json` to `bxc-site` when using JSON serialization.

References:

- `rust-bridge/crates/bxc-site/src/lib.rs`
- `rust-bridge/crates/bxc-site/src/site.css`
- `docs/DEPLOY-BXC-SITE.md`
- `scripts/deploy/bxc-site.service`
- Commits `7ea2564`, `a546537`

### Task 2: Remote deployment

task: Deploy and verify BXC site service.
task_group: VPS/systemd deployment
task_outcome: success

Reusable knowledge:

- Reachable host used was `dbfr`; checkout `/home/ubuntu/bxc`, user `ubuntu`.
- `dbfr` lacked Cargo, so WSL built the Linux binary; copy it to `~/bxc/rust-bridge/target/release/bxc-site`.
- Remote verification passed: service enabled/active, `/healthz=ok`, `/version` showed package `0.9.9` and site `0.2.1`, downloads page contained `bxc-windows-x64.exe`, API without token returned `503`.
- Do not enable nginx until TLS certificates and a valid vhost exist; certificates were absent and nginx only served its default site.

References:

- `ssh dbfr 'systemctl is-active bxc-site'`
- `site=active health=ok downloads=ok api_without_token=503`

### Task 3: SSH aliases and repo push

task: Verify exact SSH access and repository synchronization.
task_group: Git/SSH workflow
task_outcome: partial

Preference signals:

- User asked “tape juste ssh vps” -> execute the exact alias requested.
- Before remote mutations, verify aliases with `ssh -G`; do not trust stale deployment comments or `vps-tunnel`.

Reusable knowledge:

- Exact `ssh vps` succeeded and opened `ubuntu@vps-203bea89`.
- `ovh-vps` timed out in this rollout; `dbfr` was reachable.
- Main repo was clean, had no registered submodules, and `main` matched `origin/main`; no commit was needed. `git push --all` hung, while `git ls-remote --heads origin` worked.

References:

- `ssh vps`
- Successful prompt: `ubuntu@vps-203bea89:~$`
- `git status --short --branch` -> `## main...origin/main`

## Thread `01a07b3d-2173-7192-a4a2-f85ed356df31`

updated_at: 2026-09-07T09:59:47+00:00
cwd: \\?\C:\Users\aphro\.ssh
rollout_path: \\?\C:\Users\aphro\.codex\sessions\2026\09\07\rollout-2026-09-07T11-39-58-01a07b3d-2173-7192-a4a2-f85ed356df31.jsonl
rollout_summary_file: 2026-09-07T09-39-58-XkQN-ssh_vps_dbfr_transfer_monitoring_toolkit.md

---

description: Configuration validée de bout en bout pour SSH, SFTP/rclone, synchronisation, scans Nmap, monitoring et systemd sur deux VPS Ubuntu depuis Windows PowerShell.
task: configurer et documenter SSH/transferts/monitoring pour VPS et DBFR
task_group: windows-ssh-vps-administration
task_outcome: success
cwd: C:\Users\aphro\.ssh
keywords: OpenSSH, PowerShell, rclone, SFTP, Nmap, systemd, journalctl, sshd, Context7, dry-run, host_keys
---

### Task 1: SSH optimisé pour le VPS principal

task: configurer l’alias SSH `vps` et optimiser les paramètres client/serveur
task_group: windows-ssh-vps-administration
task_outcome: success

Preference signals:

- L’utilisateur a demandé d’« optimiser les perfs des deux côtés » et une configuration « de bout en bout » -> auditer les deux extrémités, appliquer des changements réversibles et fournir une validation observable.
- L’utilisateur préfère des commandes directement utilisables, avec alias courts et scripts PowerShell plutôt qu’une procédure manuelle longue.

Reusable knowledge:

- `C:\Users\aphro\.ssh\config` contient l’alias `vps` vers le VPS OVH, utilisateur `ubuntu`, clé `~/.ssh/ovh_vps`, `IdentitiesOnly yes`, `ConnectTimeout 10`, `ConnectionAttempts 2`, `TCPKeepAlive yes`, `ServerAliveInterval 60`, `ServerAliveCountMax 3`, `Compression no` et `IPQoS lowdelay`.
- Le serveur SSH a été validé avec `sshd -t`, rechargé sans coupure et configuré avec `UseDNS no`, GSSAPI désactivé, compression désactivée, `MaxSessions 32`, `MaxStartups 20:30:100` et keepalive serveur.
- Le multiplexage OpenSSH Windows (`ControlMaster auto`, `ControlPersist`, `ControlPath`) a produit `getsockname failed: Not a socket`; il a été supprimé. Ne pas le réintroduire sans test local.

Failures and how to do differently:

- Une commande SSH distante avec `$(date ...)` a été corrompue par l’échappement PowerShell. Utiliser des quotes simples autour des commandes shell distantes et minimiser les expansions imbriquées.

References:

- Test validé: `ssh -o BatchMode=yes vps "printf 'SSH_RESTORED\\n'; hostname; systemctl is-active ssh"`
- Sortie: `SSH_RESTORED`, `vps-203bea89`, `active`.
- Context7 utilisé avec `/openssh/openssh-portable` pour vérifier les options OpenSSH.

### Task 2: Transferts, synchronisation et outils VPS

task: installer et exposer des commandes Windows pour le VPS
task_group: windows-ssh-vps-administration
task_outcome: success

Reusable knowledge:

- Installation validée via winget: rclone `1.75.1` et Nmap `7.80`; OpenSSH, curl et tar étaient déjà disponibles.
- `C:\Users\aphro\bin\VpsTools.ps1` fournit `vps-upload`, `vps-download`, `vps-copy`, `vps-sync`, `vps-ports`, `vps-scan`, `vps-status`, `vps-watch`, `vps-systemd`, `vps-logs` et `vps-api`.
- `vps-sync` lance un dry-run par défaut et exige `-Apply` pour permettre les suppressions côté VPS. `copy` reste non destructif côté destination.
- Le remote rclone SFTP `vps:` fonctionne et utilise une clé hôte épinglée (`host_keys`) après résolution d’un conflit d’ancienne empreinte.

Failures and how to do differently:

- rclone a signalé initialement `knownhosts: key mismatch`; diagnostiquer avec `ssh-keyscan` et le fingerprint réellement présenté par SSH avant de modifier les fichiers connus. Ne jamais désactiver la validation sans raison.
- Le VPS principal avait environ 92% du disque utilisé; vérifier l’espace avant les transferts massifs ou `sync`.

References:

- Script: `C:\Users\aphro\bin\VpsTools.ps1`
- Profil: `C:\Users\aphro\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`
- Commandes: `vps-upload .\fichier.zip /home/ubuntu/transfer`, `vps-download /home/ubuntu/transfer/fichier.zip .\Downloads`, `vps-sync .\projet /home/ubuntu/projet`, `vps-scan all`.

### Task 3: Réplication DBFR et documentation

task: reproduire la chaîne SSH/SFTP/monitoring/systemd pour `dbfr` et créer un README complet
task_group: windows-ssh-vps-administration
task_outcome: success

Preference signals:

- L’utilisateur a demandé « créé un README complet puis fais pareil pour ssh dbfr » -> documenter les changements et répliquer les outils sur les autres serveurs au lieu de laisser une configuration implicite.

Reusable knowledge:

- `ssh dbfr` fonctionne avec l’alias vers `51.255.162.6`, utilisateur `ubuntu`, clé `~/.ssh/id_ed25519`, keepalive, `Compression no`, `IPQoS lowdelay` et `IdentitiesOnly yes`.
- Le remote rclone `dbfr:` fonctionne avec l’empreinte hôte épinglée. DBFR possède `rsync`, `ss`, `systemctl`, `journalctl` et `curl`, mais pas rclone côté serveur.
- Le README complet est dans `C:\Users\aphro\bin\README.md` et couvre les deux serveurs, transferts, dry-run, scans, monitoring, systemd, logs, health checks et chemins de configuration.
- Tests validés: `SSH_DBFR_OK`, hôte `vps-6732365f`, SSH actif, listing `rclone lsd dbfr:/home/ubuntu`, et Nmap public montrant 22/80/443.

Failures and how to do differently:

- Des commandes distantes ont échoué car PowerShell interprétait `$ID` et `$VERSION_ID`. Employer des quotes simples PowerShell pour transmettre les variables au shell Linux.
- DBFR était à environ 95% d’utilisation disque avec 5,1 Go libres; alerte prioritaire à conserver dans les futures vérifications.

References:

- README: `C:\Users\aphro\bin\README.md`
- Commandes DBFR: `dbfr-upload`, `dbfr-download`, `dbfr-sync`, `dbfr-scan`, `dbfr-ports`, `dbfr-status`, `dbfr-systemd`, `dbfr-logs`.
- Scan validé: ports publics `22/tcp`, `80/tcp`, `443/tcp`.

## Thread `01a07d3c-c878-72f1-bd3a-2c1f0c7012f3`

updated_at: 2026-09-07T19:20:16+00:00
cwd: \\?\C:\Users\aphro\Documents\Codex\2026-09-07\a
rollout_path: C:\Users\aphro\.codex\sessions\2026\09\07\rollout-2026-09-07T20-58-50-01a07d3c-c878-72f1-bd3a-2c1f0c7012f3.jsonl
rollout_summary_file: 2026-09-07T18-58-50-7yYX-install_local_aphrody_niers_n2b_codex_plugins.md

---

description: Installation réussie de plugins Codex depuis trois dépôts locaux Windows après correction du format marketplace
task: installer aphrody, niers et n2b depuis des dépôts locaux
task_group: codex-plugin-management
task_outcome: success
cwd: C:\Users\aphro\Documents\Codex\2026-09-07\a
keywords: codex plugin, marketplace.json, local marketplace, aphrody, niers, n2b, PowerShell
---

### Task 1: Installer les plugins locaux

task: installer `aphrody`, `niers` et `n2b` depuis les dépôts déjà clonés localement
task_group: codex-plugin-management
task_outcome: success

Preference signals:

- L’utilisateur a corrigé : « ce sont mes repo locaux déjà clonés » -> rechercher d’abord les chemins locaux connus plutôt que demander des dépôts GitHub.

Reusable knowledge:

- Dépôts validés : `C:\Users\aphro\aphrody`, `C:\Users\aphro\niers`, `C:\Users\aphro\n2b`.
- Le CLI Codex attend un marketplace local avec `.agents/plugins/marketplace.json`; l’ancien `C:\Users\aphro\.agents\plugins\marketplace.json` était au format Claude et n’était pas reconnu.
- La procédure qui a fonctionné : créer `C:\Users\aphro\codex-local-marketplace`, y placer `.agents\plugins\marketplace.json` et copier les sources sous `plugins\aphrody`, `plugins\niers`, `plugins\n2b`; référencer les sources comme `./plugins/aphrody`, `./plugins/niers`, `./plugins/n2b`.
- Commandes : `codex plugin marketplace add 'C:\Users\aphro\codex-local-marketplace' --json`, puis `codex plugin add aphrody@aphro-local --json`, `codex plugin add niers@aphro-local --json`, `codex plugin add n2b@aphro-local --json`.
- Vérification : `codex plugin list --json` a confirmé `installed: true` et `enabled: true` pour les trois.

Failures and how to do differently:

- Les ajouts via `personal` ont échoué avec `plugin ... was not found in marketplace personal`.
- Les chemins absolus dans le manifest n’ont pas permis la découverte ; utiliser une copie locale du marketplace avec sources relatives.

References:

- Manifests : `C:\Users\aphro\aphrody\plugins\aphrody\.codex-plugin\plugin.json`, `C:\Users\aphro\niers\plugins\niers-plugin\.codex-plugin\plugin.json`, `C:\Users\aphro\n2b\.codex-plugin\plugin.json`.
- Versions installées : Aphrody `1.0.2`, NIERS `0.1.0+codex.20260905003718`, n2b `3.0.0+codex.20260907050459`.
