"""Narration for the promo: each SCRIPT.md line -> audio/vo-NN.wav with word timings (edge-tts, zh-CN-YunyangNeural
pitched down). Writes the voices into audio_meta.json in the product-launch format, keeping any bgm/sfx already there.

    python scripts/tts_edge.py [--voice zh-CN-YunyangNeural] [--pitch -8Hz] [--rate -5%]
"""
import argparse
import asyncio
import json
import re
import subprocess
from pathlib import Path

import aiohttp.connector
import aiohttp.resolver
import edge_tts

# aiohttp picks the c-ares resolver when aiodns is installed; on this machine it cannot find the DNS servers
# ("Could not contact DNS servers") although the system resolver works. Use the system resolver.
aiohttp.resolver.DefaultResolver = aiohttp.resolver.ThreadedResolver
aiohttp.connector.DefaultResolver = aiohttp.resolver.ThreadedResolver

ROOT = Path(__file__).resolve().parents[1]


def script_lines(text: str) -> list[tuple[int, str]]:
    out = []
    for block in re.split(r"^## ", text, flags=re.M)[1:]:
        frame = re.search(r"\(Frame (\d+)\)", block.splitlines()[0])
        spoken = [line.strip() for line in block.splitlines() if line.startswith("    ") and line.strip()]
        if frame and spoken:
            out.append((int(frame.group(1)), " ".join(spoken)))
    return out


async def synth(text: str, mp3: Path, args) -> list[dict]:
    words = []
    comm = edge_tts.Communicate(text, args.voice, rate=args.rate, pitch=args.pitch, boundary="WordBoundary")
    with mp3.open("wb") as fh:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                words.append({"text": chunk["text"], "start": round(start, 3), "end": round(start + chunk["duration"] / 1e7, 3)})
    return words


PUNCT = "，。：？！、；…—《》“”「」,.:?!"


def phrases(text: str, tokens: list[dict]) -> list[dict]:
    """Caption units: the script split at punctuation, each phrase timed from the TTS word boundaries (a token's
    time spread evenly over its characters). TTS tokens cut names apart (安禄|山入殿); phrases never do."""
    chars: list[tuple[str, float, float]] = []
    for tok in tokens:
        letters = [c for c in tok["text"] if c not in PUNCT and c != " "]
        step = (tok["end"] - tok["start"]) / max(1, len(letters))
        chars.extend((c, tok["start"] + i * step, tok["start"] + (i + 1) * step) for i, c in enumerate(letters))
    out, current, k = [], [], 0
    spaced = set()
    for c in text + "。":
        if c == " ":
            spaced.add(len(current))
            continue
        if c in PUNCT:
            if current:
                label = "".join((" " if i in spaced and i else "") + x[0] for i, x in enumerate(current))
                out.append({"text": label, "start": round(current[0][1], 3), "end": round(current[-1][2], 3)})
                current, spaced = [], set()
            continue
        if k >= len(chars) or chars[k][0] != c:
            raise SystemExit(f"cannot align {c!r} at {k} in {text}")
        current.append(chars[k])
        k += 1
    return out


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return float(out.stdout.strip())


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default="zh-CN-YunyangNeural")
    parser.add_argument("--pitch", default="-8Hz")
    parser.add_argument("--rate", default="-5%")
    args = parser.parse_args()
    audio = ROOT / "audio"
    audio.mkdir(exist_ok=True)
    voices = []
    n = 0
    for frame, text in script_lines((ROOT / "SCRIPT.md").read_text(encoding="utf-8")):
        mp3 = audio / f"vo-{frame:02d}.mp3"
        wav = audio / f"vo-{frame:02d}.wav"
        words = phrases(text, await synth(text, mp3, args))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-ar", "44100", "-ac", "1", str(wav)], check=True)
        mp3.unlink()
        for w in words:
            n += 1
            w["id"] = f"w{n}"
        voices.append({"frame": frame, "path": f"audio/{wav.name}", "duration_s": round(duration(wav), 3), "words": words})
        print(f"frame {frame}: {voices[-1]['duration_s']}s, {len(words)} words")
    meta_path = ROOT / "audio_meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {"bgm": None, "bgm_pending": False, "sfx": []}
    meta["voices"] = voices
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print("total", round(sum(v["duration_s"] for v in voices), 2), "s ->", meta_path)


asyncio.run(main())
