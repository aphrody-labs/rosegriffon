#!/usr/bin/env bash
set -euo pipefail
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export WAYLAND_DISPLAY="${WSLG_VPS_SOCKET:-wslg-vps-0}"
export DISPLAY="${WSLG_VPS_X11:-:0}"   # Xwayland pour les apps X11
export GDK_BACKEND="${GDK_BACKEND:-wayland,x11}"
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-wayland;xcb}"
exec "$@"
