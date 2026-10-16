"""《宣和》剧本内容检查（scenarios/xuanhe_1120）。

先跑模板的通用检查（engine/scripts/content_lint.py：E1–E6、W1–W14），再跑本剧本特有的检查。
任何一项不过即退出码 1（本剧本把通用警告也当错误：等同 --strict）。

    .venv/Scripts/python tools/content_lint.py
    .venv/Scripts/python tools/content_lint.py --pack <剧本目录>

本剧本的检查（X 编号；来源注明《天宝》对应条目或本作新增）：
X1  史事有据：玩家可见文字提到具名史事（方腊、白沟、郭药师来降、赎燕、张觉、天祚被擒、金兵南下……），
    其条件须正向包含该史事的旗标（或该事件自身设下此旗标）。（《天宝》#3）
X2  「六贼」之称：此语出自宣和七年陈东上书，宣和七年（第 20 季）之前的文字不得使用。（本作）
X3  币制：本朝以缗计钱，玩家可见文字不得写「贯」作金额单位（「万贯」「贯钱」），免与《天宝》的「贯」混用。（本作）
X4  驰表：谏言以「（自某地驰表 / 驰奏）」开头者须 requires.region 指明其地；requires.region 不含汴京的谏言须写成驰表 / 驰奏。（《天宝》#9、#14）
X5  照例施行：凡有对应 *_default 事件（条件读 memorial:<id> absent）的奏疏，摘要须写明「若不处置」。（本作，机制透明）
X6  外方不进言：奏疏谏言人须是宋臣（faction song）。（本作）
X7  战时奏疏：标题 / 摘要提到围城、勤王、割三镇、南幸、内禅的奏疏，须正向要求 jin_invaded（或其后续旗标）。（《天宝》#18 精神）
X8  结局：每个结局正文须有【达成条件】；正文不得出现「靖康」以外的、本局不存在的年号（本作年号只有宣和）。（《天宝》#17、W13）
X9  调兵守恒：选项里某军减兵、另一军增兵（调拨）时，增减之和须为零（汰兵 / 募兵 / 折损须写在 reason 里：「汰」「募」「折」「败」「溃」「散」「戍」）。（本作）
X10 远地奏疏：驿程超过阈值的地区（川峡、闽广）的奏疏须写 turn，摘要写明「奏到 / 驰奏」。（《天宝》#24）
X11 首季账目：T1 及以后设立的经常账目（add_ledger recurring）若在 T1 设立，须同时补扣首季。（《天宝》#12）
X12 将领自主公式只用人物特质与引擎变量。（《天宝》#26）
X13 东宫称谓：文字称「太子」「东宫」须正向要求 office_holder crown_prince（或开局固定于 T0）。（《天宝》#6）
X14 选项计数：每条奏疏 2–5 个选项；选项 id 在本条内不重复；每个选项都有 hint。（本作）
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "scenarios" / "xuanhe_1120"
sys.path.insert(0, str(ROOT / "engine" / "scripts"))

from content_lint import Linter, load_pack  # noqa: E402

# X1 具名史事 → 须正向出现的任一旗标
NAMED_EVENTS: dict[str, set[str]] = {
    "方腊": {"fangla_risen", "fangla_quelled"},
    "白沟": {"beifa_lost", "beifa_started"},
    "郭药师来降": {"guo_defected_song"},
    "常胜军": {"guo_defected_song", "guo_defected_jin"},
    "赎燕": {"yanjing_bought", "yanjing_jin"},
    "代税钱": {"yanjing_bought", "yanjing_jin"},
    "张觉": {"zhangjue_risen", "zhangjue_accepted", "pingzhou_crushed", "zhangjue_executed"},
    "天祚被擒": {"liao_fallen"},
    "辽亡": {"liao_fallen"},
    "阿骨打卒": {"aguda_dead"},
    "吴乞买": {"aguda_dead"},
    "免夫钱": {"mianfu"},
    "应奉司": {"yingfeng_restored", "huashi_abolished"},
    "金兵南下": {"jin_invaded"},
    "兵临": {"jin_invaded", "bianjing_besieged"},
    "围城": {"jin_invaded", "bianjing_besieged", "taiyuan_besieged"},
    "勤王": {"jin_invaded"},
    "割三镇": {"jin_invaded", "sanzhen_ceded"},
    "南幸": {"jin_invaded", "court_south"},
    "太原被围": {"taiyuan_besieged"},
    "太原陷": {"taiyuan_fallen"},
}
# 只在说「已发生」时才算具名史事：带这些字眼的句子（劝阻、假设）不计
HYPOTHETICAL = ("若", "倘", "恐", "万一", "防", "备", "预", "将来", "或", "免", "则", "可", "宜", "勿", "莫")
LATE_TERMS = {"六贼": 20}
WAR_WORDS = ("围城", "勤王", "割三镇", "南幸", "内禅", "兵临城下", "城下之盟")
WAR_FLAGS = {"jin_invaded", "bianjing_besieged", "sanzhen_ceded", "court_south", "taiyuan_besieged", "jin_warning"}
TRANSFER_WORDS = ("汰", "募", "折", "败", "溃", "散", "戍", "伤", "亡", "死", "降")


def positive_flags(cond: Any, negated: bool = False) -> set[str]:
    out: set[str] = set()
    if isinstance(cond, list):
        for item in cond:
            out |= positive_flags(item, negated)
    elif isinstance(cond, dict):
        if "all" in cond:
            out |= positive_flags(cond["all"], negated)
        if "any" in cond:
            out |= positive_flags(cond["any"], negated)
        if "not" in cond:
            out |= positive_flags(cond["not"], not negated)
        kind = cond.get("kind")
        if kind in ("flag", "flag_age") and not negated:
            op = cond.get("operator", "eq")
            if op != "absent" and not (op == "eq" and cond.get("value") is False):
                out.add(str(cond.get("key")))
    return out


def positive_offices(cond: Any, negated: bool = False) -> set[str]:
    out: set[str] = set()
    if isinstance(cond, list):
        for item in cond:
            out |= positive_offices(item, negated)
    elif isinstance(cond, dict):
        for key in ("all", "any"):
            if key in cond:
                out |= positive_offices(cond[key], negated)
        if "not" in cond:
            out |= positive_offices(cond["not"], not negated)
        if cond.get("kind") == "office_holder" and not negated and cond.get("character") is not None:
            out.add(str(cond.get("office")))
    return out


def ops_in(rows: Any) -> Iterator[dict[str, Any]]:
    for op in rows or []:
        if isinstance(op, dict):
            yield op
            if op.get("op") == "start_project":
                yield from ops_in(op.get("on_complete"))


def set_flags(rows: Any) -> set[str]:
    return {str(op.get("key")) for op in ops_in(rows) if op.get("op") == "set_flag"}


def sentences(text: str) -> list[str]:
    return [part for part in re.split(r"[。；！？\n]", text) if part]


def player_texts(item: dict[str, Any], kind: str) -> Iterator[tuple[str, str]]:
    if kind == "memorial":
        for key in ("title", "summary"):
            if item.get(key):
                yield key, str(item[key])
        for index, advisor in enumerate(item.get("advisors") or []):
            yield f"advisors[{index}]", str(advisor.get("line", ""))
        for option in item.get("options") or []:
            yield f"option {option.get('id')}", f"{option.get('label', '')} {option.get('hint', '')}"
    else:
        for key in ("title", "text"):
            if item.get(key):
                yield key, str(item[key])
        for choice in item.get("choices") or []:
            yield f"choice {choice.get('id')}", str(choice.get("text", ""))


def earliest_turn(item: dict[str, Any]) -> int:
    if isinstance(item.get("turn"), int):
        return int(item["turn"])
    when = item.get("when")
    if isinstance(when, dict) and isinstance(when.get("turn"), int):
        return int(when["turn"])
    best = 0

    def walk(cond: Any, negated: bool = False) -> None:
        nonlocal best
        if isinstance(cond, list):
            for row in cond:
                walk(row, negated)
        elif isinstance(cond, dict):
            if "all" in cond:
                walk(cond["all"], negated)
            if "not" in cond:
                walk(cond["not"], not negated)
            if cond.get("kind") == "turn" and not negated and cond.get("operator") in ("gte", "eq", "gt"):
                value = int(cond.get("value", 0)) + (1 if cond.get("operator") == "gt" else 0)
                best = max(best, value)

    walk(item.get("conditions"))
    return best


class XuanheLinter:
    def __init__(self, data: dict[str, Any]) -> None:
        self.data = data
        self.problems: list[str] = []
        self.scenario = data["scenario"]
        self.characters = {str(row["id"]): row for row in data.get("characters") or []}
        self.regions = {str(row["id"]): row for row in data.get("regions") or []}
        self.memorials = [row for row in data.get("memorials") or [] if isinstance(row, dict)]
        self.events = [row for row in data.get("events") or [] if isinstance(row, dict)]
        settings = self.scenario.get("settings") or {}
        self.threshold = int(((settings.get("courier") or {}).get("late_threshold_days")) or 60)

    def add(self, code: str, where: str, message: str) -> None:
        self.problems.append(f"[{code}] {where}：{message}")

    def run(self) -> list[str]:
        self.named_events()
        self.late_terms()
        self.currency()
        self.remote_advisors()
        self.default_disclosure()
        self.foreign_advisors()
        self.war_memorials()
        self.endings()
        self.transfers()
        self.far_memorials()
        self.first_season_ledger()
        self.autonomy()
        self.crown_prince()
        self.option_shape()
        return self.problems

    # X1
    def named_events(self) -> None:
        for kind, rows in (("memorial", self.memorials), ("event", self.events)):
            for item in rows:
                guards = positive_flags(item.get("conditions"))
                defines = set_flags(item.get("effects"))
                for option in item.get("options") or []:
                    defines |= set_flags(option.get("ops"))
                for where, text in player_texts(item, kind):
                    if kind == "memorial" and where.startswith("option"):
                        continue  # 选项是「将要做的事」，不是已发生的史事
                    for sentence in sentences(text):
                        if any(word in sentence for word in HYPOTHETICAL):
                            continue
                        for name, flags in NAMED_EVENTS.items():
                            if name in sentence and not (flags & (guards | defines)):
                                self.add("X1", f"{kind} {item.get('id')}.{where}", f"提到「{name}」，但条件中没有正向的旗标 {sorted(flags)}")

    # X2
    def late_terms(self) -> None:
        for kind, rows in (("memorial", self.memorials), ("event", self.events)):
            for item in rows:
                first = earliest_turn(item)
                for where, text in player_texts(item, kind):
                    for term, turn in LATE_TERMS.items():
                        if term in text and first < turn:
                            self.add("X2", f"{kind} {item.get('id')}.{where}", f"「{term}」之称宣和七年始有，本条最早可见于第 {first} 季")

    # X3
    def currency(self) -> None:
        pattern = re.compile(r"\d\s*万?贯|万贯|贯钱")
        for kind, rows in (("memorial", self.memorials), ("event", self.events)):
            for item in rows:
                for where, text in player_texts(item, kind):
                    if pattern.search(text):
                        self.add("X3", f"{kind} {item.get('id')}.{where}", "金额单位写成了「贯」，本作以缗计")
        for card in self.data.get("policy_cards") or []:
            if pattern.search(str(card.get("cost_hint", ""))):
                self.add("X3", f"card {card.get('id')}", "金额单位写成了「贯」，本作以缗计")

    # X4
    def remote_advisors(self) -> None:
        for item in self.memorials:
            for index, advisor in enumerate(item.get("advisors") or []):
                line = str(advisor.get("line", ""))
                requires = advisor.get("requires") or {}
                region = requires.get("region")
                regions = set(region) if isinstance(region, list) else ({region} if region else set())
                remote_voice = bool(re.match(r"^（[^）]*(驰表|驰奏)[^）]*）", line))
                where = f"memorial {item.get('id')}.advisors[{index}]"
                if remote_voice and not regions:
                    self.add("X4", where, "写成远方驰表，却没有 requires.region")
                if regions and "bianjing" not in regions and not remote_voice:
                    self.add("X4", where, "其人须在外（requires.region 不含汴京），谏言却不是「（自某地驰表）」的口吻")

    # X5
    def default_disclosure(self) -> None:
        pattern = re.compile(r'"?memorial:([a-z0-9_]+)"?')
        defaults: set[str] = set()
        for event in self.events:
            if not str(event.get("id", "")).endswith("_default"):
                continue
            for leaf in _leaves(event.get("conditions")):
                if leaf.get("kind") == "flag" and leaf.get("operator") == "absent":
                    match = pattern.fullmatch(str(leaf.get("key")))
                    if match:
                        defaults.add(match.group(1))
        for item in self.memorials:
            if item.get("id") in defaults and "若不处置" not in str(item.get("summary", "")):
                self.add("X5", f"memorial {item.get('id')}", "未批则下季照例施行（有 *_default 事件），摘要须写明「若不处置……」")

    # X6
    def foreign_advisors(self) -> None:
        for item in self.memorials:
            for advisor in item.get("advisors") or []:
                cid = str(advisor.get("character"))
                row = self.characters.get(cid)
                if row is not None and row.get("faction") != "song":
                    self.add("X6", f"memorial {item.get('id')}", f"谏言人 {row.get('name')} 不是宋臣")

    # X7
    def war_memorials(self) -> None:
        for item in self.memorials:
            text = f"{item.get('title', '')}{item.get('summary', '')}"
            hits = [word for word in WAR_WORDS if word in text]
            if not hits:
                continue
            flags = positive_flags(item.get("conditions"))
            if not (flags & WAR_FLAGS) and not any(word in text for word in HYPOTHETICAL):
                self.add("X7", f"memorial {item.get('id')}", f"提到{hits}，却没有正向要求金兵南下（{sorted(WAR_FLAGS)}之一）")

    # X8
    def endings(self) -> None:
        for ending in self.scenario.get("endings") or []:
            text = str(ending.get("text", ""))
            if "【达成条件】" not in text:
                self.add("X8", f"ending {ending.get('id')}", "正文缺【达成条件】")
            for era in ("天宝", "至德", "政和", "重和", "建炎"):
                if era in text and "史载" not in text:
                    self.add("X8", f"ending {ending.get('id')}", f"正文出现本局不存在的年号「{era}」（引史须以「史载」起头）")

    # X9
    def transfers(self) -> None:
        for item in self.memorials:
            for option in item.get("options") or []:
                self._transfer(option.get("ops"), f"memorial {item.get('id')}.{option.get('id')}")
        for event in self.events:
            self._transfer(event.get("effects"), f"event {event.get('id')}")

    def _transfer(self, rows: Any, where: str) -> None:
        deltas = [op for op in rows or [] if isinstance(op, dict) and op.get("op") == "adjust_army" and op.get("delta")]
        plus = [op for op in deltas if float(op["delta"]) > 0]
        minus = [op for op in deltas if float(op["delta"]) < 0]
        if not plus or not minus:
            return
        net = sum(float(op["delta"]) for op in deltas)
        explained = any(word in str(op.get("reason", "")) for op in deltas for word in TRANSFER_WORDS)
        if abs(net) > 1 and not explained:
            self.add("X9", where, f"调拨兵额增减之和为 {net:+g}，不为零（若有汰、募、折损，写进 reason）")

    # X10
    def far_memorials(self) -> None:
        far = {rid for rid, row in self.regions.items() if int(row.get("courier_days") or 0) > self.threshold}
        for item in self.memorials:
            if item.get("region") in far:
                if not isinstance(item.get("turn"), int):
                    self.add("X10", f"memorial {item.get('id')}", "远地奏疏须把可见回合写在 turn 上")
                if not re.search(r"奏到|奏至|驰奏|乃至|乃达", str(item.get("summary", ""))):
                    self.add("X10", f"memorial {item.get('id')}", "远地奏疏摘要须写明奏到（驿程晚一季）")

    # X11
    def first_season_ledger(self) -> None:
        for event in self.events:
            when = event.get("when") or {}
            if when.get("turn") != 1:
                continue
            effects = event.get("effects") or []
            recurring = [op for op in effects if isinstance(op, dict) and op.get("op") == "add_ledger" and op.get("kind") == "recurring"]
            for op in recurring:
                paid = any(isinstance(row, dict) and row.get("op") == "adjust_resource" and row.get("resource") == op.get("category")
                           and "首季" in str(row.get("reason", "")) for row in effects)
                if not paid:
                    self.add("X11", f"event {event.get('id')}", f"T1 设立经常账目「{op.get('name')}」而未补扣首季")

    # X12
    def autonomy(self) -> None:
        settings = self.scenario.get("settings") or {}
        config = settings.get("autonomy") or {}
        allowed = {"ability", "loyalty", "ambition", "favor", "fear", "rashness", "present", "strength", "min", "max",
                   "is_march", "is_detach", "is_hold", "is_attack", "is_scorch", "is_move"}
        formulas = [config.get("formula")] + list((config.get("by_order") or {}).values())
        for formula in formulas:
            for name in re.findall(r"[A-Za-z_]+", str(formula or "")):
                if name not in allowed:
                    self.add("X12", "settings.autonomy", f"公式用了未知变量「{name}」")

    # X13
    def crown_prince(self) -> None:
        for item in self.memorials:
            if earliest_turn(item) == 0 and isinstance(item.get("turn"), int) and item.get("turn") == 0:
                continue
            offices = positive_offices(item.get("conditions"))
            text = f"{item.get('title', '')}{item.get('summary', '')}"
            if ("东宫" in text or "太子" in text) and "crown_prince" not in offices:
                self.add("X13", f"memorial {item.get('id')}", "称东宫 / 太子，须有 office_holder crown_prince 的正向守卫")

    # X14
    def option_shape(self) -> None:
        for item in self.memorials:
            options = item.get("options") or []
            if not 2 <= len(options) <= 5:
                self.add("X14", f"memorial {item.get('id')}", f"选项 {len(options)} 个（须 2–5 个）")
            ids = [str(option.get("id")) for option in options]
            if len(ids) != len(set(ids)):
                self.add("X14", f"memorial {item.get('id')}", "选项 id 重复")
            for option in options:
                if not str(option.get("hint", "")).strip():
                    self.add("X14", f"memorial {item.get('id')}.{option.get('id')}", "选项缺 hint")


def _leaves(cond: Any) -> Iterator[dict[str, Any]]:
    if isinstance(cond, list):
        for row in cond:
            yield from _leaves(row)
    elif isinstance(cond, dict):
        for key in ("all", "any", "not"):
            if key in cond:
                yield from _leaves(cond[key])
        if "kind" in cond:
            yield cond


def main() -> int:
    parser = argparse.ArgumentParser(description="《宣和》剧本内容检查")
    parser.add_argument("--pack", default=str(PACK))
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    data = load_pack(Path(args.pack))
    generic = Linter(data)
    generic.run()
    own = XuanheLinter(data).run()
    for line in generic.errors:
        print("通用·错误", line)
    for line in generic.warnings:
        print("通用·警告", line)
    for line in own:
        print("本剧本", line)
    total = len(generic.errors) + len(generic.warnings) + len(own)
    print(f"content_lint：通用 {len(generic.errors)} 错 {len(generic.warnings)} 警，本剧本 {len(own)} 项；共 {total} 项。")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
