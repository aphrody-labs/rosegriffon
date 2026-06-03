#!/usr/bin/env bash
# WSLg-VPS : compositeur Weston (backend RDP) headless.
# desktop (Weston stock) | rail (Weston-mirror + rdprail-shell, palier 2).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${WSLG_VPS_PORT:-3391}"
ADDR="${WSLG_VPS_ADDR:-127.0.0.1}"
W="${WSLG_VPS_WIDTH:-1600}"; H="${WSLG_VPS_HEIGHT:-900}"
MODE="${WSLG_VPS_MODE:-desktop}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR" 2>/dev/null || true
export WAYLAND_DISPLAY="${WSLG_VPS_SOCKET:-wslg-vps-0}"
CERT="$HERE/tls/rdp-tls.crt"; KEY="$HERE/tls/rdp-tls.key"
[ -f "$CERT" ] || "$HERE/gen-cert.sh"

ARGS=( --backend=rdp --address="$ADDR" --port="$PORT"
       --rdp-tls-cert="$CERT" --rdp-tls-key="$KEY"
       --width="$W" --height="$H" --socket="$WAYLAND_DISPLAY"
       --xwayland --log=$HERE/weston.log )
BIN=weston
if [ "$MODE" = rail ] && [ -x "$HERE/build/install/bin/weston" ]; then
  BIN="$HERE/build/install/bin/weston"
  export LD_LIBRARY_PATH="$HERE/build/install/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
  export WESTON_MODULE_MAP="rdprail-shell.so"
  ARGS+=( --shell=rdprail-shell.so )
fi
echo "[wslg-vps] $BIN mode=$MODE $ADDR:$PORT socket=$WAYLAND_DISPLAY ${W}x${H}"
exec "$BIN" "${ARGS[@]}"
