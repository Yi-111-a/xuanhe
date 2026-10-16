"""天宝：把游戏的 MCP 服务注册给 Codex / Claude Code（setup_mcp.ps1 的 Python 版，只用标准库）。

    python setup_mcp.py                       # 只检测并打印命令，不改任何配置
    python setup_mcp.py --codex --claude      # 执行注册（各自的 `mcp add`）
    python setup_mcp.py --codex --dry-run     # 只打印

选项：--server-exe PATH  指定安装版 tianbao-server.exe；--source  用源码目录（.venv + engine/backend）；
      --sim-home DIR  存档目录（默认 %APPDATA%/tianbao，与桌面版相同）；--claude-scope user|local|project；--name tianbao
不带 --codex / --claude 时绝不修改用户配置。
"""
from __future__ import annotations

import argparse
import glob
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

PRODUCT = "天宝"
HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SAFE = re.compile(r"^[A-Za-z0-9_\-.:/\\=@+,]+$")


def quote(s: str) -> str:
    return s if SAFE.match(s) else f'"{s}"'


def default_home() -> Path:
    appdata = os.environ.get("APPDATA")
    return Path(appdata) / "tianbao" if appdata else Path.home() / ".tianbao"


def find_installed_exe() -> Path | None:
    cands: list[Path] = []
    if os.environ.get("TIANBAO_SERVER_EXE"):
        cands.append(Path(os.environ["TIANBAO_SERVER_EXE"]))
    cands.append(REPO / "server" / "tianbao-server.exe")  # script shipped inside the install
    if sys.platform == "win32":
        import winreg

        for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
            try:
                with winreg.OpenKey(hive, rf"Software\Microsoft\Windows\CurrentVersion\Uninstall\{PRODUCT}") as key:
                    loc = str(winreg.QueryValueEx(key, "InstallLocation")[0]).strip('"')
                    cands.append(Path(loc) / "server" / "tianbao-server.exe")
            except OSError:
                pass
    if os.environ.get("LOCALAPPDATA"):
        cands.append(Path(os.environ["LOCALAPPDATA"]) / PRODUCT / "server" / "tianbao-server.exe")
    return next((c.resolve() for c in cands if c.is_file()), None)


def source_launch(home: Path) -> tuple[str, list[str], dict[str, str]] | None:
    py = REPO / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    if not (py.is_file() and (REPO / "engine" / "backend" / "cli" / "main.py").is_file()):
        return None
    env = {"LLM_SIM_HOME": str(home), "SIM_SCENARIOS_DIR": str(REPO / "scenarios"), "SIM_GAME_ROOT": str(REPO), "PYTHONUTF8": "1"}
    return str(py), ["-m", "cli.main", "mcp"], env


def codex_cmd() -> list[str]:
    js = Path(os.environ.get("APPDATA", "")) / "npm" / "node_modules" / "@openai" / "codex" / "bin" / "codex.js"
    node = shutil.which("node")
    if os.environ.get("APPDATA") and js.is_file() and node:
        return [node, str(js)]  # the npm .cmd shim (cmd.exe) can mangle non-ASCII arguments
    exe = shutil.which("codex")
    if not exe:
        sys.exit("找不到 codex（npm i -g @openai/codex）。")
    return [exe]


def claude_cmd() -> list[str]:
    exe = shutil.which("claude") or (str(Path.home() / ".local/bin/claude.exe") if (Path.home() / ".local/bin/claude.exe").is_file() else None)
    if not exe and os.environ.get("APPDATA"):
        found = sorted(glob.glob(os.path.join(os.environ["APPDATA"], "Claude", "claude-code", "*", "*", "claude.exe")), key=os.path.getmtime)
        exe = found[-1] if found else None
    if not exe:
        sys.exit("找不到 claude（Claude Code CLI）。")
    return [exe]


def ensure_codex_approval(name: str) -> None:
    """`codex mcp add` does not write default_tools_approval_mode; `codex exec` needs it."""
    cfg = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex") / "config.toml"
    if not cfg.is_file():
        print(f"警告：未找到 {cfg}")
        return
    lines = cfg.read_text(encoding="utf-8").splitlines()
    headers = {f"[mcp_servers.{name}]", f'[mcp_servers."{name}"]'}
    start = next((i for i, line in enumerate(lines) if line.strip() in headers), -1)
    if start < 0:
        print(f"警告：config.toml 中没有 [mcp_servers.{name}]")
        return
    end = next((i for i in range(start + 1, len(lines)) if lines[i].lstrip().startswith("[")), len(lines))
    want = {"startup_timeout_sec": "60", "tool_timeout_sec": "120", "default_tools_approval_mode": '"approve"'}
    added = [k for k in want if not any(re.match(rf"\s*{k}\s*=", lines[i]) for i in range(start + 1, end))]
    for i in range(start + 1, end):  # an older registration may carry a too-short startup timeout (e.g. 30)
        match = re.match(r"\s*startup_timeout_sec\s*=\s*(\d+(?:\.\d+)?)\s*$", lines[i])
        if match and float(match.group(1)) < float(want["startup_timeout_sec"]):
            lines[i] = f"startup_timeout_sec = {want['startup_timeout_sec']}"
            added.append("startup_timeout_sec（调高）")
    if added:
        shutil.copyfile(cfg, cfg.with_name("config.toml.bak-tianbao"))
        lines[start + 1:start + 1] = [f"{k} = {want[k]}" for k in added if k in want]
        cfg.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"已在 {cfg} 的 [mcp_servers.{name}] 中补上：{', '.join(added)}（备份：config.toml.bak-tianbao）")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--codex", action="store_true", help="注册到 Codex")
    ap.add_argument("--claude", action="store_true", help="注册到 Claude Code")
    ap.add_argument("--server-exe", type=Path)
    ap.add_argument("--source", action="store_true")
    ap.add_argument("--sim-home", type=Path)
    ap.add_argument("--claude-scope", choices=["user", "local", "project"], default="user")
    ap.add_argument("--name", default="tianbao")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", line_buffering=True)  # type: ignore[attr-defined]
        except Exception:
            pass

    home = a.sim_home.resolve() if a.sim_home else default_home()
    exe = None
    if not a.source:
        if a.server_exe:
            if not a.server_exe.is_file():
                sys.exit(f"找不到 {a.server_exe}")
            exe = a.server_exe.resolve()
        else:
            exe = find_installed_exe()
    if exe:
        mode, command, args = "installed", str(exe), ["mcp"]
        env = {"LLM_SIM_HOME": str(home)} if a.sim_home else {}
    else:
        launch = source_launch(home)
        if not launch:
            sys.exit(f"没有找到已安装的《{PRODUCT}》，也不在含 .venv 的源码目录里。请先安装，或用 --server-exe 指定 tianbao-server.exe。")
        mode = "source"
        command, args, env = launch

    pairs = [f"{k}={v}" for k, v in env.items()]
    tail = [command, *args]
    codex_args = ["mcp", "add", a.name, *[x for p in pairs for x in ("--env", p)], "--", *tail]
    claude_args = ["mcp", "add", a.name, "--scope", a.claude_scope, *(["-e", *pairs] if pairs else []), "--", *tail]
    print(f"《{PRODUCT}》MCP 服务（{mode}）：{' '.join(quote(x) for x in tail)}")
    print(f"存档目录：{env.get('LLM_SIM_HOME') or str(home) + '（默认）'}\n")
    print("Codex：      ", "codex " + " ".join(quote(x) for x in codex_args))
    print("Claude Code：", "claude " + " ".join(quote(x) for x in claude_args), "\n")

    if a.codex:
        if a.dry_run:
            print("[dry-run] 不执行 codex。")
        else:
            rc = subprocess.call([*codex_cmd(), *codex_args])
            if rc:
                sys.exit(f"codex mcp add 失败（{rc}）")
            ensure_codex_approval(a.name)
            print("Codex：已注册。验证：codex mcp list")
    if a.claude:
        if a.dry_run:
            print("[dry-run] 不执行 claude。")
        else:
            claude = claude_cmd()
            subprocess.call([*claude, "mcp", "remove", a.name, "--scope", a.claude_scope], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            rc = subprocess.call([*claude, *claude_args])
            if rc:
                sys.exit(f"claude mcp add 失败（{rc}）")
            print("Claude Code：已注册。验证：claude mcp list（在 Claude Code 里 /mcp）")
    if not a.codex and not a.claude:
        print("未改动任何配置。加 --codex 和/或 --claude 以执行上面的注册命令。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
