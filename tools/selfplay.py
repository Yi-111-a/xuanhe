"""Self-play through the MCP server (each step is a real MCP tool call, via tools/mcp_call.py's client).

    python tools/selfplay.py new  [--seed 7] [--difficulty shishi]      # prints the session id
    python tools/selfplay.py brief <session>                             # the full briefing
    python tools/selfplay.py call <tool> '<json args>'                   # any tool
    python tools/selfplay.py turn <session> '<adopted json>' ['<ops json>'] ['<cards json>']
        drafts, prints every clause (applied / rejected / delayed), confirms, then end_turn; a tool error or a rejected
        clause stops the turn with exit code 1 (nothing is swallowed).

State lives in LLM_SIM_HOME (default playtests/home); one process per call, like the MCP clients do.
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mcp import ClientSession
from mcp.client.stdio import stdio_client
from mcp_call import _render, server_params


async def call(tool: str, args: dict) -> tuple[str, bool]:
    async with stdio_client(server_params()) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool, args)
            error = bool(getattr(result, "isError", False) or getattr(result, "is_error", False))
            return _render(result), error


def run(tool: str, args: dict) -> str:
    text, error = asyncio.run(call(tool, args))
    if error:
        print(text)
        raise SystemExit(f"工具出错：{tool}")
    return text


def main(argv: list[str]) -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    if not argv:
        print(__doc__)
        return 2
    cmd = argv[0]
    if cmd == "new":
        seed = int(argv[argv.index("--seed") + 1]) if "--seed" in argv else 7
        args = {"scenario": "xuanhe_1120", "seed": seed}
        if "--difficulty" in argv:
            args["difficulty"] = argv[argv.index("--difficulty") + 1]
        text = run("new_game", args)
        print(text)
        return 0
    if cmd == "brief":
        print(run("briefing", {"session_id": argv[1]}))
        return 0
    if cmd == "call":
        print(run(argv[1], json.loads(argv[2]) if len(argv) > 2 else {}))
        return 0
    if cmd == "turn":
        session = argv[1]
        adopted = json.loads(argv[2]) if len(argv) > 2 else []
        ops = json.loads(argv[3]) if len(argv) > 3 else []
        cards = json.loads(argv[4]) if len(argv) > 4 else []
        if adopted or ops or cards:
            args = {"session_id": session, "adopted": adopted, "ops": ops}
            if cards:
                args["cards"] = cards
            receipt = run("draft_edict", args)
            print(receipt)
            if re.search(r"^\d+\. \[rejected", receipt, re.MULTILINE):
                print("草案有被驳回的条款：本季不确认，请改了再拟。")
                return 1
            edict = re.search(r"edict-[0-9a-f]+", receipt)
            if not edict:
                print("回执里没有诏书编号")
                return 1
            print(run("confirm_edict", {"session_id": session, "edict_id": edict.group(0)}))
        print(run("end_turn", {"session_id": session}))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
