> Historical upstream agent snapshot, relocated on 2026-10-01. Its interrupted
> work, paths, commands and measurements describe the original Ruzu checkout;
> they have not been revalidated against IECODE. The root `PLAN.md` is the current
> execution ledger. Retained Ruzu source is under `crates/emu/ruzu/`; paths below
> remain relative to the original upstream checkout unless explicitly stated.

# MaxwellDMA remap state

Resolved on 2026-07-28.

The block-linear-to-pitch fallback no longer aborts when remapping is enabled.
It now follows upstream `MaxwellDMA::CopyBlockLinearToPitch`: remapped copies
derive their base byte width from the destination component count and size,
and only non-remapped copies use the trailing-zero packing optimization.

Focused regression coverage:
`test_multi_line_blocklinear_to_pitch_remap_uses_component_size`.
