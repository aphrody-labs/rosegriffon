#!/usr/bin/env bash
# scripts/dev/env.sh — Unified IECODE Environment Setup for Linux/macOS
# Usage: source scripts/dev/env.sh

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
IECODE_ROOT="$(CDPATH='' cd -- "${SCRIPT_DIR}/../.." && pwd)"

export IECODE_ROOT

# Load only a private environment file, never the example template.
iecode_env_file="${IECODE_ROOT}/.env.local"
[ -r "$iecode_env_file" ] || iecode_env_file="${IECODE_ROOT}/.env"
if [ -r "$iecode_env_file" ]; then
    iecode_restore_allexport=0
    case $- in *a*) iecode_restore_allexport=1 ;; esac
    set -a
    # shellcheck disable=SC1090
    . "$iecode_env_file"
    [ "$iecode_restore_allexport" -eq 1 ] || set +a
    unset iecode_restore_allexport
fi
unset iecode_env_file

# Canonical Game Data Directory
export IECODE_DATA_DIR="${IECODE_DATA_DIR:-${IECODE_ROOT}/data}"

# Engine & Language Bindings (Rust NIE, C# IECODE, C++ iecode-cpp, Python)
export NIE_GAME_DIR="${NIE_GAME_DIR:-$HOME/.local/share/Steam/iecode/inazuma}"
export IEVR_GAME_DIR="${IEVR_GAME_DIR:-${NIE_GAME_DIR}}"
export NIE_GAME_PATH="${NIE_GAME_PATH:-${NIE_GAME_DIR}}"
export NIE_REPO="${NIE_REPO:-${IECODE_ROOT}}"

# Sub-paths & Aliases
export DATA_ROOT="${DATA_ROOT:-${IECODE_DATA_DIR}}"
export DATA_PATH="${DATA_PATH:-${IECODE_DATA_DIR}}"
export DUMP_ROOT="${DUMP_ROOT:-${IECODE_DATA_DIR}/dx11}"
export CPK_DIR="${CPK_DIR:-${IECODE_DATA_DIR}/packs}"

# Database & Mirror
export SQLITE_DB_PATH="${SQLITE_DB_PATH:-${IECODE_ROOT}/var/mirror.sqlite}"
export NIERS_MIRROR="${NIERS_MIRROR:-${SQLITE_DB_PATH}}"
export NIE_DB="${NIE_DB:-${SQLITE_DB_PATH}}"
# NIE_PG_URL must be configured explicitly; generic DATABASE_URL may belong to another domain.

# Ports & Services
export MODEL_SERVE_PORT="${MODEL_SERVE_PORT:-8790}"
export MODEL_SERVE_URL="${MODEL_SERVE_URL:-http://127.0.0.1:${MODEL_SERVE_PORT}}"
export NIE_MODEL_SERVE_URL="${NIE_MODEL_SERVE_URL:-${MODEL_SERVE_URL}}"
export AZALEE_PORT="${AZALEE_PORT:-8807}"
export AZALEE_API_URL="${AZALEE_API_URL:-http://127.0.0.1:${AZALEE_PORT}}"
export INAGLE_PORT="${INAGLE_PORT:-3010}"
export WEB_PORT="${WEB_PORT:-3000}"
export NGINX_PORT="${NGINX_PORT:-8080}"

# Graphics & Logging
export NIE_WGPU_BACKEND="${NIE_WGPU_BACKEND:-vulkan}"
export RUST_LOG="${RUST_LOG:-info,aphrody=debug}"

# Add local bin directories to PATH if present
for p in "${IECODE_ROOT}/target/release" "${IECODE_ROOT}/node_modules/.bin" "$HOME/.cargo/bin" "$HOME/.bun/bin"; do
    if [ -d "$p" ]; then
        case ":${PATH}:" in
            *":$p:"*) ;;
            *) PATH="$p:${PATH}" ;;
        esac
    fi
done
export PATH

echo "[IECODE] Unified environment loaded for Linux."
echo "         IECODE_ROOT     = ${IECODE_ROOT}"
echo "         IECODE_DATA_DIR = ${IECODE_DATA_DIR}"
echo "         NIE_GAME_DIR    = ${NIE_GAME_DIR}"
echo "         MODEL_SERVE_URL = ${MODEL_SERVE_URL}"
echo "         AZALEE_PORT     = ${AZALEE_PORT}"
