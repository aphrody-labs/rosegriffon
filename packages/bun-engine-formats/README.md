# Console binary formats

This Bun-native package provides read-only identification and structural inspection for console
images. It parses headers and sections, lists embedded filesystems where supported, streams
CRC-32/MD5/SHA-1/SHA-256 digests, and disassembles code with MAME `unidasm`, LLVM `llvm-objdump`,
Rizin `rz-asm`, or the included 6502 decoder.

Supported formats include NES/FDS, Game Boy/GBC/GBA, Nintendo DS, N64, GameCube/Wii DOL and disc
images (ISO/WBFS/WIA/RVZ), PlayStation executable/disc/CHD/PBP, 3DS NCSD/NCCH, Switch NSP/XCI/NRO,
ELF, Genesis/Mega Drive, and documented firmware images. This package does not execute or emulate
games.

Run it from the workspace root:

```powershell
bun run packages/bun-engine-formats/src/main.ts identify .\sample.nds --json
bun run packages/bun-engine-formats/src/main.ts sections .\sample.nds --json
bun run packages/bun-engine-formats/src/main.ts files .\sample.nds --json
bun run packages/bun-engine-formats/src/main.ts disasm .\sample.nds --arch arm --count 32
bun run packages/bun-engine-formats/src/main.ts tinke-pac-count .\sample.pac
bun tools/nds-tinke/build.ts
bun run packages/bun-engine-formats/src/main.ts tinke-decrypt .\encrypted.bin .\decrypted.bin --block-size 0x1000
```

Disassembly uses installed tools discovered on `PATH`; MAME tools may also be placed under
`usr/lib/mame` at the workspace root or a directory selected with `YOLO_RE_USR`. `tinke-*` commands
use the GPL-licensed .NET NativeAOT library in `tools/nds-tinke`; build it before use with .NET 10
and a NativeAOT toolchain. The `./usr` API reads installed-tool provenance from the optional
`RG_RE_USR/var/lib/re-tools/local.db` database without modifying it. The format and firmware
metadata used by the detector are in `data/consoles/` and remain available when the CLI is built as
a single-file executable while run from this checkout.

Source migrated from Bun OS `packages/bun-engine/src/formats` at the current workspace revision.
The source package's MIT license is retained in [LICENSE](LICENSE); the format metadata has
individual source/spec references in `data/consoles/formats.json`.
