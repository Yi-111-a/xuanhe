---
format: 1920x1080
duration: 50.5s
message: "繁华只剩六年——这一次你是宋徽宗：召对、廷议、调兵，死守汴京，史书由你来写。"
arc: 繁华（静）→ 史书上的「靖康」→ 城破四连砸 → 爆点「你，是宋徽宗」→ 实机快切（召对 / 廷议 / 诏书 / 西军）→「议和，还是——」停顿 → 爆点「死守汴京」+ 无旁白战斗蒙太奇 → AI 演群臣、引擎算钱粮 →「宣和」落版
audience: B站 / YouTube 的历史、策略游戏玩家，AI 圈
mode: autonomous
music: none  # host-made bed: assets/bgm/track.wav — build 0–17s, drop at 18.0s, break 32.0–32.9s, re-entry 33.0s, second track from 40.9s to the end
language: zh-CN
captions: on (film subtitles inside the bottom letterbox bar)
---

## Video direction

- **This is a war trailer, not a slideshow.** Ink ground, 140px letterbox bars top and bottom in every frame (each frame draws its own full-duration bars), full-bleed key-art paintings under hard camera moves, brush-calligraphy slams (Ma Shan Zheng) landing on drums, brush-script lines (Zhi Mang Xing) for the lyrical lines, real game screenshots as sharp "intel cards" whipped into the action. Fire, snow and embers. See `frame.md` (colors ink / ember / red / gold / snow / steel).
- **Sync is everything.** Every slam lands exactly at its word start given below (seconds are frame-local). The drum / impact SFX are already placed on those times. Two drops: Frame 4 at 0.99s (「你」) and Frame 7 at 3.80s (「死守汴京」) — on each, a 2-frame snow flash, the letterbox bars snap open for 6 frames, a hard camera punch, then the bars close.
- **Cut, don't dissolve.** Hard cuts, whips and flash cuts inside frames; frame seams are hard cuts. Only Frame 1 and the end card breathe.
- **Atmosphere:** registry `snow` over the war shots (Frames 3, 7), seeded rising embers (ember color) over fire shots, `grain-overlay` at ≤8% everywhere. A deterministic `camera-shake` kick (3 frames) on every slam.
- **Paintings:** 2160×1440 sources in `assets/` — cover the stage, keep their colors, never static (push 1.0→1.12 or pull, plus drift). Scrim only behind type.
- **Caption band:** captions render in the bottom letterbox bar (y 948–1072). Keep frame content inside the picture area y 140–940.
- **Negative list:** no parchment cards, no pastel rounded UI, no emoji, no purple "AI" gradients, no Latin display type (only the words Codex / Claude Code / URL, in Noto Sans SC 600), never redraw game UI, no slow crossfade slideshow.

## Frame 1 — 繁华

- scene: 黑场一记重击，汴京上元夜全景（烟火、虹桥、灯河）炸亮；行书「宣和二年 · 汴京」「天下第一繁华」
- voiceover: "宣和二年，汴京。天下第一繁华。"
- duration: 6s
- transition_in: cut
- status: animated
- src: compositions/frames/01-glory.html
- type: hook
- persuasion: Curiosity / beauty before loss
- beat: awe
- blueprint: kinetic-type-beats (Adapt)
- asset_candidates: assets/t_glory.jpg — 汴京上元夜：虹桥灯火、河上灯船、宫阙上空烟火，左侧楼台上有观灯的官员
- focal: assets/t_glory.jpg
- roles: t_glory = background (full-bleed painting shot)
- sfx: low-boom @0.95s

Adapt: statement builds across beats over a living painting.
Scene 1 (0.0–0.95s): ink black with the letterbox bars; a single gold ember drifts up the center; stillness.
Scene 2 (0.95–3.5s): on the boom (0.95s) a 2-frame warm flash, then t_glory full-bleed, slow push 1.0→1.10 toward the palace and fireworks (power2.inOut across the whole frame); small gold firework sparkles (seeded, deterministic) bloom over the sky area. On 「宣和二年」 (1.45s) a gold label line 「宣和二年 · 汴京」 in script-sm (Zhi Mang Xing, gold) writes on at the top-left of the picture area (clip wipe left→right, done by 2.8s).
Scene 3 (3.57–6.0s): on 「天下第一繁华」 (3.57s) the script line 「天下第一繁华」 (Zhi Mang Xing 120px, snow, ink glow) writes on center-low (wipe left→right 0.9s); from 5.2s the painting's saturation begins to drain slightly (saturate 1→0.75) — a hint of what comes; hold the push to the cut.

## Frame 2 — 靖康

- scene: 繁华褪色、墨色从四角涌入吞没画面；「六年之后」小字；巨大的朱砂毛笔字「靖康」砸下，墨点飞溅，灰烬开始飘落
- voiceover: "可史书上写着：六年之后——靖康。"
- duration: 4.6s
- transition_in: cut
- status: animated
- src: compositions/frames/02-jingkang.html
- type: hook
- persuasion: Scarcity / dread
- beat: dread
- blueprint: kinetic-type-beats (Adapt)
- asset_candidates: assets/t_glory.jpg — 汴京上元夜（继续，褪色）; assets/ending.e_jingkang.webp — 雪原上金骑押送二帝北去
- focal: assets/t_glory.jpg
- roles: t_glory = background (desaturating, swallowed by ink) · ending.e_jingkang = background (faint ghost behind the slam)
- sfx: taiko-hit @2.86s

Adapt: the statement is one word, built by silence then a slam.
Scene 1 (0.0–1.8s): t_glory continues (scale ~1.10 as Frame 1 ended, push continuing) and drains to grey (saturate 0.75→0, brightness down); on 「可史书上写着」 (0.40s) ink blooms in from the four corners (gooey SVG blur+threshold ink mask, see registry `ink-bleed-reveal`) and has swallowed ~90% of the frame by 1.8s.
Scene 2 (1.84–2.85s): on 「六年之后」 a small serif line 「六年之后」 (Noto Serif SC 700, 44px, snow 80%) fades up center, letter-spaced; the ending.e_jingkang painting shows as a very faint ghost (opacity 0.18, grey) through the ink.
Scene 3 (2.86–4.6s): on 「靖康」 (2.86s) SLAM: 「靖康」 in Ma Shan Zheng ~340px cinnabar with ink glow, scale 1.35→1 (0.12s power4), 2-frame ember flash, 3-frame camera kick, cinnabar/ink splatter burst behind; the small line 「六年之后」 jumps up above it. Grey ash particles start drifting down. Hold with micro push.

## Frame 3 — 城破

- scene: 四连砸：金骑踏冰冲锋「金兵南下」→ 太原城头火战「太原被围」→ 宫门焚毁「汴京城破」→ 二帝北狩「二帝北狩」，每一下硬切加闪白
- voiceover: "金兵南下！太原被围！汴京城破！二帝北狩！"
- duration: 6.3s
- transition_in: cut
- status: animated
- src: compositions/frames/03-fall.html
- type: pain_point
- persuasion: Pain agitation
- beat: overwhelm
- blueprint: kinetic-type-beats (Adapt)
- asset_candidates: assets/t_jin_charge.jpg — 金国重骑踏冰冲锋，冰屑飞溅，远处城镇起火; assets/t_taiyuan.jpg — 雪夜太原城头，宋军掷火罐、弩射，攻城楼车; assets/t_fall.jpg — 宫门火海，残破宋旗燃烧坠落，金骑穿烟而过; assets/ending.e_jingkang.webp — 雪原上金骑押送二帝北去
- focal: assets/t_jin_charge.jpg
- roles: t_jin_charge = background · t_taiyuan = background · t_fall = background · ending.e_jingkang = background (final, desaturated)
- sfx: impact-heavy @0.25s · taiko-hit @1.9s · taiko-hit @3.43s · war-drum @5.0s

Adapt: four slams, four paintings, one hard cut per phrase.
Scene 1 (0.0–1.89s): on 「金兵南下」 (0.30s) hard cut + 2-frame snow flash to t_jin_charge; fast push 1.0→1.15 (the cavalry rushes at the lens); slam 「金兵南下」 (Ma Shan Zheng 220px, cinnabar, ink glow) lower-left, −3° tilt; snow overlay. (0.0–0.30s: ink.)
Scene 2 (1.89–3.43s): on 「太原被围」 (1.90s) hard cut + flash to t_taiyuan, push with lateral drift right; slam 「太原被围」 upper-right, +2°; embers rising.
Scene 3 (3.43–5.04s): on 「汴京城破」 (3.43s) hard cut + ember flash to t_fall, slow push into the burning gate; slam 「汴京城破」 center, larger (280px), splatter burst.
Scene 4 (5.04–6.3s): on 「二帝北狩」 (5.04s) hard cut to ending.e_jingkang fully desaturated (grey, cold), slow pull 1.08→1.0; slam 「二帝北狩」 in snow white (not red), smaller (180px), no flash — the blow lands quiet; from 5.9s fade the picture to ink by 6.3s (the music drops out here).

## Frame 4 — 你是宋徽宗

- scene: 烛光里的徽宗缓缓抬眼；「这一次——」；鼓点爆发：黑边弹开、闪白、镜头猛推到他的眼睛，毛笔大字「你」+ 朱砂「是宋徽宗」
- voiceover: "这一次——你，是宋徽宗。"
- duration: 3.5s
- transition_in: cut
- status: animated
- src: compositions/frames/04-emperor.html
- type: product_intro
- persuasion: Identity / future pacing
- beat: ignition
- blueprint: titlecard-reveal (Adapt)
- asset_candidates: assets/t_emperor.jpg — 徽宗烛下执笔，身后窗外汴京起火，抬眼回望
- focal: assets/t_emperor.jpg
- roles: t_emperor = background (full-bleed, the drop shot)
- sfx: impact-heavy @0.99s

Adapt: a single restrained move, then one explosive reveal on the drop.
Scene 1 (0.0–0.99s): t_emperor very dark (brightness 0.35), slow push toward his face; on 「这一次」 (0.20s) a small script line 「这一次——」 (Zhi Mang Xing 76px, gold) writes on at the upper-left.
Scene 2 (0.99–1.48s): THE DROP on 「你」 (0.99s): 2-frame snow flash; the letterbox bars snap open (to 0 height) for 6 frames then close; brightness snaps to 1.0; hard camera punch-in toward his eyes (scale +0.18 in 0.15s, power4); 「你」 slams in Ma Shan Zheng ~360px snow white at the left third, ink glow; camera kick.
Scene 3 (1.48–3.5s): on 「是宋徽宗」 (1.48s) 「是宋徽宗」 slams beside it in cinnabar (200px), with a splatter burst; embers rise across the frame; hold with a slow continuing push (no wobble).

## Frame 5 — 召对廷议

- scene: 廷议对峙的画作做底；两张实机「情报卡」甩入：召对童贯（Claude 扮演的回话）→ 廷议三人「可 / 可 / 中」
- voiceover: "召对群臣，廷议和战。"
- duration: 3s
- transition_in: cut
- status: animated
- src: compositions/frames/05-court.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: momentum
- blueprint: device-surface-showcase (Adapt)
- asset_candidates: assets/t_court.jpg — 烛光殿上两位紫袍重臣当面对峙，徽宗端坐; assets/07-audience.png — 实机：召对童贯，Claude 扮演的回话; assets/09-debate.png — 实机：廷议王黼、童贯「可」，蔡京「中」，计票
- focal: assets/07-audience.png
- roles: t_court = background (darkened 55%, drifting) · 07-audience = supporting (intel card) · 09-debate = supporting (intel card)
- sfx: whoosh @0.0s

Adapt: one hero surface advancing through two real screens, as whipped intel cards.
Scene 1 (0.0–1.30s): t_court full-bleed, darkened, slow drift; on 「召对群臣」 (0.15s) the 07-audience screenshot whips in from the right as an intel card (gold hairline, rotateY −8°, ~62% width, left of center) with `zoom-to-target` onto 童贯's portrait + reply; tag 「召对 · 大模型扮演」; slam-sm 「召对群臣」 (Ma Shan Zheng 132px, snow) at the right.
Scene 2 (1.30–3.0s): on 「廷议和战」 (1.30s) whip: the audience card exits left, the 09-debate card whips in from the right, zoomed onto the three portraits with their 「可 / 可 / 中」 seals; tag 「廷议」; slam-sm 「廷议和战」 replaces the first slam. Hold.

## Frame 6 — 诏书兵马

- scene: 门下诏书情报卡「一纸诏书」→ 硬切西军白马铁骑冲锋「调西军北上」→ 实机舆图上火线向北「千里之外」→ 回执「驿程遥远·令达于下季」
- voiceover: "一纸诏书，调西军北上；千里之外，军令要走好几季。"
- duration: 5.95s
- transition_in: cut
- status: animated
- src: compositions/frames/06-command.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation
- beat: momentum
- blueprint: compose
- asset_candidates: assets/12-edict.png — 实机：门下诏书; assets/t_xijun.jpg — 西军白马老将率铁骑黎明北上，尘土金光; assets/05-map-zoom.png — 实机：舆图放大到燕京、河北; assets/13-receipt.png — 实机：有司回执（缓 · 驿程遥远，令达于下季）
- focal: assets/t_xijun.jpg
- roles: 12-edict = supporting (intel card) · t_xijun = background (full-bleed charge) · 05-map-zoom = background (real map) · 13-receipt = supporting (intel card)
- sfx: whoosh @1.2s

Compose: a four-beat relay, alternating real UI and painting.
Scene 1 (0.0–1.23s): ink + faint t_court; on 「一纸诏书」 (0.15s) the 12-edict screenshot whips in as an intel card (zoom onto the edict list), tag 「拟诏」; slam-sm 「一纸诏书」.
Scene 2 (1.23–2.50s): on 「调西军北上」 (1.23s) hard cut + flash to t_xijun full-bleed, fast push toward the white horse; slam 「调西军北上」 (Ma Shan Zheng 200px, snow) across the top; dust/embers.
Scene 3 (2.50–3.45s): on 「千里之外」 (2.50s) hard cut to the real map 05-map-zoom full-bleed (slight push), an ember dashed route self-draws from the bottom edge north toward 燕京 (`svg-path-draw`); script-sm 「千里之外」 at the upper-left.
Scene 4 (3.45–5.95s): on 「军令要走好几季」 (3.45s) the 13-receipt card whips in on the right, `zoom-to-target` onto its 「缓」 clause with the red line 「驿程遥远（令达于下季）」 (around y 700–830 in the screenshot); a cinnabar slam-sm 「令达于下季」 stamps beside it (−4°). Hold.

## Frame 7 — 死守汴京

- scene: 「联金？存辽？」两字对砸 →「议和」→「还是——」全黑静默 → 爆点：李纲城头举剑「死守汴京」→ 无旁白战斗蒙太奇（太原火战、金骑冲锋、实机战局图染红、西军冲锋、李纲特写）
- voiceover: "联金，还是存辽？议和，还是——死守汴京！"
- duration: 11.65s
- transition_in: cut
- status: animated
- src: compositions/frames/07-defend.html
- type: climax
- persuasion: Choice / agency
- beat: climax
- blueprint: kinetic-type-beats (Adapt)
- asset_candidates: assets/t_court.jpg — 殿上对峙; assets/t_ligang.jpg — 李纲披甲立于雪中城头举剑，守军呐喊，城下金营连绵，日出; assets/t_taiyuan.jpg — 太原城头火战; assets/t_jin_charge.jpg — 金骑踏冰冲锋; assets/24-war-desk-3.png — 实机：战局舆图，河东、京西大片染红（约 x 672–920, y 265–645），危机计「铁骑」; assets/t_xijun.jpg — 西军铁骑冲锋
- focal: assets/t_ligang.jpg
- roles: t_court = background · t_ligang = background (the drop + final) · t_taiyuan = background · t_jin_charge = background · 24-war-desk-3 = supporting (intel card) · t_xijun = background
- sfx: riser @0.5s · impact-heavy @3.8s · war-drum @4.9s

Adapt: choices slam in pairs, silence, then the biggest slam of the film and a drum-cut montage.
Scene 1 (0.0–2.44s): ink ground split by a thin vertical ember line; on 「联金」 (0.10s) 「联金」 slams left (Ma Shan Zheng 180px, gold); on 「还是存辽」 (0.98s) 「存辽」 slams right (snow) with a 「？」; the faint t_court painting (opacity 0.3) behind.
Scene 2 (2.44–3.14s): on 「议和」 (2.44s) both words are knocked out; t_court full and dark; 「议和」 slams center (snow, 160px).
Scene 3 (3.14–3.80s): on 「还是」 (3.14s) HARD CUT TO BLACK — nothing but a small script 「还是——」 (Zhi Mang Xing, gold 76px) center; total stillness (the music breaks here).
Scene 4 (3.80–5.0s): THE DROP on 「死守汴京」 (3.80s): 2-frame snow flash; bars snap open for 6 frames; t_ligang full-bleed with a hard camera punch (1.0→1.14 in 0.2s, power4) toward Li Gang's raised sword; 「死守汴京」 slams across the center in cinnabar Ma Shan Zheng ~300px with the biggest splatter burst of the film and a 3-frame kick; snow + embers.
Scene 5 (5.0–11.65s): no voice — a drum-cut montage, one shot per ~1.1s, each a hard cut with a 2-frame flash and a fast push or whip: 5.0 t_taiyuan (push right) → 6.1 t_jin_charge (push in) → 7.2 the 24-war-desk-3 intel card whipped over ink, `zoom-to-target` on the red occupied mass and the crisis dial (tag 「战局 · 实机」) → 8.3 t_xijun (push) → 9.4 t_ligang again, tight crop on him (push in slowly; the 「死守汴京」 slam returns small, snow, at the lower-left) → 10.9–11.65 snap to black. Snow/embers over the paintings throughout.

## Frame 8 — AI 演群臣，引擎算钱粮

- scene: 墨底火星；「满朝文武」砸下，三张大臣卡与童贯回话卡展开（大模型扮演）；「钱粮兵马」砸下，实机度支对账卡逐行打勾「由引擎结算」
- voiceover: "满朝文武，由 AI 来演；钱粮兵马，由引擎结算。"
- duration: 6.5s
- transition_in: cut
- status: animated
- src: compositions/frames/08-engine.html
- type: benefit_highlight
- persuasion: Feature-to-benefit translation
- beat: reveal
- blueprint: video-text-pivot (Adapt)
- asset_candidates: assets/09-debate.png — 实机：廷议三位大臣画像与发言（三张发言卡约 y 540–760，x 248–708 / 730–1190 / 1212–1672，画像在 y 278–525）; assets/07-audience.png — 实机：童贯回话; assets/15-result-ledger.png — 实机：推演结果卷，度支·本季增减（右侧约 x 1400–1760）
- focal: assets/15-result-ledger.png
- roles: 09-debate = supporting (cropped portrait+speech cards) · 07-audience = supporting · 15-result-ledger = supporting (intel card, final)
- sfx: shimmer @0.3s

Adapt: surface yields → statement takes the center → sealed by proof.
Scene 1 (0.0–2.55s): ink ground, rising embers; on 「满朝文武」 (0.50s) slam-sm 「满朝文武」 (snow) top-left; on 「由 AI 来演」 (1.54s) three portrait+speech cards cropped from 09-debate fan in from below (staggered 0.1s, slight tilts) with the 07-audience reply card behind them; a gold label 「每位大臣由大模型扮演 · Claude / Codex」.
Scene 2 (2.55–6.5s): on 「钱粮兵马」 (2.55s) the cards whip away; slam-sm 「钱粮兵马」; on 「由引擎结算」 (3.49s) the 15-result-ledger card whips in, `zoom-to-target` onto its 度支 column; four 期初→期末 rows get gold ticks in sequence (3.6–4.6s); label 「每一文钱由引擎结算」. Hold with micro push.

## Frame 9 — 宣和

- scene: 墨迹晕开，「宣和」墨块标志砸下落版，停约两秒后淡出到黑（卖点、口号与网址写在视频简介里，不进片）
- voiceover: "《宣和》。"
- duration: 3s
- transition_in: cut
- status: animated
- src: compositions/frames/09-title.html
- type: cta
- persuasion: Identity
- beat: resolve
- blueprint: logo-assemble-lockup (Adapt)
- asset_candidates: assets/01-title.png — 标题画面（左上墨块「宣和」标志，约 x 100–480, y 80–640）; assets/t_glory.jpg — 汴京上元夜（做虚化底）
- focal: assets/01-title.png
- roles: 01-title = supporting (the ink-blot 「宣和」 logo crop = the mark) · t_glory = background (blurred, dark)
- sfx: none

Adapt: the mark assembles and holds, then the film ends.
Scene 1 (0.0–1.6s): ink ground; ink blooms from the center and on 「宣和」 (0.50s) the cropped ink-blot 「宣和」 logo lands center with a slam (scale 1.3→1, one white impact frame, ember ring), behind it t_glory blurred at 35% brightness.
Scene 2 (1.6–3.0s): the logo holds centered with embers drifting and the camera still pushing; fade to black 2.5–3.0s.
