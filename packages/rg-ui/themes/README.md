# RoseGriffon theme packs (Aphrody Design `theme.toml`, schema v1.1)

One pack per entry of `THEME_PACKS` in `packages/rg-ui/src/lib/themes.ts`: `roy`, `gaelle`,
`azalee-light`, `azalee-dark`, `achillea`. Schema: `crates/design-system/src/manifest.rs`
(`deny_unknown_fields`). Colours are produced by `packages/rg-ui/src/lib/color-engine.ts`.

Assets are RoseGriffon originals already in the repo. Paths are repo-relative (from the repository
root), each wallpaper carries a sha256 and a focal point. Nothing is copied, no binary is added, and
no game art is used.

## Seeds

`[color] seed` is an `oklch(L C H)` string built from `THEME_PACKS.<id>.seed` (hue, chroma). The
engine takes only hue and chroma from the seed: each role's lightness comes from its `TONS` table,
so no L is fixed by the engine. L is set to 0.55 in every pack, a mid value chosen for this
file only.

| Pack | seed | mode | extra |
|---|---|---|---|
| roy | `oklch(0.55 0.107 265)` | light | |
| gaelle | `oklch(0.55 0.164 34)` | light | |
| azalee-light | `oklch(0.55 0.147 73)` | light | |
| azalee-dark | `oklch(0.55 0.126 77)` | dark | |
| achillea | `oklch(0.55 0.267 297)` | dark | `secondary` hue 84 chroma 0.164, `neutral_chroma = 0` (commit 6cb521c7) |

## Pets

One file per state, in `[pet.files]`; `states` lists the same keys. Only what `THEME_PACKS` declares:

- roy: hello, proud
- gaelle: hello, proud, surprised
- azalee-light, azalee-dark: Reika, hello only (`RG_Reika_zukan.webp` lives in
  `apps/rg-website/public/emote/`, not in `rg-assets`)
- achillea: none

## Asset sha256

| File | sha256 |
|---|---|
| packages/rg-assets/public/RG_Logo_V2.5.webp | 34ce07a3058bfca8de48f3937eecc1c3e67a69ac03cd31e6964ba3a7f41ce5eb |
| packages/rg-assets/public/RG_Logo_V2.5_NB.webp | e9b73dc45d6ba6b5052306d95e8197ced44fd54fadc231c7bab9bad916cd238f |
| packages/rg-assets/public/roy_bg.webp | b56649fef011b32b36f88eb4eef13f6d164c58d5b2a59d7f5b957420c9fd7a85 |
| packages/rg-assets/public/gaelle_bg.webp | 92918c46a869a1876bb0c38bd9a71ea981a4e1af87b5f54fef8b3e100e2e6570 |
| packages/rg-assets/public/azalee-bg.webp | 715b8f97f48f581004a7513443790b6f3a3e0353eb2113c9f3722bafc8f4c36c |
| packages/rg-assets/public/azalee_fond.webp | ea58a12f9ff0b62de207906e9368e070c7a8bc3de33e56e1717e51c34d22b62b |
| packages/rg-assets/public/fond_achilea.webp | ed87732c232e009fe870f542f9a231ccf4a7dca77517f2c050b29416eee0e1b7 |
| packages/rg-assets/public/RG_Azalee-logo.webp | d0c1313ac2f39ee62c9a42d646c5cac9bbd115b8127334e0defd6707c19a42ab |
| packages/rg-assets/public/achillea/logo1.svg | 8ea5358d14d8029eeac291fddf0f285be10af586fcf129f03d8e6a2bff7246fa |
| packages/rg-assets/public/emote/RG_Roy_salut.webp | 97fee8662c524902d97c994ee493d47bef32110d18bcd69dfbd168731f0469ab |
| packages/rg-assets/public/emote/RG_roy_fine.webp | 546b9e3ef1bdc6c0b55a2d19e28ed21010284ad55b13ca1447c5cce4cc98d687 |
| packages/rg-assets/public/emote/RG_Gaelle_salut.webp | e2d899c6bb05fae1436588708822f3970ec5b05e60ad813c0577e9234fb04662 |
| packages/rg-assets/public/emote/RG_Gaelle_fiere.webp | 833613845ff8d60d80e585770faa2f828862dad2bf706ced2f1d42370dcd80db |
| packages/rg-assets/public/emote/RG_Gaelle_surprise.webp | 9f26ef3b25c3fb80d97f2f96b70e644bed83ca014381cce294f830a9d5306885 |
| apps/rg-website/public/emote/RG_Reika_zukan.webp | 8dc54db9fa63baab389647d80b9cd42256589712a98e7a6e62323417c9648691 |

Only wallpapers carry a `sha256` field in the schema; the other hashes are recorded here.

## Open decisions

- Licence (decided by the repository owner): every wallpaper carries
  `LicenseRef-RoseGriffon-Proprietary` (all rights reserved Rose Griffon). The yolo-theme-pack
  schema treats this id as distributable by id (only empty, `unverified` and `pending*` are not);
  publication itself stays under the control of the repository admin. Logos and pets have no
  licence field. Achillea keeps no pet.
- Icon set: `phosphor` outlined 400 is a placeholder (RoseGriffon declares none).
- Shell: `sidebar`, density 0, radii `[6,8,10]` (Roy, Gaelle, Achillea) and `[20,22,24]` (Azalee)
  are not measured from the sites.
- Typography: families come from `design/brands.csv`; Humane (Achillea) and the Google Sans Flex
  `@font-face` are unverified. Roy/Gaelle monospace is a filler (`Liberation Mono`).
- Logos: `[logo] monochrome` must be a `currentColor` SVG per the schema; Roy/Gaelle use the WebP
  NB variant, Azalee and Achillea repeat the mark. `mark` is WebP for Rose Griffon and Azalee.
- Hand-written `THEMES.<id>.colors` palettes are not mapped (`overrides` empty); the seed drives
  the scheme.
- Wallpaper dominant colours are not computed, so `[[wallpapers]] seed` is omitted and
  `source = "seed"`.
- Game-derived (Inazuma Eleven) palette: not included.

## Checks

Every `theme.toml` parses with `Bun.TOML.parse` and uses only schema keys. The `rg-ui` gates
(lint, tests) were not run on this PC; run them on bunos.
