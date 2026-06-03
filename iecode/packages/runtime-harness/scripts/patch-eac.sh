#!/usr/bin/env bash
# patch-eac.sh — rend l'échec d'init EOS EasyAntiCheat NON-FATAL pour le boot headless.
#
# Le vrai jeu, lancé headless, échoue à `EOS_Platform_GetAntiCheatClientInterface` (renvoie NULL
# sans backend EAC) et affiche la modale fatale « ERROR CODE E-02000200 / Failed to load game
# files » (E-02000200 == décimal 2000200 == ErrorCode_Init_EasyAntiCheat — le texte est trompeur).
# Correctif chirurgical : NOP l'appel @ VA 0x14114ea02 (file offset 0x114DE02) au constructeur de
# modale fatale ; l'exécution retombe sur l'épilogue « EAC errors suppressed » du binaire lui-même.
#
# Opère sur une COPIE dans le dossier du jeu (pour que les DLL voisines — Goldberg steam_api64,
# proxy EOSSDK — se résolvent). NE touche JAMAIS l'original. Vérifie les 5 octets avant d'écrire.
#
# Usage: patch-eac.sh           -> crée <game>/nie_eacpatched.exe
#        boot-nie-direct.sh 0 <game>/nie_eacpatched.exe   pour le lancer.
set -euo pipefail
GAME="${IECODE_GAME_PATH:-/home/ubuntu/.local/share/Steam/iecode/inazuma}"
SRC="$GAME/nie.exe"
DST="$GAME/nie_eacpatched.exe"
OFF=$((0x114DE02))
ORIG="e899b79aff"   # call 0x140afa1a0
NOP="9090909090"

[ -f "$SRC" ] || { echo "ERREUR: introuvable: $SRC" >&2; exit 1; }
cp -f "$SRC" "$DST"
python3 - "$DST" "$OFF" "$ORIG" "$NOP" <<'PY'
import sys
dst, off, orig, nop = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
with open(dst, 'r+b') as f:
    f.seek(off); got = f.read(5).hex()
    if got != orig:
        sys.exit(f"ERREUR: octets @0x{off:X} = {got}, attendu {orig} — build différent, abandon.")
    f.seek(off); f.write(bytes.fromhex(nop))
    f.seek(off); new = f.read(5).hex()
print(f"OK  offset 0x{off:X}: {orig} -> {new}  ({dst})")
PY
echo "Lancer: bash $(dirname "$0")/boot-nie-direct.sh 0 \"$DST\""
