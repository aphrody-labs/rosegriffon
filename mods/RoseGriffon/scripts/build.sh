#!/usr/bin/env bash
# Rebuild the Rose Griffon working mod from the user's own game install. Ships no game data:
# every game-derived file is produced locally under $WORK (gitignored), from the installed packs.
#
#   NIE_GAME_DIR=".../INAZUMA ELEVEN Victory Road" RG_ASSETS=.../rosegriffon/packages/rg-assets/public \
#     bash mods/RoseGriffon/scripts/build.sh
# Then: nie mod status / validate -d "$WORK". Installing (`nie mod install`) is a separate, explicit step.
set -euo pipefail
export MSYS_NO_PATHCONV=1
: "${NIE_GAME_DIR:?set NIE_GAME_DIR to the game install}"
: "${RG_ASSETS:?set RG_ASSETS to rosegriffon/packages/rg-assets/public}"
ROOT="$(cd "$(dirname "$0")/../../.." && (pwd -W 2>/dev/null || pwd))"
NIE="${NIE:-$ROOT/target/release/nie.exe}"
BUNRE="${BUNRE:-$ROOT/target/release/bunre.exe}"
WORK="${WORK:-$ROOT/var/ie-work/rosegriffon-mod}"
TMP="$ROOT/var/ie-work/rg-build"
mkdir -p "$TMP"

[ -f "$WORK/mod.json" ] || "$NIE" mod init --nom RoseGriffon --auteur "Rose Griffon" -d "$WORK" \
  --description "Rose Griffon club pack (offline)"

# 1. Camera: no game file is patched; content/cameras/broadcast.toml is a VRFW match camera preset.

# 2. Kit: everything (ID, ramp, crest asset, crest box) comes from theme.toml via theme.json.
bun "$ROOT/mods/RoseGriffon/scripts/theme.ts" "$ROOT/mods/RoseGriffon/theme.toml" "$TMP/theme.json"
# Menu theme (VRFW.theme/1) and title logo (VRFW.image/1) generated from the same scheme.
bun "$ROOT/mods/RoseGriffon/scripts/vrfw_emit.ts" "$TMP/theme.json"
tj() { bun -e "const t=await Bun.file(process.argv[1]).json(); console.log(eval(process.argv[2]))" "$TMP/theme.json" "$1"; }
KIT_ID=$(tj 't.kit.id')
RAMP=$(tj 't.kit.ramp.join(",")')
CREST=$(tj 't.assets[t.kit.crest].path')
CREST_SIZE=$(tj 't.kit.crest_size')
read -r CX CY CW CH < <(tj 't.kit.crest_box.join(" ")')
KIT=data/dx11/chr/_uniform/$KIT_ID/$KIT_ID.g4tx
"$NIE" mod add --ecraser -d "$WORK" "$KIT"
"$NIE" mod recolor -d "$WORK" --texture "${KIT_ID}_10" --rampe "$RAMP" "$KIT"
bun -e '
  const [file, bunre, out, name] = process.argv.slice(1);
  const b = new Uint8Array(await Bun.file(file).arrayBuffer());
  const p = Bun.spawnSync([bunre, "formats", "inspect", file], { stdout: "pipe" });
  const t = JSON.parse(p.stdout.toString()).data.textures.find((x) => x.name === name);
  await Bun.write(out, b.subarray(t.data_offset, t.data_offset + t.data_size));
' "$WORK/$KIT" "$BUNRE" "$TMP/kit.dds" "${KIT_ID}_10"
magick "$CREST" -resize "${CREST_SIZE}x${CREST_SIZE}" "$TMP/logo.png"
# Cover the original crest with the body colour sampled just outside its box, then centre the logo.
FILL=$(magick "$TMP/kit.dds" -crop "1x1+$((CX - 24))+$((CY - 23))" -format "%[pixel:p]" info:)
magick "$TMP/kit.dds" -fill "$FILL" -draw "rectangle $((CX - 4)),$((CY - 4)) $((CX + CW + 4)),$((CY + CH + 4))" \
  "$TMP/logo.png" -geometry "+$((CX + CW / 2 - CREST_SIZE / 2))+$((CY + CH / 2 - CREST_SIZE / 2))" -composite "$TMP/kit.png"
"$NIE" mod texture --bc7 -d "$WORK" --texture "${KIT_ID}_10" --png "$TMP/kit.png" "$KIT"

"$NIE" mod validate -d "$WORK"
"$NIE" mod status -d "$WORK"
