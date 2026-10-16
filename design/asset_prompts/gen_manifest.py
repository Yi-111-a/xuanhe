# -*- coding: utf-8 -*-
"""Write scenarios/xuanhe_1120/assets.yaml from jobs.py: one entry per job (icons split per resource),
with real size and sha256 for generated webp files and status missing otherwise."""
import hashlib
import os
import sys

import yaml
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jobs import JOBS  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SC = os.path.join(ROOT, "scenarios", "xuanhe_1120")
NEG = "text, characters, calligraphy, letters, numbers, seals, inscriptions, watermark, logo, dragon, dragon robe, Ming wing hat, mandarin square, Tang futou, modern, photo, 3d render, anime"
NOMINAL = {"portrait": [768, 1152], "event": [1344, 896], "ending": [1344, 896], "map": [2048, 1365], "icon": [256, 256]}
ICONS = "treasury grain authority morale corruption ningxing dongnan wubei liao_zuo jin_contempt nanmu".split()


def used_by(i):
    p = i.split(".")
    if p[0] == "portrait":
        return f"character:{p[1]}:portrait" + ("" if p[2] == "default" else f":{p[2]}")
    if p[0] in ("event", "ending"):
        return f"{p[0]}:{p[1]}:illustration"
    if p[0] == "map":
        return "map:base"
    if p[0] == "title":
        return "ui:title:background"
    if p[0] == "icon":
        return f"resource:{p[1]}:icon"
    if i.startswith("ui.season."):
        return "ui:season:" + p[2]
    return "ui:" + p[1]


entries = []


def add(i, kind, prompt, ref=None):
    rel = f"assets/{kind}/{i}.webp"
    fp = os.path.join(SC, rel)
    ok = os.path.exists(fp)
    if ok:
        size = list(Image.open(fp).size)
        sha = hashlib.sha256(open(fp, "rb").read()).hexdigest()
    else:
        size = NOMINAL.get(kind, [1536, 1024])
        sha = None
    e = dict(id=i, kind=kind, used_by=used_by(i), path=rel, size=size, format="webp", prompt=prompt, negative_prompt=NEG,
             style_ref="design/asset_prompts/_style_block.txt", model="codex-image", sha256=sha,
             status="generated" if ok else "missing", version=1)
    if ref:
        e["reference_image"] = ref
    entries.append(e)


for i, j in JOBS.items():
    if j.get("group") == "appicon":
        continue  # desktop/icon-src/icon.png, not a scenario asset
    if i == "icon.sheet":
        for r in ICONS:
            add(f"icon.{r}", "icon", j["subject"] + " (one cell of the sprite sheet, cropped and keyed)")
        continue
    add(i, j["kind"], j["subject"], j.get("ref"))
with open(os.path.join(SC, "assets.yaml"), "w", encoding="utf-8", newline="\n") as fh:
    fh.write("# 资产清单：由 design/asset_prompts/gen_manifest.py 依 jobs.py 生成，勿手改。\n")
    yaml.safe_dump({"manifest_version": 1, "entries": entries}, fh, allow_unicode=True, sort_keys=False, width=200)
print(len(entries), sum(e["status"] == "generated" for e in entries))
