"""Trailer audio remix v2 — sample-accurate mix, muxed onto the rendered picture (video stream copied).

    .venv-tts/Scripts/python mix/remix.py [--music-db -1] [--duck-db 0] [--voice-db 9]

- narration: the nine padded VO clips at their frame starts, lifted (edge-tts comes out quiet);
- music: assets/bgm/track.wav at one constant level for the whole film (no ducking — the client found level
  changes under the voice odd; --duck-db can still lower it per line), with a fixed mid-range EQ cut that leaves
  room for the voice, and a soft fade-in over the first 3.4 s so the track's own opening hit does not slam
  into the first words;
- effects: none on spoken words; two soft impacts on the drops 「你」 (17.85 s) and 「死守汴京」 (33.10 s);
- loudness-normalised to about -14 LUFS (true peak -1.5 dB) by ffmpeg loudnorm.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
DUR = 50.5  # the film ends on the 「宣和」 slam
STARTS = [0.0, 6.0, 10.6, 16.9, 20.4, 23.4, 29.35, 41.0, 47.5]
HITS = [(17.85, 0.30), (33.10, 0.34)]


def load(path: Path, channels: int, af: str | None = None) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), *(["-af", af] if af else []), "-f", "f32le", "-ac", str(channels), "-ar", str(SR), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, channels).copy()


def place(bus: np.ndarray, clip: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(round(at * SR))
    n = min(len(clip), len(bus) - i)
    if n > 0:
        bus[i:i + n] += clip[:n] * gain


def ramp_env(n: int, spans: list[tuple[float, float, float]], ramp: float = 0.12) -> np.ndarray:
    """Gain envelope: 1 outside the spans, `low` inside each (a, b, low) span, with cosine ramps."""
    t = np.arange(n) / SR
    env = np.ones(n)
    for a, b, low in spans:
        w = np.clip(np.minimum((t - (a - ramp)) / ramp, ((b + ramp) - t) / ramp), 0, 1)
        env = np.minimum(env, 1.0 - (0.5 - 0.5 * np.cos(np.pi * w)) * (1.0 - low))
    return env


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--music-db", type=float, default=-1.0)
    # per line: the build (lines 1-3) is quiet already, the drop section (4-7) is loud, the second track (8-9) in between
    ap.add_argument("--duck-db", default="0", help="0 = the music never changes level under the voice (client's choice)")
    # a constant mid cut on the music leaves room for the voice without any audible level changes
    ap.add_argument("--music-eq", default="equalizer=f=1000:t=o:w=1.2:g=-4,equalizer=f=2600:t=o:w=1.4:g=-8")
    ap.add_argument("--voice-db", type=float, default=9.0)
    # light compression evens the TTS voice out so it sits on top of a constant music bed
    ap.add_argument("--voice-af", default="acompressor=threshold=0.08:ratio=3:attack=5:release=90:makeup=2")
    ap.add_argument("--stems", action="store_true", help="also write mix/stem-vo.wav and mix/stem-bed.wav")
    args = ap.parse_args()
    n = int(DUR * SR)
    meta = json.loads((ROOT / "audio_meta.json").read_text(encoding="utf-8"))
    voices = sorted(meta["voices"], key=lambda v: v["frame"])

    vo = np.zeros((n, 2), np.float32)
    spans = []
    ducks = [float(x) for x in str(args.duck_db).split(",")]
    ducks = ducks * 9 if len(ducks) == 1 else ducks
    for v, start, duck in zip(voices, STARTS, ducks):
        clip = load(ROOT / v["path"], 1, args.voice_af or None)
        place(vo, np.repeat(clip, 2, axis=1), start, 10 ** (args.voice_db / 20))
        spans.append((start + v["words"][0]["start"] - 0.05, start + v["words"][-1]["end"] + 0.15, 10 ** (duck / 20)))

    bed = load(ROOT / "assets/bgm/track.wav", 2, args.music_eq or None)[:n]
    bed = np.pad(bed, ((0, n - len(bed)), (0, 0)))
    t = np.arange(n) / SR
    fade_in = np.clip((t - 0.15) / 3.4, 0, 1) ** 1.5
    env = ramp_env(n, spans) * fade_in * 10 ** (args.music_db / 20)
    bed *= env[:, None].astype(np.float32)

    fx = np.zeros((n, 2), np.float32)
    hit = load(ROOT / "assets/sfx/impact-heavy.mp3", 2)
    for at, g in HITS:
        place(fx, hit, at, g)

    mix = vo + bed + fx
    tail = t > DUR - 1.5  # music and all fade out with the picture's fade to black
    mix[tail] *= (np.linspace(1, 0, tail.sum()) ** 1.5)[:, None].astype(np.float32)

    out = ROOT / "mix"
    out.mkdir(exist_ok=True)

    def write(arr: np.ndarray, path: Path, extra: list[str]) -> None:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", *extra, str(path)],
            input=arr.astype(np.float32).tobytes(), check=True,
        )

    if args.stems:
        write(vo, out / "stem-vo.wav", ["-c:a", "pcm_s16le"])
        write(bed, out / "stem-bed.wav", ["-c:a", "pcm_s16le"])
    write(mix, out / "trailer-mix-v2.wav", ["-af", "loudnorm=I=-14:LRA=11:TP=-1.5", "-ar", str(SR), "-c:a", "pcm_s16le"])
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(ROOT / "renders/xuanhe-trailer-raw.mp4"), "-i", str(out / "trailer-mix-v2.wav"),
         "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", str(ROOT / "renders/xuanhe-trailer.mp4")],
        check=True,
    )
    print("spans:", [(round(a, 2), round(b, 2), round(20 * np.log10(g), 1)) for a, b, g in spans])


if __name__ == "__main__":
    main()
