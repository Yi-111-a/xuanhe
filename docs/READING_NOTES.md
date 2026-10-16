# 读书笔记：模板能表达什么、《天宝》怎样落地、哪些坑要避开

> 开工前读完模板（engine/，llm-sim-game-template v0.3.0+，提交 3010267）与《天宝》（Yi-111-a/tianbao，十轮迭代后的 main）写下的一页笔记。

## 一、模板能表达什么

引擎是唯一事实来源：`WorldState` 只由确定性规则改变，随机全部来自种子 RNG；LLM（或 MCP 客户端模型）只提议 `StateOp`，规则层逐条校验后才执行；叙事只复述已执行的事实（StateDigest）。剧本是纯数据包。

| 机制 | 剧本里怎么写 | 我在《宣和》里怎么用 |
|---|---|---|
| 资源 / 隐藏资源 | `resources`（`hidden: true` + `estimate_width` 只给「约 a–b（风闻）」，情报旗标 `intel:<id>` 减半一次） | 隐藏「金人轻宋」；危机计「胡马南牧」本身也隐藏（窄区间），免得玩家用增量反推 |
| 危机计 | `crisis.terms` 与 `formulas.drift.<危机资源>` 一一对应 | 金势日张、金人轻宋、武备、佞幸误国、君威、辽为屏障、朝野戒备 |
| 地区指标与收入 | `stats` + `formulas.income`（`controlled_only`）+ `upkeep`（按兵额） | 繁荣 / 治安 / 防务 / 税基 / 粮产；陷敌地区不再输税 |
| 账目 | `ledger` 与 `add_ledger`（recurring、不可撤销） | 岁币（辽→金）、燕京代税钱、应奉局、宫廷用度 |
| 奏疏 | `memorials.yaml`：谏言人（`requires`）、所议之案 `proposal`、谏言 `option`、变体 `variant_of`、远地驿程 | 每季 3 条以上，剧情主线 |
| 事件与抉择 | `events.yaml`：scheduled / conditional / random / system，`choices` + `default_choice` | 史事节点（海上之盟、方腊、白沟、张觉、阿骨打卒、天祚被擒、金兵南下……） |
| 结局 | `endings` 按 priority 判定，`game_length`（时限 + 加时旗标 + fallback） | 24 季常规 + 金兵南下后加时 4 季 |
| 难度 | `difficulties`：drift_scale / gravity_scale / start / delay_scale | 演义 / 史实 / 地狱 |
| 战争 | `wars` + 关系 < 0 即敌对；`ai_routes`（可限定军队）；战斗 = 兵 × 素质 × 城防 × 军令 × 天时 | 金东西两路（宗望、宗翰）分走两条路线；方腊沿江南下 |
| 朝廷 | 官职（兼统军队、任所）、`dispatch` 赴任、朝会日程上限、廷议在场、召对三种方式 | 京城汴京；李纲在沙县、种师道在泾原、宗泽在登州都只能「驰表」 |
| 驿程 | `courier_days` + `settings.courier.late_threshold_days` | 燕山、川峡、闽广奏报晚一季 |
| 将领自主 | `settings.autonomy`（特质算拒命 / 擅动） | 郭药师、童贯、刘延庆式的将领有风险；种师道几乎不擅动 |
| 政令卡 | `policy_cards.yaml`（参数 filter、冷却、只用玩家层 op） | 25 张以上，钱粮类一律 `start_project` 防刷 |
| 引导 | `tutorial`（target = 前端 data-testid） | 前三季 |
| 工具 | `sim validate`、`scripts/content_lint.py`（E1–E6、W1–W14）、`scripts/simulate.py`、`scripts/agent_play.py`、MCP | 全部照用，另写游戏自己的 lint 与命名策略模拟 |

**模板缺的、本作会用到的（计划回写模板，带测试）**：
1. 军队素质不能由 op 调整（`adjust_army` 只改兵额）→ 「整训禁军」「括虚额」只能加兵不能提素质。计划给 `adjust_army` 加 `quality_delta`。
2. 统帅才干不影响战力（战力公式里没有将）→ 种师道与刘延庆统同一支军毫无差别。计划加 `settings.battle.commander_factor`（公式，变量为统帅特质；统帅不在军时为 1）。
3. 其余在做的过程中按需补充，记入 ITERATION_LOG。

## 二、《天宝》怎样把一个时代落到这些机制上

- **一个隐藏的「祸首数值」 + 一个隐藏的危机计**：「禄山异志」只给风闻区间，「渔阳鼙鼓」由七个分项合成；分项只算超出部分并封顶，免得一味示好把危机「存」成负数。
- **一条可走通的「改命路线」**：「禄山兵柄」把「召其入朝 → 留京解镇 → 新帅到镇 → 安抚三策」变成一个可见数值，危机计按兵柄折算——改命不靠运气，而靠一串前后相扣的决策，每一步都有代价（草率夺镇会兵变）。
- **奏疏是主线、事件是后果**：每条史事先以奏疏让玩家决定，事件读 `memorial:<id>` 在其后结算；固定回合的史事奏疏都有「局势已变」的变体（人被夺职、出京）。
- **结局按条件写正文**：同一标题按状态分两段（朝争高 / 低），末尾【达成条件】；结局 12 个以上，含失败、反事实、开放结局。
- **平衡有数据**：命名策略（do_nothing / historical / wise / half_wise / 各结局探针 / first / last / chaos）在 300 种子上跑；稳健打法好结局约 75%，不作为约 88% 走向历史结局。
- **前端是门面**：御案主界面（舆图 + 势力绸带 + 危机计）、奏疏册、召对、廷议、拟诏（政令卡）、兵部、结算卷轴、结局页；美术全由 Codex 生成、不带文字，所有文字由 DOM 渲染；字体子集化并在构建时检查覆盖。

## 三、一定要避开的坑（《天宝》十轮的教训，逐条落实到本作）

1. 玩家可见文字不出现原始 id 与回合代号（W13、E2）；给模型看的选项 id 与给玩家看的文字分开（前端议题行去编号）。
2. 每一句状态断言都要守卫：「某官某人」→ `office_holder`；「某人在京」→ `character_region` / 谏言 `requires.region`；远地大臣写「驰表」。
3. 奏疏先于它决定的事件；同季可能同现的事件靠守卫去矛盾，不挪顺序（挪顺序会悄悄改变平衡）。
4. 兵额改动 ≥ 2000 写出数目；分兵用 `detach`。
5. 每道奏疏写全「所议之案」与谏言主张，否则廷议「诸案并陈」。
6. 机制不透明就会被报成 bug：延期原因、危机突跳、情报精度都要让引擎说出来（引擎已有拆分；剧本里的事件冲击写清 reason）。
7. 「最差选择也能拿好结局」→ 用 `--policy last` 与 chaos 探针查。
8. 平叛 / 危机解除后要有善后阶段，否则十几季无事可做。
9. 失败结局要有预警（档位、提前一季的奏疏或事件）。
10. 固定开支写进 `ledger`（T0 结算就计入）。
11. Windows：Python 写文件显式 UTF-8 + `newline="\n"`；检查脚本 `set -o pipefail`，不把测试输出接 `tail` 再判断成败；Codex 用 node 直调、提示词走 stdin、JSON 流可能是 cp936；MCP 配 `startup_timeout_sec`、`default_tools_approval_mode="approve"`；MCP 服务端 `PYTHONUTF8=1`、`SIM_MCP_MODE=client`。
12. 截图前等引擎就绪、插图加载完；前端改完先类型检查和 E2E，再用真实后端点一遍；新功能在打包后的程序里再测一次。
13. 发版：版本号改全（tauri.conf.json、Cargo.toml、两个 package.json 及锁文件），从已提交快照打包、标签打在那个提交上；附件英文名；未签名安装包写清 SmartScreen 放行。
