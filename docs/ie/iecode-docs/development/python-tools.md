# Inazuma Python tools

The repository has one root `pyproject.toml` and one `uv.lock`. `niepy` is the
single unified UV workspace member providing the pure and direct Python bridge to `aphrody-nie-ffi` (Rust) and `IECODE.Core` (.NET 10 NativeAOT).

## 2026 Rust-Python Architecture

The Python subsystem aligns with the October 2026 Rust-Python ecosystem standards:

- **Python as orchestration & high-level domain layer**: visual novel scripting, game progression, story mode triggers, test suites.
- **Rust as high-performance execution & memory-safety infrastructure**: `aphrody-nie-ffi` provides low-level VFS pack resolution, deterministic 60 Hz 11v11 match simulation, and binary formats.
- **NativeAOT C# integration**: `IECODE.Core` unmanaged exports (`IECODE.Ffi`) provide Level-5 CRC32, CRI CPK position-XOR cipher, CRILAYLA compression/decompression, and RDBN parsing.
- **Unified lifecycle via Astral UV**: zero-dependency hermetic Python toolchain with PubGrub dependency resolution and CAS deduplicated caching.
- **LSP & static analysis**: type-checked and validated via modern tooling (`ruff`, `ty`).

Upstream oracles (`Buscador-Inazuma`, `IEStrikers`, `InazumaElevenGoMapenv`, `inz_cond`)
and `Ren'Py` are tracked as external references in [`docs/upstream/README.md`](../upstream/README.md)
rather than bundled trees.

## Verification & Gates

Run the commands from the IECODE checkout root (Windows or WSL):

```sh
uv lock --check
bun run lint:python
bun run test:python
uv run --directory src/niepy python -m niepy info
```

The root workspace manifests define the single active Python member (`src/niepy`). Emulation
ownership and adapter boundaries are recorded in `docs/architecture/ARCHITECTURE.md` and
`docs/architecture/EMULATOR-CRATE-LAYOUT.md`. Former temporary audit artifacts are historical references, not runtime dependencies or current contracts.
