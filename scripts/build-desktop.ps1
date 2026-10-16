# Full desktop build: sidecar -> frontend -> tauri build (NSIS installer).
# Usage: pwsh scripts/build-desktop.ps1 [-Placeholder] [-SkipSidecar] [-SkipFrontend] [-Snapshot [-AppFrom working|head]]
#   -Placeholder   use desktop/placeholder-dist instead of app/dist (smoke tests only)
#   -Snapshot      bundle scenarios/ from a temporary `git worktree` of HEAD (a consistent snapshot while others edit the
#                  working tree) and build the frontend inside that worktree, so its build-time scenario metadata matches.
#                  -AppFrom working (default) overlays the working-tree app/ sources onto the snapshot; if that build fails
#                  it falls back to the committed app/ (head). app/ itself is never written (no app/dist either).
#                  The engine sidecar is always frozen from the working-tree engine/.
param([switch]$Placeholder, [switch]$SkipSidecar, [switch]$SkipFrontend, [switch]$Snapshot,
      [ValidateSet('working', 'head')][string]$AppFrom = 'working')
$ErrorActionPreference = 'Continue'  # native tools write progress to stderr; we check $LASTEXITCODE explicitly
$Root    = Split-Path -Parent $PSScriptRoot
$Desktop = Join-Path $Root 'desktop'
$App     = Join-Path $Root 'app'

if (-not $SkipSidecar) { & (Join-Path $PSScriptRoot 'build-sidecar.ps1') }

function Remove-Junction([string]$path) {
    # delete a junction itself, never what it points to
    if (Test-Path -LiteralPath $path) {
        $item = Get-Item -LiteralPath $path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { [IO.Directory]::Delete($path) }
    }
}

$useDist = 'app'
$overrideConfig = $null
$Snap = $null
try {
    if ($Snapshot -and -not $Placeholder) {
        $sha = (git -C $Root rev-parse --short HEAD).Trim()
        $Snap = Join-Path ([IO.Path]::GetTempPath()) "tianbao-snapshot-$sha"
        if (Test-Path -LiteralPath $Snap) {
            Remove-Junction (Join-Path $Snap 'app\node_modules'); Remove-Junction (Join-Path $Snap 'tests\node_modules')
            git -C $Root worktree remove --force $Snap 2>$null | Out-Null
            if (Test-Path -LiteralPath $Snap) { Remove-Item -Recurse -Force $Snap }
        }
        git -C $Root worktree add --detach $Snap HEAD | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'git worktree add failed' }
        $SnapApp = Join-Path $Snap 'app'
        if (-not (Test-Path (Join-Path $App 'node_modules'))) { npm --prefix $App install; if ($LASTEXITCODE -ne 0) { throw 'npm install (app) failed' } }
        $built = $false
        foreach ($from in @($AppFrom, 'head') | Select-Object -Unique) {
            if ($from -eq 'working') {
                robocopy $App $SnapApp /E /NFL /NDL /NJH /NJS /NP /XD node_modules dist 'test-results*' playwright-report | Out-Null
                if ($LASTEXITCODE -ge 8) { throw "robocopy app failed ($LASTEXITCODE)" }
                # app/tsconfig also type-checks ../tests/e2e, which the frontend edits together with app/
                robocopy (Join-Path $Root 'tests\e2e') (Join-Path $Snap 'tests\e2e') /E /NFL /NDL /NJH /NJS /NP /XD node_modules | Out-Null
                if ($LASTEXITCODE -ge 8) { throw "robocopy tests/e2e failed ($LASTEXITCODE)" }
            } else {
                Remove-Junction (Join-Path $SnapApp 'node_modules')
                git -C $Snap checkout -- app tests | Out-Null
                git -C $Snap clean -fdq -- app tests | Out-Null
            }
            if (-not (Test-Path (Join-Path $SnapApp 'node_modules'))) {
                New-Item -ItemType Junction -Path (Join-Path $SnapApp 'node_modules') -Target (Join-Path $App 'node_modules') | Out-Null
            }
            npm --prefix $SnapApp run build | Out-Host
            if ($LASTEXITCODE -eq 0) { $built = $true; Write-Host "frontend built from: $from app/ (scenario metadata from HEAD)"; break }
            Write-Warning "frontend build from $from app/ failed ($LASTEXITCODE)"
        }
        if (-not $built) { throw 'frontend build failed (working and HEAD)' }
        $useDist = "snapshot:$sha"
        # stage under desktop/.build and reference RELATIVE paths: an absolute frontendDist is taken as a file:// URL
        # (not embedded), which breaks the installed app
        foreach ($pair in @(@((Join-Path $SnapApp 'dist'), 'snapshot-dist'), @((Join-Path $Snap 'scenarios'), 'snapshot-scenarios'))) {
            robocopy $pair[0] (Join-Path $Desktop ".build\$($pair[1])") /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
            if ($LASTEXITCODE -ge 8) { throw "robocopy $($pair[1]) failed ($LASTEXITCODE)" }
        }
        $global:LASTEXITCODE = 0
        $override = @{
            build  = @{ frontendDist = '../.build/snapshot-dist' }
            bundle = @{ resources = [ordered]@{
                'resources/server'           = 'server'
                '../../scenarios'            = $null
                '../.build/snapshot-scenarios' = 'scenarios'
                '../../integrations'         = 'integrations'
            } }
        }
        $overrideConfig = Join-Path $Desktop '.build\tauri.snapshot.conf.json'
        New-Item -ItemType Directory -Force (Split-Path $overrideConfig) | Out-Null
        [IO.File]::WriteAllText($overrideConfig, ($override | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding $false))
    } else {
        if (-not $Placeholder -and -not $SkipFrontend -and (Test-Path (Join-Path $App 'package.json'))) {
            if (-not (Test-Path (Join-Path $App 'node_modules'))) {
                npm --prefix $App install
                if ($LASTEXITCODE -ne 0) { throw 'npm install (app) failed' }
            }
            npm --prefix $App run build
            if ($LASTEXITCODE -ne 0) { throw 'frontend build failed (try -Snapshot to fall back to the committed app/)' }
        }
        if ($Placeholder -or -not (Test-Path (Join-Path $App 'dist\index.html'))) {
            Write-Warning 'app/dist not found (or -Placeholder): bundling desktop/placeholder-dist (NOT the real game UI).'
            $useDist = 'placeholder'
            $overrideConfig = 'src-tauri/tauri.placeholder.conf.json'
        }
    }

    if (-not (Test-Path (Join-Path $Desktop 'node_modules\.bin\tauri.cmd'))) {
        npm --prefix $Desktop install
        if ($LASTEXITCODE -ne 0) { throw 'npm install (desktop) failed' }
    }

    Push-Location $Desktop
    try {
        if ($overrideConfig) { npx tauri build --config $overrideConfig } else { npx tauri build }
        if ($LASTEXITCODE -ne 0) { throw "tauri build failed ($LASTEXITCODE)" }
    } finally { Pop-Location }
} finally {
    if ($Snap -and (Test-Path -LiteralPath $Snap)) {
        Remove-Junction (Join-Path $Snap 'app\node_modules'); Remove-Junction (Join-Path $Snap 'tests\node_modules')
        git -C $Root worktree remove --force $Snap 2>$null | Out-Null
        if (Test-Path -LiteralPath $Snap) { Remove-Item -Recurse -Force $Snap -ErrorAction SilentlyContinue }
        git -C $Root worktree prune | Out-Null
    }
}

$Bundle = Join-Path $Desktop 'src-tauri\target\release\bundle\nsis'
Get-ChildItem $Bundle -Filter *.exe | ForEach-Object {
    Write-Host ("installer: {0}  ({1} MB)" -f $_.FullName, [math]::Round($_.Length / 1MB, 1))
}
Write-Host "frontend bundled: $useDist"
