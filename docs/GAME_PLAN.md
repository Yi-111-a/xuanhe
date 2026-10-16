# 《宣和》开发计划

> 宣和二年（1120）春，宋徽宗赵佶临御第二十年。辽已残破，女真新兴；东南花石纲之扰正烈。**繁华只剩最后六年。你能避免靖康之耻吗？**
>
> 引擎：[llm-sim-game-template](https://github.com/Yi-111-a/llm-sim-game-template)（`engine/` 子模块）。参考实现：[《天宝》](https://github.com/Yi-111-a/tianbao)。
> 设计大纲：[XUANHE_OUTLINE.md](XUANHE_OUTLINE.md)；史实核对：[FACT_CHECK.md](FACT_CHECK.md)；读书笔记：[READING_NOTES.md](READING_NOTES.md)；迭代日志：[ITERATION_LOG.md](ITERATION_LOG.md)。
> 本计划由我（Claude）自行定稿，所有取舍的理由写在大纲与迭代日志里。

## 0. 定位

- **一句话**：北宋宣和书案上的帝王模拟。玩家是宋徽宗；群臣由模型扮演，钱粮兵马、人心向背、金人南侵之势由确定性引擎结算，每条诏令都有执行回执。
- **与《天宝》的区别**：
  1. 危机来自**外部**（金人南侵之势「胡马南牧」），而不是一个权臣；改命手段分散在外交、内政、朝局、军务四条线，没有单一的「夺镇」开关。
  2. **辽是一块会融化的屏障**：可见数值「辽祚」逐季消退；联金灭辽、坐观、联辽抗金三条外交路线决定屏障消退的快慢与金人对宋的轻视。
  3. 东南有一条独立的速败线（花石纲 → 方腊）；朝内有「佞幸用事」与储位之争。
  4. 美术：北宋院体工笔与青绿山水（《千里江山图》《清明上河图》的设色与构图），与《天宝》的敦煌矿物色调区分。

## 1. 阶段、产出与验收

| 阶段 | 产出 | 验收方式 |
|---|---|---|
| 0 读书 | `docs/READING_NOTES.md` | — |
| 1 调研与设计 | `GAME_PLAN.md`（本文）、`XUANHE_OUTLINE.md`、`FACT_CHECK.md` | 大纲覆盖：切入点与时限、玩家、危机计与隐藏数值、四条主线及改命手段、≥ 16 位宋臣 + 外方人物、约 20 个地区与驿程、12–18 个结局（含【达成条件】）、三档难度；史实逐条有出处或标「本游戏设定」 |
| 2 剧本 | `scenarios/xuanhe_1120/` 全部 YAML（目标约 150 事件、180 奏疏、25+ 政令卡）、`tools/content_lint.py` | `sim validate`、`engine/scripts/content_lint.py --strict`、游戏 lint 全过；`--coverage` 每季 ≥ 3 条奏疏 |
| 3 美术 | `design/asset_prompts/`（风格块 + 每图提示词 + QA.md）、`design/asset_src/`（原图，不入库）、`scenarios/xuanhe_1120/assets/`（webp） | 每张亲自看过并在 QA.md 记录；无文字、无占位；`sim validate` 资产槽位齐全 |
| 4 前端与桌面 | `app/`（宣和主题）、`desktop/`（Tauri + PyInstaller 引擎）、`integrations/` | 类型检查、Playwright E2E（按钮全覆盖 + 开局到结局）、字体覆盖检查、安装包冒烟 |
| 5 试玩迭代 ×5+ | `playtests/`（GPT、Claude、自玩、界面截图）、`docs/ITERATION_LOG.md` | 每轮四种试玩 + 300 种子平衡；每个修复配测试或 lint 规则 |
| 6 发布 | GitHub 公开仓库 `Yi-111-a/xuanhe`、Release（英文附件名）、README（封面、截图墙、下载、玩法） | 重新下载核对 SHA-256；打包程序里实测「Claude（本机）」当大臣 |

## 2. 验收门槛（G1–G10，全部达标才算完成）

| 门槛 | 内容 | 证据位置 |
|---|---|---|
| G1 按钮全能用 | E2E 覆盖每个面板每个按钮；「用界面从开局打到结局」通过 | `tests/e2e/`、`npm run test:e2e(:real)` |
| G2 机制正确 | 引擎 pytest、ruff、mypy、`sim validate`、通用与游戏 content_lint 全过 | `scripts/verify.sh`（pipefail） |
| G3 接口正常 | REST 与 MCP 每个工具有测试；MCP 冷启动约 1 秒；Codex 与 Claude Code 都能挂上 | 引擎测试 + `scripts/mcp_selftest.py` |
| G4 无乱码 | 界面、日志、MCP 输出、存档全 UTF-8；专门的乱码检查测试 | `tests/e2e/garble.spec.ts` + `tests/test_garble.py` |
| G5 GPT 能玩 | 连续三局 GPT 开局到结局、工具零报错、无机制错误 | `playtests/codex/gpt-*/` |
| G6 Claude 能玩 | Claude 至少两局同上 | `playtests/claude/claude-*/` |
| G7 我自己能玩 | 经 MCP 打完两局（一局好结局、一局放任到靖康） | `playtests/self/` |
| G8 平衡 | 稳健打法好结局 70–80%；不作为约 85–90% 走向靖康；乱打拿不到好结局；300 种子以上 | `playtests/balance/` |
| G9 好看 | 主要画面截图集亲自审过 | `playtests/screens/` |
| G10 能发布 | 安装包冒烟全过；打包程序里「Claude（本机）」能当大臣；README 完整；Release SHA-256 复核 | Release 页、`playtests/release/` |

## 3. 关键取舍（理由）

- **开局宣和二年春（1120）**：海上之盟正在议定（赵良嗣当年使金）、方腊尚未起事（当年十月），四条主线都还没有定局，玩家有足够的回旋余地。宣和元年开局则海上之盟已过半、马政已渡海；宣和三年开局则方腊已起、盟约已定。
- **常规时限 24 季（至宣和七年冬）+ 金兵南下后加时 4 季（至「宣和八年」冬）**：史载金兵宣和七年十月分两路南下、十二月徽宗内禅、次年正月围汴京。加时让「却敌 / 城下之盟 / 划河而守 / 靖康之变 / 南渡」都有时间打出来。玩家是徽宗，不内禅就不会改元靖康，所以加时的一年记作「宣和八年」——历史上它本该是靖康元年，结局文字点明这一点。
- **危机计隐藏（窄区间）**：与《天宝》同理——其漂移含隐藏的「金人轻宋」，若总值公开，玩家可以用增量反推隐藏值。
- **不做「太子监国」第二剧本**（可选项）：先把主剧本做精；结局「内禅东宫」作为接口留给以后。
- **模板回写**：军队素质可调（`adjust_army.quality_delta`）、统帅才干影响战力（`settings.battle.commander_factor`），二者都是场景无关的通用机制。

## 4. 风险与应对

| 风险 | 应对 |
|---|---|
| 内容量大（≈150 事件、180 奏疏） | 我写骨架与第一、二幕，后几幕按大纲交给子代理分批写，每批由我逐条审读并跑 validate / lint / 模拟后再合入 |
| 战争局失控（金军必胜或必败） | 用 `simulate.py --trace` 看战报；平衡策略里加「却敌」「割地」「南渡」探针 |
| Codex 生图额度 / 速度 | 3 路并行、清单驱动；不合格的重画；失败的记下来，不用占位图冒充 |
| 外部服务不可用 | 记入迭代日志，绕开做完其余部分，最终报告如实说明 |
