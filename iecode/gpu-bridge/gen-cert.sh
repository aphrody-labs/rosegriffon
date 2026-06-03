#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT="$HERE/tls/rdp-tls.crt"; KEY="$HERE/tls/rdp-tls.key"
mkdir -p "$HERE/tls"
if [ -f "$CERT" ] && [ -f "$KEY" ]; then echo "cert déjà présent"; exit 0; fi
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$KEY" -out "$CERT" -days 3650 \
  -subj "/CN=wslg-vps" 2>/dev/null
chmod 600 "$KEY"
echo "cert TLS généré -> $CERT"
