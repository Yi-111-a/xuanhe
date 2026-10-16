# 让 Codex / Claude Code 来玩《天宝》

《天宝》自带一个 MCP 服务：安装版是 `tianbao-server.exe mcp`，源码版是 `.venv\Scripts\python.exe -m cli.main mcp`。
注册之后，Codex 或 Claude Code 就能开局、读简报、召对、下诏、结算回合，**存档与桌面版共用**（默认都在
`%APPDATA%\tianbao`）：模型开的局在桌面版「读档」里能看到，桌面版的局模型也能用 `load_game` 接着玩。

安装版的默认位置是 `%LOCALAPPDATA%\天宝`，MCP 服务就是：

```
"%LOCALAPPDATA%\天宝\server\tianbao-server.exe" mcp
```

它和桌面版用同一套默认值（`LLM_SIM_HOME=%APPDATA%\tianbao`，场景目录取安装目录下的 `scenarios`），不需要另设环境变量。
桌面版「设置」里也会列出本机的现成命令（来自接口 `GET /api/integration`）。

## 一条命令注册

在 PowerShell 里运行（安装版里这个脚本在 `%LOCALAPPDATA%\天宝\integrations\`，源码版在仓库的 `integrations\`）：

```powershell
# 先看看会做什么（只打印，不改任何配置）
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\天宝\integrations\setup_mcp.ps1"

# 注册给 Codex（写入 ~/.codex/config.toml）
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\天宝\integrations\setup_mcp.ps1" -Codex

# 注册给 Claude Code（用户级，所有项目可用）
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\天宝\integrations\setup_mcp.ps1" -Claude
```

- 脚本按顺序找：`-ServerExe` 参数 → 环境变量 `TIANBAO_SERVER_EXE` → 脚本所在的安装目录 → 注册表里的安装位置 →
  `%LOCALAPPDATA%\天宝`；都没有且在源码目录里时，改用 `.venv` + `engine\backend`（也可用 `-Source` 强制）。
- 只有带上 `-Codex` / `-Claude` 才会改配置；`-DryRun` 只打印。`-SimHome <目录>` 换存档目录，`-ClaudeScope local|project` 换 Claude 的作用域。
- `-Codex` 会运行 `codex mcp add`，再在 `[mcp_servers.tianbao]` 里补上 `default_tools_approval_mode = "approve"`
  （`codex exec` 必须有它，否则工具调用会被取消）和超时设置；改之前备份为 `config.toml.bak-tianbao`。
- 没有 PowerShell 时用 Python 版：`python setup_mcp.py --codex --claude`（参数同上，改成 `--server-exe`、`--sim-home` 等）。

## 手动注册

**Codex**

```powershell
codex mcp add tianbao -- "$env:LOCALAPPDATA\天宝\server\tianbao-server.exe" mcp
```

然后在 `~/.codex/config.toml` 的 `[mcp_servers.tianbao]` 下加一行 `default_tools_approval_mode = "approve"`。
或者直接把这一段贴进 `config.toml`（把路径换成你的）：

```toml
[mcp_servers.tianbao]
command = 'C:\Users\<你>\AppData\Local\天宝\server\tianbao-server.exe'
args = ["mcp"]
startup_timeout_sec = 60
tool_timeout_sec = 120
default_tools_approval_mode = "approve"
```

Windows 上若 `codex` 命令把中文路径弄乱（npm 的 `.cmd` 外壳经过 cmd.exe），改用
`node "$env:APPDATA\npm\node_modules\@openai\codex\bin\codex.js" mcp add ...`。

**Claude Code**

```powershell
claude mcp add tianbao -- "$env:LOCALAPPDATA\天宝\server\tianbao-server.exe" mcp                 # 当前项目
claude mcp add tianbao --scope user -- "$env:LOCALAPPDATA\天宝\server\tianbao-server.exe" mcp    # 所有项目
```

或在项目根目录放一个 `.mcp.json`：

```json
{ "mcpServers": { "tianbao": { "type": "stdio", "command": "${LOCALAPPDATA}/天宝/server/tianbao-server.exe", "args": ["mcp"] } } }
```

## Claude Code 插件（含「上朝」技能）

`claude-code/` 是一个插件：自带 MCP 配置（默认安装位置的 `tianbao-server.exe`）和技能 `tianbao`（「上朝」，教模型怎么玩）。

```powershell
claude plugin marketplace add "$env:LOCALAPPDATA\天宝\integrations"     # 源码版：仓库的 integrations 目录
claude plugin install tianbao@tianbao
```

然后在 Claude Code 里说「上朝」或「用 tianbao 开一局」。装在别处时，插件里的 MCP 配置找不到程序，请改用上面的
`setup_mcp.ps1 -Claude`（它注册的是实际路径），插件只留作技能。两种都装会出现两份同样的工具，留一种即可。

## Codex 的游玩说明

`codex/AGENTS.md` 是给 Codex 的游玩说明。在该目录启动 Codex 即可读到：

```powershell
cd "$env:LOCALAPPDATA\天宝\integrations\codex"
codex "上朝：开一局天宝，种子 7"
```

非交互运行（提示词走标准输入，避免中文参数被 cmd.exe 改坏）：

```powershell
$OutputEncoding = [Text.UTF8Encoding]::new($false)   # Windows PowerShell 5.1 默认按 ASCII 管道传给外部程序
"开一局天宝（tianbao_751，种子 7），读简报，下一道诏，结算一季，告诉我结果。" |
  node "$env:APPDATA\npm\node_modules\@openai\codex\bin\codex.js" exec --skip-git-repo-check -
```

## 排查

- `codex mcp list` / `claude mcp list` 能看到 `tianbao` 且状态为已连接。
- 手动试服务：`"%LOCALAPPDATA%\天宝\server\tianbao-server.exe" mcp` 会停在那里等 JSON-RPC（Ctrl+C 退出）。
  源码版自检：`.venv\Scripts\python.exe scripts\mcp_selftest.py --source --home <临时目录>`。
- 服务先秒回 MCP 握手、再在后台加载引擎，正常 1 秒内就能连上；但杀毒软件扫描新文件时 Python 冷启动可能拖到几十秒，
  所以 Codex 配置一律写 `startup_timeout_sec = 60`（脚本会补上或把更小的值调到 60）。Claude Code 没有按服务器的启动超时，
  需要时设环境变量 `MCP_TIMEOUT=60000`（毫秒）再启动 `claude`。
- 模型和桌面版看到的存档不一致：检查两边的 `LLM_SIM_HOME` 是否相同（桌面版「设置」里的命令会写明）。
