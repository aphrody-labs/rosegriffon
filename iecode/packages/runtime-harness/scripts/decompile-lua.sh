#!/usr/bin/env bash
# decompile-lua.sh — extrait les .lua.bin des CPK (via iecode) et les décompile (unluac, Lua 5.2.1).
# Usage: decompile-lua.sh [filtre_chemin] [dossier_sortie]   (défaut : "script/lua/menu" -> re/lua/decompiled)
set -uo pipefail
IECODE=/home/ubuntu/iecode
DLL="$IECODE/src/IECODE.CLI/bin/Debug/net10.0/iecode.dll"
UNLUAC="$IECODE/re/lua/unluac.jar"
FILTER="${1:-script/lua/menu}"
OUT="${2:-$IECODE/re/lua/decompiled}"
mkdir -p "$OUT" "$IECODE/re/lua/raw"
mapfile -t paths < <(dotnet "$DLL" cdn ls "$FILTER" -n 100000 2>/dev/null | grep -oE 'data/[^ ]+\.lua\.bin')
echo "${#paths[@]} .lua.bin pour filtre « $FILTER »"
ok=0; fail=0
for p in "${paths[@]}"; do
  rel="${p#data/}"; raw="$IECODE/re/lua/raw/$(echo "$rel" | tr '/' '_')"
  dst="$OUT/${rel%.lua.bin}.lua"; mkdir -p "$(dirname "$dst")"
  dotnet "$DLL" cdn get "$p" -o "$raw" >/dev/null 2>&1 || { fail=$((fail+1)); continue; }
  if java -jar "$UNLUAC" "$raw" > "$dst" 2>/dev/null && [ -s "$dst" ]; then ok=$((ok+1)); else fail=$((fail+1)); rm -f "$dst"; fi
done
echo "décompilés=$ok échecs=$fail -> $OUT"
