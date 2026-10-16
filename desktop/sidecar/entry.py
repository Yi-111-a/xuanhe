"""Frozen / dev entry point for the tianbao-server sidecar.

`tianbao-server serve --host H --port P`  -> run the FastAPI engine directly (no string import,
so PyInstaller can see every module) and make sure CORS allows the desktop webview origins.
`tianbao-server mcp [--mode client|server]` -> stdio MCP server for Codex / Claude Code, sharing the
app's saves. Anything else (`validate`, ...) is delegated to the engine CLI (`cli.main:app`).

Both modes get the same defaults as the desktop app unless the caller sets them:
  LLM_SIM_HOME      = %APPDATA%/tianbao
  SIM_SCENARIOS_DIR = <install>/scenarios   (frozen: next to server/; dev: <repo>/scenarios)
  SIM_GAME_ROOT     = <install>             (frozen)                 dev: <repo>
"""
from __future__ import annotations

import json
import multiprocessing
import os
import sys
from pathlib import Path

FROZEN = bool(getattr(sys, "frozen", False))
MCP_NAME = "tianbao"

os.environ.setdefault("PYTHONUTF8", "1")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
for _stream in (sys.stdout, sys.stderr, sys.stdin):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except Exception:
        pass

if not FROZEN:
    # dev mode: run straight from the repo (tianbao/desktop/sidecar/entry.py -> tianbao/engine/backend)
    _backend = Path(__file__).resolve().parents[2] / "engine" / "backend"
    if str(_backend) not in sys.path:
        sys.path.insert(0, str(_backend))

CORS_ORIGINS = [
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]


def roaming_appdata() -> Path | None:
    """%APPDATA% via the known-folder API, so it is right even when a client (e.g. Codex) strips the environment."""
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes

            class GUID(ctypes.Structure):
                _fields_ = [("d1", wintypes.DWORD), ("d2", wintypes.WORD), ("d3", wintypes.WORD), ("d4", ctypes.c_ubyte * 8)]

            rid = GUID(0x3EB685DB, 0x65F9, 0x4CF6, (ctypes.c_ubyte * 8)(0xA0, 0x3A, 0xE3, 0xEF, 0x65, 0x72, 0x9F, 0x3D))  # FOLDERID_RoamingAppData
            out = ctypes.c_wchar_p()
            if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(rid), 0, None, ctypes.byref(out)) == 0 and out.value:
                path = Path(out.value)
                ctypes.windll.ole32.CoTaskMemFree(out)
                return path
        except Exception:
            pass
    appdata = os.environ.get("APPDATA")
    return Path(appdata) if appdata else None


def default_env() -> dict[str, str]:
    """The environment the desktop shell would give the engine for this install."""
    if FROZEN:
        game_root = Path(sys.executable).resolve().parent.parent  # <install>/server/tianbao-server.exe
    else:
        game_root = Path(__file__).resolve().parents[2]  # repo root
    appdata = roaming_appdata()
    home = appdata / "tianbao" if appdata else Path.home() / ".tianbao"
    return {
        "LLM_SIM_HOME": str(home),
        "SIM_SCENARIOS_DIR": str(game_root / "scenarios"),
        "SIM_GAME_ROOT": str(game_root),
    }


def _same_path(a: str, b: str) -> bool:
    return os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))


def apply_defaults() -> dict[str, str]:
    defaults = default_env()
    for key, value in defaults.items():
        os.environ.setdefault(key, value)
    os.environ.setdefault("SIM_MCP_NAME", MCP_NAME)
    return defaults


def publish_mcp_launch(defaults: dict[str, str]) -> None:
    """Tell GET /api/integration how to start the MCP server for this very install."""
    if not FROZEN or os.environ.get("SIM_MCP_LAUNCH"):
        return  # dev: the engine's own default (venv python -m cli.main mcp + env) is exact
    env = {k: os.environ[k] for k in defaults if k in os.environ and not _same_path(os.environ[k], defaults[k])}
    spec = {"name": MCP_NAME, "mode": "installed", "command": str(Path(sys.executable).resolve()), "args": ["mcp"], "env": env}
    os.environ["SIM_MCP_LAUNCH"] = json.dumps(spec, ensure_ascii=False)


def _ensure_cors(app) -> None:
    from starlette.middleware.cors import CORSMiddleware

    if any(m.cls is CORSMiddleware for m in getattr(app, "user_middleware", [])):
        return
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_origin_regex=r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$",
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _serve(argv: list[str]) -> None:
    host, port = "127.0.0.1", 8000
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--host" and i + 1 < len(argv):
            host = argv[i + 1]
            i += 2
        elif arg == "--port" and i + 1 < len(argv):
            port = int(argv[i + 1])
            i += 2
        elif arg.startswith("--host="):
            host = arg.split("=", 1)[1]
            i += 1
        elif arg.startswith("--port="):
            port = int(arg.split("=", 1)[1])
            i += 1
        else:
            i += 1

    import uvicorn

    from api.app import app

    _ensure_cors(app)
    uvicorn.run(app, host=host, port=port, log_level="info")


def _mcp(argv: list[str]) -> None:
    mode = ""
    for i, arg in enumerate(argv):
        if arg == "--mode" and i + 1 < len(argv):
            mode = argv[i + 1]
        elif arg.startswith("--mode="):
            mode = arg.split("=", 1)[1]
    # the MCP SDK re-wraps fd 0/1 as UTF-8 itself; logs go to stderr (already UTF-8 above)
    from simcore.mcp.server import build_server

    build_server(mode=mode or None).run("stdio")


def main() -> None:
    multiprocessing.freeze_support()
    defaults = apply_defaults()
    argv = sys.argv[1:]
    if argv and argv[0] == "serve":
        publish_mcp_launch(defaults)
        _serve(argv[1:])
        return
    if argv and argv[0] == "mcp" and not any(a in ("-h", "--help") for a in argv[1:]):
        _mcp(argv[1:])
        return
    from cli.main import app as cli_app

    cli_app()


if __name__ == "__main__":
    main()
