"""《天宝》剧本内容静态检查（scenarios/tianbao_751）。

用法（在 tianbao/ 下）：

    .venv/Scripts/python tools/content_lint.py            # 检查，发现问题时退出码 1
    .venv/Scripts/python tools/content_lint.py --pack <剧本目录>

检查项（与引擎 `sim validate` 互补：validate 管结构与引用，本工具管「文字与状态是否相符」）：

1. 人物引用：奏疏谏言人、选项 memory、各 op 的 character 字段都须是 characters.yaml 中的人物。
2. 题文相符：奏疏选项 label、事件选项 text 提到「任 / 另择 / 授」等任免字样，就须真有任免
   （appoint 或 set_army_commander），或以 `appoints_via: <事件 id>` 指向一个确有任免的后续抉择。
   明说不任命的写法（「不任命」「不另任」「专任将帅」「预定…继任」「授官加赏」「颁授 / 自授告身」）不算。
3. 史事有据：奏疏标题 / summary / 谏言、事件标题 / 正文提到具名史事（西洱河、怛罗斯、土护真水、霖雨……），
   其 conditions 须正向包含该史事的旗标（不在 not 之内）；定义该旗标的事件本身除外。
4. 情报上限：凡设置 intel:* 旗标的选项 / 事件，提示或正文须写明「只减半一次 / 不叠加」。
5. 易逝人物：在其可能亡故之后仍可见的奏疏若以其为谏言人，须带「此人在世」条件或谏言 `requires`。
6. 任职与所在（#38）：叙述性文字（奏疏标题 / summary / 谏言，事件标题 / 正文）断言「某官为某人」
   （如「河西节度使安思顺」「右相杨国忠」）或「某人在某地」（如「仙芝在京」「哥舒翰留京」「颜杲卿在范阳幕府」），
   须有相符的守卫：条件里正向的 office_holder / character_region（谏言可用 requires.office / requires.region），
   或该事件自身的 appoint / move_character，或固定于 T0（开局状态确定）。
   军队统帅无条件可验，故不得断言「禁军久无宿将」「军务无人主持」之类的统帅有无。
7. 分兵（round 6）：文字说「一部 / 分兵 / 偏师 / 半数」而选项（或事件）只有整军 move_army / march、没有 detach，
   即文字与操作不符（整军移动写「移屯 / 入屯」即可；兵员先有折损的「一部从乱、余众溃散」不算）。
8. 同题分支（round 6）：同一议题按局势写的几条奏疏（同标题，或以 `variant_of: <主条目>` 声明）须彼此互斥：
   每条的 conditions 写明「其余分支未处理」（`{not: {kind: flag, operator: exists, key: "memorial:<分支 id>"}}`），
   以免同季局势一变（如留京解镇）又冒出一条同类奏疏、重复领取收益。同标题者须以 variant_of 声明。
9. 自称在京（round 6）：谏言以第一人称说自己在京（「京师有臣」「臣在京」）须以 requires.region 或条件保证其人在京畿。
10. 末季部署（round 6）：最后一个决策季（game_length.last_turn − 1）的奏疏若选项都调动军队，须另有不调兵的「维持现状」选项；
    其调兵选项的提示须提到行程。
11. 养兵（round 6）：剧本启用 formulas.upkeep 时，凡给本方军队增兵（adjust_army delta > 0）的选项，提示须写明此后的「养兵」负担。
12. 首季账目（round 6）：T1 才设立的经常账目（add_ledger recurring）须同时补扣首季（同一资源、reason 含「首季」的 adjust_resource），
    否则 T0 的第一次结算会漏记这些固定支出。
13. 官缺断言（round 7）：文字（奏疏标题 / summary / 谏言 / 选项标题与提示，事件标题 / 正文 / 抉择）称「某官出缺 / 官缺 / 久缺 / 仍空」，
    须有正向的 office_holder 某官 = null 守卫（或该选项 / 事件自身 dismiss 该官，或固定于 T0 且开局即缺）。
14. 中枢口吻（round 7）：谏言以在京理事的口吻说话（「臣督办」「臣一手可理」「臣好收息」「京师有臣」……），
    须以 requires.region: jingji 保证其人在京（出镇在外者另写远方来奏的谏言）。
15. 养兵净额（round 7，扩充第 11 项）：按选项对本方军队兵额的净变化计——净增兵须写「养兵」负担，
    写明的「养兵每季 +X 万贯」须与净增兵相符（每万兵 formulas.upkeep 之数）；净额为零的调拨不得写养兵增加。
16. 到任之效（round 7）：任命边将并启程赴任（dispatch）的选项，不得在下诏时即给「得人 / 新帅」之类的边患收益，
    应设旗标、由「到镇」事件（character_region + army_commander）落实。
17. 结局文字（round 7）：结局正文称「朝堂议论渐平 / 不复相倾」须有 court_strife 上限条件，称「朝争犹存 / 倾轧犹烈」须有下限条件；
    称「旧部受代 / 渔阳之兵既归朝廷」须有 an_command 上限条件。
18. 乱局奏疏池（round 8）：带 `war_pool` 的奏疏按战局出现——同一题目至多两条、标题互异，不得按固定回合，
    须正向要求 rebellion_started 并排除 rebellion_quelled / hebei_ceded；第二条须要求第一条已处理且隔两季以上（flag_age ≥ 2）。
    常备三题 standing_pay / standing_reward / standing_post 例外：各三班轮值，每题每季最多一案、同条隔三季，
    须在条件与所有选项中落实冷却及轮值操作，不能仅声明 repeatable / cooldown。
19. 兵变宽限（round 8）：设 mutiny_rebellion 的事件须有留京 / 不许还帅之后的季数条件，an_detained、fanyang_restive 下限 ≥ 2，
    early_detain_alarm 下限 ≥ 1（夺镇当季与下一季不发，留一整季可行安抚之策）。
20. 再造唐室须有战功（round 8）：e3_* 结局须正向要求乱平、官军战功（counter war_merit）或范阳已不在叛军之手之一。
21. 善后之言须有其事（round 8）：乱平后的奏疏称乱中新募、加税、西兵东调、漕路被毁、州县陷贼等，须有记录其事的旗标。
22. 察使称谓（round 8）：察看范阳的回奏事件写「中使」须排除遣御史，写「御史」须限于遣御史（memorial:p_envoy）。
23. 政令卡（round 9，policy_cards.yaml）：id 不重复；category 为 军务 / 内政 / 人事 / 外交 / 财计；params 的 kind 合法；
    ops 只用玩家层操作（CONTRACT 1.3.1 白名单，另加 set_army_posture）；ops 中的 {参数} 都有定义、每个参数都被用到；
    start_project 的 on_complete 只能加本工程地区的 adjust_region（0 < delta ≤ 10，且增益合计 × 10 ≤ 总花费）；
    cost_hint 不能空；cooldown 为正整数。
24. 驿程（round 9）：每个地区都有正整数 courier_days；驿程超过 settings.courier.late_threshold_days 的地区，
    其奏疏摘要须写明晚到（「乃至 / 奏到 / 奏至 / 乃达」之类），且回合写在条目 turn 上、conditions 不含 turn（奏到时条件须仍成立）。
25. 新手引导（round 9）：tutorial 每步有 turn / step / title / text / target；target 形如「画面.元素」（末段可为 *）；
    同一季 step 从 1 连续编号；target 指向具体奏疏（memorial.item.<id> / memorial.option.<id>.*）时，该奏疏须存在且在当季可见。
26. 将领自主（round 9）：settings.autonomy 的 formula 与 by_order 各式只用人物特质、is_<命令>、present、strength 与 min / max；
    by_order 只用引擎的命令类型（march / move / detach / hold / attack / scorch）。
27. 兵额写明（round 10，gpt-10 #11）：奏疏选项（及事件抉择）的 ops 使某军兵额变动 ≥ 2000（adjust_army 增减、detach 分出），
    提示（抉择则为选项文字）须写出这一数目（「5000」「五千」「0.5万」之类任一写法），不能只在引擎摘要里出现。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any, Iterator

import yaml

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "scenarios" / "tianbao_751"
STANDING_WAR_POOLS = frozenset({"standing_pay", "standing_reward", "standing_post"})

# ---- 规则表 ----
APPOINT_WORDS = re.compile(r"任|另择|另简|授|代镇|久镇")
# 明说不任命或并非官职任免的固定说法：先从标题里剔除，再判断
APPOINT_EXEMPT = re.compile(r"不任命|留任|不另任|不另任要员|专任将帅|预定\S{0,6}继任|授官加赏|颁授|自授|不改官职")
APPOINT_OPS = {"appoint", "set_army_commander"}

# 具名史事 → 可作依据的旗标（任一正向出现即可）。"yan_control" 表示条件里有「某地归叛军」。
WAR = ["rebellion_started", "rebellion_quelled", "mutiny_rebellion", "duji_lost", "tongguan_lost", "yan_control"]
NAMED_EVENTS: list[tuple[str, list[str]]] = [
    (r"西洱河", ["xier_defeat"]),
    (r"怛罗斯", ["talas_defeat"]),
    (r"土护真水|新经战阵|一败之后", ["an_weakened"]),
    (r"阿布思", ["abusi_gone"]),
    (r"霖雨", ["autumn_rains"]),
    (r"风疾", ["geshu_ill"]),
    (r"丧师", ["xier_defeat", "li_mi_defeat"]),
    (r"南诏.{0,3}寇|南诏与吐蕃合", ["xier_defeat", "nanzhao_tubo", "li_mi_defeat"]),
    (r"潼关已失|潼关失守|潼关不守", ["tongguan_lost", "yan_control"]),
    (r"东都失守|东都陷|入东都|顿兵陕郡", ["duji_lost", "yan_control"]),
    (r"范阳兵起|范阳兵已起|叛军|讨贼|贼势|乱后", WAR),
    (r"叛乱既平|乱既平|乱平", ["rebellion_quelled"]),
]
# ---- #38 任职 / 所在 / 统帅断言 ----
# 人物简称（叙事中常用）：除 characters.yaml 的全名外另行识别
CHAR_ALIASES = {
    "an_lushan": ["禄山"], "gao_xianzhi": ["仙芝"], "yang_guozhong": ["国忠"], "yan_zhenqing": ["真卿"],
    "yan_gaoqing": ["杲卿"], "an_sishun": ["思顺"], "feng_changqing": ["常清"], "guo_ziyi": ["子仪"],
    "li_guangbi": ["光弼"], "li_linfu": ["林甫"], "chen_xilie": ["希烈"], "shi_siming": ["思明"],
    "xianyu_zhongtong": ["仲通"], "geshu_han": ["哥舒"],
}
# 「某人在某地」的叙述（人物, 地区, 正则）
LOCATION_CLAIMS: list[tuple[str, str, str]] = [
    ("gao_xianzhi", "jingji", r"仙芝(久)?在京|仙芝在京宿卫|仙芝久在京师"),
    ("geshu_han", "jingji", r"哥舒翰[^。；]{0,6}留(京|居京师)"),
    ("geshu_han", "jingji", r"哥舒翰[^。；]{0,8}(同时)?入朝|哥舒翰[^。；]{0,8}同朝"),
    ("an_lushan", "jingji", r"禄山(就)?在(京|华清宫)|禄山奉召至京"),
    ("yan_gaoqing", "fanyang", r"杲卿[^。；]{0,3}在范阳幕府"),
    ("feng_changqing", "anxi", r"判官封常清|常清知留后"),
    ("yan_zhenqing", "hebei", r"平原太守(请|奏)"),
]
# 军队统帅无条件可验：不得断言统帅有无
COMMANDER_CLAIMS = re.compile(r"久无宿将|无宿将统领|军务无人主持|无人统领|军中无帅")
INTEL_CAP = re.compile(r"只减半一次|不叠加|不再收窄")
# 可能中途亡故的人物：{人物: 最早亡故回合}（李林甫病卒事件自 T7 起掷骰）
MORTAL_FROM = {"li_linfu": 7}
# ---- round 6 ----
PARTIAL_WORDS = re.compile(r"一部|分兵|偏师|半数|分其兵|分[^。；，]{0,4}兵[一二三四五六七八九十百千万\d]")
SELF_IN_CAPITAL = re.compile(r"京师有臣|臣在京|臣在朝中")
# ---- round 7 ----
VACANCY_WORDS = r"(?:出缺|官缺|久缺|暂缺|虚位|仍空)"
COURT_VOICE = re.compile(r"(?<![重大])臣督办|臣愿督办|臣一手可理|臣好收息|臣这里|京师有臣|臣在京|臣另有安排")
UPKEEP_CLAIM = re.compile(r"养兵每季 ?\+ ?([\d.]+) ?万贯")
ARRIVAL_REASONS = {"得人", "新帅", "新帅到镇", "易帅得人"}
ENDING_CLAIMS: list[tuple[str, str, str]] = [   # (正则, 资源, 须有的界限方向)
    (r"朝堂议论渐平|朝堂不复相倾|朝堂渐和", "court_strife", "upper"),
    (r"朝争犹存|朝争未息|倾轧犹烈|争执未息", "court_strife", "lower"),
    (r"旧部受代|渔阳之兵既归朝廷|兵柄尽归", "an_command", "upper"),
]
MOVE_OPS = {"move_army", "march", "detach"}
# ---- round 8 ----
POSTWAR_CLAIMS: list[tuple[str, list[str]]] = [   # 善后奏疏的说法 → 记录乱中确有其事的旗标
    (r"新募|所募|赦囚", ["jinjun_war_recruits"]),
    (r"所加诸税|税商|鬻官|铸大钱|榷盐", ["war_levies"]),
    (r"东调|边备空虚", ["west_called"]),
    (r"漕路.{0,6}(阻|毁)|堰闸", ["canal_was_cut"]),
    (r"陷贼|兵燹|受伪命|户口流散", ["hebei_lost", "duji_lost"]),
]


# ---- 读取 ----
def load(pack: Path) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for name in ("scenario", "characters", "events", "memorials", "regions", "policy_cards"):
        file = pack / f"{name}.yaml"
        data[name] = yaml.safe_load(file.read_text(encoding="utf-8")) if file.is_file() else []
    return data


# ---- 条件遍历 ----
def positive_evidence(cond: Any, negated: bool = False) -> set[str]:
    """条件里正向出现的旗标（flag / flag_age 的 key），以及 yan_control（某地归 yan）。"""
    found: set[str] = set()
    if isinstance(cond, list):
        for row in cond:
            found |= positive_evidence(row, negated)
        return found
    if not isinstance(cond, dict):
        return found
    for key in ("all", "any"):
        if key in cond:
            return positive_evidence(cond[key], negated)
    if "not" in cond:
        return positive_evidence(cond["not"], not negated)
    if negated:
        return found
    kind = cond.get("kind")
    if kind == "flag":
        if cond.get("operator") == "absent" or cond.get("value", True) in (False, None):
            return found
        found.add(str(cond.get("key")))
    elif kind == "flag_age":
        found.add(str(cond.get("key")))
    elif kind == "region_controller" and cond.get("faction") == "yan":
        found.add("yan_control")
    return found


def positive_kinds(cond: Any, kind: str, negated: bool = False) -> set[tuple[str, str]]:
    """条件里正向出现的 office_holder（(官职, 人物)）或 character_region（(人物, 地区)）。any 之内的不算（不一定成立）。"""
    found: set[tuple[str, str]] = set()
    if isinstance(cond, list):
        for row in cond:
            found |= positive_kinds(row, kind, negated)
        return found
    if not isinstance(cond, dict) or negated:
        return found
    if "all" in cond:
        return positive_kinds(cond["all"], kind)
    if "any" in cond or "not" in cond:
        return found
    if cond.get("kind") == kind == "office_holder" and cond.get("operator", "eq") == "eq":
        found.add((str(cond.get("office")), str(cond.get("character"))))
    elif cond.get("kind") == kind == "character_region" and cond.get("operator", "eq") == "eq":
        found.add((str(cond.get("character")), str(cond.get("region"))))
    return found


def alive_condition(cond: Any, character: str, negated: bool = False) -> bool:
    if isinstance(cond, list):
        return any(alive_condition(row, character, negated) for row in cond)
    if not isinstance(cond, dict):
        return False
    if "all" in cond:
        return any(alive_condition(row, character, negated) for row in cond["all"])
    if "any" in cond:
        return all(alive_condition(row, character, negated) for row in cond["any"])
    if "not" in cond:
        return alive_condition(cond["not"], character, not negated)
    return (not negated and cond.get("kind") == "character_status" and cond.get("character") == character
            and cond.get("value", "alive") == "alive")


def earliest_turn(item: dict[str, Any]) -> int:
    if item.get("turn") is not None:
        return int(item["turn"])
    lows = [0]

    def walk(cond: Any) -> None:
        if isinstance(cond, list):
            for row in cond:
                walk(row)
        elif isinstance(cond, dict):
            if "all" in cond:
                walk(cond["all"])
            elif cond.get("kind") == "turn" and cond.get("operator", "eq") in ("eq", "gte", "gt"):
                lows.append(int(cond["value"]) + (1 if cond.get("operator") == "gt" else 0))
            elif cond.get("kind") == "flag_age" and cond.get("key") == "rebellion_started":
                lows.append(8)  # 最早起兵在 T8 以后
    walk(item.get("conditions"))
    return max(lows)


def ops_of(rows: Any) -> Iterator[dict[str, Any]]:
    for op in rows or []:
        if isinstance(op, dict):
            yield op
            yield from ops_of(op.get("on_complete"))


def flag_exists_guards(cond: Any, negated: bool = False) -> set[str]:
    """条件里「旗标未设」的守卫：not + flag exists，或 flag absent。返回旗标 key。"""
    found: set[str] = set()
    if isinstance(cond, list):
        for row in cond:
            found |= flag_exists_guards(row, negated)
        return found
    if not isinstance(cond, dict):
        return found
    if "all" in cond:
        return flag_exists_guards(cond["all"], negated)
    if "any" in cond:
        return found
    if "not" in cond:
        return flag_exists_guards(cond["not"], not negated)
    if cond.get("kind") == "flag":
        op = cond.get("operator")
        if (negated and op == "exists") or (not negated and op == "absent"):
            found.add(str(cond.get("key")))
    return found


def leaf_conditions(cond: Any, negated: bool = False) -> list[dict[str, Any]]:
    """条件里正向的叶子（all / any 之内；not 之内的不算）。"""
    if isinstance(cond, list):
        return [leaf for row in cond for leaf in leaf_conditions(row, negated)]
    if not isinstance(cond, dict):
        return []
    for key in ("all", "any"):
        if key in cond:
            return leaf_conditions(cond[key], negated)
    if "not" in cond:
        return leaf_conditions(cond["not"], not negated)
    return [] if negated else [cond]


def negated_leaves(cond: Any, negated: bool = False) -> list[dict[str, Any]]:
    """条件里 not 之内的叶子。"""
    if isinstance(cond, list):
        return [leaf for row in cond for leaf in negated_leaves(row, negated)]
    if not isinstance(cond, dict):
        return []
    for key in ("all", "any"):
        if key in cond:
            return negated_leaves(cond[key], negated)
    if "not" in cond:
        return negated_leaves(cond["not"], not negated)
    return [cond] if negated else []


def flag_negations(cond: Any) -> set[str]:
    """条件里「旗标未成」的 key（not + flag eq true）。"""
    return {str(c.get("key")) for c in negated_leaves(cond)
            if c.get("kind") == "flag" and c.get("operator", "eq") == "eq" and c.get("value", True) is True}


def visible_turns(item: dict[str, Any]) -> set[int] | None:
    """奏疏的固定可见回合（turn 字段或条件里 turn eq）；无法确定时为 None。"""
    if item.get("turn") is not None:
        start = int(item["turn"])
        return set(range(start, start + int(item.get("expires_after", 0) or 0) + 1))
    cond = item.get("conditions")
    rows = cond.get("all") if isinstance(cond, dict) and isinstance(cond.get("all"), list) else [cond]
    for row in rows:
        if isinstance(row, dict) and row.get("kind") == "turn" and row.get("operator", "eq") == "eq":
            return {int(row["value"])}
    return None


def options_of(item: dict[str, Any]) -> list[dict[str, Any]]:
    return [row for row in item.get("options") or [] if isinstance(row, dict)]


def memories(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        return [value]
    return [row for row in value or [] if isinstance(row, dict)]


# ---- 检查 ----
def lint(pack: Path) -> list[str]:
    data = load(pack)
    chars = {c["id"] for c in data["characters"] or []}
    events = {e["id"]: e for e in data["events"] or []}
    memos = data["memorials"] or []
    problems: list[str] = []

    def check_char(cid: Any, where: str) -> None:
        if cid is not None and cid not in chars:
            problems.append(f"[人物] {where} 引用不存在的人物：{cid}")

    def has_appoint(rows: Any) -> bool:
        return any(op.get("op") in APPOINT_OPS and op.get("character") for op in ops_of(rows))

    def check_title(label: str, rows: Any, via: Any, where: str) -> None:
        stripped = APPOINT_EXEMPT.sub("", label or "")
        if not APPOINT_WORDS.search(stripped):
            return
        if has_appoint(rows):
            return
        if via:
            event = events.get(str(via))
            if event is None:
                problems.append(f"[题文] {where}「{label}」appoints_via 指向不存在的事件：{via}")
            elif not any(has_appoint(choice.get("effects")) for choice in event.get("choices") or []):
                problems.append(f"[题文] {where}「{label}」appoints_via 事件 {via} 的选项里没有任免")
            return
        problems.append(f"[题文] {where}「{label}」标题提到任免，但没有 appoint / set_army_commander")

    def check_named(text: str, cond: Any, where: str, defines: set[str] = frozenset()) -> None:
        evidence = positive_evidence(cond) | set(defines)
        for pattern, flags in NAMED_EVENTS:
            hit = re.search(pattern, text or "")
            if hit and not evidence.intersection(flags):
                problems.append(f"[史事] {where} 提到「{hit.group(0)}」，但条件里没有 {' / '.join(flags)} 之一")

    office_names = {}
    for row in data["scenario"].get("offices", []) or []:
        name = str(row.get("name", ""))
        if not name or row.get("id") == "emperor":
            continue
        office_names[name] = row["id"]
        if name.endswith("使"):
            office_names[name[:-1]] = row["id"]
        if "四镇" in name:
            office_names[name.replace("四镇", "")] = row["id"]
            office_names[name.replace("四镇", "")[:-1]] = row["id"]
    char_names: dict[str, str] = {}
    for row in data["characters"] or []:
        char_names[str(row.get("name"))] = row["id"]
    for cid, aliases in CHAR_ALIASES.items():
        for alias in aliases:
            char_names.setdefault(alias, cid)
    holder_re = re.compile(
        "(" + "|".join(sorted(map(re.escape, office_names), key=len, reverse=True)) + ")"
        + "(" + "|".join(sorted(map(re.escape, char_names), key=len, reverse=True)) + ")"
    )

    def check_state_claims(text: str, cond: Any, where: str, fixed_t0: bool, appoints: set[tuple[str, str]] = frozenset(),
                           moves: set[tuple[str, str]] = frozenset(), req: dict[str, Any] | None = None,
                           speaker: str | None = None) -> None:
        if not text:
            return
        hit = COMMANDER_CLAIMS.search(text)
        if hit:
            problems.append(f"[任职] {where}「{hit.group(0)}」断言军队统帅有无，而统帅无条件可验；请改写为不依赖统帅状态的说法")
        if fixed_t0:
            return
        req = req or {}
        req_offices = req.get("office")
        req_offices = set(req_offices if isinstance(req_offices, list) else [req_offices]) if req_offices else set()
        req_regions = req.get("region")
        req_regions = set(req_regions if isinstance(req_regions, list) else [req_regions]) if req_regions else set()
        holders = positive_kinds(cond, "office_holder")
        places = positive_kinds(cond, "character_region")
        for match in holder_re.finditer(text):
            office, cid = office_names[match.group(1)], char_names[match.group(2)]
            if (office, cid) in holders or (office, cid) in appoints or (speaker == cid and office in req_offices):
                continue
            problems.append(f"[任职] {where} 称「{match.group(0)}」，但条件里没有 office_holder {office}={cid}")
        for cid, region, pattern in LOCATION_CLAIMS:
            hit = re.search(pattern, text)
            if not hit:
                continue
            if (cid, region) in places or (cid, region) in moves or (speaker == cid and region in req_regions):
                continue
            problems.append(f"[所在] {where} 称「{hit.group(0)}」，但条件里没有 character_region {cid}={region}")

    # ---- round 6：分兵 / 同题分支 / 自称在京 / 末季部署 / 养兵 / 首季账目 ----
    scenario = data["scenario"] or {}
    upkeep = (scenario.get("formulas") or {}).get("upkeep")
    player = (scenario.get("settings") or {}).get("player_faction", "tang")
    armies_file = pack / "armies.yaml"
    army_faction = {a["id"]: a.get("faction") for a in (yaml.safe_load(armies_file.read_text(encoding="utf-8")) if armies_file.is_file() else []) or []}
    last_turn = int(((scenario.get("game_length") or {}).get("last_turn") or 0))

    def check_partial(text: str, rows: Any, where: str) -> None:
        hit = PARTIAL_WORDS.search(text or "")
        if not hit:
            return
        ops = list(ops_of(rows))
        moves = [op for op in ops if op.get("op") in ("move_army", "march")]
        if not moves or any(op.get("op") == "detach" for op in ops):
            return
        moved = {op.get("army") for op in moves}
        if any(op.get("op") == "adjust_army" and op.get("army") in moved and float(op.get("delta", 0)) < 0 for op in ops):
            return  # 先折损、余部整军移动（「一部从乱，余众溃散」）
        problems.append(f"[分兵] {where} 称「{hit.group(0)}」，但只有整军 {moves[0].get('op')}（{moves[0].get('army')}），没有 detach")

    by_id = {str(m.get("id")): m for m in memos}
    families: dict[str, list[str]] = {}
    for item in memos:
        base = item.get("variant_of")
        if base is not None:
            if str(base) not in by_id:
                problems.append(f"[分支] 奏疏 {item.get('id')} variant_of 指向不存在的奏疏：{base}")
                continue
            families.setdefault(str(base), [str(base)]).append(str(item["id"]))
    family_of = {mid: base for base, rows in families.items() for mid in rows}
    titles: dict[str, list[str]] = {}
    for item in memos:
        titles.setdefault(str(item.get("title", "")), []).append(str(item.get("id")))
    for title, ids in titles.items():
        if len(ids) > 1 and len({family_of.get(i, i) for i in ids}) > 1:
            problems.append(f"[分支] 同标题奏疏「{title}」{'、'.join(ids)} 未以 variant_of 声明为同题分支")
    for base, ids in families.items():
        for mid in ids:
            guards = flag_exists_guards(by_id[mid].get("conditions"))
            missing = [s for s in ids if s != mid and f"memorial:{s}" not in guards]
            if missing:
                problems.append(f"[分支] 奏疏 {mid}（同题 {base}）条件里缺少「其余分支未处理」：{'、'.join('memorial:' + s for s in missing)}")

    # 奏疏
    for item in memos:
        mid = item.get("id")
        for adv in item.get("advisors") or []:
            hit = SELF_IN_CAPITAL.search(str(adv.get("line", "")))
            if hit:
                req = adv.get("requires") if isinstance(adv.get("requires"), dict) else {}
                regions = req.get("region")
                regions = set(regions if isinstance(regions, list) else [regions]) if regions else set()
                if "jingji" not in regions and (adv.get("character"), "jingji") not in positive_kinds(item.get("conditions"), "character_region"):
                    problems.append(f"[所在] 奏疏 {mid} 谏言（{adv.get('character')}）自称「{hit.group(0)}」，但没有 requires.region: jingji")
        for opt in item.get("options") or []:
            check_partial(f"{opt.get('label', '')}｜{opt.get('hint', '')}", opt.get("ops"), f"奏疏 {mid}.{opt.get('id')}")
        # 正文说「一部」而全条奏疏没有一个 detach 选项：正文许诺的分兵无从兑现（有分兵选项时，其余整军选项另以标题 / 提示自明）
        if PARTIAL_WORDS.search(str(item.get("summary", ""))) and not any(
                op.get("op") == "detach" for opt in options_of(item) for op in ops_of(opt.get("ops"))):
            for opt in item.get("options") or []:
                check_partial(str(item.get("summary", "")), opt.get("ops"), f"奏疏 {mid}（正文）.{opt.get('id')}")
        turns = visible_turns(item)
        options = item.get("options") or []
        if last_turn and turns and (last_turn - 1) in turns and options:
            moving = [opt for opt in options if any(op.get("op") in MOVE_OPS for op in ops_of(opt.get("ops")))]
            if moving and len(moving) == len(options):
                problems.append(f"[末季] 奏疏 {mid} 在最后决策季 T{last_turn - 1} 可见，选项都调兵，缺少「维持现状」的不调兵选项")
            for opt in moving:
                if "行程" not in str(opt.get("hint", "")):
                    problems.append(f"[末季] 奏疏 {mid}.{opt.get('id')} 在最后决策季调兵，提示未写行程（终局前能否抵达）")
        if upkeep:
            per_treasury = next((float(row.get("amount", 0)) / float(row.get("per", 1)) for row in upkeep
                                 if row.get("resource") == "treasury"), 0.0)
            rebel_now = {key[: -len("_rebel")] for key in positive_evidence(item.get("conditions")) if key.endswith("_army_rebel")}
            for opt in options:   # 条件写明某军已从乱（<军>_rebel 旗标）者，其兵额不计入本方养兵（round 8）
                net = sum(float(op.get("delta", 0)) for op in ops_of(opt.get("ops"))
                          if op.get("op") == "adjust_army" and army_faction.get(op.get("army")) == player
                          and op.get("army") not in rebel_now)
                hint = str(opt.get("hint", ""))
                claim = UPKEEP_CLAIM.search(hint)
                where = f"奏疏 {mid}.{opt.get('id')}"
                if net > 0 and "养兵" not in hint:
                    problems.append(f"[养兵] {where} 净增兵 {net:g}，提示未写此后的养兵负担")
                if claim and net <= 0:
                    problems.append(f"[养兵] {where} 提示称「{claim.group(0)}」，但本方兵额净变化为 {net:g}（调拨不增养兵）")
                elif claim and per_treasury and abs(float(claim.group(1)) - net * per_treasury) > 0.06:
                    problems.append(f"[养兵] {where} 提示称「{claim.group(0)}」，按净增兵 {net:g} 应为 +{net * per_treasury:g} 万贯")
        for opt in options:
            ops = list(ops_of(opt.get("ops")))
            if any(op.get("dispatch") and op.get("op") in APPOINT_OPS for op in ops) and any(
                    op.get("op") == "adjust_resource" and op.get("resource") == "frontier_pressure"
                    and float(op.get("delta", 0)) < 0 and str(op.get("reason", "")) in ARRIVAL_REASONS for op in ops):
                problems.append(f"[到任] 奏疏 {mid}.{opt.get('id')} 任将赴镇，却在下诏时即给边患收益；应由到镇事件落实")
    for eid, ev in events.items():
        effects = list(ops_of(ev.get("effects")))
        check_partial(str(ev.get("title", "")) + "｜" + str(ev.get("text", "")), effects, f"事件 {eid}")
        for choice in ev.get("choices") or []:
            check_partial(str(choice.get("text", "")), choice.get("effects"), f"事件 {eid}.{choice.get('id')}")
        if (ev.get("when") or {}).get("turn") == 1:
            recurring = {str(op.get("category")) for op in effects if op.get("op") == "add_ledger" and op.get("kind", "recurring") == "recurring"}
            caught_up = {str(op.get("resource")) for op in effects if op.get("op") == "adjust_resource" and "首季" in str(op.get("reason", ""))}
            for resource in sorted(recurring - caught_up):
                problems.append(f"[账目] 事件 {eid} 在 T1 才设经常账目（{resource}），却没有补扣首季（reason 含「首季」的 adjust_resource）")

    # ---- round 7：官缺断言 / 中枢口吻 ----
    vacancy_re = re.compile("(" + "|".join(sorted(map(re.escape, office_names), key=len, reverse=True)) + ")" + VACANCY_WORDS)
    vacant_at_start = {str(row["id"]) for row in data["scenario"].get("offices", []) or []} - {
        str(office) for row in data["characters"] or [] for office in (row.get("offices") or [row.get("office")]) if office}

    def check_vacancy(text: str, cond: Any, where: str, fixed_t0: bool, dismissed: set[str] = frozenset()) -> None:
        holders = positive_kinds(cond, "office_holder")
        for match in vacancy_re.finditer(text or ""):
            office = office_names[match.group(1)]
            if (office, "None") in holders or office in dismissed or (fixed_t0 and office in vacant_at_start):
                continue
            problems.append(f"[官缺] {where} 称「{match.group(0)}」，但条件里没有 office_holder {office}=null")

    for item in memos:
        mid = item.get("id")
        cond = item.get("conditions")
        t0 = item.get("turn") == 0
        check_vacancy(f"{item.get('title', '')}｜{item.get('summary', '')}", cond, f"奏疏 {mid} 标题/正文", t0)
        for adv in item.get("advisors") or []:
            check_vacancy(str(adv.get("line", "")), cond, f"奏疏 {mid} 谏言（{adv.get('character')}）", t0)
            hit = COURT_VOICE.search(str(adv.get("line", "")))
            if hit and not t0:
                req = adv.get("requires") if isinstance(adv.get("requires"), dict) else {}
                regions = req.get("region")
                regions = set(regions if isinstance(regions, list) else [regions]) if regions else set()
                if regions != {"jingji"} and (adv.get("character"), "jingji") not in positive_kinds(cond, "character_region"):
                    problems.append(f"[所在] 奏疏 {mid} 谏言（{adv.get('character')}）以在京理事口吻说「{hit.group(0)}」，但没有 requires.region: jingji")
        for opt in options_of(item):
            dismissed = {str(op.get("office")) for op in ops_of(opt.get("ops")) if op.get("op") == "dismiss"}
            check_vacancy(f"{opt.get('label', '')}｜{opt.get('hint', '')}", cond, f"奏疏 {mid}.{opt.get('id')}", t0, dismissed)
    for eid, ev in events.items():
        dismissed = {str(op.get("office")) for op in ops_of(ev.get("effects")) if op.get("op") == "dismiss"}
        check_vacancy(f"{ev.get('title', '')}｜{ev.get('text', '')}", ev.get("conditions"), f"事件 {eid}",
                      (ev.get("when") or {}).get("turn") == 0, dismissed)
        for choice in ev.get("choices") or []:
            chosen = {str(op.get("office")) for op in ops_of(choice.get("effects")) if op.get("op") == "dismiss"}
            check_vacancy(str(choice.get("text", "")), ev.get("conditions"), f"事件 {eid}.{choice.get('id')}", False, dismissed | chosen)

    # ---- round 7：结局文字与条件 ----
    def bounds(cond: Any) -> set[tuple[str, str]]:
        found: set[tuple[str, str]] = set()
        if isinstance(cond, list):
            for row in cond:
                found |= bounds(row)
        elif isinstance(cond, dict):
            if "all" in cond:
                found |= bounds(cond["all"])
            elif cond.get("kind") == "resource":
                found.add((str(cond.get("id")), str(cond.get("operator", "gte"))))
        return found

    for ending in data["scenario"].get("endings", []) or []:
        have = bounds(ending.get("conditions"))
        for pattern, resource, direction in ENDING_CLAIMS:
            hit = re.search(pattern, str(ending.get("text", "")))
            if not hit:
                continue
            ok = {"upper": {"lt", "lte"}, "lower": {"gt", "gte"}}[direction]
            if not any(res == resource and op in ok for res, op in have):
                problems.append(f"[结局] 结局 {ending.get('id')} 称「{hit.group(0)}」，但条件里没有 {resource} 的相应界限")

    # ---- round 8：乱局奏疏池 / 兵变宽限 / 再造唐室须有战功 / 善后之言须有其事 / 察使称谓 ----
    pool: dict[str, list[dict[str, Any]]] = {}
    for item in memos:
        if item.get("war_pool") is not None:
            pool.setdefault(str(item["war_pool"]), []).append(item)
    for template, rows in pool.items():
        standing = template in STANDING_WAR_POOLS
        if standing and [r.get("id") for r in rows] != [f"wp_{template}_{i}" for i in range(1, 4)]:
            problems.append(f"[奏疏池] 常备题目 {template} 须按次序列出三班 wp_{template}_1 / _2 / _3")
        if not standing and len(rows) > 2:
            problems.append(f"[奏疏池] 题目 {template} 有 {len(rows)} 条（{'、'.join(str(r['id']) for r in rows)}），每场战事同题至多两见")
        if len({str(r.get("title")) for r in rows}) < len(rows):
            problems.append(f"[奏疏池] 题目 {template} 的各条标题须互不相同（第二见另写标题）")
        for index, row in enumerate(rows):
            where = f"奏疏 {row.get('id')}（题目 {template}）"
            cond = row.get("conditions")
            if standing:
                mid = str(row.get("id"))
                last = f"war_pool:{template}:last"
                clock = f"cooldown:{mid}"
                counter = f"war_pool:{template}:slot"
                if row.get("repeatable") is not True or row.get("cooldown") != 3:
                    problems.append(f"[奏疏池] {where} 须声明 repeatable: true、cooldown: 3")
                # 检查顶层 all 中的完整守卫，不能把冷却藏在可绕过的 any 分支中。
                required = [
                    {"kind": "counter", "key": counter, "operator": "eq", "value": index},
                    {"any": [{"kind": "flag", "key": last, "operator": "absent"},
                             {"kind": "flag_age", "key": last, "operator": "gte", "value": 1}]},
                    {"any": [{"kind": "flag", "key": clock, "operator": "absent"},
                             {"kind": "flag_age", "key": clock, "operator": "gte", "value": 3}]},
                ]
                guards = cond.get("all", []) if isinstance(cond, dict) else []
                if any(guard not in guards for guard in required):
                    problems.append(f"[奏疏池] {where} 须有当前轮班、本题隔季、本条隔三季的完整守卫")
                transition = [
                    {"op": "set_flag", "key": last, "value": True},
                    {"op": "set_flag", "key": clock, "value": True},
                    {"op": "set_counter", "key": counter, "value": (index + 1) % 3},
                    {"op": "start_project", "name": {"standing_pay": "军饷簿勘会", "standing_reward": "犒军簿勘会",
                                                    "standing_post": "驿传簿勘会"}[template],
                     "region": "jingji", "cost_per_turn": {}, "turns": 1,
                     "on_complete": [{"op": "set_flag", "key": f"memorial:wp_{template}_{(index + 1) % 3 + 1}", "value": None}]},
                ]
                for opt in options_of(row):
                    controls = [op for op in opt.get("ops") or [] if op.get("op") in
                                {"set_flag", "set_counter", "adjust_counter", "start_project"}]
                    if controls != transition:
                        problems.append(f"[奏疏池] {where}.{opt.get('id')} 须记下两道冷却时钟、推进轮班并经一季无耗勘会只清下一班处理标记")
                option_ids = {opt.get("id") for opt in options_of(row)}
                if row.get("proposal") not in option_ids or any(
                        adv.get("option") not in option_ids for adv in row.get("advisors") or []):
                    problems.append(f"[奏疏池] {where} 须写明 proposal 与各谏言的 option")
                if len(str(row.get("summary", ""))) > 120 or any(
                        len(str(adv.get("line", ""))) > 60 for adv in row.get("advisors") or []):
                    problems.append(f"[奏疏池] {where} 正文须 ≤120 字、谏言须 ≤60 字")
            elif row.get("repeatable"):
                problems.append(f"[奏疏池] {where} 非常备题目，不得重复")
            if row.get("turn") is not None:
                problems.append(f"[奏疏池] {where} 不得按固定回合出现，须按战局条件出现")
            if "rebellion_started" not in positive_evidence(cond):
                problems.append(f"[奏疏池] {where} 条件里没有正向的 rebellion_started")
            negated = {key for key in ("rebellion_quelled", "hebei_ceded") if key in flag_negations(cond)}
            for key in sorted({"rebellion_quelled", "hebei_ceded"} - negated):
                problems.append(f"[奏疏池] {where} 条件里缺少「{key} 未成」")
            if index > 0 and not standing:
                first_id = str(rows[0]["id"])
                if not any(c.get("kind") == "flag_age" and c.get("key") == f"memorial:{first_id}"
                           and c.get("operator") in ("gte", "gt") and float(c.get("value", 0)) >= 2 for c in leaf_conditions(cond)):
                    problems.append(f"[奏疏池] {where} 为第二见，条件须写「memorial:{first_id}」已处理且隔两季以上（flag_age ≥ 2）")
    # 兵变宽限：设 mutiny_rebellion 的事件，留京 / 不许还帅之后须满一整季（flag_age ≥ 2），「诸镇自危」之后须 ≥ 1
    grace_min = {"an_detained": 2, "fanyang_restive": 2, "early_detain_alarm": 1}
    for eid, ev in events.items():
        sets_mutiny = any(op.get("op") == "set_flag" and op.get("key") == "mutiny_rebellion" and op.get("value", True)
                          for op in ops_of(ev.get("effects")))
        if not sets_mutiny:
            continue
        ages = [c for c in leaf_conditions(ev.get("conditions")) if c.get("kind") == "flag_age" and c.get("key") in grace_min]
        if not ages:
            problems.append(f"[宽限] 事件 {eid} 酿成兵变，却没有留京 / 夺镇之后的季数条件（宽限一季）")
        for key in {str(c.get("key")) for c in ages}:
            lows = [float(c.get("value", 0)) + (1 if c.get("operator") == "gt" else 0)
                    for c in ages if c.get("key") == key and c.get("operator") in ("gte", "gt", "eq")]
            if not lows or max(lows) < grace_min[key]:
                problems.append(f"[宽限] 事件 {eid} 的 {key} 季数下限须 ≥ {grace_min[key]}（夺镇 / 不许还帅之后至少留一整季可行安抚之策）")
    # 再造唐室须是官军亲手取胜：e3_* 结局须正向要求乱平、战功或收复范阳之一
    for ending in data["scenario"].get("endings", []) or []:
        if not str(ending.get("id", "")).startswith("e3_"):
            continue
        cond = ending.get("conditions")
        leaves = leaf_conditions(cond)
        ok = "rebellion_quelled" in positive_evidence(cond) or any(
            c.get("kind") == "counter" and c.get("key") == "war_merit" and c.get("operator") in ("gte", "gt") for c in leaves
        ) or any(c.get("kind") == "region_controller" and c.get("region") == "fanyang" and c.get("faction") == "yan"
                 for c in negated_leaves(cond))
        if not ok:
            problems.append(f"[结局] 结局 {ending.get('id')} 属「再造唐室」，须要求乱平、官军战功（war_merit）或范阳已不在叛军之手之一，坐守不战者不得")
    # 善后之言须有其事：乱平后的奏疏所称乱中之事，须有记录此事的旗标
    for item in memos:
        cond = item.get("conditions")
        evidence = positive_evidence(cond)
        if "rebellion_quelled" not in evidence:
            continue
        text = f"{item.get('title', '')}｜{item.get('summary', '')}"
        for pattern, flags in POSTWAR_CLAIMS:
            hit = re.search(pattern, text)
            if hit and not evidence.intersection(flags):
                problems.append(f"[善后] 奏疏 {item.get('id')} 称「{hit.group(0)}」，但条件里没有 {' / '.join(flags)} 之一（乱中未必有其事）")
    # 察使称谓：察看范阳的回奏事件（条件含 envoy_sent）写「中使」者须排除遣御史，写「御史」者须限于遣御史
    censor_key = "memorial:p_envoy"
    for eid, ev in events.items():
        leaves = leaf_conditions(ev.get("conditions"))
        if not any(c.get("key") == "envoy_sent" for c in leaves):
            continue
        text = f"{ev.get('title', '')}｜{ev.get('text', '')}"
        is_censor = any(c.get("key") == censor_key and c.get("value") == "censor" for c in leaves)
        not_censor = any(c.get("key") == censor_key and c.get("value") == "censor" for c in negated_leaves(ev.get("conditions")))
        if "中使" in text and not not_censor:
            problems.append(f"[称谓] 事件 {eid} 写「中使」，但条件未排除遣御史（memorial:p_envoy = censor）")
        if "御史" in text and not is_censor:
            problems.append(f"[称谓] 事件 {eid} 写「御史」，但条件未限于遣御史")

    # 奏疏（原有检查）
    for item in memos:
        mid = item.get("id")
        cond = item.get("conditions")
        first = earliest_turn(item)
        for adv in item.get("advisors") or []:
            cid = adv.get("character")
            check_char(cid, f"奏疏 {mid} 谏言")
            check_named(adv.get("line", ""), cond, f"奏疏 {mid} 谏言（{cid}）")
            check_state_claims(adv.get("line", ""), cond, f"奏疏 {mid} 谏言（{cid}）", item.get("turn") == 0,
                               req=adv.get("requires") if isinstance(adv.get("requires"), dict) else None, speaker=cid)
            dies = MORTAL_FROM.get(cid)
            guarded = bool(adv.get("requires")) or alive_condition(cond, cid)  # requires 由引擎在列出时校验
            if dies is not None and first >= dies and not guarded:
                problems.append(f"[易逝] 奏疏 {mid} 自 T{first} 可见，谏言人 {cid} 可能已故，却无「在世」条件")
        check_named(f"{item.get('title', '')}｜{item.get('summary', '')}", cond, f"奏疏 {mid} 标题/正文")
        check_state_claims(f"{item.get('title', '')}｜{item.get('summary', '')}", cond, f"奏疏 {mid} 标题/正文", item.get("turn") == 0)
        for opt in item.get("options") or []:
            where = f"奏疏 {mid}.{opt.get('id')}"
            for mem in memories(opt.get("memory")):
                check_char(mem.get("character"), f"{where} memory")
            for op in ops_of(opt.get("ops")):
                check_char(op.get("character"), f"{where} op {op.get('op')}")
            check_title(str(opt.get("label", "")), opt.get("ops"), opt.get("appoints_via"), where)
            sets_intel = any(op.get("op") == "set_flag" and str(op.get("key", "")).startswith("intel:") for op in ops_of(opt.get("ops")))
            if sets_intel and not INTEL_CAP.search(str(opt.get("hint", ""))):
                problems.append(f"[情报] {where} 设置情报旗标，但提示未写明叠加上限（只减半一次 / 不叠加）")

    # 事件
    for eid, ev in events.items():
        cond = ev.get("conditions")
        defines = {str(op.get("key")) for op in ops_of(ev.get("effects")) if op.get("op") == "set_flag" and op.get("value", True)}
        check_named(f"{ev.get('title', '')}｜{ev.get('text', '')}", cond, f"事件 {eid}", defines)
        effects = list(ops_of(ev.get("effects")))
        appoints = {(str(op.get("office")), str(op.get("character"))) for op in effects if op.get("op") == "appoint"}
        moves = {(str(op.get("character")), str(op.get("to_region"))) for op in effects if op.get("op") == "move_character"}
        t0 = (ev.get("when") or {}).get("turn") == 0
        check_state_claims(f"{ev.get('title', '')}｜{ev.get('text', '')}", cond, f"事件 {eid}", t0, appoints, moves)
        for op in ops_of(ev.get("effects")):
            check_char(op.get("character"), f"事件 {eid} op {op.get('op')}")
        sets_intel = any(k.startswith("intel:") for k in defines)
        if sets_intel and not INTEL_CAP.search(str(ev.get("text", ""))):
            problems.append(f"[情报] 事件 {eid} 设置情报旗标，但正文未写明叠加上限")
        for choice in ev.get("choices") or []:
            where = f"事件 {eid}.{choice.get('id')}"
            for mem in memories(choice.get("memory")):
                check_char(mem.get("character"), f"{where} memory")
            for op in ops_of(choice.get("effects")):
                check_char(op.get("character"), f"{where} op {op.get('op')}")
            check_title(str(choice.get("text", "")), choice.get("effects"), choice.get("appoints_via"), where)
    problems.extend(lint_round9(data))
    problems.extend(lint_round10(data))
    problems.extend(lint_turn_codes(data))
    return problems


# ---- round 9：政令卡、驿程、新手引导、将领自主 ----
PLAYER_OPS = {"appoint", "dismiss", "move_character", "move_army", "march", "detach", "set_army_commander",
              "start_project", "add_standing_order", "cancel_standing_order", "cancel_ledger", "remember",
              "set_character_status", "set_army_posture"}
CARD_CATEGORIES = {"军务", "内政", "人事", "外交", "财计"}
PARAM_KINDS = {"character", "office", "army", "region", "amount", "choice"}
PLACEHOLDER = re.compile(r"\{(\w+)(?:\.name)?\}")
LATE_WORDS = re.compile(r"乃至|奏到|奏至|乃达")
TARGET_RE = re.compile(r"^[a-z][A-Za-z0-9]*(\.(?:[A-Za-z0-9_]+|\*))+$")
AUTONOMY_ORDERS = {"march", "move", "detach", "hold", "attack", "scorch"}
AUTONOMY_VARS = {"min", "max", "present", "strength"} | {f"is_{k}" for k in AUTONOMY_ORDERS}


def _placeholders(value: Any) -> set[str]:
    if isinstance(value, str):
        return set(PLACEHOLDER.findall(value))
    if isinstance(value, dict):
        return {name for v in value.values() for name in _placeholders(v)}
    if isinstance(value, list):
        return {name for v in value for name in _placeholders(v)}
    return set()


def _lint_card(card: dict[str, Any], problems: list[str]) -> None:
    where = f"[政令卡] {card.get('id')}"
    if card.get("category") not in CARD_CATEGORIES:
        problems.append(f"{where} category 不合法：{card.get('category')}")
    for key in ("title", "summary", "cost_hint"):
        if not str(card.get(key) or "").strip():
            problems.append(f"{where} 缺 {key}")
    if "cooldown" in card and not (isinstance(card["cooldown"], int) and card["cooldown"] > 0):
        problems.append(f"{where} cooldown 须为正整数")
    params = {str(p.get("name")): p for p in card.get("params") or []}
    for name, prm in params.items():
        if prm.get("kind") not in PARAM_KINDS:
            problems.append(f"{where} 参数 {name} 的 kind 不合法：{prm.get('kind')}")
        if prm.get("kind") == "amount" and not all(isinstance(prm.get(k), (int, float)) for k in ("min", "max")):
            problems.append(f"{where} 数额参数 {name} 须写 min / max")
        if prm.get("kind") == "choice" and not prm.get("choices"):
            problems.append(f"{where} 选项参数 {name} 须写 choices")
    ops = list(card.get("ops") or [])
    if not ops:
        problems.append(f"{where} 没有 ops")
    used = _placeholders(ops)
    for name in sorted(used - set(params)):
        problems.append(f"{where} ops 引用未定义的参数 {{{name}}}")
    for name in sorted(set(params) - used):
        problems.append(f"{where} 参数 {name} 未被 ops 使用")
    for op in ops:
        kind = op.get("op")
        if kind not in PLAYER_OPS:
            problems.append(f"{where} 使用了非玩家层操作 {kind}（只许 CONTRACT 1.3.1 白名单与 set_army_posture）")
        if kind == "set_army_posture" and op.get("posture") not in ("hold", "attack", "scorch"):
            problems.append(f"{where} posture 不合法：{op.get('posture')}")
        if kind != "start_project":
            continue
        cost = op.get("cost_per_turn") or {}
        turns = op.get("turns")
        if not cost or any(not isinstance(v, (int, float)) or v <= 0 for v in cost.values()) or not isinstance(turns, int) or turns < 1:
            problems.append(f"{where} start_project 的 cost_per_turn / turns 须为正")
            continue
        gain = 0.0
        for sub in op.get("on_complete") or []:
            if sub.get("op") == "adjust_region":
                delta = sub.get("delta")
                if sub.get("region") != op.get("region"):
                    problems.append(f"{where} 工程竣工只能加本地区指标")
                if not isinstance(delta, (int, float)) or not 0 < delta <= 10:
                    problems.append(f"{where} 工程竣工每项增益须在 (0, 10]")
                else:
                    gain += delta
            elif sub.get("op") not in PLAYER_OPS:
                problems.append(f"{where} 工程竣工含非玩家层操作 {sub.get('op')}")
        total = sum(cost.values()) * turns
        if gain * 10 > total:
            problems.append(f"{where} 工程增益合计 {gain:g} × 10 超过总花费 {total:g}")


def lint_round9(data: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    scenario = data["scenario"] or {}
    settings = scenario.get("settings") or {}
    regions = [r for r in data.get("regions") or [] if isinstance(r, dict)]
    memos = {m["id"]: m for m in data["memorials"] or [] if isinstance(m, dict) and m.get("id")}
    # 23 政令卡
    seen: set[str] = set()
    for card in data.get("policy_cards") or []:
        if str(card.get("id")) in seen:
            problems.append(f"[政令卡] {card.get('id')} id 重复")
        seen.add(str(card.get("id")))
        _lint_card(card, problems)
    # 24 驿程
    threshold = float((settings.get("courier") or {}).get("late_threshold_days", 60))
    late: set[str] = set()
    for region in regions:
        days = region.get("courier_days")
        if not isinstance(days, int) or days <= 0:
            problems.append(f"[驿程] 地区 {region.get('id')} 缺正整数 courier_days")
        elif days > threshold:
            late.add(str(region.get("id")))
    for mid, memo in memos.items():
        if memo.get("region") not in late:
            continue
        if not LATE_WORDS.search(str(memo.get("summary", ""))):
            problems.append(f"[驿程] 奏疏 {mid} 来自驿程过远之地（{memo.get('region')}，晚一季奏到），摘要须写明晚到")
        if any(leaf.get("kind") == "turn" for leaf in leaf_conditions(memo.get("conditions")) + negated_leaves(memo.get("conditions"))):
            problems.append(f"[驿程] 远地奏疏 {mid} 的回合须写在条目的 turn 上（引擎后移一季）；conditions 奏到时须仍成立，不能含 turn 条件")
    # 25 新手引导
    steps: dict[int, list[int]] = {}
    for row in scenario.get("tutorial") or []:
        where = f"[引导] T{row.get('turn')} 第{row.get('step')}步"
        if not isinstance(row.get("turn"), int) or not isinstance(row.get("step"), int):
            problems.append(f"{where} turn / step 须为整数")
            continue
        steps.setdefault(row["turn"], []).append(row["step"])
        for key in ("title", "text"):
            if not str(row.get(key) or "").strip():
                problems.append(f"{where} 缺 {key}")
        target = str(row.get("target") or "")
        if not TARGET_RE.match(target):
            problems.append(f"{where} target 不合「画面.元素」格式：{target!r}")
            continue
        parts = target.split(".")
        if parts[0] == "memorial" and len(parts) >= 3 and parts[1] in ("item", "option"):
            memo = memos.get(parts[2])
            vt = visible_turns(memo) if memo else None
            if memo is None:
                problems.append(f"{where} target 指向不存在的奏疏 {parts[2]}")
            elif vt is not None and row["turn"] not in vt:
                problems.append(f"{where} target 奏疏 {parts[2]} 不在 T{row['turn']} 可见")
    for turn, nums in steps.items():
        if sorted(nums) != list(range(1, len(nums) + 1)):
            problems.append(f"[引导] T{turn} 的 step 须自 1 连续编号：{sorted(nums)}")
    # 26 将领自主
    autonomy = settings.get("autonomy")
    if autonomy is not None:
        traits = {str(k) for c in data["characters"] or [] for k in (c.get("traits") or {})}
        by_order = autonomy.get("by_order") or {}
        if not autonomy.get("formula") and not by_order:
            problems.append("[将领自主] settings.autonomy 缺 formula")
        for order in sorted(set(by_order) - AUTONOMY_ORDERS):
            problems.append(f"[将领自主] by_order 的命令类型无效：{order}")
        for formula in [autonomy.get("formula") or "", *by_order.values()]:
            names = set(re.findall(r"[A-Za-z_]\w*", str(formula)))
            for name in sorted(names - AUTONOMY_VARS - traits):
                problems.append(f"[将领自主] 公式用了未定义的变量 {name}")
    return problems


# ---- round 10：兵额变动须写进提示 ----
TROOP_HINT_MIN = 2000
CN_DIGITS = "〇一二三四五六七八九"


def troop_forms(amount: float) -> set[str]:
    """兵数的几种常见写法：5000 / 5,000 / 五千 / 0.5万；15000 → 一万五千 / 1.5万；20000 → 二万 / 两万。"""
    n = int(abs(amount))
    forms = {str(n), f"{n:,}"}
    if n % 1000 == 0 and n < 100000:
        wan, qian = divmod(n // 1000, 10)
        for two in ("二", "两"):
            digits = CN_DIGITS[:2] + two + CN_DIGITS[3:]
            forms.add((digits[wan] + "万" if wan else "") + (digits[qian] + "千" if qian else ""))
        forms.add(f"{n / 10000:g}万")
    return forms


def troop_changes(rows: Any) -> Iterator[tuple[str, float]]:
    """ops 中使某军兵额变动 ≥ 2000 的：adjust_army 的增减，detach 自原军分出的兵数（参数化的政令卡除外）。"""
    for op in ops_of(rows):
        if op.get("op") == "adjust_army" and isinstance(op.get("delta"), (int, float)) and abs(op["delta"]) >= TROOP_HINT_MIN:
            yield str(op.get("army")), float(op["delta"])
        elif op.get("op") == "detach" and isinstance(op.get("strength"), (int, float)) and op["strength"] >= TROOP_HINT_MIN:
            yield str(op.get("army")), -float(op["strength"])


def lint_round10(data: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    for item in data["memorials"] or []:
        for opt in options_of(item):
            text = f"{opt.get('label', '')}｜{opt.get('hint', '')}"
            for army, delta in troop_changes(opt.get("ops")):
                if not any(form in text for form in troop_forms(delta)):
                    problems.append(f"[兵额] 奏疏 {item.get('id')}.{opt.get('id')} 使 {army} 兵额变动 {delta:+g}，提示未写这一数目")
    for ev in data["events"] or []:
        for choice in ev.get("choices") or []:
            for army, delta in troop_changes(choice.get("effects")):
                if not any(form in str(choice.get("text", "")) for form in troop_forms(delta)):
                    problems.append(f"[兵额] 事件 {ev.get('id')}.{choice.get('id')} 使 {army} 兵额变动 {delta:+g}，选项文字未写这一数目")
    return problems


TURN_CODE = re.compile(r"(?<![A-Za-z_\d])T\d{1,2}(?!\d)")
PLAYER_TEXT_KEYS = {"text", "title", "summary", "hint", "detail", "label", "line", "description"}


def lint_turn_codes(data: dict[str, Any]) -> list[str]:
    """玩家看得到的文字不写回合代号（「至 T23」「（T19）」），一律写成历法（天宝十五载冬）。"""
    problems: list[str] = []

    def walk(value: Any, where: str) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if key in PLAYER_TEXT_KEYS and isinstance(child, str) and TURN_CODE.search(child):
                    problems.append(f"[回合代号] {where}.{key}：{TURN_CODE.search(child).group(0)} 应写成历法（{child[:40]}…）")
                else:
                    walk(child, f"{where}.{value.get('id', key) if key in ('options', 'choices') else key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, f"{where}[{child.get('id', index) if isinstance(child, dict) else index}]")

    for key, value in data.items():
        walk(value, key)
    return problems


def main() -> None:
    ap = argparse.ArgumentParser(description="《天宝》剧本内容静态检查")
    ap.add_argument("--pack", default=str(PACK))
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    problems = lint(Path(args.pack))
    for line in problems:
        print(line)
    print(f"content_lint：{len(problems)} 处问题" if problems else "content_lint：无问题")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
