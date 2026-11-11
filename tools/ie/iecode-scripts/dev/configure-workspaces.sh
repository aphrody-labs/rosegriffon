#!/usr/bin/env bash
# Source this file to configure the current checkout without changing shell options.

iecode_workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export NIE_REPO_ROOT="${NIE_REPO_ROOT:-$iecode_workspace_root}"
export IECODE_ROOT="${IECODE_ROOT:-$iecode_workspace_root}"
export NIE_GAME_DIR="${NIE_GAME_DIR:-$HOME/.local/share/Steam/iecode/inazuma}"
export NIE_BIN="${NIE_BIN:-$NIE_REPO_ROOT/target/release/nie}"
for iecode_workspace_path in "$NIE_REPO_ROOT/target/debug" "$NIE_REPO_ROOT/target/release" "$IECODE_ROOT/target/debug" "$IECODE_ROOT/target/release"; do
    [ -d "$iecode_workspace_path" ] || continue
    case ":${PATH:-}:" in
        *":$iecode_workspace_path:"*) ;;
        *) PATH="$iecode_workspace_path${PATH:+:$PATH}" ;;
    esac
done
export PATH
unset iecode_workspace_root iecode_workspace_path

if [ "${1:-}" = "--print" ]; then
    printf 'IECODE_ROOT=%s\nNIE_REPO_ROOT=%s\nNIE_GAME_DIR=%s\nNIE_BIN=%s\n' "$IECODE_ROOT" "$NIE_REPO_ROOT" "$NIE_GAME_DIR" "$NIE_BIN"
fi
