# Inazuma Eleven: Victory Road tools

This directory contains the migrated IEVR Ultimate Team inspection utility
from `bun-os/packages/iecode-scripts/re/ievr_ultimate_team.py`.

## Commands

```powershell
python tools/ievr/ievr_ultimate_team.py team-decrypt path\to\team-export.json
python tools/ievr/ievr_ultimate_team.py utmod-info path\to\package.utmod
python tools/ievr/ievr_ultimate_team.py save-info path\to\USERDATALIVE
```

`team-decrypt` requires the `cryptography` package. The command uses the public
export passphrase recovered from the web export client; do not treat it as a
secret or use it for protecting new data. `utmod-info` validates the UTMOD2
magic and reports the package UUID and file size. `save-info` derives and
reports the CRC target encoded in the encrypted header; it does not decrypt the
save or recover a key.

The utility reads inputs and writes JSON to stdout. It does not modify game
files or install mods.
