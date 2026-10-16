# Dev run: Vite dev server (started by tauri beforeDevCommand on 127.0.0.1:5173) + debug shell.
# The debug shell uses the frozen sidecar if staged, else falls back to .venv python + engine/backend.
param([switch]$Placeholder)
$ErrorActionPreference = 'Continue'  # native tools write progress to stderr; we check $LASTEXITCODE explicitly
$Root    = Split-Path -Parent $PSScriptRoot
$Desktop = Join-Path $Root 'desktop'
if (-not (Test-Path (Join-Path $Desktop 'node_modules\.bin\tauri.cmd'))) {
    npm --prefix $Desktop install
    if ($LASTEXITCODE -ne 0) { throw 'npm install (desktop) failed' }
}
if (-not (Test-Path (Join-Path $Root 'app\node_modules'))) {
    npm --prefix (Join-Path $Root 'app') install
    if ($LASTEXITCODE -ne 0) { throw 'npm install (app) failed' }
}
Push-Location $Desktop
try { npx tauri dev } finally { Pop-Location }
