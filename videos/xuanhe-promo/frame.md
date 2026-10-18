---
version: alpha
name: 宣和 · 战火预告片 — Frame (video / frame layer)
description: >
  A hot-blooded cinematic trailer system for 《宣和》. Ink-black ground, 2.39:1 letterbox bars, full-bleed
  epic paintings pushed hard by the camera, brush-calligraphy slams in cinnabar and snow white, fire glow,
  driving snow and embers, flash cuts on the drums. Real game screenshots appear as sharp "intel cards"
  cut into the action, never as a slow slideshow. Hand-written for this promo (no shipped preset fits a
  dark cinematic trailer); replaces the earlier bold-poster parchment look entirely.
unit: the frame — 1920×1080
principle: cut on the drum · one slam per beat · the painting is the world, the brush is the voice

colors:
  ink: "#0b0907"
  ember: "#e8792e"
  red: "#c23a26"
  gold: "#d6b46a"
  snow: "#efe9dc"
  steel: "#8c99a3"

typography:
  slam:      { fontFamily: "Ma Shan Zheng", px: 220, weight: 400, lineHeight: 1.0, color: "red", shadow: "ink-glow" }
  slam-xl:   { fontFamily: "Ma Shan Zheng", px: 340, weight: 400, lineHeight: 0.95, color: "snow", shadow: "ink-glow" }
  slam-sm:   { fontFamily: "Ma Shan Zheng", px: 132, weight: 400, lineHeight: 1.05, color: "snow", shadow: "ink-glow" }
  script:    { fontFamily: "Zhi Mang Xing", px: 120, weight: 400, lineHeight: 1.15, color: "snow" }
  script-sm: { fontFamily: "Zhi Mang Xing", px: 76, weight: 400, lineHeight: 1.2, color: "gold" }
  serif:     { fontFamily: "Noto Serif SC", px: 44, weight: 700, lineHeight: 1.3, color: "snow" }
  label:     { fontFamily: "Noto Sans SC", px: 22, weight: 600, tracking: "6px", color: "gold" }
  mono:      { fontFamily: "Noto Sans SC", px: 30, weight: 500, color: "snow" }

spacing:
  letterbox: "140px bars top and bottom (picture area y 140–940, 2.39:1-ish)"
  safe: "120px side margin inside the picture area"

components:
  letterbox:
    description: >
      Two solid {colors.ink} bars, 140px tall, top and bottom, present in every frame for the whole film
      (each frame draws its own bars as a full-duration clip so seams never show a gap). Captions live in the
      bottom bar. The bars may briefly open to full frame only on the two "drops" (Frame 4 「你」 and Frame 7
      「死守汴京」) — 6 frames of full-bleed, then close again.
  brush-slam:
    typography: "{typography.slam} / {typography.slam-xl}"
    description: >
      The signature. A 2–5 character brush word lands on the drum: scale 1.35→1 with a 0.12s power4 settle,
      a 3-frame camera kick (translate ±8px, rotate ±0.6°), and an ink-splatter burst behind it (cinnabar or
      ink blobs, deterministic SVG circles scaling out and fading). Optional −3°…+3° tilt. Cinnabar on dark
      paintings always gets the ink-glow (a dark 0 0 24px halo) so it reads; snow-white slams get the same
      glow. Never a full sentence in slam size.
  script-line:
    typography: "{typography.script}"
    description: "Running brush-script line (行书) revealed left→right by a soft clip wipe, for the lyrical lines."
  painting-shot:
    description: >
      A full-bleed key-art painting (2160×1440 source, covers the 1920×1080 stage) with a hard camera move:
      push 1.0→1.12 or pull 1.12→1.0 across the shot, plus a slight lateral drift; never static. A gentle
      vignette and a low ink scrim (0–30%) only where type sits. Paintings keep their own color.
  intel-card:
    description: >
      A real game screenshot cut into the action: sharp 2px {colors.gold} hairline, slight 3D tilt
      (rotateY ±8°), punched in with a whip (x ±240px → 0 in 0.25s) over a darkened painting or ink; zoom-to-target
      onto the region the VO names. Each card holds ≤1.6s. A small {typography.label} tag sits on its top-left
      edge (e.g. 「召对 · Claude 扮演」).
  flash-cut:
    description: "A 2-frame {colors.snow} (or ember) flash at a hard cut on a drum hit. Used ≤8 times in the film."
  ink-wipe:
    description: >
      Ink-bleed transition: black ink blooms from one point and swallows the frame (SVG gooey blur+threshold),
      then the next shot is revealed through it. Used at most twice (the turn into history, the end card).
  atmosphere:
    description: >
      Seek-safe deterministic snow or embers drifting across war shots (registry `snow` block, or seeded
      CSS particles), plus a light film grain (`grain-overlay`) at ≤8% over everything. Embers rise and glow
      {colors.ember}; snow falls {colors.snow} at 40–70% opacity.

---

## Usage

- **Ground** is always ink; the letterbox bars are always ink. Color comes from the paintings, the cinnabar slams and fire.
- **One slam per beat.** Every slam lands exactly on its VO word start (given in the packet) — the drum SFX is placed there too.
- **Cut, don't dissolve.** Inside a frame, shots change with hard cuts, whips or flash cuts; crossfades only in Frame 1 (the calm before) and the end card.
- **Motion:** power4.out for slams, power2.inOut for camera pushes, expo for whips. No bounce, no float. Holds keep a micro-drift (camera keeps pushing slowly) — never frozen, never wobbling.
- **Screenshots** are real; never redraw UI, never recolor it.
- **Negative list:** no parchment cards, no rounded pastel UI, no emoji, no Latin display type (Codex / Claude Code are the only Latin words, set in Noto Sans SC 600), no purple "AI" gradients, no lens-flare spam, no slow slideshow.

## Fonts

All local in `assets/fonts/` (OFL licenses in `assets/fonts/licenses/`):

```html
<style>
@font-face{font-family:"Ma Shan Zheng";font-weight:400;font-style:normal;font-display:block;src:url("assets/fonts/MaShanZheng-Regular.ttf") format("truetype");}
@font-face{font-family:"Zhi Mang Xing";font-weight:400;font-style:normal;font-display:block;src:url("assets/fonts/ZhiMangXing-Regular.ttf") format("truetype");}
@font-face{font-family:"Noto Serif SC";font-weight:200 900;font-style:normal;font-display:block;src:url("assets/fonts/NotoSerifSC-VF.ttf") format("truetype");}
@font-face{font-family:"Noto Sans SC";font-weight:100 900;font-style:normal;font-display:block;src:url("assets/fonts/NotoSansSC-VF.ttf") format("truetype");}
</style>
```
