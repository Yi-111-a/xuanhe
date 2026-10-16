"""Subset the bundled fonts for 《天宝》 (contract §4, gate G4).

Character set = GB2312 (symbol rows + level 1 + level 2, generated from the codec)
              + every character in scenarios/tianbao_751/**/*.{yaml,yml,md,json,txt}
              + every character in app/src/**/*.{ts,tsx,css,html,json} and app/index.html
              + ASCII and the punctuation / arrows / shapes the UI uses.

Outputs woff2 files into app/src/assets/fonts/ and a coverage manifest
(app/src/assets/fonts/subset-chars.json) that the garble E2E test reads.

Run:  ..\\.venv\\Scripts\\python.exe scripts/subset_fonts.py   (or `npm run fonts`)
Source fonts are downloaded into app/.font-cache/ on first run (OFL licensed):
  LXGW WenKai Medium  — https://github.com/lxgw/LxgwWenKai
  Noto Serif SC       — https://github.com/notofonts/noto-cjk
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent
CACHE = APP / ".font-cache"
OUT = APP / "src" / "assets" / "fonts"
SCENARIO = ROOT / "scenarios" / "tianbao_751"

FONTS = [
    # (output name, cache file, url, role)
    (
        "wenkai-medium",
        "LXGWWenKai-Medium.ttf",
        "https://github.com/lxgw/LxgwWenKai/releases/latest/download/LXGWWenKai-Medium.ttf",
        "title",
    ),
    (
        "serif-regular",
        "NotoSerifSC-Regular.otf",
        "https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf",
        "body",
    ),
    (
        "serif-bold",
        "NotoSerifSC-Bold.otf",
        "https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf",
        "body",
    ),
]


def gb2312_chars() -> set[str]:
    chars: set[str] = set()
    # Rows 0xA1-0xA9 are symbols/punctuation; 0xB0-0xD7 level 1; 0xD8-0xF7 level 2.
    for lead in list(range(0xA1, 0xAA)) + list(range(0xB0, 0xF8)):
        for trail in range(0xA1, 0xFF):
            try:
                ch = bytes([lead, trail]).decode("gb2312")
            except UnicodeDecodeError:
                continue
            chars.add(ch)
    return chars


def extra_chars() -> set[str]:
    chars = {chr(c) for c in range(0x20, 0x7F)}
    ranges = [
        (0x00A0, 0x00FF),  # Latin-1 punctuation (·, ×, ÷ …)
        (0x2010, 0x206F),  # general punctuation (— … ‧ ※)
        (0x2190, 0x21FF),  # arrows
        (0x2212, 0x2212),  # minus sign
        (0x2460, 0x24FF),  # enclosed numerals ①
        (0x25A0, 0x25FF),  # geometric shapes ▲▼●○◆
        (0x2600, 0x2606),
        (0x3000, 0x303F),  # CJK symbols and punctuation
        (0xFF00, 0xFFEF),  # full-width forms
    ]
    for lo, hi in ranges:
        chars.update(chr(c) for c in range(lo, hi + 1))
    return chars


def text_chars(paths: list[Path]) -> set[str]:
    chars: set[str] = set()
    for path in paths:
        try:
            chars.update(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError) as exc:
            print(f"warning: cannot read {path}: {exc}", file=sys.stderr)
    return {c for c in chars if c.isprintable() and c not in "\r\n\t"}


def scenario_files() -> list[Path]:
    if not SCENARIO.is_dir():
        return []
    exts = {".yaml", ".yml", ".md", ".json", ".txt"}
    return [p for p in SCENARIO.rglob("*") if p.suffix.lower() in exts and p.is_file()]


def app_files() -> list[Path]:
    exts = {".ts", ".tsx", ".css", ".html", ".json"}
    files = [p for p in (APP / "src").rglob("*") if p.suffix in exts and p.is_file() and p.name != "subset-chars.json"]
    files.append(APP / "index.html")
    return files


def ensure_source(name: str, url: str) -> Path:
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    if not path.exists():
        print(f"downloading {url}")
        with urllib.request.urlopen(url, timeout=300) as resp:  # noqa: S310 (fixed https URLs)
            path.write_bytes(resp.read())
    return path


def is_cjk(ch: str) -> bool:
    cp = ord(ch)
    return 0x3400 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF or 0x20000 <= cp <= 0x3134F


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    gb = gb2312_chars()
    scen = text_chars(scenario_files())
    src = text_chars(app_files())
    wanted = gb | extra_chars() | scen | src
    wanted.discard("�")
    coverage: dict[str, list[str]] = {}
    sizes: dict[str, int] = {}
    for out_name, cache_name, url, _role in FONTS:
        source = ensure_source(cache_name, url)
        font = TTFont(source)
        cmap = font.getBestCmap()
        present = sorted(c for c in wanted if ord(c) in cmap)
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.notdef_outline = True
        options.hinting = False
        options.desubroutinize = True
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=[ord(c) for c in present])
        subsetter.subset(font)
        target = OUT / f"{out_name}.woff2"
        font.flavor = "woff2"
        font.save(target)
        coverage[out_name] = present
        sizes[out_name] = target.stat().st_size
        print(f"{target.name}: {len(present)} glyphs, {target.stat().st_size / 1024:.0f} KiB")

    body = set(coverage["serif-regular"])
    title = set(coverage["wenkai-medium"])
    missing_body = sorted(c for c in (scen | src) if is_cjk(c) and c not in body)
    missing_title = sorted(c for c in (scen | src) if is_cjk(c) and c not in title)
    manifest = {
        "generated_by": "app/scripts/subset_fonts.py",
        "counts": {
            "gb2312": len(gb),
            "scenario_chars": len(scen),
            "app_chars": len(src),
            "body_glyphs": len(body),
            "title_glyphs": len(title),
        },
        "sizes": sizes,
        "body": "".join(sorted(body)),
        "title": "".join(sorted(title)),
        "missing_body": "".join(missing_body),
        "missing_title": "".join(missing_title),
    }
    (OUT / "subset-chars.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8", newline="\n")
    if missing_body:
        print(f"WARNING: {len(missing_body)} source chars missing from body font: {''.join(missing_body)}")
    if missing_title:
        print(f"note: {len(missing_title)} source chars missing from title font (fall back to body): {''.join(missing_title)}")


if __name__ == "__main__":
    main()
