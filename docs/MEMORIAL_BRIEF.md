# 奏疏写作任务书（给分批写作的子代理）

> 本文是写 `scenarios/xuanhe_1120/memorials.yaml` 后续批次的唯一任务书。写之前**必须**读完：
> 1. `docs/XUANHE_OUTLINE.md`（设计大纲：资源 id、旗标登记、人物、地区、结局、分幕节拍）
> 2. `docs/FACT_CHECK_RESEARCH.md`（史实核对：官职、时间以此为准）
> 3. `scenarios/xuanhe_1120/scenario.yaml`、`characters.yaml`、`regions.yaml`、`armies.yaml`、`events.yaml`（**事件已写好**，奏疏要与之咬合）
> 4. `scenarios/xuanhe_1120/memorials.yaml` 现有的 T0–T5 条目——**照它的格式、口吻、粒度写**
> 5. `engine/docs/SCENARIO_GUIDE.md` 第 6–9、15 节（条件 DSL、op、事件与奏疏、内容检查）
> 6. 参考成品：`../tianbao/scenarios/tianbao_751/memorials.yaml`（同一引擎上写满的剧本，看写法，不要抄内容）

## 一、格式与硬性规则

- 一条奏疏：`id, turn?/expires_after? 或 conditions, title, summary, region, illustration, proposal, keywords, advisors, options`；变体加 `variant_of`。
- **id 前缀用季序**：`t8_beifa`、`t9_...`；常设条目用 `s_` 前缀。
- **可见性**：史事固定季的用 `turn`（+ `expires_after`）；由局势触发的用 `conditions`（不写 turn）。远地（川峡、闽广）奏疏的回合写在 `turn` 上，不要只写在 conditions 里（W10）。
- **选项没有 conditions**：选项里的每个 op 在奏疏可见的任何局势下都必须合法（appoint 的官职须空缺、人须在世且不在途；dismiss 的人须正任此职；cancel_ledger 的账目须存在；march 的军队须存在且兵额 > 0）。不合法的用**变体**拆开，变体之间用条件互斥（E4）。
- **每个状态断言都要守卫**：文字里说「某官某人」→ `office_holder`；「某人在京 / 当面」→ 谏言 `requires: {region: bianjing}` 或条件 `character_region`；出守在外者写「（自某地驰表）」并 `requires: {region: <其地>}`；已故、系狱、流放者自动不显示。
- **谏言**：每条写 `option`（他主张哪个选项）；奏疏写 `proposal`（所议之案）。3 位左右谏言人，派系、口吻要像其人（见 characters.yaml 的 speech_style 与例句）。
- **hint 与 ops 一致**：写清代价；隐藏数值（金人轻宋、胡马南牧）只写方向「（风闻）↑/↓」，不写数；兵额改动 ≥ 2000 写出数目（W14）；增兵写养兵负担（每万兵每季 3 万缗、1.2 万石）。
- **玩家可见文字不出现原始 id、snake_case、回合代号（T19）**，一律写显示名与历法（「宣和六年冬」）。
- 资源 id：`treasury grain authority morale corruption ningxing dongnan wubei liao_zuo jin_contempt nanmu`。只能用这些。
- `illustration` 只能用 `design/asset_prompts/jobs.py` 里已有的 `event.*` id：haishang huashi genyue cai_retire shangjing_falls fangla_rising nanzheng songjiang zhongjing_falls beifa baigou_defeat guo_surrender yanjing_taken yanjing_returned zhangjue aguda_death zhangjue_executed famine mianfu tianzuo_captured jin_envoy chen_dong jin_invasion taiyuan_siege bianjing_siege ligang_defense qinwang neishan nanxing qingming flood daoist_rite xixia tangluo jinjun_review goryeo_envoy liao_envoy military_drill court_debate。
- 军队调动：整军用 `march`；分出一部用 `detach`（新军 id 不可预知，之后不要再引用）；偏师归建用 `merge_army {army, into}`（模板新 op）；素质用 `adjust_army {army, quality_delta}`（模板新字段）；`add_ledger` 可带 `id`（同 id 替换）。
- 「若不处置，下季照例施行」的奏疏，事件里已有对应的 `*_default`（读 `memorial:<id>` absent），**id 必须一字不差**（见下）。
- 每写完一批就跑（在你自己的临时副本里，见第四节）：`sim validate`、`engine/scripts/content_lint.py --strict`、`tools/sim_policies.py --policy do_nothing --seeds 40`（确认没有把史实路线改坏）。

## 二、选项 id 词汇（平衡脚本靠它选策略，请尽量复用）

| 意图 | 推荐 id |
|---|---|
| 史实 / 佞幸主张 | `ally` `buy` `accept` `execute` `mianfu` `restore` `march` `favor` `wang` `cai` `hold` `stall` `tax` |
| 稳健 / 正人主张 | `fortify` `defend` `qinwang` `ligang` `zhong_lead` `refuse_jue` `keep_jue` `split` `relief` `thrift` `integrity` `punish` `dismiss` `train` `repel` `remit` `settle` `frank` `written` |
| 联辽 | `aid` `grain` `lianliao` |
| 议和 / 割地 | `cede` `peace` `gifts` |
| 南幸 | `south` |
| 内禅 | `neishan` |
| 维持现状 | `keep` `none` |

## 三、两批的范围

### 甲批：T6–T15（宣和三年秋 → 宣和五年冬）

每季 ≥ 3 条可批（与常设条目合计亦可，但史事条目要有）。必须包含（id 固定者加粗）：
- T6–T7：武备与河北择帅（可任 `hebei_xuanfu`：种师道 / 童贯）、西军东调、夹攻之备、东宫、财计、西夏边事、方腊未平时的续战与善后变体。
- **`t8_beifa`「伐燕之议」**（T8，条件 `haishang_ally` 且燕京在辽）：选项至少有：童贯宣抚出师（史实，同 `beifa_default` 的 ops）、种师道专制出师（统帅种师道，`zhong_lead`）、按兵观变（违约：金人轻宋↑）、与耶律淳和而存辽（`lianliao`）。出师的 ops 照 `events.yaml` 的 `beifa_default` 写（抽调兵额写数）；若南讨诸军（`nanzheng`）已移屯河北东路，另写一个变体把它并入伐燕诸军（`merge_army`）。summary 写明「若不处置，下季枢密院照前议出师」。
- 非盟金路线（`haishang_refused` / `haishang_loose` / `lian_liao`）的 T8 替代条目（辽使、燕人、边防）。
- T9–T10：白沟战后（`beifa_lost`）的「再举之议」**`t10_zaiju`**（再攻燕京 / 罢兵）、郭药师来降后的处置（厚待 / 分屯 `split` 设 `changsheng_split` / 疑而防之），伐燕得胜（`beifa_won`）后的燕京经略（设燕山府、以谁为宣抚使 `yanshan_xuanfu`、留戍多少）。
- 宣和四年：王黼谋动摇东宫（东宫线：斥王黼 / 默许 / 易储 `yichu`）。
- **`t12_shuyan`「赎燕之议」**（T12，金据燕京且 `haishang_ally`）：许（史实，同 `shuyan_default` 的 ops）/ 讨价（`written` 已定者价低）/ 拒（燕京在金，不付代税钱）。summary 写明「若不处置，下季照前议许之」。
- **`t13_zhangjue`「张觉来附」**（T13，`zhangjue_risen`）：纳（`accept`，同 `zhangjue_default`）/ 拒（`refuse_jue`）/ 阴纳之（介于其间）。
- **`t15_zhangjue_demand`「金索张觉」**（`pingzhou_crushed` 且 `flag_age ≥ 1`、张觉在世）：斩首与金（`execute`，同 `zhangjue_demand_default`）/ 拒不与（`keep_jue`：金人轻宋↓而胡马南牧↑）/ 纵之远去。
- 郭药师与常胜军（燕山）：厚饷安抚（忠诚 +）、分屯 `split`、以宿将监之。
- 每季的内政：吏治、财赋、灾异、东南、言路（李纲在京时的条目、陈东）。

### 乙批：T16–T27（宣和六年 → 宣和八年冬）+ 常设条目

- 宣和六年：山后诸州、**`t16_jin_grain`「金人求粮」**（`jin_grain_asked`：输 / 少输 / 不输，未批照例不输）、**`t17_mianfu`「免夫钱」**（`mianfu` 照 `mianfu_default`；或不行）、**`t18_zaixiang`**（王黼罢、蔡京复出的处置：照 `wangfu_falls_default`；或罢王黼而不起蔡京、以李纲 / 张叔夜为相等变体）、河北饥（`hebei_famine`）赈济、西夏附金、群盗。
- 「金人治兵」预警奏疏（条件 `jin_warning`，马扩 / 张孝纯 / 宗泽等觇报），以及设防选项：修汴京城（汴京防务 +）、修太原城（河东防务加到 ≥ 80 即为坚城）、西军东调关中、分常胜军、起用种师道 / 宗泽 / 张叔夜守河北、罢童贯。
- 陈东上书论佞幸（宣和七年，`chen_dong` 在京）：罢黜王黼 / 童贯 / 梁师成 / 朱勔 / 蔡京 / 李邦彦（各写变体，罢黜者须正任其职）。
- **金兵南下后**（`jin_invaded`）的战时奏疏——这些旗标是结局判定读的，名字不能改：
  - 李纲血书（宣和七年冬或南下当季）：`neishan` 内禅（设 `neishan`，即终局）/ 罪己诏亲征（君威、民心 +）/ `south` 南幸（设 `court_south`，`move_character zhao_ji` 赴江南）。李纲不在京时写成「侍从之臣交章」，不点李纲名。
  - 守城：`ligang` 以李纲为亲征行营使守京城（设 `ligang_defense`；汴京防务 +30、京师禁军素质 +0.15；李纲须在京且在世）；无李纲则以他人（宗泽 / 张叔夜，须在京）变体。
  - 勤王：`qinwang` 西军入援（`march` 泾原军 / 秦凤熙河军赴汴京；到京由事件 `qinwang_arrives` 设旗标）。
  - 城下之盟：金军兵临汴京（`bianjing_besieged`）时，`cede` 许割三镇（设 `sanzhen_ceded`、`jin_withdrawn`；`adjust_relation` 宋金各 +150；`move_army jin_west → yunzhong`、`jin_east → pingzhou`；国库大减、君威 −8）/ 坚守待援 / 遣使缓兵。许割之后再给「三镇交割」：交（设 `sanzhen_delivered`）/ 不交（金人再来，见 `jin_returns`）。
  - 劫营（姚平仲）：奏疏只设旗标 `jieying`，再写**两个事件**放进 `events.yaml` 草稿里交给我：成功（gravity 0.4，金东路军 −2 万，设 `jieying_done`）、失败（成功未发生时必发，泾原军 −1 万、姚平仲出奔）。
  - 救太原：`march` 秦凤熙河军赴河东（种师中）；太原陷后的处置。
  - 南幸后的东南经营、汴京留守人选。
  - 宣和八年各季都要有 ≥ 3 条（战事、粮饷、民心、京城治安、义兵）。
- **常设条目**（`s_` 前缀，全局约 25 条，带 `conditions` 与冷却式的旗标守卫，例如 `flag_age` 或「本条处置后若干季不再出」），覆盖：赈济（水旱蝗）、河防、漕运、边储和籴、吏治考课、太学言路、道教斋醮与宫观、艮岳、宗室、川峡钱引、闽广海舶、高丽使、西夏边事。目的：保证任何路线下每季都有 ≥ 3 条可批，且中后期不同质。

## 四、工作方式

1. 把 `scenarios/xuanhe_1120` 整个复制到你的临时目录（例：`C:\Users\yiyin\AppData\Local\Temp\claude\...\scratchpad\xh_<批次>\xuanhe_1120`），只在副本里改 `memorials.yaml`（追加你的批次）和（乙批）`events.yaml`（只追加劫营两个事件）。
2. 在副本上跑（工作目录 `C:\Users\yiyin\Desktop\新建文件夹\xuanhe`，Python 用 `.venv/Scripts/python`，加 `PYTHONIOENCODING=utf-8`）：
   - `.venv/Scripts/sim validate <副本路径>`（资产相关的错误忽略不了就看是否只是 illustration id 写错）
   - `.venv/Scripts/python engine/scripts/content_lint.py <副本路径> --strict`
   - `tools/sim_policies.py` 默认读正式目录；要测副本，复制一份脚本把 `PACK` 改成副本路径再跑 `--policy do_nothing --seeds 40` 与 `--policy wise --seeds 40`、`--coverage`。
3. 写完后，把**你新增的条目**单独存成一个文件交回：甲批 `docs/_drafts/memorials_act3_4.yaml`，乙批 `docs/_drafts/memorials_act5_7.yaml` 和 `docs/_drafts/events_act5_7.yaml`（UTF-8、LF；用 Write 工具，Python 写文件时显式 `encoding="utf-8", newline="\n"`）。**不要改正式目录里的任何文件**。
4. 最后汇报：条目数、每季可见条数的最小值、validate / lint / 模拟的结果（原样贴数字）、你拿不准的史实或机制、需要我补的事件或资产。不要粉饰：没跑通的就写没跑通。
