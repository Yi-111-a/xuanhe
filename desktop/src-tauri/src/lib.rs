//! 天宝 desktop shell.
//!
//! * picks a free localhost port and spawns the frozen Python engine (`tianbao-server`)
//! * shows a splash window (inline HTML, no IPC) while polling `/api/health`
//! * exposes `get_api_base` to the webview (waits until the engine is ready)
//! * guarantees the sidecar dies with the app: Windows Job Object (KILL_ON_JOB_CLOSE) + explicit kill on exit
//! * sidecar stdout/stderr -> `<APPDATA>/tianbao/logs/server.log` (UTF-8)

use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tokio::sync::watch;

const STARTUP_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Clone, Debug)]
enum Status {
    Starting,
    Ready(String),
    Failed(String),
}

struct AppState {
    tx: watch::Sender<Status>,
    rx: watch::Receiver<Status>,
    child: Mutex<Option<Child>>,
    splash_done: AtomicBool,
    log_path: PathBuf,
}

/// Returns `http://127.0.0.1:<port>` once the engine answers its health check.
#[tauri::command]
async fn get_api_base(state: tauri::State<'_, Arc<AppState>>) -> Result<String, String> {
    let mut rx = state.rx.clone();
    let wait = async {
        loop {
            let cur = rx.borrow_and_update().clone();
            match cur {
                Status::Ready(url) => return Ok(url),
                Status::Failed(msg) => return Err(msg),
                Status::Starting => {}
            }
            if rx.changed().await.is_err() {
                return Err("桌面壳已退出".to_string());
            }
        }
    };
    match tokio::time::timeout(STARTUP_TIMEOUT + Duration::from_secs(10), wait).await {
        Ok(r) => r,
        Err(_) => Err("等待本地引擎启动超时".to_string()),
    }
}

/// Where the sidecar log lives (shown in error dialogs / handy for the frontend settings page).
#[tauri::command]
fn get_log_path(state: tauri::State<'_, Arc<AppState>>) -> String {
    state.log_path.to_string_lossy().to_string()
}

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

fn strip_verbatim(p: PathBuf) -> PathBuf {
    let s = p.to_string_lossy().to_string();
    if let Some(rest) = s.strip_prefix(r"\\?\") {
        PathBuf::from(rest)
    } else {
        p
    }
}

fn pick_free_port() -> Result<u16, String> {
    let l = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("无法分配本地端口：{e}"))?;
    let port = l.local_addr().map_err(|e| e.to_string())?.port();
    drop(l);
    Ok(port)
}

fn unix_ts() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// Minimal HTTP/1.1 GET against the loopback engine. Returns the status code.
fn http_status(port: u16, path: &str) -> Option<u16> {
    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    let mut s = TcpStream::connect_timeout(&addr, Duration::from_millis(400)).ok()?;
    s.set_read_timeout(Some(Duration::from_millis(1500))).ok()?;
    s.set_write_timeout(Some(Duration::from_millis(1500))).ok()?;
    let req = format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\nAccept: application/json\r\n\r\n");
    s.write_all(req.as_bytes()).ok()?;
    let mut buf = [0u8; 64];
    let mut got = 0;
    while got < 12 {
        let n = s.read(&mut buf[got..]).ok()?;
        if n == 0 {
            break;
        }
        got += n;
    }
    let head = std::str::from_utf8(&buf[..got]).ok()?;
    // "HTTP/1.1 200 OK"
    head.split_whitespace().nth(1)?.parse().ok()
}

fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

// NOTE: keep '#' and '%' out of this document: it is passed as a data: URL, where '#' starts a fragment
// and truncates the page.
const SPLASH_HTML: &str = r#"<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>天宝</title>
<style>
  html,body{margin:0;height:100vh;overflow:hidden;background:rgb(20,16,14);color:rgb(217,200,160);
    font-family:"KaiTi","STKaiti","楷体","Songti SC","SimSun","Microsoft YaHei",serif;user-select:none;cursor:default}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(ellipse at center,rgb(42,29,23),rgb(20,16,14));
    border:1px solid rgb(107,79,39);box-sizing:border-box}
  h1{margin:0;font-size:84px;font-weight:400;letter-spacing:.35em;padding-left:.35em;
    background:linear-gradient(180deg,rgb(243,220,155),rgb(184,137,47));-webkit-background-clip:text;background-clip:text;color:transparent;
    text-shadow:0 0 30px rgba(212,168,74,.25)}
  .rule{width:200px;height:1px;margin:14px 0 12px;background:linear-gradient(90deg,transparent,rgb(184,137,47),transparent)}
  [id=msg]{font-size:17px;letter-spacing:.2em;color:rgb(205,185,138);min-height:24px;text-align:center;padding:0 24px;line-height:1.6}
  [id=msg].err{color:rgb(224,115,95);letter-spacing:.05em;font-size:15px;white-space:pre-wrap}
  .bar{margin-top:18px;width:180px;height:3px;background:rgb(43,33,26);overflow:hidden;border-radius:2px}
  .bar i{display:block;width:72px;height:3px;background:linear-gradient(90deg,rgb(138,31,23),rgb(217,164,65));animation:s 1.3s ease-in-out infinite}
  .bar.stop{display:none}
  @keyframes s{from{transform:translateX(-80px)}to{transform:translateX(190px)}}
</style></head>
<body><h1>天宝</h1><div class="rule"></div>
<div id="msg">正在启动…</div><div class="bar" id="bar"><i></i></div>
<script>
  window.setStatus=function(t,err){var m=document.getElementById('msg');m.textContent=t;m.className=err?'err':'';
    document.getElementById('bar').className=err?'bar stop':'bar';};
</script></body></html>"#;

fn splash_url() -> tauri::Url {
    let url = format!("data:text/html;charset=utf-8,{}", percent_encode(SPLASH_HTML));
    tauri::Url::parse(&url).expect("splash url")
}

fn js_string(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_else(|_| "\"\"".into())
}

fn set_splash_status(app: &AppHandle, text: &str, err: bool) {
    if let Some(w) = app.get_webview_window("splash") {
        let _ = w.eval(format!("window.setStatus&&window.setStatus({},{})", js_string(text), err));
    }
}

// ---------------------------------------------------------------------------------------------
// Windows job object: every process in the job is killed when the last handle closes
// (i.e. when the shell exits for ANY reason, including crash / End Task).
// ---------------------------------------------------------------------------------------------

#[cfg(windows)]
fn assign_to_kill_on_close_job(child: &Child) {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return;
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const core::ffi::c_void,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        AssignProcessToJobObject(job, child.as_raw_handle() as _);
        // Deliberately leak `job`: it must stay open for the whole life of the shell process.
    }
}

#[cfg(not(windows))]
fn assign_to_kill_on_close_job(_child: &Child) {}

// ---------------------------------------------------------------------------------------------
// sidecar launch
// ---------------------------------------------------------------------------------------------

struct Launch {
    program: PathBuf,
    args: Vec<String>,
    cwd: Option<PathBuf>,
    scenarios: PathBuf,
    root: PathBuf,
    extra_env: Vec<(String, String)>,
}

fn resolve_launch(app: &AppHandle, port: u16) -> Result<Launch, String> {
    let res_dir = strip_verbatim(app.path().resource_dir().map_err(|e| format!("无法定位资源目录：{e}"))?);
    let exe_name = if cfg!(windows) { "tianbao-server.exe" } else { "tianbao-server" };
    let serve_args = vec!["serve".to_string(), "--host".into(), "127.0.0.1".into(), "--port".into(), port.to_string()];

    if let Ok(over) = std::env::var("TIANBAO_SERVER_EXE") {
        let p = PathBuf::from(over);
        return Ok(Launch {
            scenarios: std::env::var("SIM_SCENARIOS_DIR").map(PathBuf::from).unwrap_or_else(|_| res_dir.join("scenarios")),
            root: res_dir.clone(),
            program: p,
            args: serve_args,
            cwd: None,
            extra_env: vec![],
        });
    }

    let frozen = res_dir.join("server").join(exe_name);
    if frozen.is_file() {
        return Ok(Launch {
            program: frozen.clone(),
            args: serve_args,
            cwd: frozen.parent().map(Path::to_path_buf),
            scenarios: res_dir.join("scenarios"),
            root: res_dir,
            extra_env: vec![],
        });
    }

    // dev fallback (debug builds only): run the engine from the repo with the shared venv python.
    if cfg!(debug_assertions) {
        let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
        let repo = manifest.join("..").join("..");
        let repo = fs::canonicalize(&repo).map(strip_verbatim).unwrap_or(repo);
        let py = repo.join(".venv").join("Scripts").join("python.exe");
        let entry = repo.join("desktop").join("sidecar").join("entry.py");
        if py.is_file() && entry.is_file() {
            let mut args = vec![entry.to_string_lossy().to_string()];
            args.extend(serve_args);
            return Ok(Launch {
                program: py,
                args,
                cwd: Some(repo.join("engine").join("backend")),
                scenarios: repo.join("scenarios"),
                root: repo.clone(),
                extra_env: vec![("PYTHONPATH".into(), repo.join("engine").join("backend").to_string_lossy().to_string())],
            });
        }
    }

    Err(format!("找不到本地引擎：{}\n请先运行 scripts/build-sidecar.ps1", frozen.display()))
}

fn spawn_sidecar(app: &AppHandle, port: u16, home: &Path, log_path: &Path) -> Result<Child, String> {
    let mut launch = resolve_launch(app, port)?;
    // explicit override (tests / power users): SIM_SCENARIOS_DIR in the shell's own environment wins
    if let Ok(v) = std::env::var("SIM_SCENARIOS_DIR") {
        if !v.is_empty() {
            launch.scenarios = PathBuf::from(v);
        }
    }

    fs::create_dir_all(home).map_err(|e| format!("无法创建数据目录 {}：{e}", home.display()))?;
    if let Some(dir) = log_path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    // keep the log bounded: restart it when it grows past 5 MB
    if fs::metadata(log_path).map(|m| m.len() > 5 * 1024 * 1024).unwrap_or(false) {
        let _ = fs::rename(log_path, log_path.with_extension("log.old"));
    }
    let mut log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|e| format!("无法打开日志 {}：{e}", log_path.display()))?;
    let _ = writeln!(
        log,
        "\n=== tianbao-shell start ts={} port={} program={} ===",
        unix_ts(),
        port,
        launch.program.display()
    );
    let log_err = log.try_clone().map_err(|e| e.to_string())?;

    let mut cmd = Command::new(&launch.program);
    cmd.args(&launch.args)
        .env("SIM_SCENARIOS_DIR", &launch.scenarios)
        .env("SIM_GAME_ROOT", &launch.root)
        .env("LLM_SIM_HOME", home)
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1")
        .env("PYTHONUNBUFFERED", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err));
    for (k, v) in &launch.extra_env {
        cmd.env(k, v);
    }
    if let Some(cwd) = &launch.cwd {
        cmd.current_dir(cwd);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let child = cmd.spawn().map_err(|e| format!("无法启动本地引擎 {}：{e}", launch.program.display()))?;
    assign_to_kill_on_close_job(&child);
    Ok(child)
}

fn kill_child(state: &AppState) {
    if let Ok(mut guard) = state.child.lock() {
        if let Some(mut c) = guard.take() {
            let _ = c.kill();
            let _ = c.wait();
        }
    }
}

fn child_exited(state: &AppState) -> Option<String> {
    let mut guard = state.child.lock().ok()?;
    let c = guard.as_mut()?;
    match c.try_wait() {
        Ok(Some(status)) => Some(format!("本地引擎意外退出（{status}）")),
        _ => None,
    }
}

fn fit_to_monitor(w: &WebviewWindow) {
    // Default 1600x900; on smaller screens shrink (but never below the 1280x720 minimum).
    if let Ok(Some(m)) = w.current_monitor() {
        let scale = m.scale_factor();
        let (mw, mh) = (m.size().width as f64 / scale, m.size().height as f64 / scale);
        let tw = (1600f64).min(mw * 0.96).max(1280.0);
        let th = (900f64).min(mh * 0.92).max(720.0);
        if tw < 1600.0 || th < 900.0 {
            let _ = w.set_size(tauri::LogicalSize::new(tw, th));
            let _ = w.center();
        }
    }
}

fn run_startup(app: AppHandle, port: u16) {
    let state = app.state::<Arc<AppState>>().inner().clone();
    let started = Instant::now();
    let outcome: Result<(), String> = loop {
        if let Some(msg) = child_exited(&state) {
            break Err(msg);
        }
        let ok = match http_status(port, "/api/health") {
            Some(200) => true,
            // engine without /api/health yet: any HTTP answer from /api/scenarios proves it is serving
            Some(404) => http_status(port, "/api/scenarios").is_some(),
            _ => false,
        };
        if ok {
            break Ok(());
        }
        if started.elapsed() > STARTUP_TIMEOUT {
            break Err(format!("本地引擎在 {} 秒内没有响应", STARTUP_TIMEOUT.as_secs()));
        }
        std::thread::sleep(Duration::from_millis(150));
    };

    match outcome {
        Ok(()) => {
            let _ = state.tx.send(Status::Ready(format!("http://127.0.0.1:{port}")));
            if let Ok(line) = std::env::var("TIANBAO_LOG_STARTUP") {
                let _ = line;
                eprintln!("[tianbao] engine ready in {} ms", started.elapsed().as_millis());
            }
            if let Some(main) = app.get_webview_window("main") {
                fit_to_monitor(&main);
                let _ = main.show();
                let _ = main.set_focus();
            }
            state.splash_done.store(true, Ordering::SeqCst);
            if let Some(splash) = app.get_webview_window("splash") {
                let _ = splash.close();
            }
        }
        Err(msg) => {
            kill_child(&state);
            let full = format!("{msg}\n日志：{}", state.log_path.display());
            let _ = state.tx.send(Status::Failed(full.clone()));
            set_splash_status(&app, &full, true);
        }
    }
}

pub fn run() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_api_base, get_log_path])
        .setup(|app| {
            let handle = app.handle().clone();
            let data_dir = handle.path().data_dir().map_err(|e| format!("无法定位 APPDATA：{e}"))?;
            let home = std::env::var("LLM_SIM_HOME").map(PathBuf::from).unwrap_or_else(|_| data_dir.join("tianbao"));
            let log_path = home.join("logs").join("server.log");
            let (tx, rx) = watch::channel(Status::Starting);
            let state = Arc::new(AppState {
                tx,
                rx,
                child: Mutex::new(None),
                splash_done: AtomicBool::new(false),
                log_path: log_path.clone(),
            });
            app.manage(state.clone());

            // splash first, so the user sees something immediately
            let splash = WebviewWindowBuilder::new(app, "splash", WebviewUrl::External(splash_url()))
                .title("天宝")
                .inner_size(520.0, 320.0)
                .resizable(false)
                .decorations(false)
                .center()
                .always_on_top(true)
                .build()?;
            {
                let h = handle.clone();
                let st = state.clone();
                splash.on_window_event(move |ev| {
                    if let WindowEvent::CloseRequested { .. } = ev {
                        if !st.splash_done.load(Ordering::SeqCst) {
                            h.exit(0);
                        }
                    }
                });
            }

            let port = pick_free_port()?;
            let api_base = format!("http://127.0.0.1:{port}");

            // main window: hidden until the engine is ready; loads the frontend in parallel
            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("天宝")
                .inner_size(1600.0, 900.0)
                .min_inner_size(1280.0, 720.0)
                .resizable(true)
                .center()
                .visible(false)
                .initialization_script(format!("window.__TIANBAO_API_BASE__ = {};", js_string(&api_base)))
                .build()?;

            match spawn_sidecar(&handle, port, &home, &log_path) {
                Ok(child) => {
                    *state.child.lock().unwrap() = Some(child);
                    let h = handle.clone();
                    std::thread::spawn(move || run_startup(h, port));
                }
                Err(msg) => {
                    let full = format!("{msg}\n日志：{}", log_path.display());
                    let _ = state.tx.send(Status::Failed(full.clone()));
                    // the splash page may not have finished loading yet; retry the status push a few times
                    let h = handle.clone();
                    std::thread::spawn(move || {
                        for _ in 0..30 {
                            set_splash_status(&h, &full, true);
                            std::thread::sleep(Duration::from_millis(500));
                        }
                    });
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            if let Some(state) = handle.try_state::<Arc<AppState>>() {
                kill_child(&state);
            }
        }
    });
}
