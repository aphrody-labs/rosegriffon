# aphrody-nie-queue

Bounded FIFO breadth-first work frontiers used by static NIE reverse-engineering workflows. The in-memory `MemoryFrontier` deduplicates work and enforces per-queue, seen-set and batch limits. The optional host feature adds the shared Redis-backed `Frontier` used by parallel RE workers.

The default build includes only the in-memory planner. Enable `--features host` to add the optional Redis backend. No game runtime, emulator, WASM or WGPU code is included. The upstream licensing notice is preserved in `LICENSE`.
