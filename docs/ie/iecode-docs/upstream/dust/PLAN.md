# Dust CLI debug bridge for RE agents

## Context

Dust is a Nintendo DS emulator (Rust workspace: `core` = platform-agnostic emulation library,
`frontend/desktop` = imgui/winit/wgpu GUI app that already contains an in-app GDB server for human-driven
debugging). We want the same kind of tool the team already built for a Game Boy emulator (see
`SameBoy-SKILL.md`): a CLI (`dust-cli`) that launches the emulator headlessly in the background and drives
it over a socket — breakpoints, real watchpoints, stepping, register/memory inspection, input injection,
screenshots, and deterministic record/replay — so a reverse-engineering agent doing static analysis (Ghidra
etc.) can get dynamic answers ("what's actually at PC right now", "does this candidate address get hit",
"what does the player see at this state") without a human in a GUI.

Exploration confirmed Dust already has almost all the _building blocks_ needed (breakpoint/watchpoint hooks,
register/memory access functions, savestate serialization, input injection API, framebuffer access) because
the existing GDB server (`frontend/desktop/src/emu/gdb_server*`) already uses them — see the "Reusable core
APIs" section below. What's missing is: (1) a true headless launch path (today the app always opens a
window — there is zero CLI arg parsing), (2) a bespoke, agent-friendly protocol/server (JSON over a socket,
not GDB RSP), (3) true per-instruction stepping (the existing GDB server's "step" is a documented cycle-count
hack, not real instruction stepping), (4) deterministic RTC for record/replay, and (5) the record/replay
feature itself, which has no precedent in this codebase at all (no rewind buffer exists).

The user will write the actual Claude Skill (`SKILL.md`) themselves once this system exists — this plan only
covers building the emulator-side bridge and the Python CLI wrapper, not the skill file.

The user's existing (non-headless) build command is:

```
cargo build --release --no-default-features --features="xq-audio,discord-presence,log,debug-views,dldi" --package dust-desktop
```

This does **not** include `debugger-hooks`/`gdb-server` — the new `cli-server` feature (below) needs to be
added to this invocation to get breakpoints/watchpoints.

## Reusable core APIs (traced during exploration — reuse these directly, don't reinvent)

- **Breakpoints**: `Arm7`/`Arm9::{breakpoints, add_breakpoint, remove_breakpoint, clear_breakpoints,
set_breakpoint_hook}` in `core/src/cpu/{arm7,arm9}.rs` (gated `debugger-hooks`). `BreakpointHook` type in
  `core/src/cpu/debug.rs`.
- **Watchpoints**: `Arm7`/`Arm9::{mem_watchpoints, add_mem_watchpoint, remove_mem_watchpoint,
clear_mem_watchpoints, set_mem_watchpoint_hook}`, same files. Real hardware-accurate, triggers from the bus
  fallback path (`check_watchpoints!` macro, `core/src/cpu/debug.rs:28-60`) — no extra runtime toggle needed
  beyond compiling with `debugger-hooks` (which pulls in `bft-r`/`bft-w`).
- **Registers**: `Arm7`/`Arm9::{regs, set_regs, cpsr, set_cpsr}` (`core/src/cpu/{arm7,arm9}.rs`), `Regs`
  struct in `core/src/cpu.rs:36-52`. Note the GDB layer's PC pipeline-offset adjustment
  (`gdb_server/packets.rs`, `-8`/`+8` shifted by thumb) — replicate or deliberately expose raw PC and document it.
- **Memory**: `arm7::bus::{read_8,read_16,read_32,write_8,write_16,write_32}::<DebugCpuAccess, _>(emu, addr)`
  (and `arm9::bus::*` equivalents) in `core/src/cpu/{arm7,arm9}/bus/access.rs`. `DebugCpuAccess` marker type
  in `core/src/cpu/bus.rs` avoids side effects tied to normal CPU/DMA timing.
- **Input**: `Emu::{press_keys, release_keys, set_touch_pos, end_touch}` in `core/src/emu/input.rs`, `Keys`
  bitflags there too. Trivial to call directly, no host input device involved.
- **Framebuffer/screenshot**: `emu.gpu.renderer_2d().framebuffer()` gives `&Framebuffer` (`[[u32; 256*192]; 2]`,
  `core/src/gpu.rs`) synchronously for the software renderer — headless mode should always use the software
  2D/3D renderers (`dust-soft-2d`, `dust-soft-3d`) specifically so this always works (the accelerated wgpu
  path has no CPU-side readback today — confirmed via the `// TODO: Capture the framebuffer on the UI thread`
  in `emu.rs`). Reuse the PNG-writing pattern from `frontend/desktop/src/debug_views/bg_maps_2d.rs:1364-1389`
  (`png` crate, already a dependency behind `debug-views`).
- **Savestate**: `Emu<E>` derives `Savestate` (via `emu-utils`); `PersistentWriteSavestate::new(buf).store(&mut emu)`
  / `PersistentReadSavestate::new(&bytes)?.load_into(&mut emu)` — see `frontend/desktop/src/emu.rs:548-597`
  for the exact pattern already used for named savestates. No RNG anywhere in `core` — the only
  non-determinism is the RTC backend (see below), so a full-state snapshot + input replay is otherwise safe.
- **RTC determinism**: `core/src/rtc.rs`'s `Rtc.backend: Box<dyn Backend>` is `#[savestate(skip)]` and
  pluggable (`trait Backend`, `core/src/rtc.rs:72`). The desktop's current impl
  (`frontend/desktop/src/emu/rtc.rs`) reads `chrono::Local::now()` live — this must be swapped for a
  deterministic backend in headless mode for record/replay to actually replay deterministically.
- **Threading/polling model to copy**: everything runs on one thread (the "emu thread"); the existing GDB
  server is a non-blocking TCP server whose `poll(&mut emu)` is called once per iteration of the main run
  loop (`frontend/desktop/src/emu.rs:518` `'run_loop`, `gdb_server.poll(&mut emu)` at `emu.rs:738-742`).
  Hooks fire deep inside the interpreter (same thread) and just push onto an `Rc<RefCell<_>>` queue that's
  drained on the next `poll()` — no `Arc<Mutex<_>>` needed. The new CLI bridge server should follow this
  exact pattern (`server.rs`'s non-blocking accept/read plumbing is directly reusable/adaptable).
- **Known limitation to fix, not copy**: GDB's "step" (`gdb_server/packets.rs`, `remaining_step_cycles`) is
  cycle-granular, not instruction-granular (explicit TODOs at `packets.rs:759,823`). The CLI bridge should
  implement real single-instruction stepping instead (see Phase A).

## Plan

### Phase A — small core change: true single-instruction step

Add a `single_step: bool` flag alongside the existing `breakpoints`/`breakpoint_hook` fields in
`Arm7Data`/`Arm9Data` (`core/src/cpu/debug.rs`), plus `Arm7`/`Arm9::step_once()` setters
(`core/src/cpu/{arm7,arm9}.rs`, mirroring `add_breakpoint`'s shape). In the interpreter's instruction-fetch
loop (`core/src/cpu/interpreter/{arm7,arm9}.rs`, the same site that compares `r15` against
`next_breakpoint_addr`), OR in the single_step flag: if set, execute exactly one instruction, clear the flag,
and invoke the existing `breakpoint_hook` (reusing the same stop machinery —
`schedule.set_target_time(cur_time)`, `was_stopped_by_debug_hook = true`, `is_stopped = true`) instead of
introducing a new hook type. This is a minimal, surgical diff that gives real instruction-level stepping
without touching the JIT engine (headless CLI bridge is interpreter-only, matching the existing GDB server).

### Phase B — new Cargo feature

Add to `frontend/desktop/Cargo.toml`:

```
cli-server = ["dust-core/debugger-hooks"]
```

(mirrors `gdb-server`'s shape but independent — the CLI bridge doesn't need `gdb-protocol`). Add
`crc32fast` (new, small dependency) for replay-file ROM validation. Document the updated build command:

```
cargo build --release --no-default-features --features="xq-audio,log,debug-views,dldi,cli-server" --package dust-desktop --bin dust-desktop -- --headless
```

(dropping `discord-presence` for headless is optional/cosmetic — keep it if the user wants parity with the
existing build).

### Phase C — headless launch path

- `frontend/desktop/src/main.rs`: before calling `ui::main()`, do minimal manual arg parsing (no new heavy
  dependency — `std::env::args()`) for `--headless`, `--rom <path>`, `--socket <path>`, `--boot-rom7/9 <path>`,
  `--firmware <path>`, `--realtime` (opt-in frame pacing; default unthrottled for fast RE iteration). If
  `--headless` is present, dispatch to a new `headless::run(args)` instead of `ui::main()` — this entirely
  skips `window::Builder`/winit/wgpu/imgui.
- New module `frontend/desktop/src/headless.rs`: builds `Emu<Interpreter>` via `emu::Builder` using
  `dust-soft-2d`/`dust-soft-3d` renderers (never wgpu — needed for screenshot readback, see above), a no-op
  audio backend (check whether `audio::output::Channel` already tolerates no output device; if not, add a
  trivial silent backend), and the new deterministic RTC backend (Phase D). Drives a trimmed version of
  `emu.rs`'s `'run_loop`: no UI channels/`SharedState`/triple-buffer frame_tx needed — just
  `cli_server.poll(&mut emu)` each iteration (installs/removes hooks, processes at most the buffered
  commands) plus `emu.run()`/`emu.run_with_cycles()` when "playing". Reuse `emu.rs`'s sys-file/ROM loading
  logic (the same helpers `ui.rs`'s `load_from_rom_path` calls) rather than duplicating BIOS/firmware
  loading.

### Phase D — CLI bridge server and protocol

New `frontend/desktop/src/emu/cli_server.rs` (+ a `cli_server/protocol.rs` for command/response types),
modeled directly on `gdb_server.rs`/`gdb_server/server.rs`:

- Transport: TCP on `127.0.0.1`, following the existing `ToggleGdbServer(Option<SocketAddr>)` precedent
  (simpler and more portable than a Unix socket given Dust already ships Windows builds — SameBoy's Unix
  socket choice doesn't transfer). Non-blocking listener/stream, same polling shape as `gdb_server::server`.
- Protocol: newline-delimited JSON, one request per line, one synchronous JSON response per line (`serde`,
  already a dependency) — deliberately not GDB RSP; far simpler for a Python client and lets responses carry
  structured data (registers as an object, memory as a byte array, etc.) instead of hex-string encoding.
- Commands (each maps to a core API traced above):
  - `break`/`unbreak`/`breaks` → `add_breakpoint`/`remove_breakpoint`/`breakpoints()` (per-core, default
    ARM9; ARM7 selectable via a `core` field)
  - `watch`/`unwatch` → `add_mem_watchpoint`/`remove_mem_watchpoint` with `MemWatchpointRwMask`
  - `continue`/`pause`/`step` → drives the "playing" flag + Phase A's `step_once()`; step-over/step-out can
    be implemented client-side (or server-side) as "set a temporary breakpoint at the return address, then
    continue" using the same `add_breakpoint`/`remove_breakpoint` API — no new core primitive needed
  - `regs` (get/set) → `regs()`/`set_regs()`/`cpsr()`/`set_cpsr()`
  - `read`/`write` → `arm{7,9}::bus::{read,write}_{8,16,32}::<DebugCpuAccess, _>`
  - `press`/`release`/`touch` → `press_keys`/`release_keys`/`set_touch_pos`/`end_touch`
  - `screenshot` → `emu.gpu.renderer_2d().framebuffer()` + the `bg_maps_2d.rs` PNG-writing pattern
  - `checkpoint`/`save-replay`/`replay` → see Phase E
  - `kill` → clean process exit

### Phase E — record/replay

- `checkpoint`: serialize full state via `PersistentWriteSavestate` (as `emu.rs:548-597` already does) into
  an in-memory buffer held by `cli_server`; start recording a `Vec<(RawTimestamp, InputEvent)>` log of every
  subsequent `press`/`release`/`touch` command (timestamped against the emu's own schedule clock, not wall
  time, for determinism).
- `save-replay <path>`: write a small file: magic + version + `crc32fast` checksum of the loaded ROM +
  length-prefixed savestate bytes + serde-JSON-encoded input log.
- `replay <path>`: verify the CRC32 matches the currently loaded ROM (refuse on mismatch, mirroring
  SameBoy's behavior), `load_into` the checkpoint state, arm input playback so recorded `InputEvent`s are
  injected automatically as the schedule clock reaches their timestamps during subsequent `continue`s.
- This is safe/deterministic because (confirmed above) `core` has no RNG and the only non-deterministic
  input is the RTC backend, which is fixed/deterministic in headless mode (Phase D's RTC backend swap).

### Phase F — Python CLI wrapper

New `tools/dust-cli/dust-cli` (Python 3, no extra deps), mirroring `sameboy-cli`'s UX/command surface:
`launch`, `break`/`unbreak`/`breaks`, `watch`/`unwatch`, `continue`/`step`/`pause`, `regs [--json]`,
`read`/`write`, `press`/`release`, `screenshot`, `checkpoint`/`save-replay`/`replay`, `kill`. `launch` spawns
the headless binary detached, polls the TCP port until accepting, and persists session state (socket
port/PID) in `.dust-cli-state.json` in the working directory (git-ignored), same pattern as the SameBoy
bridge's `.sameboy-cli-state.json`. Each subsequent subcommand opens a short-lived connection, sends one JSON
line, reads one JSON line back, and prints a human-readable summary (or raw JSON with `--json`).

## Files touched (new unless noted)

- `core/src/cpu/debug.rs`, `core/src/cpu/{arm7,arm9}.rs`, `core/src/cpu/interpreter/{arm7,arm9}.rs` — Phase A (modified)
- `frontend/desktop/Cargo.toml` — Phase B (modified: new feature + `crc32fast`)
- `frontend/desktop/src/main.rs` — Phase C (modified: arg dispatch)
- `frontend/desktop/src/headless.rs` — Phase C (new)
- `frontend/desktop/src/emu/cli_server.rs`, `frontend/desktop/src/emu/cli_server/protocol.rs` — Phase D (new)
- `frontend/desktop/src/emu/rtc.rs` — Phase D (modified: deterministic backend variant)
- `frontend/desktop/src/emu.rs` — Phase D (modified: wire `cli_server` in like `gdb_server`, behind `cfg(feature = "cli-server")`)
- `tools/dust-cli/dust-cli`, `tools/dust-cli/README.md` — Phase F (new)

## Verification

- `cargo build --no-default-features --features="log,debug-views,dldi,cli-server" --package dust-desktop`
  and the release variant from the user's build command (with `cli-server` added) both succeed.
- `cargo clippy` for the same feature combinations (matching the two-configuration pattern in
  `.github/workflows/clippy.yml`), no new warnings.
- Manual smoke test with a legally-owned test ROM (homebrew or user-provided, not committed to the repo):
  `dust-cli launch game.nds`, then round-trip `regs`, `read`/`write`, `break`+`continue`, `watch`+`continue`,
  `step` (confirm PC advances by exactly one instruction, not one cycle), `press`/`screenshot` (confirm a
  non-blank PNG), and `checkpoint`/`save-replay`/`replay` (confirm a replayed session reaches the same PC and
  produces a byte-identical screenshot at a given point vs. the original run).
- No existing automated test suite in this repo (confirmed zero `#[test]`s) — rely on build/clippy plus the
  manual smoke test above.
