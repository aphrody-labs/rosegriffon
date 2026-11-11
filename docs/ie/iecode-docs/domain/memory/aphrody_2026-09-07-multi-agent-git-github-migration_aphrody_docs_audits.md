---
source_file: C:\Users\aphro\aphrody\docs\audits\2026-09-07-multi-agent-git-github-migration.md
imported_at: 2026-09-09T02:59:12.194Z
---

<!-- SPDX-License-Identifier: Apache-2.0 -->

# Multi-agent Git/GitHub migration audit — 2026-09-07

This is the common delivery record for the Codex, Claude and Gemini work that
converged on 2026-09-07. It distinguishes repository artifacts from CI runs
that GitHub accepted but could not start.

## Final classification

| Deliverable                 | Classification                    | Evidence                                                                                                                                                                                                            |
| --------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native Git and GitHub layer | **FAIT**                          | `aphrody-git` uses `gix` and `octocrab`; the CLI exposes inspect, repository, REST, GraphQL, install, audit and rollout operations.                                                                                 |
| Shared CI source            | **FAIT**                          | Reusable workflow and composite action are published at immutable source commit `7394f2e57c9be15f464dbf9277f38a305cc89d74`.                                                                                         |
| Organization rollout        | **FAIT** for 73 repositories      | 73 managed callers were committed directly to their default branches; a post-rollout native audit reports all 73 as `current`.                                                                                      |
| Empty repositories          | **NON_FAIT** for 2 repositories   | `aphrody-code/awesome-windows-champagne` and `aphrody-code/dscode` have no default-branch commit and were deliberately not initialized.                                                                             |
| Consumer CI execution       | **NON_FAIT** as a readiness claim | GitHub recognized the workflow, but 27 immediate runs were rejected because the account was locked for billing; 46 repositories had no run in the immediate observation window. No passing consumer run is claimed. |
| Canonical YOLO package      | **FAIT**                          | 60 skills and 31 agents are centralized in `packages/yolo`; `bun run verify` passed 112 tests with zero failures after the final rebase.                                                                            |
| BXC FFI boundary            | **FAIT**                          | Commit `9e96091f023490becb2b008101e2e8a15847c497` contains panic guards and explicit safety contracts; check, 2 tests and target-only Clippy passed.                                                                |
| WinClean convergence        | **FAIT**                          | Commits `75fa023c`, `58a8f3e0` and `7e755351` publish the cross-platform work, validated handoff records and final Codex closure fact.                                                                              |

## Agent convergence

- Codex delivered the native Git/GitHub implementation, hardened and validated
  the reusable CI contract, performed the 75-repository rollout and audit,
  closed the BXC FFI work, and published the final cross-repository record.
- Claude restored 48 plugin files that had been truncated to zero bytes
  (`e79a5179`), corrected invalid advertised MCP capabilities (`34e6e734`),
  and handed the canonical YOLO source decision to Gemini with measured gates.
- Gemini migrated and deduplicated the YOLO catalog, produced the multi-market
  manifests and agent catalog, removed obsolete duplicate trees, and reported
  the final 60-skill, 31-agent and 112-test state through A2A.

The current published YOLO chain, after rebasing over the managed CI caller, is:

| Commit    | Deliverable                                               |
| --------- | --------------------------------------------------------- |
| `be3e1d0` | Recursive project detection across nested package roots.  |
| `07cb616` | Canonical migration of Aphrody skills into YOLO.          |
| `25916f4` | Universal Agent Skills metadata and ecosystem support.    |
| `9475bdf` | Marketplace manifests and 60-skill catalog documentation. |
| `e8ee703` | Consolidation of 31 specialized agents.                   |

The Aphrody root records the deduplication and final submodule state in
`4837f36a`, `67c6f15c`, `33e78fc3` and `6ffe5682`. The final YOLO submodule
target is `e8ee7039bc6c176670ce3561da22dafe8d17e4b8`.

## Validation evidence

- `cargo nextest run -p aphrody-git`: 27 passed, 0 failed.
- `cargo clippy -p aphrody-git --all-targets -- -D warnings`: passed.
- `cargo deny check`: passed for the Aphrody workspace.
- `zizmor` on the reusable workflow and toolkit action: passed.
- Extracted detection logic: exercised against the real repository with
  enabled and disabled surfaces; bounded matrices and opt-outs behaved as
  documented.
- `bun run verify` in YOLO: TypeScript check passed; 112 tests passed.
- `cargo check -p bxc-rust-bridge`: passed.
- `cargo test -p bxc-rust-bridge`: 2 passed, 0 failed.
- `cargo clippy -p bxc-rust-bridge --all-targets --no-deps -- -D warnings`:
  passed. Workspace-wide BXC Clippy still has unrelated pre-existing findings
  in `obscura-net`, so no broader claim is made.
- Native post-rollout audit: 75 eligible non-fork repositories, 73 `current`,
  2 `empty_repository`, 0 API or decoding errors.

## GitHub execution blocker

The managed caller was accepted and displayed by GitHub Actions. The sampled
annotations for Aphrody and N2B reported: `The job was not started because your
account is locked due to a billing issue.` This is an external account state,
not a workflow parse or caller-install failure. The rollout therefore proves
coverage, not green CI. Re-run or dispatch the consumers after the GitHub
account lock is cleared.

## Complete rollout ledger

`written = true` means the rollout created the managed caller commit shown.
Commit identifiers are abbreviated to 12 hexadecimal characters; every caller
pins the full immutable source SHA stated above.

| Repository                               | State              | Written | Rollout commit |
| ---------------------------------------- | ------------------ | ------- | -------------- |
| `aphrody-code/.github`                   | `current`          | true    | `c3a204c3e7fe` |
| `aphrody-code/A2UI`                      | `current`          | true    | `a6db1043c177` |
| `aphrody-code/Windows-classic-samples`   | `current`          | true    | `d21fc074e411` |
| `aphrody-code/YOLO`                      | `current`          | true    | `842409c71657` |
| `aphrody-code/a2a-js`                    | `current`          | true    | `abb8048199f7` |
| `aphrody-code/agent-browser`             | `current`          | true    | `1a728aff9750` |
| `aphrody-code/animesama`                 | `current`          | true    | `d71a03a3be2f` |
| `aphrody-code/aphrody`                   | `current`          | true    | `b74481b11a71` |
| `aphrody-code/aphrody-go`                | `current`          | true    | `232fe229812a` |
| `aphrody-code/aphrody-py`                | `current`          | true    | `20bb80020996` |
| `aphrody-code/aphrody-ts`                | `current`          | true    | `0f11e31c8372` |
| `aphrody-code/awesome-grok-build`        | `current`          | true    | `7d8864d7b55f` |
| `aphrody-code/awesome-windows`           | `current`          | true    | `790d2bb848ab` |
| `aphrody-code/awesome-windows-champagne` | `empty_repository` | false   | —              |
| `aphrody-code/bun-agent`                 | `current`          | true    | `076238563dfb` |
| `aphrody-code/bun-plus-plus`             | `current`          | true    | `2012b111ee69` |
| `aphrody-code/bxc`                       | `current`          | true    | `cab3f2eb7906` |
| `aphrody-code/bxc-test`                  | `current`          | true    | `cd2e8cb6778f` |
| `aphrody-code/challonge`                 | `current`          | true    | `1dcff21e36ba` |
| `aphrody-code/chrome-devtools-mcp`       | `current`          | true    | `c28cc85ab7b6` |
| `aphrody-code/chromium-bun`              | `current`          | true    | `f75fc8f607ec` |
| `aphrody-code/chromium-rs`               | `current`          | true    | `3e88e4cffe8b` |
| `aphrody-code/crawlee`                   | `current`          | true    | `fd88008b2d21` |
| `aphrody-code/csharp-sdk`                | `current`          | true    | `2ce46802ebf5` |
| `aphrody-code/dbxv2`                     | `current`          | true    | `fabc19c0021e` |
| `aphrody-code/debian-cis`                | `current`          | true    | `640362d607bd` |
| `aphrody-code/depot_tools`               | `current`          | true    | `e0288d4087ac` |
| `aphrody-code/dscode`                    | `empty_repository` | false   | —              |
| `aphrody-code/floatgif`                  | `current`          | true    | `76c157d24c72` |
| `aphrody-code/frames`                    | `current`          | true    | `6e2d94f18494` |
| `aphrody-code/fut`                       | `current`          | true    | `1c20286dbe3a` |
| `aphrody-code/gemini-cli`                | `current`          | true    | `bd6bccf2d1fa` |
| `aphrody-code/gemium`                    | `current`          | true    | `20f1fbf75b14` |
| `aphrody-code/ghidra-suite-plugin`       | `current`          | true    | `2d2440db44de` |
| `aphrody-code/happy`                     | `current`          | true    | `8916065f063a` |
| `aphrody-code/homebrew-tap`              | `current`          | true    | `5472650a46cf` |
| `aphrody-code/iecode`                    | `current`          | true    | `7dffe7c82198` |
| `aphrody-code/iecode-cpp`                | `current`          | true    | `2e8f669e32ea` |
| `aphrody-code/iecode-csharp`             | `current`          | true    | `c1f94b801e47` |
| `aphrody-code/iptv-fr`                   | `current`          | true    | `6d2b3bc81d82` |
| `aphrody-code/leptos`                    | `current`          | true    | `29268d06ec8e` |
| `aphrody-code/lightpanda`                | `current`          | true    | `d51c694125ff` |
| `aphrody-code/material-ai`               | `current`          | true    | `a1ac99faac2e` |
| `aphrody-code/mcp`                       | `current`          | true    | `102d8c33bfca` |
| `aphrody-code/mrx`                       | `current`          | true    | `6a542661f8c8` |
| `aphrody-code/mui-rs`                    | `current`          | true    | `d9647b36f35e` |
| `aphrody-code/n2b`                       | `current`          | true    | `68765da77368` |
| `aphrody-code/next-playwright`           | `current`          | true    | `e0bf4615a732` |
| `aphrody-code/next.js`                   | `current`          | true    | `2967abb73c68` |
| `aphrody-code/nie`                       | `current`          | true    | `0adef9d82548` |
| `aphrody-code/node-api-dotnet`           | `current`          | true    | `0327161bb2b9` |
| `aphrody-code/node-ovh`                  | `current`          | true    | `ff62f0b9480d` |
| `aphrody-code/okms-cli`                  | `current`          | true    | `a8d8ce4921d3` |
| `aphrody-code/ovhcloud-cli`              | `current`          | true    | `c93ce437a152` |
| `aphrody-code/oxc`                       | `current`          | true    | `413e02e4627d` |
| `aphrody-code/puppeteer`                 | `current`          | true    | `5eca533b47f5` |
| `aphrody-code/pwsh-native-plugin`        | `current`          | true    | `a03082778680` |
| `aphrody-code/query-windows-indexing`    | `current`          | true    | `bfc7498e73a8` |
| `aphrody-code/rs-bun`                    | `current`          | true    | `7e6782d20c81` |
| `aphrody-code/shai`                      | `current`          | true    | `ccefd405bcfc` |
| `aphrody-code/shenron`                   | `current`          | true    | `a61043cec459` |
| `aphrody-code/skills`                    | `current`          | true    | `bf21df538747` |
| `aphrody-code/stack`                     | `current`          | true    | `e7473360c94b` |
| `aphrody-code/terminal`                  | `current`          | true    | `5532a752fa40` |
| `aphrody-code/the-bastion`               | `current`          | true    | `c4ab8677676c` |
| `aphrody-code/turborepo`                 | `current`          | true    | `3ce9b32f9969` |
| `aphrody-code/voiranime`                 | `current`          | true    | `43a662c81d7b` |
| `aphrody-code/vps`                       | `current`          | true    | `7d425c51f218` |
| `aphrody-code/win32metadata`             | `current`          | true    | `a90cf4ee6800` |
| `aphrody-code/winDS`                     | `current`          | true    | `3cbd1365e8f9` |
| `aphrody-code/winclean`                  | `current`          | true    | `d54e537ac7d2` |
| `aphrody-code/worldbeyblade`             | `current`          | true    | `9750a66e33c1` |
| `aphrody-code/x`                         | `current`          | true    | `9d788f0be4e0` |
| `aphrody-code/x-client`                  | `current`          | true    | `adc7b8b27ef4` |
| `aphrody-code/xai`                       | `current`          | true    | `423dfa3db645` |
