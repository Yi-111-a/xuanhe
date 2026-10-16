# -*- coding: utf-8 -*-
"""Usage: python run_jobs.py <id-or-group> ...   (3 parallel codex runs; skips existing PNGs unless --force)"""
import sys, os, subprocess, time, glob, shutil, threading, json
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jobs import JOBS

ROOT = r"C:\Users\yiyin\Desktop\新建文件夹\xuanhe"
PROMPTS = os.path.join(ROOT, "design", "asset_prompts")
SRC = os.path.join(ROOT, "design", "asset_src")
CODEX = r"C:\Users\yiyin\AppData\Roaming\npm\node_modules\@openai\codex\bin\codex.js"
STYLE = open(os.path.join(PROMPTS, "_style_block.txt"), encoding="utf8").read().strip()
LOG = os.path.join(PROMPTS, "run.log")
lock = threading.Lock()


def log(msg):
    line = time.strftime("%H:%M:%S ") + msg
    with lock:
        print(line, flush=True)
        open(LOG, "a", encoding="utf8").write(line + "\n")


def run(job, force=False):
    jid = job["id"]
    outdir = os.path.join(SRC, job["kind"])
    os.makedirs(outdir, exist_ok=True)
    png = os.path.join(outdir, jid + ".png")
    if os.path.exists(png) and not force:
        log(f"SKIP {jid}")
        return jid, True
    full = STYLE + " " + job["subject"]
    open(os.path.join(PROMPTS, jid + ".txt"), "w", encoding="utf8", newline=chr(10)).write(full + "\n\n" + job["aspect"] + "\n")
    prompt = " ".join(full.split())
    cmdtext = (f"Use your image generation tool to create ONE image: {prompt} {job['aspect']} "
               f"After generating, copy the resulting PNG into the current working directory as {jid}.png "
               f"and print its absolute path and pixel size. Do not do anything else.")
    args = ["node", CODEX, "exec", "--skip-git-repo-check", "--json", "-C", outdir, "-s", "workspace-write",
            "-c", 'windows.sandbox="unelevated"']
    if job.get("ref"):
        refpng = os.path.join(SRC, JOBS[job["ref"]]["kind"], job["ref"] + ".png")
        if not os.path.exists(refpng):
            log(f"FAIL {jid} missing ref {refpng}")
            return jid, False
        args.insert(3, "-i"); args.insert(4, refpng)  # -i is variadic: must be followed by another flag
        cmdtext = ("The attached image is the reference portrait of this character. " + cmdtext)
    args.append(cmdtext)
    for attempt in (1, 2):
        t0 = time.time()
        with open(os.path.join(outdir, jid + ".jsonl"), "w", encoding="utf8") as so, \
             open(os.path.join(outdir, jid + ".err"), "w", encoding="utf8") as se:
            try:
                subprocess.run(args, stdout=so, stderr=se, timeout=420, stdin=subprocess.DEVNULL)
            except subprocess.TimeoutExpired:
                log(f"TIMEOUT {jid} attempt {attempt}")
        dt = time.time() - t0
        if os.path.exists(png):
            log(f"OK   {jid} {dt:.0f}s attempt {attempt}")
            return jid, True
        log(f"MISS {jid} {dt:.0f}s attempt {attempt}")
    return jid, False


def main():
    force = "--force" in sys.argv
    names = [a for a in sys.argv[1:] if not a.startswith("--")]
    ids = []
    for n in names:
        if n in JOBS:
            ids.append(n)
        else:
            ids += [k for k, v in JOBS.items() if v["group"] == n]
    log(f"START {len(ids)} jobs: {ids}")
    res = []
    with ThreadPoolExecutor(3) as ex:
        res = list(ex.map(lambda i: run(JOBS[i], force), ids))
    log("DONE ok=%d fail=%s" % (sum(1 for _, ok in res if ok), [i for i, ok in res if not ok]))


if __name__ == "__main__":
    main()
