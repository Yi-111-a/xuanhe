"""Run the engine API for local development against this repo's scenarios.

    .venv/Scripts/python scripts/dev_backend.py [--port 8765] [--home playtests/home-dev]
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--home", default=str(ROOT / "playtests" / "home-dev"))
    args = parser.parse_args()
    os.environ.setdefault("SIM_GAME_ROOT", str(ROOT))
    os.environ.setdefault("SIM_SCENARIOS_DIR", str(ROOT / "scenarios"))
    os.environ["LLM_SIM_HOME"] = args.home
    os.environ.setdefault("PYTHONUTF8", "1")
    os.environ.setdefault("SIM_MCP_NAME", "tianbao")  # GET /api/integration names the MCP server like the app
    os.chdir(ROOT / "engine" / "backend")
    sys.path.insert(0, str(ROOT / "engine" / "backend"))
    import uvicorn

    uvicorn.run("api.app:app", host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
