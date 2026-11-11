> Historical upstream agent snapshot, relocated on 2026-10-01. Its interrupted
> work, paths, commands and measurements describe the original Ruzu checkout;
> they have not been revalidated against IECODE. The root `PLAN.md` is the current
> execution ledger. Retained Ruzu source is under `crates/emu/ruzu/`; paths below
> remain relative to the original upstream checkout unless explicitly stated.

# Surface format conversion unimplemented

- kind: PixelFormatFromRenderTargetFormat
- format: 0x0
- upstream_fallback: A8B8G8R8Unorm
- upstream: surface.cpp reaches UNIMPLEMENTED_MSG before returning the fallback format
- rust: stopped before treating the fallback as an implemented mapping
