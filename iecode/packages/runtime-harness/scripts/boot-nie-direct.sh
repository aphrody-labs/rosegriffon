#!/usr/bin/env bash
# boot-nie-direct.sh — lance nie.exe (IEVR) HEADLESS en DIRECT via le wine du Proton fourni,
# SANS le shim steam.exe (qui assert sur lsteamclient faute de vrai client Steam).
# On contourne GameBootstrapper/EAC (exe nu), DXVK sur lavapipe, d3dcompiler_47 MS natif.
#
# Pré-requis posés une fois (idempotents) :
#   - prefix Proton initialisé (proton run a déjà tourné une fois)
#   - DXVK d3d11/dxgi/d3d10core/d3d9 copiés dans system32/syswow64
#   - d3dcompiler_47 MS (winetricks) dans le prefix, override natif
#   - [optionnel] Goldberg steam_api64.dll + Nemirtingas EOSSDK (spoof Steam/EOS)
#
# Usage: boot-nie-direct.sh [timeout_s] [exe]   (timeout 0 = infini, pour run persistant)
set -uo pipefail
GAME=/home/ubuntu/.local/share/Steam/iecode/inazuma
BASE=/home/ubuntu/.local/share/iecode
TIMEOUT="${1:-0}"
EXE="${2:-$GAME/nie.exe}"
TS="$(date +%Y%m%d-%H%M%S 2>/dev/null || echo run)"
LOG="$BASE/logs/direct-$TS.log"
mkdir -p "$BASE/logs" "$BASE/dxvk-cache"

# Steam compat (le script proton les exige même en runinprefix)
export STEAM_COMPAT_DATA_PATH="$BASE/proton-prefix"
export STEAM_COMPAT_CLIENT_INSTALL_PATH="$BASE/steam-client"
export STEAM_COMPAT_INSTALL_PATH="$GAME"
export STEAM_COMPAT_LIBRARY_PATHS="$GAME"
export STEAM_COMPAT_APP_ID=2799860 SteamAppId=2799860 SteamGameId=2799860

# Rendu logiciel lavapipe, headless
export VK_DRIVER_FILES=/usr/share/vulkan/icd.d/lvp_icd.json
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json
export DXVK_FILTER_DEVICE_NAME=llvmpipe
export DXVK_STATE_CACHE_PATH="$BASE/dxvk-cache"
export DXVK_LOG_PATH="$BASE/logs" DXVK_LOG_LEVEL="${DXVK_LOG_LEVEL:-info}"
export DXVK_HUD="${DXVK_HUD:-devinfo}"
export DXVK_ENABLE_NVAPI=0
export MESA_VK_DEVICE_SELECT=llvmpipe
export LP_NUM_THREADS="${LP_NUM_THREADS:-8}"
export GALLIVM_PERF="${GALLIVM_PERF:-}"

# Wine/Proton : DXVK natif + d3dcompiler MS natif, NVAPI builtin, EAC neutralisé
export PROTON_DISABLE_NVAPI=1 PROTON_HIDE_NVIDIA_GPU=1 PROTON_NO_EAC_RUNTIME=1
export WINEDLLOVERRIDES="${WINEDLLOVERRIDES:-d3d11,dxgi,d3d10core,d3d9=n;d3dcompiler_47=n;nvapi64,nvapi=b}"
export WINEDEBUG="${WINEDEBUG:-+seh}"

# Xvfb headless
export DISPLAY="${DISPLAY:-:99}"
if ! xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
  Xvfb "$DISPLAY" -screen 0 1280x720x24 -nolisten tcp >/dev/null 2>&1 &
  echo "$!" > "$BASE/logs/xvfb.pid"
  sleep 1
fi

echo "=== boot-nie-direct $TS  exe=$EXE timeout=${TIMEOUT}s ===" | tee "$LOG"
# CWD = répertoire du jeu : nie.exe fait des chargements RELATIFS très tôt (locale/data) ;
# un CWD erroné laisse une table globale à NULL -> crash 0xC0000005 en init.
cd "$GAME"
if [ "$TIMEOUT" = "0" ]; then
  python3 "$GAME/proton" runinprefix "$EXE" >>"$LOG" 2>&1
else
  timeout --kill-after=10 "$TIMEOUT" python3 "$GAME/proton" runinprefix "$EXE" >>"$LOG" 2>&1
fi
RC=$?
echo "=== exit rc=$RC ===" | tee -a "$LOG"
echo "log=$LOG"
exit $RC
