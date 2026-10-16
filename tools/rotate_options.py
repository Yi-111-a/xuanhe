"""把每条奏疏的选项次序按 id 的稳定哈希轮转，免得「处处取首项」恰好等于稳健打法（平衡模拟的 first 策略）。

只改选项在列表中的次序，不改内容；对同一份文件重复运行结果不变（按选项 id 排序后再轮转）。
    .venv/Scripts/python tools/rotate_options.py            # 改写 scenarios/xuanhe_1120/memorials.yaml
    .venv/Scripts/python tools/rotate_options.py --check    # 只报告每个位置上 wise 选项的分布
"""
from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "scenarios" / "xuanhe_1120" / "memorials.yaml"


def blocks(text: str) -> list[tuple[int, int]]:
    starts = [m.start() for m in re.finditer(r"^- id: ", text, re.M)]
    return [(s, starts[i + 1] if i + 1 < len(starts) else len(text)) for i, s in enumerate(starts)]


def rotate(block: str) -> str:
    m = re.search(r"^  options:\n", block, re.M)
    if not m:
        return block
    head, body = block[: m.end()], block[m.end():]
    # 选项区到下一个两格缩进的键（或块尾）为止
    end = re.search(r"^(?:  [a-z_]+:|# )", body, re.M)
    tail = body[end.start():] if end else ""
    body = body[: end.start()] if end else body
    trailing = body[len(body.rstrip("\n")):]
    body = body.rstrip("\n") + "\n"
    opts = [o for o in re.split(r"(?=^    - id: )", body, flags=re.M) if o.strip()]
    if len(opts) < 2 or not all(o.startswith("    - id: ") for o in opts):
        return block
    ids = [re.match(r"    - id: (\S+)", o).group(1) for o in opts]
    item = re.match(r"- id: (\S+)", block).group(1)
    order = sorted(range(len(opts)), key=lambda i: ids[i])
    k = int(hashlib.sha1(item.encode()).hexdigest(), 16) % len(opts)
    order = order[k:] + order[:k]
    new = "".join(opts[i].rstrip("\n") + "\n" for i in order)
    return head + new + trailing[1:] + tail if trailing else head + new + tail


def main() -> int:
    text = PATH.read_text(encoding="utf-8")
    out, last = [], 0
    for s, e in blocks(text):
        out.append(text[last:s])
        out.append(rotate(text[s:e]))
        last = e
    out.append(text[last:])
    new = "".join(out)
    if "--check" in sys.argv:
        print("changed" if new != text else "unchanged")
        return 0
    PATH.write_text(new, encoding="utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
