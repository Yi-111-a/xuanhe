# 天宝：把游戏的 MCP 服务注册给 Codex / Claude Code，让外部模型与桌面版共用存档。
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File setup_mcp.ps1                 # 只检测并打印命令，不改任何配置
#   powershell -NoProfile -ExecutionPolicy Bypass -File setup_mcp.ps1 -Codex          # 注册到 Codex（~/.codex/config.toml）
#   powershell -NoProfile -ExecutionPolicy Bypass -File setup_mcp.ps1 -Claude         # 注册到 Claude Code（用户级）
#   ... -Codex -Claude -DryRun                                                          # 只打印将要执行的命令
#
# 选项：-ServerExe <tianbao-server.exe>  指定安装版；-Source  用源码目录（.venv + engine/backend）；
#       -SimHome <目录>  存档目录（默认 %APPDATA%\tianbao，与桌面版相同）；-ClaudeScope user|local|project；
#       -Name <服务名>（默认 tianbao）。不带 -Codex / -Claude 时绝不修改用户配置。
param(
    [switch]$Codex,
    [switch]$Claude,
    [string]$ServerExe = '',
    [switch]$Source,
    [string]$SimHome = '',
    [ValidateSet('user', 'local', 'project')][string]$ClaudeScope = 'user',
    [string]$Name = 'tianbao',
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false) } catch {}
$Utf8NoBom = New-Object Text.UTF8Encoding $false
$Product = '天宝'

function Find-InstalledExe {
    $candidates = @()
    if ($env:TIANBAO_SERVER_EXE) { $candidates += $env:TIANBAO_SERVER_EXE }
    # this script shipped inside the install: <install>\integrations\setup_mcp.ps1
    $candidates += (Join-Path (Split-Path -Parent $PSScriptRoot) 'server\tianbao-server.exe')
    foreach ($hive in 'HKCU:', 'HKLM:') {
        try {
            $loc = (Get-ItemProperty -Path "$hive\Software\Microsoft\Windows\CurrentVersion\Uninstall\$Product" -ErrorAction Stop).InstallLocation
            if ($loc) { $candidates += (Join-Path $loc.Trim('"') 'server\tianbao-server.exe') }
        } catch {}
    }
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA "$Product\server\tianbao-server.exe") }
    foreach ($c in $candidates) { if ($c -and (Test-Path -LiteralPath $c -PathType Leaf)) { return (Resolve-Path -LiteralPath $c).Path } }
    return $null
}

function Find-SourceCheckout {
    $repo = Split-Path -Parent $PSScriptRoot
    $py = Join-Path $repo '.venv\Scripts\python.exe'
    $backend = Join-Path $repo 'engine\backend'
    if ((Test-Path -LiteralPath $py) -and (Test-Path -LiteralPath (Join-Path $backend 'cli\main.py'))) {
        return @{ Repo = $repo; Python = $py; Backend = $backend }
    }
    return $null
}

$defaultHome = if ($env:APPDATA) { Join-Path $env:APPDATA 'tianbao' } else { Join-Path $HOME '.tianbao' }
$serverEnv = [ordered]@{}
if ($ServerExe) {
    if (-not (Test-Path -LiteralPath $ServerExe -PathType Leaf)) { throw "找不到 $ServerExe" }
    $ServerExe = (Resolve-Path -LiteralPath $ServerExe).Path
}
$exe = $null
if (-not $Source) { $exe = if ($ServerExe) { $ServerExe } else { Find-InstalledExe } }
if ($exe) {
    $mode = 'installed'
    $command = $exe
    $argsList = @('mcp')
    if ($SimHome) { $serverEnv['LLM_SIM_HOME'] = [IO.Path]::GetFullPath($SimHome) }
} else {
    $src = Find-SourceCheckout
    if (-not $src) {
        throw "没有找到已安装的《$Product》（$env:LOCALAPPDATA\$Product\server\tianbao-server.exe），也不在含 .venv 的源码目录里。请先安装，或用 -ServerExe 指定 tianbao-server.exe。"
    }
    $mode = 'source'
    $command = $src.Python
    $argsList = @('-m', 'cli.main', 'mcp')
    $serverEnv['LLM_SIM_HOME'] = if ($SimHome) { [IO.Path]::GetFullPath($SimHome) } else { $defaultHome }
    $serverEnv['SIM_SCENARIOS_DIR'] = Join-Path $src.Repo 'scenarios'
    $serverEnv['SIM_GAME_ROOT'] = $src.Repo
    $serverEnv['PYTHONUTF8'] = '1'
}

function Quote([string]$s) { if ($s -match '^[A-Za-z0-9_\-.:/\\=@+,]+$') { $s } else { '"' + $s + '"' } }
$envPairs = @($serverEnv.Keys | ForEach-Object { "$_=$($serverEnv[$_])" })
$tail = @($command) + $argsList
$codexArgs = @('mcp', 'add', $Name) + @($envPairs | ForEach-Object { '--env', $_ }) + @('--') + $tail
$claudeArgs = @('mcp', 'add', $Name, '--scope', $ClaudeScope)
if ($envPairs.Count) { $claudeArgs += @('-e') + $envPairs }
$claudeArgs += @('--') + $tail
function Show([string]$exeName, [string[]]$a) { "$exeName " + (($a | ForEach-Object { Quote $_ }) -join ' ') }

Write-Host "《$Product》MCP 服务（$mode）：$((@($tail) | ForEach-Object { Quote $_ }) -join ' ')"
Write-Host "存档目录：$(if ($serverEnv['LLM_SIM_HOME']) { $serverEnv['LLM_SIM_HOME'] } else { "$defaultHome（默认）" })"
Write-Host ''
Write-Host 'Codex：      ' (Show 'codex' $codexArgs)
Write-Host 'Claude Code：' (Show 'claude' $claudeArgs)
Write-Host ''

# ------------------------------------------------------------------ Codex
function Invoke-Codex([string[]]$a) {
    $js = if ($env:APPDATA) { Join-Path $env:APPDATA 'npm\node_modules\@openai\codex\bin\codex.js' } else { '' }
    $node = Get-Command node -ErrorAction SilentlyContinue
    # the npm .cmd shim goes through cmd.exe, which can mangle non-ASCII (e.g. 天宝) arguments: call codex.js via node
    $cx = Get-Command codex -ErrorAction SilentlyContinue
    if (-not ($js -and (Test-Path -LiteralPath $js) -and $node) -and -not $cx) { throw '找不到 codex（npm i -g @openai/codex）。' }
    $ErrorActionPreference = 'Continue'  # native tools write progress to stderr
    if ($js -and (Test-Path -LiteralPath $js) -and $node) { & $node.Source $js @a | Out-Host } else { & $cx.Source @a | Out-Host }
    return $LASTEXITCODE
}

function Set-CodexApproval {
    $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
    $cfg = Join-Path $codexHome 'config.toml'
    if (-not (Test-Path -LiteralPath $cfg)) { Write-Warning "未找到 $cfg"; return }
    $lines = [Collections.Generic.List[string]]::new()
    foreach ($l in [IO.File]::ReadAllLines($cfg, $Utf8NoBom)) { $lines.Add($l) }
    $header = "[mcp_servers.$Name]"
    $start = -1
    for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i].Trim() -eq $header -or $lines[$i].Trim() -eq "[mcp_servers.`"$Name`"]") { $start = $i; break } }
    if ($start -lt 0) { Write-Warning "config.toml 中没有 $header"; return }
    $end = $lines.Count
    for ($i = $start + 1; $i -lt $lines.Count; $i++) { if ($lines[$i].TrimStart().StartsWith('[')) { $end = $i; break } }
    $want = [ordered]@{ 'startup_timeout_sec' = '60'; 'tool_timeout_sec' = '120'; 'default_tools_approval_mode' = '"approve"' }
    $added = @()
    foreach ($k in $want.Keys) {
        $has = $false
        for ($i = $start + 1; $i -lt $end; $i++) { if ($lines[$i] -match "^\s*$k\s*=") { $has = $true; break } }
        if (-not $has) { $lines.Insert($start + 1 + $added.Count, "$k = $($want[$k])"); $end++; $added += $k }
    }
    # an older registration may carry a too-short startup timeout (e.g. 30)
    for ($i = $start + 1; $i -lt $end; $i++) {
        if ($lines[$i] -match '^\s*startup_timeout_sec\s*=\s*(\d+(\.\d+)?)\s*$' -and [double]$Matches[1] -lt [double]$want['startup_timeout_sec']) {
            $lines[$i] = "startup_timeout_sec = $($want['startup_timeout_sec'])"; $added += 'startup_timeout_sec（调高）'
        }
    }
    if ($added.Count) {
        Copy-Item -LiteralPath $cfg -Destination "$cfg.bak-tianbao" -Force
        [IO.File]::WriteAllText($cfg, (($lines -join "`n") + "`n"), $Utf8NoBom)
        Write-Host "已在 $cfg 的 $header 中补上：$($added -join ', ')（备份：config.toml.bak-tianbao）"
    }
}

if ($Codex) {
    if ($DryRun) { Write-Host '[DryRun] 不执行 codex。' }
    else {
        $rc = Invoke-Codex $codexArgs
        if ($rc -ne 0) { throw "codex mcp add 失败（$rc）" }
        Set-CodexApproval  # codex exec needs default_tools_approval_mode = "approve", which `mcp add` does not write
        Write-Host 'Codex：已注册。验证：codex mcp list'
    }
}

# ------------------------------------------------------------------ Claude Code
function Find-Claude {
    $c = Get-Command claude -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $local = Join-Path $HOME '.local\bin\claude.exe'
    if (Test-Path -LiteralPath $local) { return $local }
    if ($env:APPDATA) {
        $bundled = Get-ChildItem -Path (Join-Path $env:APPDATA 'Claude\claude-code') -Filter claude.exe -Recurse -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($bundled) { return $bundled.FullName }
    }
    if ($env:LOCALAPPDATA) {
        # Claude desktop is an MSIX app: its %APPDATA% is redirected to Packages\Claude_*\LocalCache\Roaming
        $packages = Join-Path $env:LOCALAPPDATA 'Packages'
        $msix = Get-ChildItem -Path $packages -Directory -Filter 'Claude_*' -ErrorAction SilentlyContinue |
            ForEach-Object { Get-ChildItem -Path (Join-Path $_.FullName 'LocalCache\Roaming\Claude\claude-code') -Filter claude.exe -Recurse -ErrorAction SilentlyContinue } |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($msix) { return $msix.FullName }
    }
    return $null
}

if ($Claude) {
    if ($DryRun) { Write-Host '[DryRun] 不执行 claude。' }
    else {
        $cl = Find-Claude
        if (-not $cl) { throw '找不到 claude（Claude Code CLI）。' }
        $ErrorActionPreference = 'Continue'  # native tools write to stderr; checked via $LASTEXITCODE
        & $cl mcp remove $Name --scope $ClaudeScope 2>&1 | Out-Null  # replace an older registration of the same name/scope
        & $cl @claudeArgs | Out-Host
        $ErrorActionPreference = 'Stop'
        if ($LASTEXITCODE -ne 0) { throw "claude mcp add 失败（$LASTEXITCODE）" }
        Write-Host 'Claude Code：已注册。验证：claude mcp list（在 Claude Code 里 /mcp）'
    }
}

if (-not $Codex -and -not $Claude) {
    Write-Host '未改动任何配置。加 -Codex 和/或 -Claude 以执行上面的注册命令。'
}
