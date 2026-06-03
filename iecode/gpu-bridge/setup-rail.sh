#!/usr/bin/env bash
# setup-rail.sh — Palier 2 : build Weston-mirror + FreeRDP-mirror (rdprail-shell)
# pour VPS-direct. Recette dérivée du Dockerfile microsoft/wslg, adaptée Ubuntu.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="$HERE/build/install"
SRC="$HERE/build/src"
JOBS="$(nproc)"
mkdir -p "$PREFIX" "$SRC"

echo "### [1/4] deps apt"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  build-essential cmake meson ninja-build pkg-config git \
  libwayland-dev wayland-protocols libxkbcommon-dev libpixman-1-dev \
  libcairo2-dev libpango1.0-dev libgdk-pixbuf-2.0-dev libjpeg-dev libwebp-dev \
  libinput-dev libdrm-dev libgbm-dev libxcb1-dev libxcb-composite0-dev \
  libxcb-xfixes0-dev libxcb-xkb-dev libx11-xcb-dev libxcursor-dev libdbus-1-dev \
  libpam0g-dev liblcms2-dev libva-dev libssl-dev libusb-1.0-0-dev libicu-dev \
  libcjson-dev libavutil-dev libavcodec-dev libxdamage-dev libxext-dev \
  libxcb-shm0-dev libfontconfig-dev libpciaccess-dev libdisplay-info-dev \
  libxml2-dev libxkbcommon-x11-dev libsystemd-dev 2>&1 | tail -2 || true

echo "### [2/4] FreeRDP-mirror (branche working)"
[ -d "$SRC/FreeRDP/.git" ] || git clone --depth 1 -b working \
  https://github.com/microsoft/FreeRDP-mirror "$SRC/FreeRDP"
cd "$SRC/FreeRDP"
cmake -G Ninja -B build -DCMAKE_POLICY_VERSION_MINIMUM=3.5 -DCMAKE_INSTALL_PREFIX="$PREFIX" \
  -DCMAKE_INSTALL_LIBDIR="$PREFIX/lib" -DCMAKE_BUILD_TYPE=Release \
  -DWITH_ICU=ON -DWITH_FFMPEG=OFF -DWITH_DSP_FFMPEG=OFF -DWITH_OPENH264=OFF -DWITH_SERVER=ON -DWITH_CHANNEL_GFXREDIR=ON \
  -DWITH_CHANNEL_RDPAPPLIST=ON -DWITH_CLIENT=OFF -DWITH_CLIENT_COMMON=OFF \
  -DWITH_CLIENT_CHANNELS=OFF -DWITH_CLIENT_INTERFACE=OFF -DWITH_LIBSYSTEMD=OFF \
  -DWITH_WAYLAND=OFF -DWITH_X11=OFF -DWITH_PROXY=OFF -DWITH_SHADOW=OFF \
  -DWITH_SAMPLE=OFF
ninja -C build -j"$JOBS" install

echo "### [3/4] Weston-mirror (branche working)"
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:$PREFIX/lib/x86_64-linux-gnu/pkgconfig:${PKG_CONFIG_PATH:-}"
export LD_LIBRARY_PATH="$PREFIX/lib:${LD_LIBRARY_PATH:-}"
[ -d "$SRC/weston/.git" ] || git clone --depth 1 -b working \
  https://github.com/microsoft/weston-mirror "$SRC/weston"
cd "$SRC/weston"
rm -rf build
meson setup build --prefix="$PREFIX" --buildtype=release \
  -Dbackend-default=rdp -Dbackend-drm=false -Dbackend-drm-screencast-vaapi=false \
  -Dbackend-headless=false -Dbackend-wayland=false -Dbackend-x11=false \
  -Dbackend-fbdev=false -Dcolor-management-colord=false -Dscreenshare=false \
  -Dsystemd=false -Dwslgd=true -Dremoting=false -Dpipewire=false \
  -Dshell-fullscreen=false -Dcolor-management-lcms=false -Dshell-ivi=false \
  -Dshell-kiosk=false -Ddemo-clients=false -Dsimple-clients=[] -Dtools=[] \
  -Dresize-pool=false -Dwcap-decode=false -Dtest-junit-xml=false
ninja -C build -j"$JOBS" install

echo "### [4/4] vérif rdprail-shell"
find "$PREFIX" -name "rdprail-shell.so" -o -name "rdp-backend.so" | sed "s#^#  #"
echo "RAIL_BUILD_DONE prefix=$PREFIX"
