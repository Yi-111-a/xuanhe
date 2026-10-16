"""Call one tool on the tianbao MCP server over stdio and print the result.

Usage:
    python tools/mcp_call.py <tool> ['<json args>']
    python tools/mcp_call.py --list

Used for self-play: every call spawns `sim mcp`, so state lives only in the
session files under LLM_SIM_HOME (default: playtests/home).
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"


def server_params() -> StdioServerParameters:
    env = {
        **os.environ,
        "PYTHONUTF8": "1",
        "PYTHONIOENCODING": "utf-8",
        "SIM_GAME_ROOT": str(ROOT),
        "SIM_SCENARIOS_DIR": str(ROOT / "scenarios"),
        "LLM_SIM_HOME": os.environ.get("LLM_SIM_HOME", str(ROOT / "playtests" / "home")),
        "SIM_MCP_MODE": os.environ.get("SIM_MCP_MODE", "client"),
        "SIM_MCP_NAME": "tianbao",
    }
    return StdioServerParameters(
        command=str(PYTHON),
        args=["-m", "cli.main", "mcp"],
        env=env,
        cwd=str(ROOT / "engine" / "backend"),
    )


def _render(result: object) -> str:
    content = getattr(result, "content", None) or []
    parts = []
    for item in content:
        text = getattr(item, "text", None)
        parts.append(text if text is not None else repr(item))
    structured = getattr(result, "structuredContent", None) or getattr(result, "structured_content", None)
    if structured and not parts:
        parts.append(json.dumps(structured, ensure_ascii=False, indent=2))
    if getattr(result, "isError", False) or getattr(result, "is_error", False):
        parts.insert(0, "[TOOL ERROR]")
    return "\n".join(parts)


async def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    async with stdio_client(server_params()) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            if argv[0] == "--list":
                tools = await session.list_tools()
                for tool in tools.tools:
                    print(f"- {tool.name}: {(tool.description or '').splitlines()[0]}")
                return 0
            args = json.loads(argv[1]) if len(argv) > 1 else {}
            result = await session.call_tool(argv[0], args)
            print(_render(result))
            return 1 if (getattr(result, "isError", False) or getattr(result, "is_error", False)) else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    raise SystemExit(asyncio.run(main(sys.argv[1:])))
