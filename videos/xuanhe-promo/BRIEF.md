---
workflow: product-launch-video
flow: automation
storyboard: no
message: "繁华只剩最后六年——满朝文武由 AI 来演，你来当宋徽宗，能不能避开靖康之耻？"
destination: bilibili / YouTube / GitHub README
aspect: 1920x1080
language: zh-CN
audience: 历史、策略游戏玩家；AI 圈
length: 60s
angle: 倒计时开场 → 两条路 → 你就是徽宗 → 实机玩法 → 一步走错即靖康 → AI 驱动 → 发问收尾
---

## Intent

《宣和》首发宣传片，一分钟。用户原话：「给我做一个宣传视频1分钟的」。同作者上一作《天宝》已有一支同类宣传片（`tianbao/videos/tianbao-promo`），叙事骨架、说书人口吻、黑漆 + 宣纸 + 朱砂的视觉语言沿用它，换成北宋：院体工笔、青绿山水、汝窑天青。

## Assets

- `capture/assets/*.png`、`capture/clips/*.webm` — 用 `tests/e2e/promo_capture.spec.ts` 对真引擎录下的实机画面（开局一季、金兵南下到靖康、好结局）；召对、廷议与纪事由「Claude（本机）」扮演。
- `../../scenarios/xuanhe_1120/assets/` — Codex 生成的标题画、事件插画、结局插画与人物立绘。

## Notes

- 用户一贯全权委托（「一口气做完不用问我」），按 autonomous 走：不问中间确认，只在渲染前问一次。
- 画面只用真实截图与剧本美术，不画假 UI，不出现英文界面字或内部 id。
- 中文字幕烧录在下方约 17% 的安全带内。
