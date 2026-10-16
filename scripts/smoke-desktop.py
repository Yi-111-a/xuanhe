"""Smoke test for the built 天宝 desktop app (Tauri shell + PyInstaller sidecar).

Default flow (no args):
  1. silently install the newest NSIS installer into a throw-away dir (per-user, no admin),
  2. launch the installed exe with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9229,
  3. attach Playwright over CDP; assert splash text, title screen, window title, API base, /api/health,
     CORS, no console errors, no mojibake (DOM + server.log), session file lands in LLM_SIM_HOME/sessions,
  4. close the window gracefully (WM_CLOSE) and assert no tianbao-server process remains,
  5. launch again, kill the shell hard (taskkill /F) and assert the sidecar dies too (job object),
  6. uninstall.

Usage:
  python scripts/smoke-desktop.py [--installer PATH | --exe PATH] [--keep] [--no-crash-test] [--real-home]

--exe skips the installer; NOTE a bare target/release/tianbao.exe has no bundled resources, so use the
installed exe (or the installer flow). --real-home uses the real %APPDATA%/tianbao instead of a temp home.
"""
from __future__ import annotations

import argparse
import ctypes
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from ctypes import wintypes
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "desktop" / "src-tauri" / "target" / "release" / "bundle" / "nsis"
CDP_PORT = 9229
CDP_URL = f"http://127.0.0.1:{CDP_PORT}"
MOJIBAKE = re.compile("�|锟斤拷|[Ãåæçè][\u0080-¿]")

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" -- {detail}" if detail else ""), flush=True)
    return ok


# ------------------------------------------------------------------ process helpers
def tasklist(image: str) -> list[int]:
    out = subprocess.run(["tasklist", "/FI", f"IMAGENAME eq {image}", "/FO", "CSV", "/NH"], capture_output=True, text=True, errors="replace").stdout
    pids = []
    for line in out.splitlines():
        parts = [p.strip('"') for p in line.split('","')]
        if len(parts) >= 2 and parts[0].strip('"').lower() == image.lower():
            try:
                pids.append(int(parts[1]))
            except ValueError:
                pass
    return pids


def wait_gone(image: str, seconds: float) -> bool:
    end = time.time() + seconds
    while time.time() < end:
        if not tasklist(image):
            return True
        time.sleep(0.2)
    return not tasklist(image)


user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)


def windows_of(pid: int) -> list[tuple[int, str, bool, tuple[int, int]]]:
    found: list[tuple[int, str, bool, tuple[int, int]]] = []

    def cb(hwnd, _):
        p = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
        if p.value == pid:
            buf = ctypes.create_unicode_buffer(256)
            user32.GetWindowTextW(hwnd, buf, 256)
            rect = wintypes.RECT()
            user32.GetClientRect(hwnd, ctypes.byref(rect))
            found.append((hwnd, buf.value, bool(user32.IsWindowVisible(hwnd)), (rect.right, rect.bottom)))
        return True

    user32.EnumWindows(WNDENUMPROC(cb), 0)
    return found


def cdp_targets() -> list[dict]:
    try:
        with urllib.request.urlopen(f"{CDP_URL}/json", timeout=1) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return []


# ------------------------------------------------------------------ install
def newest_installer() -> Path:
    files = sorted(BUNDLE.glob("*-setup.exe"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not files:
        sys.exit(f"no installer under {BUNDLE} -- run scripts/build-desktop.ps1 first")
    return files[0]


def install(installer: Path, target: Path) -> Path:
    if target.exists():
        shutil.rmtree(target, ignore_errors=True)
    t0 = time.time()
    # NSIS: /S silent, /D= must be the last argument and unquoted
    subprocess.run([str(installer), "/S", f"/D={target}"], check=True, timeout=300)
    exe = target / "tianbao.exe"
    check("installer ran silently", exe.is_file(), f"{time.time() - t0:.1f}s -> {exe}")
    server = target / "server" / "tianbao-server.exe"
    check("sidecar installed", server.is_file(), str(server))
    check("scenarios dir installed", (target / "scenarios").is_dir())
    return exe


def uninstall(target: Path) -> None:
    unins = target / "uninstall.exe"
    if unins.is_file():
        subprocess.run([str(unins), "/S", f"_?={target}"], timeout=120)
    shutil.rmtree(target, ignore_errors=True)


# ------------------------------------------------------------------ launch
def launch(exe: Path, env_extra: dict[str, str]) -> subprocess.Popen:
    env = os.environ.copy()
    env["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = f"--remote-debugging-port={CDP_PORT}"
    env.update(env_extra)
    return subprocess.Popen([str(exe)], env=env, cwd=str(exe.parent))


def wait_cdp(proc: subprocess.Popen, seconds: float = 40) -> bool:
    end = time.time() + seconds
    while time.time() < end and proc.poll() is None:
        if cdp_targets():
            return True
        time.sleep(0.05)
    return False


def run_main_checks(exe: Path, home: Path, scen_env: dict[str, str]) -> None:
    from playwright.sync_api import sync_playwright

    for img in ("tianbao-server.exe",):
        stale = tasklist(img)
        if stale:
            sys.exit(f"stale {img} processes already running: {stale}")
    env = {"LLM_SIM_HOME": str(home)} if home else {}
    env.update(scen_env)
    t0 = time.time()
    proc = launch(exe, env)
    try:
        check("CDP endpoint up", wait_cdp(proc), f"{time.time() - t0:.1f}s")
        splash_text = None
        splash_h1 = None
        main_seen_at = None
        splash_gone_at = None
        with sync_playwright() as pw:
            browser = pw.chromium.connect_over_cdp(CDP_URL)
            deadline = time.time() + 60
            page = None
            while time.time() < deadline:
                pages = [pg for ctx in browser.contexts for pg in ctx.pages]
                for pg in pages:
                    if pg.url.startswith("data:text/html") and splash_text is None:
                        try:
                            splash_text = pg.inner_text("#msg", timeout=500)
                            splash_h1 = pg.inner_text("h1", timeout=500)
                        except Exception:
                            pass
                app_pages = [pg for pg in pages if not pg.is_closed() and not pg.url.startswith(("data:", "about:", "devtools:"))]
                splash_pages = [t for t in cdp_targets() if t.get("type") == "page" and t.get("url", "").startswith("data:text/html")]
                if app_pages and main_seen_at is None:
                    main_seen_at = time.time() - t0
                    page = app_pages[0]
                if app_pages and not splash_pages:
                    splash_gone_at = time.time() - t0
                    break
                time.sleep(0.05)
            check("main window shown (splash closed)", splash_gone_at is not None, f"cold start {splash_gone_at:.2f}s" if splash_gone_at else "timeout")
            print(f"   COLD_START_SECONDS={splash_gone_at}")
            if splash_h1 is not None:
                check("splash text", splash_h1.strip() == "天宝" and "正在启动" in (splash_text or ""), f"{splash_h1!r} / {splash_text!r}")
            else:
                print("   (splash was gone before CDP could attach; text not sampled)")
            if page is None:
                return

            # ---- window title / size via Win32
            wins = [w for w in windows_of(proc.pid) if w[1] == "天宝" and w[2]]
            check("native window title is 天宝", bool(wins), str([(w[1], w[3]) for w in windows_of(proc.pid) if w[1]]))

            # ---- console errors: collect across a reload
            errors: list[str] = []
            page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.reload(wait_until="load")
            try:
                page.wait_for_selector('[data-testid^="title."]', state="visible", timeout=15000)
                title_ok = True
            except Exception as e:  # noqa: BLE001
                title_ok = False
                errors.append(f"title selector: {e}")
            time.sleep(1.5)
            check("title screen renders ([data-testid^=title.])", title_ok, page.url)
            check("no console errors", not errors, "; ".join(errors)[:400])
            body = page.inner_text("body")
            check("no mojibake in DOM", not MOJIBAKE.search(body))
            check("DOM contains 天宝", "天宝" in body)

            # ---- API base + health from inside the page (also proves CORS + CSP connect-src)
            base = page.evaluate("window.__TAURI_INTERNALS__.invoke('get_api_base')")
            check("get_api_base", bool(re.fullmatch(r"http://127\.0\.0\.1:\d+", base or "")), str(base))
            injected = page.evaluate("window.__TIANBAO_API_BASE__")
            check("window.__TIANBAO_API_BASE__ injected", injected == base, str(injected))
            res = page.evaluate(
                """async (base) => {
                    const out = {};
                    for (const p of ['/api/health', '/api/scenarios']) {
                        try { const r = await fetch(base + p); out[p] = [r.status, (await r.text()).slice(0, 200), r.headers.get('content-type')]; }
                        catch (e) { out[p] = ['ERR', String(e)]; }
                    }
                    return out; }""",
                base,
            )
            health = res["/api/health"]
            if health[0] == 404:
                print("   NOTE: /api/health not implemented by this engine build yet (shell falls back to /api/scenarios)")
            else:
                check("GET /api/health from page", health[0] == 200, str(health)[:200])
                check("health JSON is utf-8", "utf-8" in (health[2] or "").lower(), str(health[2]))
            check("GET /api/scenarios from page (CORS ok)", res["/api/scenarios"][0] == 200, str(res["/api/scenarios"])[:160])

            # ---- session landing in LLM_SIM_HOME
            scen = page.evaluate("b => fetch(b + '/api/scenarios').then(r => r.json())", base)
            ids = [s["id"] for s in scen if not s["id"].startswith("_")] or [s["id"] for s in scen]
            if ids:
                created = page.evaluate(
                    """async ([base, id]) => { const r = await fetch(base + '/api/sessions', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({scenario:id, seed:1})}); return [r.status, (await r.json()).id]; }""",
                    [base, ids[0]],
                )
                check("create session via API", created[0] in (200, 201), f"{ids[0]} -> {created}")
                sess_dir = (home or Path(os.environ["APPDATA"]) / "tianbao") / "sessions"
                time.sleep(0.3)
                check("session file in <home>/sessions", any(sess_dir.glob(f"{created[1]}*")), str(sess_dir))
            else:
                print("   (no scenarios available to create a session)")

            # ---- new game through the UI: title -> newgame -> desk
            ui_session = None
            try:
                page.get_by_test_id("title.newGame").click()
                page.get_by_test_id("newgame.root").wait_for(state="visible", timeout=15000)
                page.get_by_test_id("newgame.start").click()
                t_ng = time.time()
                page.get_by_test_id("desk.root").wait_for(state="visible", timeout=60000)
                ui_session = page.evaluate("JSON.parse(localStorage.getItem('tianbao.session') ?? 'null')")
                check("UI new game: title -> newgame -> desk", bool(ui_session), f"{time.time() - t_ng:.1f}s, session {ui_session}")
            except Exception as e:  # noqa: BLE001
                check("UI new game: title -> newgame -> desk", False, str(e)[:300])
            sess_dir = (home or Path(os.environ["APPDATA"]) / "tianbao") / "sessions"
            if ui_session:
                time.sleep(0.3)
                check("UI save file in <home>/sessions", any(sess_dir.glob(f"{ui_session}*")), str(sess_dir))
            check("no console errors after new game", not errors, "; ".join(errors)[:400])

            # ---- /api/integration: exact MCP commands for this install
            integ = page.evaluate("b => fetch(b + '/api/integration').then(async r => [r.status, await r.json()])", base)
            server_exe = (exe.parent / "server" / "tianbao-server.exe").resolve()
            info = integ[1] if integ[0] == 200 else {}
            srv = info.get("server", {})
            same_exe = bool(srv.get("command")) and os.path.normcase(str(Path(srv["command"]).resolve())) == os.path.normcase(str(server_exe))
            check("GET /api/integration", integ[0] == 200 and info.get("mode") == "installed" and info.get("name") == "tianbao" and same_exe,
                  f"{integ[0]} mode={info.get('mode')} command={srv.get('command')}")
            add = info.get("codex", {}).get("add", "")
            check("integration: codex/claude commands", add.startswith("codex mcp add tianbao ") and add.endswith(f' -- "{srv.get("command")}" mcp')
                  and (not home or f"LLM_SIM_HOME={home}" in add)
                  and info.get("claude", {}).get("add_user", "").startswith("claude mcp add tianbao --scope user")
                  and 'default_tools_approval_mode = "approve"' in info.get("codex", {}).get("toml", ""), info.get("codex", {}).get("add", "")[:200])
            if home:
                check("integration: home is the app's LLM_SIM_HOME", srv.get("env", {}).get("LLM_SIM_HOME") == str(home), str(srv.get("env")))
            setup = info.get("setup") or {}
            check("integration: bundled setup_mcp.ps1", bool(setup) and Path(setup.get("script", "")).is_file(), str(setup.get("script")))
            print("   INTEGRATION_CODEX_ADD=" + info.get("codex", {}).get("add", ""))

            # ---- the installed exe as an MCP server (official client SDK), using exactly the advertised command
            if srv.get("command"):
                sys.path.insert(0, str(ROOT / "scripts"))
                import asyncio

                from mcp_selftest import play_one_season

                try:
                    from concurrent.futures import ThreadPoolExecutor

                    coro = play_one_season(srv["command"], srv.get("args", ["mcp"]), srv.get("env") or {}, load_session=ui_session)
                    with ThreadPoolExecutor(1) as pool:  # Playwright's sync API owns this thread's event loop
                        mcp_res = pool.submit(asyncio.run, coro).result(timeout=300)
                except Exception as e:  # noqa: BLE001
                    mcp_res = {"ok": False, "steps": {}, "error": repr(e)[:300]}
                print("   MCP_RESULT=" + json.dumps(mcp_res, ensure_ascii=False))
                for step, ok in mcp_res.get("steps", {}).items():
                    check(f"MCP {step}", ok)
                check("MCP: new_game -> briefing -> end_turn via tianbao-server.exe mcp", mcp_res.get("ok", False),
                      f"startup {mcp_res.get('startup_s')}s, total {mcp_res.get('seconds')}s {mcp_res.get('error', '')}")
                if mcp_res.get("session_id"):
                    listed = page.evaluate("b => fetch(b + '/api/sessions').then(r => r.json())", base)
                    ids_seen = {str(x.get("id")) for x in listed} if isinstance(listed, list) else set()
                    check("shared saves: MCP game listed by the app's /api/sessions", mcp_res["session_id"] in ids_seen, f"{len(ids_seen)} sessions")
                    view = page.evaluate("([b, s]) => fetch(b + '/api/sessions/' + s + '/view').then(r => r.json())", [base, mcp_res["session_id"]])
                    cal = str((view or {}).get("calendar_label", ""))
                    turn = ((view or {}).get("state") or {}).get("turn")
                    check("shared saves: app sees the MCP game after end_turn", turn == 1, f"turn={turn} {cal}")

            # ---- sidecar facts
            sidecars = tasklist("tianbao-server.exe")
            check("sidecar process running", len(sidecars) >= 1, str(sidecars))
            browser.close()

        log = (home or Path(os.environ["APPDATA"]) / "tianbao") / "logs" / "server.log"
        check("server.log written", log.is_file(), str(log))
        if log.is_file():
            txt = log.read_text(encoding="utf-8", errors="strict")
            check("server.log is valid UTF-8, no mojibake", not MOJIBAKE.search(txt))
            check("engine reported startup complete", "Application startup complete" in txt)

        # ---- graceful close
        for hwnd, title, vis, _ in windows_of(proc.pid):
            if title == "天宝" and vis:
                user32.PostMessageW(hwnd, 0x0010, 0, 0)  # WM_CLOSE
        try:
            proc.wait(timeout=15)
            exited = True
        except subprocess.TimeoutExpired:
            exited = False
        check("shell exits on window close", exited)
        check("no tianbao-server left after close", wait_gone("tianbao-server.exe", 8), str(tasklist("tianbao-server.exe")))
    finally:
        if proc.poll() is None:
            proc.kill()
        subprocess.run(["taskkill", "/F", "/IM", "tianbao-server.exe"], capture_output=True)


def find_claude() -> str | None:
    exe = shutil.which("claude")
    if exe:
        return exe
    found = sorted(Path(os.environ.get("APPDATA", "")).glob("Claude/claude-code/*/*/claude.exe"), key=lambda p: p.stat().st_mtime)
    return str(found[-1]) if found else None


def run_plugin_check(target: Path, home: Path | None, tmp: Path) -> None:
    """The Claude Code plugin's .mcp.json points at ${LOCALAPPDATA}/天宝/server/tianbao-server.exe (default install)."""
    claude = find_claude()
    plugin = target / "integrations" / "claude-code"
    if not claude or target.name != "天宝":
        print("   (Claude Code CLI not found or non-default install dir name; plugin check skipped)")
        return
    check("plugin bundled in install", (plugin / ".claude-plugin" / "plugin.json").is_file(), str(plugin))
    env = os.environ.copy()
    env.update({"LOCALAPPDATA": str(target.parent), "CLAUDE_CONFIG_DIR": str(tmp / "claude-config")})
    if home:
        env["LLM_SIM_HOME"] = str(home)
    out = subprocess.run([claude, "--plugin-dir", str(plugin), "mcp", "list"], env=env, capture_output=True, timeout=120)
    text = out.stdout.decode("utf-8", errors="replace") + out.stderr.decode("utf-8", errors="replace")
    line = next((ln for ln in text.splitlines() if "plugin:tianbao" in ln), text.strip()[-200:])
    check("Claude Code plugin MCP server connects", "plugin:tianbao:tianbao" in text and "Connected" in line, line.strip()[:240])
    subprocess.run(["taskkill", "/F", "/IM", "tianbao-server.exe"], capture_output=True)


def run_crash_test(exe: Path, home: Path, scen_env: dict[str, str]) -> None:
    env = {"LLM_SIM_HOME": str(home)} if home else {}
    env.update(scen_env)
    proc = launch(exe, env)
    try:
        end = time.time() + 40
        while time.time() < end and not tasklist("tianbao-server.exe"):
            time.sleep(0.1)
        check("crash test: sidecar started", bool(tasklist("tianbao-server.exe")))
        subprocess.run(["taskkill", "/F", "/PID", str(proc.pid)], capture_output=True)  # hard kill the shell
        check("crash test: sidecar dies with shell (job object)", wait_gone("tianbao-server.exe", 10), str(tasklist("tianbao-server.exe")))
    finally:
        if proc.poll() is None:
            proc.kill()
        subprocess.run(["taskkill", "/F", "/IM", "tianbao-server.exe"], capture_output=True)
        subprocess.run(["taskkill", "/F", "/IM", "tianbao.exe"], capture_output=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--installer", type=Path)
    ap.add_argument("--exe", type=Path)
    ap.add_argument("--keep", action="store_true", help="keep the throw-away install dir")
    ap.add_argument("--no-crash-test", action="store_true")
    ap.add_argument("--real-home", action="store_true", help="use the real %%APPDATA%%/tianbao")
    ap.add_argument("--scenarios-dir", type=Path, help="override SIM_SCENARIOS_DIR (use when the bundle has no scenarios yet)")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]

    tmp = Path(tempfile.mkdtemp(prefix="tianbao-smoke-"))
    target = tmp / "天宝"  # same leaf name as the default %LOCALAPPDATA%\天宝 (plugin check relies on it)
    home = None if args.real_home else tmp / "home"
    scen_env: dict[str, str] = {}
    if args.scenarios_dir:
        scen_env["SIM_SCENARIOS_DIR"] = str(args.scenarios_dir)
    try:
        if args.exe:
            exe = args.exe
        else:
            exe = install(args.installer or newest_installer(), target)
        run_main_checks(exe, home, scen_env)
        if not args.exe:
            run_plugin_check(target, home, tmp)
        if not args.no_crash_test:
            run_crash_test(exe, home, scen_env)
    finally:
        if not args.exe and not args.keep:
            uninstall(target)
        if not args.keep:
            shutil.rmtree(tmp, ignore_errors=True)
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
