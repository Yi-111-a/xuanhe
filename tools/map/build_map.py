# -*- coding: utf-8 -*-
"""Build scenarios/xuanhe_1120/map.json from the painted base map.

Sea is detected by colour (the calm celadon sea is a large uniform blue-green body touching the right edge);
land pixels are split between regions by nearest seed (weighted), and each region's outline is traced with OpenCV.
Seeds, labels and capitals are in base-map pixel coordinates of the 1536x1024 original; output is scaled to 2048 wide.
Usage: python tools/map/build_map.py [--debug out.png]
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "design" / "asset_src" / "map" / "map.base.png"
OUT = ROOT / "scenarios" / "xuanhe_1120" / "map.json"
SCALE = 2048 / 1536

# id: (name, foreign, seed, weight, capital)
REGIONS = {
    "bianjing": ("汴京", False, (870, 505), 0.75, (855, 470)),
    "jingxi": ("京西", False, (680, 570), 1.0, (700, 540)),
    "hedong": ("河东", False, (650, 320), 1.0, (700, 360)),
    "hebei_xi": ("河北西路", False, (835, 360), 0.85, (820, 325)),
    "hebei_dong": ("河北东路", False, (1010, 390), 0.9, (1050, 330)),
    "jingdong": ("京东", False, (1200, 470), 1.0, (1105, 505)),
    "huainan": ("淮南", False, (1000, 640), 1.0, (1000, 700)),
    "guanzhong": ("关中", False, (430, 470), 1.0, (380, 380)),
    "xibian": ("西北边", False, (140, 470), 1.1, (215, 420)),
    "liangzhe": ("两浙", False, (1250, 800), 1.0, (1300, 740)),
    "jiangnan": ("江南", False, (870, 870), 1.0, (820, 795)),
    "jinghu": ("荆湖", False, (560, 790), 1.1, (560, 690)),
    "chuanxia": ("川峡", False, (190, 800), 1.15, (240, 820)),
    "minguang": ("闽广", False, (1180, 990), 0.8, (1150, 960)),
    "yanshan": ("燕京", True, (930, 200), 0.95, (940, 250)),
    "pingzhou": ("平州", True, (1130, 170), 0.8, (1100, 220)),
    "yunzhong": ("云中", True, (560, 120), 1.0, (600, 150)),
    "liao": ("辽", True, (830, 40), 1.1, (850, 60)),
    "jin": ("金", True, (1360, 60), 1.3, (1380, 120)),
    "goryeo": ("高丽", True, (1488, 300), 0.6, (1495, 260)),
    "xixia": ("西夏", True, (230, 170), 1.2, (300, 220)),
}


def sea_mask(img: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    blue = ((h >= 80) & (h <= 105) & (s >= 50) & (v >= 120)).astype(np.uint8)
    blue = cv2.morphologyEx(blue, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    blue = cv2.morphologyEx(blue, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(blue)
    sea = np.zeros_like(blue)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > 20000:  # only large water bodies (the sea, the gulf), not rivers
            sea[lab == i] = 1
    return sea


def main() -> int:
    img = cv2.imdecode(np.fromfile(str(SRC), dtype=np.uint8), cv2.IMREAD_COLOR) if SRC.exists() else None  # imread can't open non-ASCII paths on Windows
    if img is None:
        print("missing", SRC)
        return 1
    hgt, wid = img.shape[:2]
    sea = sea_mask(img)
    ys, xs = np.mgrid[0:hgt, 0:wid]
    ids = list(REGIONS)
    dist = np.stack([np.hypot(xs - REGIONS[r][2][0], ys - REGIONS[r][2][1]) / REGIONS[r][3] for r in ids])
    owner = np.argmin(dist, axis=0)
    owner[sea == 1] = -1
    regions = []
    for index, rid in enumerate(ids):
        name, foreign, seed, _, capital = REGIONS[rid]
        mask = (owner == index).astype(np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            print("empty region", rid)
            return 1
        contour = max(contours, key=cv2.contourArea)
        poly = cv2.approxPolyDP(contour, 3.0, True)[:, 0, :]
        regions.append({
            "id": rid,
            "name": name,
            "foreign": foreign,
            "polygon": [[round(float(x) * SCALE), round(float(y) * SCALE)] for x, y in poly],
            "label": [round(seed[0] * SCALE), round(seed[1] * SCALE)],
            "capital": [round(capital[0] * SCALE), round(capital[1] * SCALE)],
        })
    data = {"image": {"id": "map.base", "width": 2048, "height": round(hgt * SCALE),
                      "source_size_note": "polygons traced from the 1536x1024 painting (sea masked by colour, land split by weighted nearest seed) and scaled x1.3333"},
            "regions": regions}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    if "--debug" in sys.argv:
        out = sys.argv[sys.argv.index("--debug") + 1]
        vis = img.copy()
        rng = np.random.default_rng(3)
        overlay = vis.copy()
        for index in range(len(ids)):
            overlay[owner == index] = rng.integers(40, 255, 3)
        vis = cv2.addWeighted(vis, 0.55, overlay, 0.45, 0)
        for rid in ids:
            x, y = REGIONS[rid][2]
            cv2.circle(vis, (x, y), 6, (0, 0, 0), -1)
            cv2.putText(vis, rid, (x + 6, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
        cv2.imencode('.png', vis)[1].tofile(out)
    print("regions", len(regions), "points", sum(len(r["polygon"]) for r in regions))
    return 0


if __name__ == "__main__":
    sys.exit(main())
