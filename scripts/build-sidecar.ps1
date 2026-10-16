# Freeze the Python engine (engine/backend) into an onedir PyInstaller bundle and stage it for Tauri:
#   desktop/src-tauri/resources/server/tianbao-server.exe (+ _internal/...)
# Usage: pwsh scripts/build-sidecar.ps1 [-Clean]
param([switch]$Clean)
$ErrorActionPreference = 'Continue'  # native tools write progress to stderr; we check $LASTEXITCODE explicitly
$Root    = Split-Path -Parent $PSScriptRoot
$Desktop = Join-Path $Root 'desktop'
$Python  = Join-Path $Root '.venv\Scripts\python.exe'
$Build   = Join-Path $Desktop '.build'
$Stage   = Join-Path $Desktop 'src-tauri\resources\server'

if (-not (Test-Path $Python)) { throw "shared venv python not found: $Python" }
& $Python -c "import PyInstaller" 2>$null
if ($LASTEXITCODE -ne 0) { throw "PyInstaller is not installed in $Python (pip install pyinstaller)" }

if ($Clean -and (Test-Path $Build)) { Remove-Item -Recurse -Force $Build }
New-Item -ItemType Directory -Force $Build | Out-Null

$env:PYTHONUTF8 = '1'
Push-Location (Join-Path $Desktop 'sidecar')
try {
    & $Python -m PyInstaller --noconfirm --clean `
        --distpath (Join-Path $Build 'sidecar-dist') `
        --workpath (Join-Path $Build 'sidecar-work') `
        tianbao_server.spec
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed ($LASTEXITCODE)" }
} finally { Pop-Location }

$Out = Join-Path $Build 'sidecar-dist\tianbao-server'
if (-not (Test-Path (Join-Path $Out 'tianbao-server.exe'))) { throw "tianbao-server.exe missing in $Out" }

New-Item -ItemType Directory -Force $Stage | Out-Null
robocopy $Out $Stage /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }
$global:LASTEXITCODE = 0
New-Item -ItemType File -Force (Join-Path $Stage '.gitkeep') | Out-Null

$mb = [math]::Round(((Get-ChildItem $Stage -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB, 1)
Write-Host "sidecar staged: $Stage ($mb MB)"
