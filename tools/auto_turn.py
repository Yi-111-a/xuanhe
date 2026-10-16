"""Play seasons quickly via MCP for self-play: adopt one option per memorial (first by default),
with per-memorial overrides, resolve pending choices, and end the turn.

    python tools/auto_turn.py <session> [--turns N] [--pick first|last]
        [--choose memorial_id=option_id ...] [--choice prefix=option_id ...]

Prints a compact digest of each season: crisis, key resources, events, outcome.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys

from mcp_call import ClientSession, server_params, stdio_client, _render

MEMORIAL = re.compile(r"^### \[([\w-]+)\]", re.M)
OPTION = re.compile(r"^- 选项 `([\w-]+)`", re.M)
CHOICE = re.compile(r"\[(choice-[\w-]+)\][^\n]*?选项：((?:`[\w-]+`「[^」]*」；?)+)")


def plan(briefing: str, pick: str, overrides: dict[str, str]) -> list[dict[str, str]]:
    adopted = []
    blocks = re.split(r"(?=^### \[)", briefing, flags=re.M)
    for block in blocks:
        head = MEMORIAL.match(block)
        if not head:
            continue
        memorial = head.group(1)
        options = OPTION.findall(block)
        if not options:
            continue
        option = overrides.get(memorial) or (options[-1] if pick == "last" else options[0])
        adopted.append({"memorial_id": memorial, "option_id": option})
    return adopted


async def call(session: ClientSession, tool: str, args: dict) -> str:
    return _render(await session.call_tool(tool, args))


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("session")
    parser.add_argument("--turns", type=int, default=1)
    parser.add_argument("--pick", default="first")
    parser.add_argument("--choose", nargs="*", default=[])
    parser.add_argument("--choice", nargs="*", default=[])
    args = parser.parse_args()
    overrides = dict(item.split("=", 1) for item in args.choose)
    choice_overrides = dict(item.split("=", 1) for item in args.choice)
    sid = args.session
    async with stdio_client(server_params()) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for _ in range(args.turns):
                brief = await call(session, "briefing", {"session_id": sid})
                if "本局已终局" in brief or "终局复盘" in brief:
                    print("[终局]", brief[:600])
                    return 0
                for choice_id, options in CHOICE.findall(brief):
                    ids = re.findall(r"`([\w-]+)`", options)
                    option = next((v for k, v in choice_overrides.items() if choice_id.startswith(k)), ids[0])
                    print("choose", choice_id, option, (await call(session, "choose", {"session_id": sid, "choice_id": choice_id, "option_id": option}))[:160])
                adopted = plan(brief, args.pick, overrides)
                receipt = await call(session, "draft_edict", {"session_id": sid, "adopted": adopted})
                bad = [line for line in receipt.splitlines() if "rejected" in line or "错误" in line]
                edict = re.search(r"edict-[0-9a-f]+", receipt)
                if edict:
                    await call(session, "confirm_edict", {"session_id": sid, "edict_id": edict.group(0)})
                report = await call(session, "end_turn", {"session_id": sid})
                head = report.splitlines()[0] if report else ""
                crisis = re.search(r"危机计 渔阳鼙鼓：([^\n]*)", report)
                events = re.search(r"## 触发事件：([^\n]*)", report)
                outcome = re.search(r"本局已终局：([^\n*]*)", report)
                print(f"{head} | 采纳 {','.join(a['memorial_id'] + '=' + a['option_id'] for a in adopted)}")
                print(f"   鼙鼓 {crisis.group(1) if crisis else '?'} | 事件 {events.group(1) if events else '-'}")
                for line in bad:
                    print("   !", line[:200])
                if outcome or "GAME_OVER" in report:
                    print("   [终局]", outcome.group(1) if outcome else report[:200])
                    return 0
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    raise SystemExit(asyncio.run(main()))
