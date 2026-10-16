# -*- coding: utf-8 -*-
"""Convert PNG originals in design/asset_src to webp in scenarios/xuanhe_1120/assets. Usage: python process.py [ids...]"""
import os, sys, json, hashlib
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jobs import JOBS

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(ROOT, "design", "asset_src")
OUT = os.path.join(ROOT, "scenarios", "xuanhe_1120", "assets")
WIDTH = {"portrait": 768, "event": 1344, "ending": 1344, "map": 2048}
KEYED = {"ui.ink_button", "ui.seal", "ui.crisis_beacon", "ui.ribbon_cai", "ui.ribbon_xingchen", "ui.ribbon_neishi", "ui.ribbon_qingyi"}


def key_white(im, thr=240):
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    near = a.min(axis=2) >= thr
    lab, n = ndi.label(near)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # soft alpha: erode bg a touch, feather
    fg = ~bg
    fg = ndi.binary_opening(fg, iterations=1)
    alpha = ndi.gaussian_filter(fg.astype(np.float32), 0.8)
    out = im.convert("RGBA")
    arr = np.asarray(out).copy()
    arr[..., 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(arr), fg


def crop_alpha(im, pad=4):
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    l, t, r, b = bb
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def save(im, path, q=84):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=q, method=6)
    return im.size


def outpath(jid):
    kind = JOBS[jid]["kind"]
    return os.path.join(OUT, kind, jid + ".webp")


def do(jid):
    src = os.path.join(SRC, JOBS[jid]["kind"], jid + ".png")
    if not os.path.exists(src):
        return {}
    im = Image.open(src)
    res = {}
    kind = JOBS[jid]["kind"]
    if jid == "icon.sheet":
        # 两行六列的圆形图标：按列 / 行的非白像素投影找出每枚圆盘，再以圆形蒙版裁出（相邻圆盘边缘相切，连通域法会粘连）
        rgb = np.asarray(im.convert("RGB")).astype(np.int16)
        ink = rgb.min(axis=2) < 225
        cols = np.where(ink.sum(axis=0) > 20)[0]
        rows = np.where(ink.sum(axis=1) > 20)[0]

        def runs(idx):
            out, start = [], idx[0]
            for a, b in zip(idx, idx[1:]):
                if b != a + 1:
                    out.append((start, a)); start = b
            out.append((start, idx[-1]))
            return [r for r in out if r[1] - r[0] > 60]
        row_runs = runs(rows)
        ids = ["treasury", "grain", "authority", "morale", "corruption", "ningxing", "dongnan", "wubei", "liao_zuo", "jin_contempt", "nanmu", "spare"]
        k = 0
        for (y0, y1) in row_runs[:2]:
            band = ink[y0:y1 + 1]
            col_runs = runs(np.where(band.sum(axis=0) > 5)[0])
            if len(col_runs) != 6:  # 圆盘相切：按行宽六等分
                x0, x1 = col_runs[0][0], col_runs[-1][1]
                w = (x1 - x0 + 1) / 6
                col_runs = [(round(x0 + i * w), round(x0 + (i + 1) * w) - 1) for i in range(6)]
            for (cx0, cx1) in col_runs:
                cx, cy = (cx0 + cx1) / 2, (y0 + y1) / 2
                r = min(cx1 - cx0, y1 - y0) / 2
                box = (round(cx - r), round(cy - r), round(cx + r), round(cy + r))
                crop = im.convert("RGBA").crop(box).resize((256, 256), Image.LANCZOS)
                mask = Image.new("L", (256 * 4, 256 * 4), 0)
                from PIL import ImageDraw
                ImageDraw.Draw(mask).ellipse((6, 6, 256 * 4 - 6, 256 * 4 - 6), fill=255)
                crop.putalpha(mask.resize((256, 256), Image.LANCZOS))
                rid = ids[k]; k += 1
                if rid == "spare":
                    continue
                p = os.path.join(OUT, "icon", f"icon.{rid}.webp")
                res[f"icon.{rid}"] = dict(path=p, size=list(save(crop, p, 90)))
        return res
    if jid == "ui.lacquer_bar":
        rgba, fg = key_white(im, 240)
        out = crop_alpha(rgba, 6)
    elif jid in KEYED:
        rgba, fg = key_white(im, 238)
        out = crop_alpha(rgba, 6)
        if out.width > 1100:
            out = out.resize((1100, round(out.height * 1100 / out.width)), Image.LANCZOS)
    else:
        w = WIDTH.get(kind)
        out = im.convert("RGB")
        if w and out.width != w:
            out = out.resize((w, round(out.height * w / out.width)), Image.LANCZOS)
        elif jid == "title.scroll":
            pass
        elif kind == "ui" and out.width > 1536:
            pass
    p = outpath(jid)
    res[jid] = dict(path=p, size=list(save(out, p)))
    return res


if __name__ == "__main__":
    ids = sys.argv[1:] or list(JOBS)
    allres = {}
    for j in ids:
        allres.update(do(j))
    for k, v in allres.items():
        print(k, v["size"])
