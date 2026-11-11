#Requires -Version 7.0
# Bootstrap the maintained Rust and Bun workspace.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $Root
try {
    bun scripts/tools/setup-fresh.ts @args
    if ($LASTEXITCODE -ne 0) { throw "Workspace setup failed with exit code $LASTEXITCODE" }
    Write-Host 'IECODE, NIE, Inagle and RG dependency setup complete'
} finally { Pop-Location }
