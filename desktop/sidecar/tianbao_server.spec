# -*- mode: python ; coding: utf-8 -*-
# Build:  python -m PyInstaller --noconfirm --clean tianbao_server.spec   (see scripts/build-sidecar.ps1)
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules

SPEC_DIR = Path(SPECPATH).resolve()          # tianbao/desktop/sidecar
BACKEND = SPEC_DIR.parents[1] / "engine" / "backend"

# --- data files: replicate pyproject package-data (simcore: llm/presets.yaml, prompts/*.md) and,
# --- to be future proof, ship every non-Python file inside the engine packages.
datas = []
for pkg in ("simcore", "api", "cli"):
    root = BACKEND / pkg
    for f in root.rglob("*"):
        if f.is_file() and f.suffix not in (".py", ".pyc") and "__pycache__" not in f.parts:
            datas.append((str(f), str(Path(pkg) / f.parent.relative_to(root))))

hiddenimports = []
binaries = []
for pkg in ("simcore", "api", "cli", "uvicorn", "anyio", "h11", "httptools", "websockets", "watchfiles", "yaml", "jinja2"):
    try:
        hiddenimports += collect_submodules(pkg)
    except Exception:
        pass

# mcp SDK (engine/backend/simcore/mcp is added by the engine agent) and textual (CLI TUI) need data + dynamic imports.
for pkg in ("mcp", "mcp_types", "textual", "pydantic_settings", "sse_starlette", "starlette", "typer", "rich"):
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception:
        pass

hiddenimports = sorted(set(hiddenimports))

a = Analysis(
    [str(SPEC_DIR / "entry.py")],
    pathex=[str(BACKEND)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy.tests", "pytest", "mypy", "ruff", "playwright", "IPython"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="tianbao-server",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    icon=str(SPEC_DIR.parent / "src-tauri" / "icons" / "icon.ico"),
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="tianbao-server")
