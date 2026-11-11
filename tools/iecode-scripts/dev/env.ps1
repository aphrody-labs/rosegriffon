# scripts/dev/env.ps1 — Unified IECODE Environment Setup for Windows (PowerShell)
# Usage: . .\scripts\dev\env.ps1

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$IecodeRoot = Resolve-Path "$ScriptDir\..\.."
$env:IECODE_ROOT = $IecodeRoot

# Load .env if present
$EnvFile = Join-Path $IecodeRoot ".env.local"
if (-not (Test-Path $EnvFile)) {
    $EnvFile = Join-Path $IecodeRoot ".env"
}

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $name = $parts[0].Trim()
            $value = $parts[1].Trim().Trim('"').Trim("'")
            if (-not [string]::IsNullOrEmpty($name)) {
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    }
}

# Ensure Canonical Paths
if (-not $env:IECODE_DATA_DIR) { $env:IECODE_DATA_DIR = Join-Path $IecodeRoot "data" }
if (-not $env:NIE_GAME_DIR) { $env:NIE_GAME_DIR = Join-Path $HOME ".local/share/Steam/iecode/inazuma" }
if (-not $env:IEVR_GAME_DIR) { $env:IEVR_GAME_DIR = $env:NIE_GAME_DIR }
if (-not $env:NIE_GAME_PATH) { $env:NIE_GAME_PATH = $env:NIE_GAME_DIR }
if (-not $env:NIE_REPO) { $env:NIE_REPO = $IecodeRoot }

if (-not $env:DATA_ROOT) { $env:DATA_ROOT = $env:IECODE_DATA_DIR }
if (-not $env:DATA_PATH) { $env:DATA_PATH = $env:IECODE_DATA_DIR }
if (-not $env:DUMP_ROOT) { $env:DUMP_ROOT = Join-Path $env:IECODE_DATA_DIR "dx11" }
if (-not $env:CPK_DIR) { $env:CPK_DIR = Join-Path $env:IECODE_DATA_DIR "packs" }

# Database & Mirror
if (-not $env:SQLITE_DB_PATH) { $env:SQLITE_DB_PATH = Join-Path $IecodeRoot "var\mirror.sqlite" }
if (-not $env:NIERS_MIRROR) { $env:NIERS_MIRROR = $env:SQLITE_DB_PATH }
if (-not $env:NIE_DB) { $env:NIE_DB = $env:SQLITE_DB_PATH }
# NIE_PG_URL is explicit; inherited DATABASE_URL may belong to another domain.

# Services & Ports
if (-not $env:MODEL_SERVE_PORT) { $env:MODEL_SERVE_PORT = "8790" }
if (-not $env:MODEL_SERVE_URL) { $env:MODEL_SERVE_URL = "http://127.0.0.1:$($env:MODEL_SERVE_PORT)" }
if (-not $env:NIE_MODEL_SERVE_URL) { $env:NIE_MODEL_SERVE_URL = $env:MODEL_SERVE_URL }
if (-not $env:AZALEE_PORT) { $env:AZALEE_PORT = "8807" }
if (-not $env:AZALEE_API_URL) { $env:AZALEE_API_URL = "http://127.0.0.1:$($env:AZALEE_PORT)" }
if (-not $env:INAGLE_PORT) { $env:INAGLE_PORT = "3010" }
if (-not $env:WEB_PORT) { $env:WEB_PORT = "3000" }

# Graphics & Logging
if (-not $env:NIE_WGPU_BACKEND) { $env:NIE_WGPU_BACKEND = "dx12" }
if (-not $env:RUST_LOG) { $env:RUST_LOG = "info,aphrody=debug" }

Write-Host "[IECODE] Unified environment loaded for Windows (PowerShell)." -ForegroundColor Green
Write-Host "         IECODE_ROOT     = $env:IECODE_ROOT"
Write-Host "         IECODE_DATA_DIR = $env:IECODE_DATA_DIR"
Write-Host "         NIE_GAME_DIR    = $env:NIE_GAME_DIR"
Write-Host "         MODEL_SERVE_URL = $env:MODEL_SERVE_URL"
Write-Host "         AZALEE_PORT     = $env:AZALEE_PORT"
