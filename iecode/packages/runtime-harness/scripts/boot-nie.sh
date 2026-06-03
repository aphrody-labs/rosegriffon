#!/usr/bin/env bash
# boot-nie.sh — lance nie.exe (IEVR) en HEADLESS via le Proton 11 fourni par l'install,
# rendu logiciel lavapipe, en contournant GameBootstrapper/EAC (on lance l'exe nu).
# Aucune dépendance prod : prefix + steam-client factice sous ~/.local/share/iecode.
#
# Usage: boot-nie.sh [secondes_timeout] [exe]
#   secondes_timeout : tue le process après N s (défaut 90). 0 = pas de timeout.
#   exe              : exe à lancer (défaut nie.exe). 'winecfg' / 'cmd' utiles pour diag.
set -uo pipefail

GAME=/home/ubuntu/.local/share/Steam/iecode/inazuma
BASE=/home/ubuntu/.local/share/iecode
PROTON="$GAME/proton"
TIMEOUT="${1:-90}"
EXE="${2:-$GAME/nie.exe}"
TS="$(date +%Y%m%d-%H%M%S 2>/dev/null || echo run)"
LOG="$BASE/logs/boot-$TS.log"

# ── Steam compat (exigés par le script proton) ─────────────────────────────
export STEAM_COMPAT_DATA_PATH="$BASE/proton-prefix"
export STEAM_COMPAT_CLIENT_INSTALL_PATH="$BASE/steam-client"
export STEAM_COMPAT_INSTALL_PATH="$GAME"
export STEAM_COMPAT_LIBRARY_PATHS="$GAME"
export STEAM_COMPAT_APP_ID=2799860
export SteamAppId=2799860
export SteamGameId=2799860
export STEAM_COMPAT_MOUNTS="$GAME"

# ── Rendu logiciel lavapipe, headless ──────────────────────────────────────
export VK_DRIVER_FILES=/usr/share/vulkan/icd.d/lvp_icd.json
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json   # compat anciens loaders
export DXVK_FILTER_DEVICE_NAME=llvmpipe
export DXVK_STATE_CACHE_PATH="$BASE/dxvk-cache"
export DXVK_LOG_PATH="$BASE/logs"
export DXVK_LOG_LEVEL=info
export DXVK_HUD=devinfo,version
export DXVK_ENABLE_NVAPI=0
export MESA_VK_DEVICE_SELECT=llvmpipe          # double verrouillage device
export LP_NUM_THREADS=8                          # threads raster lavapipe (12 vCPU)
export GALLIVM_PERF=nopt                          # compil LLVM plus rapide (un peu moins optimisé)

# ── Proton / Wine ──────────────────────────────────────────────────────────
export PROTON_LOG=1
export PROTON_LOG_DIR="$BASE/logs"
export PROTON_NO_ESYNC=0
export PROTON_NO_FSYNC=0
export PROTON_USE_WINED3D="${PROTON_USE_WINED3D:-0}"   # 1 = voie GL de secours
export WINEDEBUG="${WINEDEBUG:--all}"
export PROTON_DISABLE_NVAPI=1
export PROTON_HIDE_NVIDIA_GPU=1
# ne PAS charger EAC : on lance nie.exe directement, pas EACLauncher
export PROTON_NO_EAC_RUNTIME=1

echo "=== boot-nie $TS ===" | tee "$LOG"
echo "exe=$EXE timeout=${TIMEOUT}s prefix=$STEAM_COMPAT_DATA_PATH" | tee -a "$LOG"
echo "wined3d=$PROTON_USE_WINED3D" | tee -a "$LOG"

# Xvfb headless (display privé) + timeout dur
export DISPLAY=:99
Xvfb :99 -screen 0 1280x720x24 -nolisten tcp >/dev/null 2>&1 &
XPID=$!
sleep 1

if [ "$TIMEOUT" = "0" ]; then
  python3 "$PROTON" run "$EXE" >>"$LOG" 2>&1
  RC=$?
else
  timeout --kill-after=10 "$TIMEOUT" python3 "$PROTON" run "$EXE" >>"$LOG" 2>&1
  RC=$?
fi

kill "$XPID" 2>/dev/null
echo "=== exit rc=$RC ===" | tee -a "$LOG"
echo "log: $LOG"
# proton écrit aussi steam-2799860.log dans PROTON_LOG_DIR
exit $RC
