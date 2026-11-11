# Installed IEVR smoke verification

This records a read-only run against the Steam IEVR installation on Windows. The commands read
the installed game; conversion output goes to `%TEMP%`. No game files or extracted assets are
checked into the repository.

Target: `C:\Program Files (x86)\Steam\steamapps\common\INAZUMA ELEVEN Victory Road`
(Steam app 2799860), detected from the installation's `data/cpk_list.cfg.bin`.

Build and inspect the installed target:

```powershell
$GameRoot = 'C:\Program Files (x86)\Steam\steamapps\common\INAZUMA ELEVEN Victory Road'
cargo run -q -p yolo-re-core --features assets --bin bunre -- game detect $GameRoot
cargo run -q -p yolo-re-core --features assets --bin bunre -- game mount $GameRoot
cargo run -q -p yolo-re-core --features assets --bin bunre -- game ls $GameRoot --limit 10
cargo run -q -p yolo-re-core --features assets --bin bunre -- game formats $GameRoot data/common/action/base_act.cfg.bin
cargo run -q -p yolo-re-core --features assets --bin bunre -- game convert $GameRoot data/common/action/base_act.cfg.bin --format json --output "$env:TEMP\yolo-re-ievr-base-act.json"
```

Observed on 2026-11-04:

- Detection selected the Level-5 engine and IEVR profile, found 936 CPK packs, scanned 962 loose
  installation files, and reported no truncation.
- Mount indexed 255,628 archive assets from the 936 CPKs plus 21 loose files (255,649 total),
  with no shadowed paths and no refused archives. The mount owner was the canonical
  `aphrody-nie-formats::vfs` reader.
- Listing returned the first 10 entries, including `data/common/action/base_act.cfg.bin` from a
  CPK. Format negotiation offered raw `cfg.bin` and JSON.
- Conversion produced parseable JSON from that installed T2B table; the root format was `T2b`
  with seven entries.

This verifies the real IEVR detect, mount, list, range-read, table-parse and JSON-conversion path.
It does not qualify every asset decoder or every game profile.
