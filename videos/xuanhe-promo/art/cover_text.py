# -*- coding: utf-8 -*-
"""Covers with the title calligraphy drawn by the image model itself (client's choice). 2 parallel codex runs.
Usage: python cover_text.py [ids...]   (outputs art/out/<id>.png; skips existing unless --force)"""
import os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
CODEX = r"C:\Users\yiyin\AppData\Roaming\npm\node_modules\@openai\codex\bin\codex.js"

TEXT = ("Include exactly this Chinese title text, correctly written in Simplified Chinese, as part of the poster design: "
        "(1) the huge main title 宣和 (two characters: 宣 then 和) in bold, powerful Chinese brush calligraphy (xingkai style, "
        "thick dry-brush strokes), ivory white with a thin gold edge and a soft dark glow, very large; "
        "(2) under it, the line 繁华只剩六年 (six characters: 繁 华 只 剩 六 年) in vermilion-red brush calligraphy, about a third of the title's height; "
        "(3) under that, the line 这一次，你是宋徽宗 (这 一 次 ， 你 是 宋 徽 宗) in smaller white brush script. "
        "Every character must be correct and legible; no other text, letters, numbers, seals or watermarks anywhere. ")
COSTUME = ("Authentic Northern Song costume: the emperor wears a pale ochre-yellow round-collar robe and a black futou hat with long straight "
           "horizontal wings; Jurchen cavalry with fur trims, braided queues and iron lamellar armour; no dragons, no Ming/Qing costume. ")
STYLE = ("Epic cinematic Chinese historical war movie poster / video thumbnail, 16:9 composition inside a landscape frame, dramatic fire and "
         "snow lighting, high contrast, painterly but highly detailed, hot-blooded and gripping. ")

JOBS = {
  "ctext_a1": dict(ref="cover_a.png", prompt="Use the attached image as the base picture and keep its composition (Emperor Huizong close-up on the right, burning capital and charging Jurchen cavalry behind). Place the title text on the dark smoky left side. "),
  "ctext_a2": dict(ref="cover_a.png", prompt="Use the attached image as the base picture and keep its composition (Emperor Huizong close-up on the right, burning capital and charging Jurchen cavalry behind). Place the title text on the dark smoky left side. "),
  "ctext_b1": dict(ref="cover_b.png", prompt="Use the attached image as the base picture and keep its composition (golden Lantern Festival city on the left, the same city burning in snow on the right, the emperor seen from behind on the seam). Place the main title centered in the dark sky at the top, the two lines beneath it. "),
  "ctext_n1": dict(ref=None, prompt="New composition: Emperor Huizong in a dramatic half-figure close-up on the right third, staring into the camera with cold resolve, his face half lit by fire; behind him Kaifeng burns at night in falling snow and Jurchen iron cavalry charges out of the smoke. Dark smoky space on the left holds the title text. "),
}


def log(m):
    print(time.strftime("%H:%M:%S ") + m, flush=True)


def run(jid, force=False):
    job = JOBS[jid]
    png = os.path.join(OUT, jid + ".png")
    if os.path.exists(png) and not force:
        log("SKIP " + jid); return jid, True
    prompt = STYLE + job["prompt"] + COSTUME + TEXT + "Landscape 3:2 aspect ratio (1536x1024)."
    open(os.path.join(HERE, jid + ".txt"), "w", encoding="utf8", newline="\n").write(prompt + "\n")
    cmd = (f"Use your image generation tool to create ONE image: {prompt} After generating, copy the resulting PNG into the "
           f"current working directory as {jid}.png and print its absolute path and pixel size. Do not do anything else.")
    args = ["node", CODEX, "exec", "--skip-git-repo-check", "--json", "-C", OUT, "-s", "workspace-write", "-c", 'windows.sandbox="unelevated"']
    if job["ref"]:
        args[3:3] = ["-i", os.path.join(OUT, job["ref"])]
        cmd = "The attached image is the base picture to work from. " + cmd
    args.append(cmd)
    for attempt in (1, 2):
        t0 = time.time()
        with open(os.path.join(OUT, jid + ".jsonl"), "w", encoding="utf8") as so, open(os.path.join(OUT, jid + ".err"), "w", encoding="utf8") as se:
            try:
                subprocess.run(args, stdout=so, stderr=se, timeout=480, stdin=subprocess.DEVNULL)
            except subprocess.TimeoutExpired:
                log(f"TIMEOUT {jid} attempt {attempt}")
        if os.path.exists(png):
            log(f"OK   {jid} {time.time()-t0:.0f}s attempt {attempt}"); return jid, True
        log(f"MISS {jid} attempt {attempt}")
    return jid, False


if __name__ == "__main__":
    force = "--force" in sys.argv
    ids = [a for a in sys.argv[1:] if not a.startswith("--")] or list(JOBS)
    with ThreadPoolExecutor(2) as ex:
        res = list(ex.map(lambda i: run(i, force), ids))
    log("DONE " + str(res))
