"""Play one season through the tianbao MCP server with the official `mcp` client SDK.

    python scripts/mcp_selftest.py --exe "<install>/server/tianbao-server.exe" [--home DIR]
    python scripts/mcp_selftest.py --source [--home DIR]          # desktop/sidecar/entry.py mcp from this checkout

Calls list_scenarios -> new_game -> briefing -> end_turn -> list_saves, checks the Chinese text comes back
intact (no mojibake / U+FFFD) and prints a JSON summary on the last line. Exit code 0 = all good.
Used by scripts/smoke-desktop.py (imported as a module) and handy by hand.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
MOJIBAKE = re.compile("�|锟斤拷|[ÃåæçèÂ][\u0080-¿]")
SESSION_RE = re.compile(r"session_id=([0-9a-zA-Z_\-]+)")


def _text(result: Any) -> str:
    return "\n".join(getattr(item, "text", "") or "" for item in (getattr(result, "content", None) or []))


def _is_error(result: Any) -> bool:
    return bool(getattr(result, "isError", False) or getattr(result, "is_error", False))


async def play_one_season(command: str, args: list[str], env: dict[str, str] | None = None, scenario: str = "tianbao_751",
                          seed: int = 1, cwd: str | None = None, load_session: str | None = None) -> dict[str, Any]:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    full_env = {k: v for k, v in os.environ.items() if k not in ("PYTHONUTF8", "PYTHONIOENCODING")}
    # deliberately do NOT force UTF-8 on the child: the server must cope with a cp936 console by itself
    full_env.update(env or {})
    params = StdioServerParameters(command=command, args=args, env=full_env, cwd=cwd)
    out: dict[str, Any] = {"ok": False, "steps": {}}
    t0 = time.time()
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            out["startup_s"] = round(time.time() - t0, 2)
            tools = sorted(t.name for t in (await session.list_tools()).tools)
            out["tools"] = tools
            listed = await session.call_tool("list_scenarios", {})
            out["steps"]["list_scenarios"] = not _is_error(listed) and scenario in _text(listed)
            created = await session.call_tool("new_game", {"scenario": scenario, "seed": seed})
            text = _text(created)
            match = SESSION_RE.search(text)
            out["steps"]["new_game"] = not _is_error(created) and bool(match)
            if not match:
                out["error"] = text[:400]
                return out
            sid = match.group(1)
            out["session_id"] = sid
            brief = await session.call_tool("briefing", {"session_id": sid})
            btext = _text(brief)
            out["steps"]["briefing"] = not _is_error(brief) and len(btext) > 200
            out["briefing_head"] = btext.splitlines()[0][:80] if btext else ""
            ended = await session.call_tool("end_turn", {"session_id": sid})
            etext = _text(ended)
            out["steps"]["end_turn"] = not _is_error(ended) and len(etext) > 50
            out["end_turn_head"] = etext.splitlines()[0][:80] if etext else ""
            saves = await session.call_tool("list_saves", {})
            out["steps"]["list_saves"] = sid in _text(saves)
            if load_session:  # a save made elsewhere (e.g. by the desktop UI) must be playable here too
                loaded = await session.call_tool("load_game", {"session_id": load_session})
                out["steps"]["load_other_save"] = not _is_error(loaded) and len(_text(loaded)) > 200
            all_text = "\n".join([_text(listed), text, btext, etext])
            out["steps"]["chinese_intact"] = ("天宝" in all_text or "天寶" in all_text) and not MOJIBAKE.search(all_text)
    out["seconds"] = round(time.time() - t0, 2)
    out["ok"] = all(out["steps"].values())
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--exe", type=Path, help="installed tianbao-server.exe")
    g.add_argument("--source", action="store_true", help="run desktop/sidecar/entry.py mcp with the repo venv")
    ap.add_argument("--home", type=Path, help="LLM_SIM_HOME (default: the app default %%APPDATA%%/tianbao)")
    ap.add_argument("--scenario", default="tianbao_751")
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    env = {"LLM_SIM_HOME": str(a.home)} if a.home else {}
    if a.exe:
        command, args = str(a.exe), ["mcp"]
    else:
        command, args = str(ROOT / ".venv" / "Scripts" / "python.exe"), [str(ROOT / "desktop" / "sidecar" / "entry.py"), "mcp"]
    result = asyncio.run(play_one_season(command, args, env, a.scenario, a.seed))
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
