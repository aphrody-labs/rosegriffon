@echo off
rem scripts/dev/env.bat — Unified IECODE Environment Setup for Windows (Command Prompt)
rem Usage: call scripts\dev\env.bat

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "IECODE_ROOT=%%~fI"

rem Set Canonical Paths
if "%IECODE_DATA_DIR%"=="" set "IECODE_DATA_DIR=%IECODE_ROOT%\data"
if "%NIE_GAME_DIR%"=="" set "NIE_GAME_DIR=%USERPROFILE%\.local\share\Steam\iecode\inazuma"
if not defined IEVR_GAME_DIR set "IEVR_GAME_DIR=%NIE_GAME_DIR%"
if not defined NIE_GAME_PATH set "NIE_GAME_PATH=%NIE_GAME_DIR%"
if not defined NIE_REPO set "NIE_REPO=%IECODE_ROOT%"

if not defined DATA_ROOT set "DATA_ROOT=%IECODE_DATA_DIR%"
if not defined DATA_PATH set "DATA_PATH=%IECODE_DATA_DIR%"
if not defined DUMP_ROOT set "DUMP_ROOT=%IECODE_DATA_DIR%\dx11"
if not defined CPK_DIR set "CPK_DIR=%IECODE_DATA_DIR%\packs"

if "%SQLITE_DB_PATH%"=="" set "SQLITE_DB_PATH=%IECODE_ROOT%\var\mirror.sqlite"
if not defined NIERS_MIRROR set "NIERS_MIRROR=%SQLITE_DB_PATH%"
if not defined NIE_DB set "NIE_DB=%SQLITE_DB_PATH%"
rem NIE_PG_URL is explicit; inherited DATABASE_URL may belong to another domain.

if "%MODEL_SERVE_PORT%"=="" set "MODEL_SERVE_PORT=8790"
if not defined MODEL_SERVE_URL set "MODEL_SERVE_URL=http://127.0.0.1:%MODEL_SERVE_PORT%"
if not defined NIE_MODEL_SERVE_URL set "NIE_MODEL_SERVE_URL=%MODEL_SERVE_URL%"
if "%AZALEE_PORT%"=="" set "AZALEE_PORT=8807"
if not defined AZALEE_API_URL set "AZALEE_API_URL=http://127.0.0.1:%AZALEE_PORT%"
if "%INAGLE_PORT%"=="" set "INAGLE_PORT=3010"
if "%WEB_PORT%"=="" set "WEB_PORT=3000"

if "%NIE_WGPU_BACKEND%"=="" set "NIE_WGPU_BACKEND=dx12"
if "%RUST_LOG%"=="" set "RUST_LOG=info,aphrody=debug"

echo [IECODE] Unified environment loaded for Windows (CMD).
echo          IECODE_ROOT     = %IECODE_ROOT%
echo          IECODE_DATA_DIR = %IECODE_DATA_DIR%
echo          NIE_GAME_DIR    = %NIE_GAME_DIR%
