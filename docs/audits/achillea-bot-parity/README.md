# Achilléa bot canvas parity (legacy vs current)

Reproduce (from the repo root, offline):

    bun docs/audits/achillea-bot-parity/scripts/run.ts

It renders each case with the legacy renderers (`legacy/achillea-bot/src/services/PlayerCardService.ts`,
`ClanPosterService.ts`, drawing code kept verbatim) and with `apps/rg-bot/src/api/modules/achillea/images`,
then writes `<case>.legacy.png`, `<case>.current.png` and `diff.json` (a pixel differs when the summed RGB delta is above 6).

| case | size | differing px | % | note |
| --- | --- | --- | --- | --- |
| card-latin | 1080x1350 | 0 | 0 | |
| card-cjk | 1080x1350 | 8824 | 0.605 | legacy fell back to MS Gothic (proprietary, not shipped); current uses system CJK fonts |
| poster-logo | 1080x1920 | 0 | 0 | |
| poster-nologo-before-fix | 1080x1920 | 2807 | 0.135 | "?" at 140px instead of 96px (3c36d153) |
| poster-nologo-after-fix | 1080x1920 | 0 | 0 | fixed in 8599f6ed |
| poster-empty | 1080x1920 | 0 | 0 | |
