---
source_file: C:\Users\aphro\aphrody\docs\agent-stack\SSH-REPO-AUDIT-2026-09-07.md
imported_at: 2026-09-09T02:59:12.193Z
---

<!-- SPDX-License-Identifier: Apache-2.0 -->

# SSH and repository context audit

Audit time: 2026-09-07T16:08:45Z
Scope: `<home>/.ssh`, SSH aliases `ovh-vps` and `dbfr`, and local repositories `aphrody`, `bxc`, `niers`, `N2B`, and `WinClean`.

## SSH facts

- The SSH tree contains directories `.config`, `bin`, `target`, `target\tmp`, `var`, and `var\mirror`.
- The SSH tree contains `config` (665 bytes), an existing `config.backup-20260907T160712Z` (989 bytes), `known_hosts` (1126 bytes), `known_hosts.old` (384 bytes), `dbfr_known_hosts` (936 bytes), `rclone_known_hosts` (195 bytes), `id_ed25519` (399 bytes), `id_ed25519.pub` (96 bytes), `ovh_vps` (419 bytes), `ovh_vps.pub` (106 bytes), and `ovh_vps.ppk` (313 bytes).
- Private-key, known-hosts, and credential contents were not read or printed. Only filesystem metadata was collected for those files.
- `config` has two parsed blocks and no parse warnings:
  - `ovh-vps ovh-vps-ubuntu-direct ovh-vps-direct vps` -> `51.77.147.152:22`, user `ubuntu`, identity `~/.ssh/ovh_vps`.
  - `dbfr` -> `51.255.162.6:22`, user `ubuntu`, identity `~/.ssh/id_ed25519`.
- No duplicate host patterns or duplicate directives were found.
- Both configured identity-file references resolve to existing files.
- `ssh -G ovh-vps` exited 0 and resolved the expected host, port, user, identity, and known-hosts paths.
- `ssh -G dbfr` exited 0 and resolved the expected host, port, user, identity, and known-hosts paths.
- Read-only connectivity succeeded for both aliases:
  - `ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes ovh-vps "hostname; uptime"` -> `vps-203bea89`, uptime 31 days 19:54.
  - `ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes dbfr "hostname; uptime"` -> `vps-6732365f`, uptime 60 days 15:33.

## Git facts

All five paths are Git worktrees on `main` and track `origin/main`; no remote divergence was reported by `git status --short --branch`.

| Repository | HEAD       | Worktree                                        | Remote                                         |
| ---------- | ---------- | ----------------------------------------------- | ---------------------------------------------- |
| `aphrody`  | `f199726a` | modified and untracked files present; preserved | `https://github.com/aphrody-code/aphrody.git`  |
| `bxc`      | `f2d1a23`  | clean                                           | `https://github.com/aphrody-code/bxc.git`      |
| `niers`    | `9bffa8a7` | clean                                           | `https://github.com/aphrody-code/nie.git`      |
| `N2B`      | `e377fd5`  | clean                                           | `https://github.com/aphrody-code/n2b.git`      |
| `WinClean` | `7e755351` | clean                                           | `https://github.com/aphrody-code/winclean.git` |

The `aphrody` worktree changes are outside this audit and were not altered. Its modified paths are `.agents/plugins/marketplace.json`, `crates/aphrody-logo/src/lib.rs`, `crates/aphrody-ssh/README.md`, `crates/aphrody-ssh/src/main.rs`, `package.json`, `packages/ovh/README.md`, `packages/ovh/package.json`, `packages/ovh/src/cli.ts`, `packages/ovh/src/index.ts`, `packages/ovh/test/profiles.test.ts`, and `plugins/.claude-plugin/marketplace.json`. Its untracked paths are `.agents/plugins/components.json`, `.agents/plugins/github-account-audit.json`, `.agents/plugins/github-repository-intelligence.json`, `crates/aphrody-logo/assets/`, `docs/agent-stack/PLUGIN-SYNC.md`, `docs/ovh/`, `scripts/gh-repo-intelligence.ts`, `scripts/github-account-audit.ts`, and `scripts/sync-agent-plugins.ts`.

## Repair decision

No SSH configuration repair was objectively safe or necessary. No SSH files, keys, known-hosts files, credentials, remotes, branches, or worktree files were mutated. No commit, push, publish, deploy, or remote mutation was performed.

Blockers: none for this read-only audit. Deployment and remote repository mutation remain intentionally out of scope.
