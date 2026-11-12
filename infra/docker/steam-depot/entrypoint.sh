#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# steam-depot entrypoint: thin dispatch over bun-steam-depot.
#   login <user>         interactive once (password + Steam Guard on the TTY)
#   update               download / resume into $STEAM_INSTALL_DIR (default)
#   verify               hash every file against the manifest (steamcmd validate)
#   list | auth status | auth export --to <store>
# Exit code 2 means the stored token is missing, expired or revoked: run `login` again.
set -eu

umask 077
if [ -d "${STEAM_HOME:-/steam}" ]; then
  chmod 700 "${STEAM_HOME:-/steam}" 2>/dev/null || true
fi

cmd="${1:-update}"
[ "$#" -gt 0 ] && shift

case "$cmd" in
  login)
    if [ "$#" -lt 1 ]; then
      echo "usage: steam-depot login <steam-account>" >&2
      exit 64
    fi
    if [ ! -t 0 ]; then
      echo "login needs a TTY: use 'docker compose run --rm steam-depot login <user>' (ssh -t)" >&2
      exit 64
    fi
    exec bun-steam-depot login "$@"
    ;;
  *)
    exec bun-steam-depot "$cmd" "$@"
    ;;
esac
