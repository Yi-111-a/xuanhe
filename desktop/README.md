# 天宝 desktop shell (Tauri 2)

Tauri 2 shell around the React frontend (`../app`) and the Python engine (`../engine/backend`), which is frozen with
PyInstaller and run as a sidecar. Contract: `../docs/CONTRACT.md` section 5.

```
desktop/
  package.json            @tauri-apps/cli (npm)
  placeholder-dist/       stand-in frontend, ONLY for smoke tests when app/dist is not built yet
  icon-src/               icon.svg / icon.png (original cinnabar seal + coin mark, no text); `tauri icon` output in src-tauri/icons
  sidecar/entry.py        PyInstaller entry: `serve --host --port` (adds CORS for the webview), `mcp` (stdio MCP server),
                          else delegates to `cli.main`; applies the app's env defaults in every mode
  sidecar/tianbao_server.spec
  src-tauri/
    tauri.conf.json       window/CSP/NSIS/resources
    tauri.placeholder.conf.json   frontendDist override used by -Placeholder
    src/lib.rs            port pick, sidecar spawn + job object, splash, health poll, get_api_base
    resources/server/     staged PyInstaller onedir (generated, git-ignored)
../scripts/
  build-sidecar.ps1  build-desktop.ps1  dev-desktop.ps1  smoke-desktop.py  mcp_selftest.py
../integrations/          bundled as resource `integrations/`: setup_mcp.ps1/.py, Claude Code plugin, Codex AGENTS.md
```

## How it runs

1. Splash window (inline HTML, dark lacquer + gold "天宝", "正在启动…") opens at once; the real `main` window is created
   hidden (1600x900, min 1280x720, centered; shrunk to fit small screens) and loads the frontend in parallel.
2. Shell picks a free `127.0.0.1` port and spawns `resources/server/tianbao-server.exe serve --host 127.0.0.1 --port N` with
   `SIM_SCENARIOS_DIR=<resources>/scenarios`, `SIM_GAME_ROOT=<resources>`, `LLM_SIM_HOME=%APPDATA%/tianbao`,
   `PYTHONUTF8=1`, `PYTHONIOENCODING=utf-8`, `PYTHONUNBUFFERED=1`, no console window.
   stdout/stderr -> `%APPDATA%/tianbao/logs/server.log` (appended, rotated to `.log.old` past 5 MB).
3. Polls `GET /api/health` (falls back to `/api/scenarios` while the engine has no health route) for up to 30 s.
   On success: main window shown, splash closed. On failure: splash shows the reason + log path; closing it exits.
4. The webview gets the API base two ways: Tauri command `get_api_base` (async, waits for readiness) and the injected
   global `window.__TIANBAO_API_BASE__`. The frontend should prefer `invoke('get_api_base')` (`withGlobalTauri` is on, so
   `window.__TAURI__.core.invoke` also exists).
5. Sidecar lifetime: it is put in a Windows Job Object with `KILL_ON_JOB_CLOSE`, so it dies with the shell even on crash /
   End Task; normal exit also kills it explicitly. (Hard kill means an in-flight session append could be cut short; the
   engine writes JSONL one record at a time.)
6. `sidecar/entry.py` handles `serve` itself (no uvicorn string import, so PyInstaller sees every module) and adds CORS for
   `http://tauri.localhost` and `http://127.0.0.1|localhost:<any>` if the engine app has none. Other subcommands
   (`validate`, ...) go to the engine CLI.
7. **MCP mode**: `<install>\server\tianbao-server.exe mcp [--mode client|server]` is a stdio MCP server for Codex /
   Claude Code. Without any env it uses the same defaults as the app (`LLM_SIM_HOME=%APPDATA%\tianbao`,
   `SIM_SCENARIOS_DIR=<install>\scenarios`, `SIM_GAME_ROOT=<install>`, resolved from the exe path), so saves are shared.
   stdio is UTF-8 regardless of the console code page (the MCP SDK re-wraps fd 0/1 as UTF-8; stderr is reconfigured).
   In `serve` mode the entry publishes `SIM_MCP_LAUNCH` so `GET /api/integration` returns the exact
   `codex mcp add` / `claude mcp add` / TOML / `.mcp.json` for this install (see CONTRACT section 2). Setup: `../integrations/README.md`.

Frontend in the webview: bundled files are served from `http://tauri.localhost`; CSP (see `tauri.conf.json`) allows
`connect-src` / `img-src` / `media-src` to `http://127.0.0.1:*`, `font-src 'self' data:`, `script-src 'self'`.

## Build

Prereqs: Rust 1.77+ (MSVC), VS 2022 Build Tools, Node, the shared venv `../.venv` with PyInstaller. First build downloads
NSIS 3.13 + nsis_tauri_utils from GitHub (needs network once).

```powershell
pwsh scripts/build-desktop.ps1 -Snapshot       # release: scenarios + frontend from a temp `git worktree` of HEAD (working
                                               # app/ sources overlaid, falls back to committed app/), engine from working tree
pwsh scripts/build-desktop.ps1                 # sidecar -> npm --prefix app run build -> tauri build
pwsh scripts/build-desktop.ps1 -Placeholder    # use desktop/placeholder-dist instead of app/dist (smoke only)
pwsh scripts/build-desktop.ps1 -SkipSidecar    # reuse staged sidecar
pwsh scripts/build-sidecar.ps1 [-Clean]        # only the PyInstaller part
```

(Windows PowerShell 5.1 works too: `powershell -File scripts\build-desktop.ps1`.)
Output: `desktop/src-tauri/target/release/bundle/nsis/天宝_0.1.0_x64-setup.exe` (NSIS, per-user, zh-CN, no admin).
`app/dist` missing => the script warns and bundles the placeholder; do not ship that.

The sidecar is a PyInstaller **onedir** (not onefile): onefile re-extracts ~60 MB into %TEMP% on every start, which is
slower and a frequent Defender target. It is shipped as a Tauri resource (`server/`), not as `externalBin`, because
`externalBin` only supports a single file.

## Dev

```powershell
pwsh scripts/dev-desktop.ps1     # = npx tauri dev; starts `npm --prefix ../app run dev -- --host 127.0.0.1 --port 5173`
```
In a debug build, if `resources/server/tianbao-server.exe` is not staged, the shell runs the engine from source:
`.venv\Scripts\python.exe desktop\sidecar\entry.py serve ...` with scenarios from `../scenarios`.
Overrides (any build): `TIANBAO_SERVER_EXE=<path>` (custom sidecar), `SIM_SCENARIOS_DIR`, `LLM_SIM_HOME`.

## Smoke test

```powershell
.venv\Scripts\python.exe scripts\smoke-desktop.py                 # installs newest installer to a temp dir, tests, uninstalls
.venv\Scripts\python.exe scripts\smoke-desktop.py --scenarios-dir engine\scenarios   # if bundled scenarios/ is still empty
```
Launches with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9229`, attaches Playwright over CDP and checks:
splash text, title screen (`[data-testid^="title."]`), native window title, `get_api_base`, `/api/health` + CORS from the
page, zero console errors across a reload, no mojibake (DOM + server.log), a new game through the UI
(title -> newgame -> desk), `/api/integration` (installed mode, exe path, shared home), the installed
`tianbao-server.exe mcp` driven by the `mcp` client SDK (new_game -> briefing -> end_turn, Chinese intact) and that save
showing up in the app's `/api/sessions` (shared saves), graceful close leaves no `tianbao-server.exe`, and hard-killing
the shell also takes the sidecar down. Uses a temp `LLM_SIM_HOME`
unless `--real-home`. Needs no browser download (CDP to WebView2).

## Troubleshooting

* Splash stuck / error text: read `%APPDATA%\tianbao\logs\server.log`. The first start after install can take several
  seconds (Defender scans the new files); the shell waits up to 30 s.
* `link.exe` errors: Git's `link.exe` shadows MSVC only when cargo cannot find VS; run from a normal shell with VS 2022 Build
  Tools installed (it is auto-detected).
* PyInstaller misses a module: add it to `hiddenimports` in `sidecar/tianbao_server.spec` (spec already collects `simcore`,
  `api`, `cli`, uvicorn, mcp, textual submodules and every non-.py file in the engine packages); rebuild with `-Clean`.
* Engine reports CORS errors in a dev webview: the origin must be `127.0.0.1`/`localhost` or `*.tauri.localhost`;
  adjust `CORS_ORIGINS` in `sidecar/entry.py`.
* Blank window offline on Windows 10 without WebView2: the installer uses the default `downloadBootstrapper`; Windows 11
  ships WebView2.
* Orphan `tianbao-server.exe`: should not happen (job object); `taskkill /F /IM tianbao-server.exe` as a last resort.
* Port in use / multiple instances: each instance picks its own free port and shares `LLM_SIM_HOME`.
