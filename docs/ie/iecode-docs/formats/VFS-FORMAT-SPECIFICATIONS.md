# Victory Road VFS: measured contents and decoding coverage

This reference describes the installed dataset observed on **2026-10-03** with
`nie 1.0.1`, including the fixes recorded in commit `9707e8ed`. Its evidence is
VFS enumeration, extracted bytes, decoder output and runtime test results.
No source declaration is used to infer a binary layout, format capability,
cryptographic algorithm or cross-language implementation parity.

The previous universal format matrix and C structures were not established by
this scan and have been removed. The counts below describe one private install;
other game versions, DLC sets and mount orders require their own measurement.
The private game files and raw reports are not distributed with this reference.

## Dataset and mount boundary

| Observation                  |  Measured value |
| ---------------------------- | --------------: |
| Physical files under `data/` |           1,171 |
| Physical file bytes          |  61,587,961,011 |
| Physical CPK archives        |             936 |
| Mounted VFS entries          |         255,308 |
| Declared logical VFS bytes   | 117,633,700,148 |
| Entries reported as loose    |               5 |

Physical file bytes and declared logical bytes are different measurements;
logical sizes do not measure resident memory or extracted disk usage. The root
VFS listing exposes `data/`. Both `data/common/` and `data/dx11/` occur in mounted
paths; the physical directories do not expose the complete archived dataset.

The tested layout keeps `nie.exe` and its launch components under `data/`.
`--game-dir` selects the containing workspace/install root, not the archive
folder: in this run it was `/home/aphro/iecode`. Executable discovery and VFS
mounting are separate; corrected `info` output found the executable and all five
checked launch components without changing that VFS root.

## Whole-VFS outcome

Both scans visited **all 255,308 entries**, without a prefix or file-count limit.

| Result                     | Header recognition | Decoder dispatch (`--parse`) |
| -------------------------- | -----------------: | ---------------------------: |
| Recognized / decoded       |            234,406 |                      232,414 |
| Unknown                    |             20,900 |                       15,902 |
| Known but non-decoded      |                  0 |                        6,990 |
| Unreadable                 |                  2 |                            2 |
| Recognized / decoded share |           91.8130% |                     91.0328% |
| Measured duration          |          780.090 s |                    446.385 s |

Each column partitions the full mounted entry count. Header recognition does not
establish successful parsing. Decoder dispatch success does not establish that
all payload fields, nested resources, pixels, audio samples or game semantics
were validated. The dispatch labels below are reported labels, not a universal
format taxonomy. Timings reflect these particular sequential runs and cache
conditions; they are not comparative performance benchmarks.

### Successful decoder dispatch

| Reported format | Entries |
| --------------- | ------: |
| `cfg.bin (T2B)` |  84,407 |
| `g4tx`          |  54,201 |
| `g4pk`          |  45,434 |
| `lip`           |  21,047 |
| `g4md`          |   8,956 |
| `g4pkm`         |   7,163 |
| `awb`           |   5,512 |
| `dxbc`          |   2,497 |
| `lua-bytecode`  |   1,197 |
| `col (PXCL)`    |   1,150 |
| `g4sk`          |     339 |
| `cfg.bin`       |     308 |
| `navm`          |     160 |
| `g4ma`          |      35 |
| `g4la`          |       4 |
| `g4vs`          |       4 |

### Recognized but non-decoded

| Reported header family | Entries |
| ---------------------- | ------: |
| `utf`                  |   5,513 |
| `g4cm`                 |   1,217 |
| `usm`                  |     190 |
| `g4mt`                 |      70 |

The report groups these entries as `sans_decodeur`; it does not separately prove
whether each cause is a missing decoder or a rejected payload. In particular,
190 USM entries appear here although a representative video metadata command
succeeded. A dedicated command and the generic dispatch can have different
coverage; metadata output is not playback qualification.

### Unknown after decoder dispatch

| Filename extension | Entries |
| ------------------ | ------: |
| `g4mg`             |  15,876 |
| `log`              |      10 |
| `g4tg`             |       9 |
| `usm`              |       4 |
| `cfg`              |       2 |
| `g4mt`             |       1 |

The 15,876 `.g4mg` entries dominate the unknown set. Their presence and extension
are observed; this scan does not establish their binary structure or purpose.
One `.g4mt` remains unknown while 70 are recognized but non-decoded. A filename
suffix therefore cannot establish uniform content or parser coverage.

### Unreadable resources

Two `.g4tx` resources declare decompressed outputs of **347,230,704** and
**314,879,952 bytes**. Extraction reports
`CRILAYLA: decoded size exceeds 256 MiB budget`. This is the retained resource
limit, not evidence of corrupt files. Their pixels were not decoded in this run.
The extraction diagnostic now preserves that cause rather than replacing it
with a generic decompression failure.

## What extensions and sample bytes actually show

The filename inventory includes 72,308 `.bin`, 54,203 `.g4tx`, 45,591 `.g4pk`,
21,047 `.p3lip`, 15,876 `.g4mg`, 12,190 `.objbin`, 8,956 `.g4md`, 6,992 `.g4pkm`,
5,512 `.acb` and 5,512 `.awb` entries. These are suffix counts, not format counts:
the parser reports 84,407 T2B entries and 1,197 Lua bytecode entries across the
mounted dataset. Do not compare an extension bucket directly to one dispatch
label or assume a `.bin` file has a particular magic.

| Extracted sample | Observed bytes or output                                                         | Scope                                                                  |
| ---------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| G4TX             | Starts `47 34 54 58` (`G4TX`); PNG output 2048 × 1024                            | One texture sample; decode and conversion produced matching PNG hashes |
| G4MD             | Starts `47 34 4d 44` (`G4MD`); JSON contains 3 submeshes and 30 joint hashes     | One model sample; full mesh rendering was not established              |
| Configuration    | Starts `e1 04 00 00`, rather than `RDBN`; decoder reports `T2b`, 7 entries       | One configuration sample; no universal header layout inferred          |
| Lua bytecode     | Starts `1b 4c 75 61 52` (`ESC Lua`, byte `52`); header and main function decoded | One bytecode sample; script execution audited separately               |

These short signatures summarize observed bytes. Sizes, field offsets and
endianness for other payloads require additional direct byte-level evidence.
No copyrighted payload, full decoded script or model data is reproduced here.

## Script, font, media and command observations

- The Lua audit decoded and executed **1,197 scripts**, reporting zero decode or
  execution errors and zero missing includes, with a **200,000-instruction
  per-script limit**. It still reported **54 missing host read paths**. A green
  audit does not establish the host behavior required by the original game.
- Video listing returned **97 film records**; generic dispatch counted 190 USM
  entries as non-decoded and four as unknown. These are different report scopes;
  they must not be equated to a playable-video count.
- The extracted native font atlas measured **4096 × 2048**. Its DDS payload uses
  BGRA channels; the glyph test requires normalized RGBA. After correcting that
  test input conversion, all existing glyph/width reference checks passed
  unchanged. The first `A` glyph check yielded 544 nonzero pixels and CRC32
  `2fe85c8f`; feeding raw BGRA had incorrectly yielded 536 pixels. This validates
  the selected font fixture, not every font or locale.
- Story-mode content export yielded two Lua references, three message records,
  15 object-bin references, one screen and two texture references. These are
  exported associations, not proof of a complete playable story mode.
- Menu and match headless commands emitted valid 1280 × 720 PPM artifacts for
  three and 60 frames respectively. File structure was checked; visual fidelity,
  native-game equivalence and interactive gameplay remain unqualified.
- The command receipt contains **247 expected outcomes**, including **209 help
  surfaces** and negative cases. Successful help or expected exit status is not
  a decoder coverage claim. Private input size, modification time and mode were
  unchanged at the end of the complete test run.

## Reproduce against an authorized installation

Use a built `nie` binary on PATH, or replace `nie` with its absolute path.
The commands below reproduce the observed CLI operations; do not substitute
`data/packs` for the logical installation root.

```sh
export NIE_GAME_ROOT=/path/to/installation-root
export RAYON_NUM_THREADS=4
export NIE_CPK_CACHE_BUDGET_GIB=4

nie --version
nie info --game-dir "$NIE_GAME_ROOT" --json
nie vfs ls --game-dir "$NIE_GAME_ROOT"
nie vfs stats --game-dir "$NIE_GAME_ROOT"
nie vfs formats --game-dir "$NIE_GAME_ROOT" --json > magic-report.json
nie vfs formats --game-dir "$NIE_GAME_ROOT" --parse --json > parse-report.json
nie lua-audit --game-dir "$NIE_GAME_ROOT" --instruction-limit 200000 > lua-report.json
```

Keep reports and extracted resources in private storage outside Git. The
original complete receipt remains locally at
`/tmp/iecode-cli-data-test/summary.json`; temporary files can be removed and are
not a durable public fixture. The aggregate tables above preserve the measured
outcome without requiring redistribution of the dataset. Refresh them from a
new whole-VFS scan when the installation changes, recording the binary version,
date, limits and actual examined count; do not extrapolate from source or help.

## Additional cross-tool evidence (same date)

A subsequent paired-resource probe used `nie` to extract one G4MG/G4MD pair,
then `iecode` to inspect and convert it. That managed command succeeded even
though generic Rust dispatch classified the G4MG as unknown. Rust and managed
G4MD submesh counts agree; native C++ metadata disagrees. This contextual sample
success does not alter the whole-VFS totals above. The generated GLB passes
structural checks but its exported vertex count differs from the source count.

The [multi-CLI analysis](../architecture/CLI-DECISION.md) records exact counts,
observed output shapes, the asset-flow diagram, failed installation/database
probes and the reusable `bun run analyze:cli` command. Its private receipts
preserve raw outputs separately from the public aggregate documentation.

## Remaining evidence to collect

Prioritize the 15,876 unknown `.g4mg` resources, the 6,990 non-decoded entries and
the two over-budget textures. Identify representative payloads and rejected
cases before proposing layouts or decoder changes. Resolve the missing Lua host
reads and validate media playback and rendered output independently. Parser
coverage, executable analysis and complete emulation remain separate claims.

See the [execution ledger](../../PLAN.md) for build/test gates and
[remaining work](../REMAINING-WORK.md) for broader integration limits.
