"""Let an external agent CLI play a full game of 天宝 through the MCP server.

    python tools/agent_play.py codex  --run gpt-01  [--model gpt-6.1-sol] [--seed 7]
    python tools/agent_play.py claude --run claude-01 [--seed 7]

Each run gets its own LLM_SIM_HOME under playtests/<agent>/<run>/home, a
transcript (events.jsonl) and the agent's own report.md written in that folder.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"
# A frozen engine checkout keeps long agent runs stable while engine/ is being edited.
ENGINE = Path(os.environ.get("TIANBAO_ENGINE_DIR", ROOT / "engine"))

PROMPT = """你要完整地玩一局桌面策略游戏《天宝》：你扮演天宝十载（751 年）的唐玄宗。游戏通过名为 tianbao 的 MCP 服务提供工具。

规则：
1. 先调用 list_scenarios，再用 new_game 开局（scenario=tianbao_751，seed={seed}{difficulty_arg}）。记下 session_id。
2. 每一季：调用 briefing 阅读局势；至少召见一位大臣（audience，你根据返回的人设和事实摘要自行扮演他回话，数字只能引用工具给出的值）；需要时开 court_debate；
   然后用 draft_edict 下诏（可以 adopted 采纳奏疏选项，也可以 ops 直接提出操作，op 格式见 op_reference），读回执后 confirm_edict；有待决事件就用 choose 选择；最后 end_turn。
3. 一直玩到游戏给出 outcome（结局或失败）为止，不要中途停下，也不要提前问我。你的目标是取得最好的结局（阻止安史之乱、财政不枯竭、君威 ≥ 50）。
4. 工具报错时，读懂错误说明，修正参数再试；同一个错误连续出现 3 次就换一种做法，并把它记进报告。
5. 结束后，把一份中文试玩报告写到文件 {report}：结局、每季一行的大事记、你遇到的所有问题（工具报错、看不懂的说明、前后矛盾的数字、卡住的地方、认为不合理的机制），以及改进建议。问题请尽量具体（哪一季、哪个工具、什么参数、返回了什么）。
"""


def mcp_env(home: Path) -> dict[str, str]:
    return {
        "PYTHONUTF8": "1",
        "PYTHONIOENCODING": "utf-8",
        "SIM_GAME_ROOT": str(ROOT),
        "SIM_SCENARIOS_DIR": str(ROOT / "scenarios"),
        "LLM_SIM_HOME": str(home),
        "SIM_MCP_MODE": "client",
        "SIM_MCP_NAME": "tianbao",
    }


def run_codex(run_dir: Path, model: str) -> list[str]:
    env = mcp_env(run_dir / "home")
    server = f"mcp_servers.tianbao"
    # Call codex.js through node directly: the npm .CMD shim goes through cmd.exe, whose
    # code page mangles UTF-8 arguments. The prompt itself is sent on stdin (see main()).
    codex_js = Path(os.environ["APPDATA"]) / "npm" / "node_modules" / "@openai" / "codex" / "bin" / "codex.js"
    cmd = [
        shutil.which("node") or "node", str(codex_js), "exec", "--skip-git-repo-check", "--json",
        "-m", model, "-C", str(run_dir),
        "-s", "workspace-write", "-c", 'windows.sandbox="unelevated"',
        "-c", f'{server}.command={json.dumps(str(PYTHON))}',
        "-c", f'{server}.args=["-m","cli.main","mcp"]',
        "-c", f'{server}.cwd={json.dumps(str(ENGINE / "backend"))}',
        "-c", f"{server}.env={{{', '.join(f'{k}={json.dumps(v)}' for k, v in env.items())}}}",
        # Cold start can take tens of seconds while antivirus scans the venv (gpt-09 never mounted the server).
        "-c", f"{server}.startup_timeout_sec=60",
        "-c", f"{server}.tool_timeout_sec=120",
        "-c", f'{server}.default_tools_approval_mode="approve"',
    ]
    return cmd


def run_claude(run_dir: Path, prompt: str) -> list[str]:
    config = {
        "mcpServers": {
            "tianbao": {
                "command": str(PYTHON),
                "args": ["-m", "cli.main", "mcp"],
                "cwd": str(ENGINE / "backend"),
                "env": mcp_env(run_dir / "home"),
            }
        }
    }
    config_path = run_dir / "mcp.json"
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
    claude = os.environ.get("CLAUDE_CLI") or shutil.which("claude") or "claude"
    return [
        claude, "-p", prompt, "--output-format", "stream-json", "--verbose",
        "--mcp-config", str(config_path), "--strict-mcp-config",
        "--allowedTools", "mcp__tianbao__*", "Write",
        "--max-turns", "400",
    ]


def _decode(data: bytes) -> str:
    lines = []
    for raw in data.splitlines():
        try:
            lines.append(raw.decode("utf-8"))
        except UnicodeDecodeError:
            lines.append(raw.decode("cp936", errors="replace"))
    return "\n".join(lines) + ("\n" if lines else "")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("agent", choices=["codex", "claude"])
    parser.add_argument("--run", required=True)
    parser.add_argument("--model", default="gpt-6.1-sol")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--difficulty", default="")
    args = parser.parse_args()

    run_dir = ROOT / "playtests" / args.agent / args.run
    (run_dir / "home").mkdir(parents=True, exist_ok=True)
    report = run_dir / "report.md"
    difficulty_arg = f"，difficulty={args.difficulty}" if args.difficulty else ""
    prompt = PROMPT.format(seed=args.seed, report=report, difficulty_arg=difficulty_arg)
    cmd = run_codex(run_dir, args.model) if args.agent == "codex" else run_claude(run_dir, prompt)

    started = time.time()
    stdin_prompt = prompt.encode("utf-8") if args.agent == "codex" else None
    # Claude Code has no per-server startup timeout in --mcp-config; MCP_TIMEOUT (ms) raises it for all servers.
    env = {**os.environ, "MCP_TIMEOUT": os.environ.get("MCP_TIMEOUT", "60000")}
    proc = subprocess.run(cmd, cwd=run_dir, input=stdin_prompt, capture_output=True, env=env)
    # On a Chinese-locale Windows, codex writes its JSON stream in the ANSI code page (cp936),
    # not UTF-8; decode each line with whichever codec is valid.
    (run_dir / "events.jsonl").write_text(_decode(proc.stdout), encoding="utf-8")
    (run_dir / "stderr.txt").write_text(_decode(proc.stderr), encoding="utf-8")
    elapsed = time.time() - started
    summary = {"agent": args.agent, "run": args.run, "exit": proc.returncode, "seconds": round(elapsed), "report": report.exists()}
    (run_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))
    return proc.returncode


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    raise SystemExit(main())
