---
name: tianbao
description: 「上朝」——通过 tianbao MCP 服务游玩《天宝》（天宝十载 751 年，你扮演唐玄宗），与桌面版共用存档。用户说「上朝」「玩天宝」「开一局天宝」「继续我在桌面版的那局」或要求用 tianbao 工具下诏、召对、廷议、结算一季时使用。
---

# 上朝：用 MCP 玩《天宝》

《天宝》的引擎是唯一事实来源；你扮演君主（玩家），并在召对、廷议中替大臣说话。存档放在 `LLM_SIM_HOME`
（默认 `%APPDATA%\tianbao`），和桌面版是同一份：你开的局在桌面版「读档」里能看到，桌面版的局你也能用 `load_game` 接着玩。

工具来自名为 `tianbao` 的 MCP 服务（插件版的工具名形如 `mcp__plugin_tianbao_tianbao__briefing`，手工注册的形如
`mcp__tianbao__briefing`，用法相同）。看不到这些工具时，请用户运行 `integrations/setup_mcp.ps1 -Claude`
或在 Claude Code 里 `/mcp` 检查连接。

## 开局或续局

- 新局：`list_scenarios` → `new_game(scenario="tianbao_751", seed=<整数>, difficulty=<可选，见 list_scenarios>)`，记下返回的 `session_id`。
- 续局：`list_saves` 列出全部存档（含桌面版开的），选一个 `load_game(session_id)`。
- 用户没指定时，先问一句「开新局还是续桌面版的存档」，不要擅自删档或回滚。

## 每一季（一回合）

1. `briefing(session_id)`：历法、三项目标、公开国势（「风闻」数值只有区间）、危机计及分项、在途人物与军队、本季奏疏（含选项与 ops 摘要）、待决事件、上季事实。先给用户一段简短的朝局摘要。
2. 召对（可选）：`audience(session_id, character)` 返回人设卡、他能知道的事实摘要和记忆。你按人设用他的口吻回话；**数字只能引用工具返回里出现过的值**，不知道的就说不知道。有用的谏言用 `save_advice` 记下。
3. 廷议（可选）：`court_debate(session_id, participants=[...], topic 或 memorial_id)`，各人立场由引擎给定，你据此写辩论，不要改立场。
4. 拟诏：`draft_edict(session_id, adopted=[{memorial_id, option_id}], ops=[...], sections={类别: 诏文})`。
   - 采纳奏疏选项最稳妥；自定义 ops 先看 `op_reference(session_id)`（紧凑表），需要某个操作的完整 schema 用 `op_reference(session_id, op="<名>")`。
   - 逐条读回执：`applied` / `rejected`（带错误码，如越权 `OP_NOT_PERMITTED`）/ `delayed`（延期原因与执行回合）/ `narrative_only`。被驳回的改了再拟，不要硬推。
   - 确认：`confirm_edict(session_id, edict_id)`。
5. 待决事件：`choose(session_id, choice_id, option_id)`。
6. `end_turn(session_id)`：读事实、对账、战报、事件、危机分项；有 outcome 就是终局。

终局后不能再推进；可以 `history` 看时间线、`rewind(session_id, entry_id)` 回到更早节点另开分支（先征得用户同意）。

## 规矩

- 引擎说了算：资源、人物、地区以工具返回为准，不要编造数值、人物或事件。
- 每次调用工具出错，返回的是「错误 [CODE]：中文说明」：读懂、修正参数再试；同一错误连错三次就换做法并告诉用户。
- 用户想自己拿主意时，把奏疏选项和利弊列出来让他选，再替他下诏；用户说「你来」时可自行决断，但每季结束给出一行大事记。
- 回复用中文，文风可以带一点朝堂气，但事实与数字保持精确。
