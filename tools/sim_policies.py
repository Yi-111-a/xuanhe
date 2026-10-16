"""《宣和》剧本平衡模拟：命名策略只通过奏疏选项与事件抉择操作（引擎后端，直接执行采纳的 ops）。

用法（在 xuanhe/ 下）：

    .venv/Scripts/python tools/sim_policies.py --seeds 300                 # 全部策略
    .venv/Scripts/python tools/sim_policies.py --policy wise --seed 3 --trace
    .venv/Scripts/python tools/sim_policies.py --difficulty diyu --seeds 300
    .venv/Scripts/python tools/sim_policies.py --coverage                  # 每季最少可见奏疏
    .venv/Scripts/python tools/sim_policies.py --out playtests/balance/r1.json

策略（选项 id 的偏好表，见 PREFS；表中没有的奏疏不批，抉择按默认）：
- do_nothing：一概不批，抉择到期走默认（默认即史事）。目标：约 85–90% 走向「靖康之耻」。
- historical：按史事批（结盟、伐燕、赎燕、纳张觉、斩张觉、免夫钱……）。
- wise：稳健打法（罢花石、括禁军、召李纲、修边备、种师道专任、不纳张觉、修城、勤王……）。目标：好结局 70–80%。
- half_wise：每条 wise 选择以 50% 概率采纳，否则不批。用来看难度梯度。
- first / last / random：不看局势，处处取首项 / 末项 / 随机。乱打不应拿到好结局。
- 探针（结局可达性，不是玩家画像）：lianliao（存辽 → 唇齿相依）、appease（议和割地 → 城下之盟）、
  flee（南幸 → 衣冠南渡）、abdicate（内禅）、favorites（宠信佞幸 → 佞幸专国）、bankrupt（挥霍 → 帑竭）。
engine 后端不掷延期骰、不计驿程与将领自主；要看精确规则用 engine/scripts/simulate.py --backend service。
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
from collections import Counter, defaultdict
from collections.abc import Callable
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine" / "backend"))
sys.path.insert(0, str(ROOT / "engine" / "scripts"))

from simcore.domain.apply import apply
from simcore.domain.memorials import (
    MemorialError,
    adopted_ops,
    is_visible,
    memorial_flag,
)
from simcore.domain.turn import GameOver, resolve_turn
from simcore.scenario.loader import build_initial_state, load_scenario
from simulate import (
    allowed_choice_options,
    crisis_value,
    objective_rows,
    visible_memorials,
)

PACK = ROOT / "scenarios" / "xuanhe_1120"
GOOD = {"e_yanyun", "e_baojing", "e_quedi", "e_chunchi"}
BEST = {"e_yanyun", "e_baojing"}

# 偏好表：按序取第一个出现在本奏疏选项里的 id；"*" 之外的键为奏疏 id 专用偏好（优先）。
WISE = ["abolish", "kuo", "recall", "retire_check", "written", "repair", "check", "keep_yu", "frank", "curb", "tangluo",
              "soothe", "zhong", "amnesty", "thrift", "pardon", "gifts", "refuse", "remit", "home", "canal",
              "zhong_lead", "fortify", "refuse_jue", "keep_jue", "settle", "split", "relief", "defend", "qinwang",
              "ligang", "repel", "train", "integrity", "punish", "dismiss", "yes"]

PREFS: dict[str, dict[str, list[str]]] = {
    "historical": {
        "*": ["ally", "raise", "recruit", "stay", "retire", "six", "wang", "delay", "favor", "none", "strict", "tong",
              "amnesty", "tax", "keep", "stall", "restore", "hebei", "march", "buy", "accept", "execute", "mianfu",
              "cai", "hold"],
    },
    "wise": {
        "t0_haishang": ["spy"],
        "t1_haishang_again": ["loose"],
        "*": WISE,
    },
    # 联辽：开局谢绝金使、以粮帛助辽，其余照稳健打法（看「唇齿相依」是否可达）
    "lianliao": {
        "t0_haishang": ["refuse"],
        "t1_haishang_again": ["refuse"],
        "*": ["grain", "aid", "lianliao", *WISE],
    },
    "appease": {"*": ["ally", "cede", "peace", "buy", "accept", "gifts"]},
    "flee": {"*": ["south", "flee", "nanxing"]},
    "abdicate": {"*": ["neishan", "abdicate"]},
    "favorites": {"*": ["raise", "favor", "keep", "restore", "wang", "recruit", "stay", "mianfu", "cai", "restore", "tax"]},
    "bankrupt": {"*": ["raise", "recruit", "remit", "train", "tangluo", "cities", "aid", "gifts", "buy", "grain"]},
}

Policy = Callable[[str, list[str], Any, random.Random], "str | None"]


def pref_policy(name: str, keep: float = 1.0) -> Policy:
    table = PREFS[name]

    def policy(item_id: str, options: list[str], state: Any, rng: random.Random) -> str | None:
        if keep < 1.0 and rng.random() > keep:
            return None
        for option in table.get(item_id, []) + table.get("*", []):
            if option in options:
                return option
        return None

    return policy


def simple(kind: str) -> Policy:
    def policy(item_id: str, options: list[str], state: Any, rng: random.Random) -> str | None:
        if not options or kind == "none":
            return None
        if kind == "first":
            return options[0]
        if kind == "last":
            return options[-1]
        return rng.choice(options)

    return policy


POLICIES: dict[str, Policy] = {
    "do_nothing": simple("none"),
    "historical": pref_policy("historical"),
    "wise": pref_policy("wise"),
    "half_wise": pref_policy("wise", 0.5),
    "first": simple("first"),
    "last": simple("last"),
    "random": simple("random"),
    "lianliao": pref_policy("lianliao"),
    "appease": pref_policy("appease"),
    "flee": pref_policy("flee"),
    "abdicate": pref_policy("abdicate"),
    "favorites": pref_policy("favorites"),
    "bankrupt": pref_policy("bankrupt"),
}
DEFAULT_SET = ["do_nothing", "historical", "wise", "half_wise", "first", "last", "random"]
PROBES = ["lianliao", "appease", "flee", "abdicate", "favorites", "bankrupt"]


def play(scenario: dict[str, Any], policy: Policy, seed: int, difficulty: str | None, trace: bool = False,
         coverage: dict[int, int] | None = None) -> dict[str, Any]:
    state = build_initial_state(scenario, difficulty)
    rng = random.Random(f"policy:{seed}")
    peak = crisis_value(scenario, state) or 0.0
    invaded_at = None
    while state.outcome is None and state.turn < 60:
        visible = visible_memorials(scenario, state)
        if coverage is not None:
            coverage[state.turn] = min(coverage.get(state.turn, 99), len(visible))
        if trace:
            res = {key: round(row.amount, 1) for key, row in state.resources.items()}
            print(f"T{state.turn:>2} {state.calendar.label} {res}")
        for item in visible:
            if not is_visible(item, state):
                continue
            options = [str(option.get("id")) for option in item.get("options") or []]
            picked = policy(str(item["id"]), options, state, rng)
            if picked is None:
                continue
            try:
                ops = adopted_ops(scenario, state, str(item["id"]), picked)
            except MemorialError as exc:
                if trace:
                    print(f"     跳过 {item['id']}：{exc.message}")
                continue
            for op in ops:
                try:
                    state, _ = apply(op, state, source=str(item.get("title") or item["id"]))
                except ValueError as exc:
                    if trace:
                        print(f"     ! 拒绝 {item['id']}/{picked} {op.get('op')}：{exc}")
            state, _ = apply({"op": "set_flag", "key": memorial_flag(str(item["id"])), "value": picked}, state)
            if trace:
                print(f"     奏疏「{item.get('title')}」→ {picked}")
        for choice in list(state.pending_choices):
            options = allowed_choice_options(choice, state)
            picked = policy(str(choice.id), options, state, rng)
            if picked is None:
                continue
            try:
                state, _ = apply({"op": "choose_event_option", "choice_id": choice.id, "option_id": picked}, state)
                if trace:
                    print(f"     抉择「{choice.title}」→ {picked}")
            except ValueError:
                pass
        try:
            state, report = resolve_turn(state, random.Random(seed * 1000 + state.turn), scenario)
        except GameOver:
            break
        if trace:
            for event in report.events_fired:
                print(f"     事件：{event}")
            for battle in report.battles:
                print(f"     战：{battle.get('text')}")
            for warning in report.warnings:
                print(f"     ! {warning}")
        if invaded_at is None and state.flags.get("jin_invaded"):
            invaded_at = state.turn
        peak = max(peak, crisis_value(scenario, state) or 0.0)
    outcome = state.outcome
    if trace:
        print(f"终局：{outcome.title if outcome else '（未终局）'}，T{state.turn}")
    return {
        "outcome": outcome.id if outcome else "none",
        "title": outcome.title if outcome else "（未终局）",
        "turn": state.turn,
        "crisis": crisis_value(scenario, state),
        "peak": peak,
        "invaded_at": invaded_at,
        "objectives": objective_rows(scenario, state),
        "treasury": round(state.resources["treasury"].amount, 1),
        "resources": {key: round(row.amount, 1) for key, row in state.resources.items()},
    }


def summarize(name: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(rows)
    counts = Counter(row["outcome"] for row in rows)
    titles = {row["outcome"]: row["title"] for row in rows}
    turns: dict[str, list[int]] = defaultdict(list)
    for row in rows:
        turns[row["outcome"]].append(row["turn"])
    invaded = [row["invaded_at"] for row in rows if row["invaded_at"] is not None]
    return {
        "policy": name,
        "games": total,
        "outcomes": {key: {"count": value, "share": round(value / total, 4), "title": titles[key], "mean_turn": round(statistics.mean(turns[key]), 1)}
                     for key, value in counts.most_common()},
        "good_share": round(sum(counts[key] for key in GOOD) / total, 4),
        "best_share": round(sum(counts[key] for key in BEST) / total, 4),
        "jingkang_share": round(counts["e_jingkang"] / total, 4),
        "invaded_share": round(len(invaded) / total, 4),
        "invaded_mean_turn": round(statistics.mean(invaded), 1) if invaded else None,
        "crisis_mean": round(statistics.mean(row["crisis"] for row in rows), 1),
        "peak_mean": round(statistics.mean(row["peak"] for row in rows), 1),
        "treasury_mean": round(statistics.mean(row["treasury"] for row in rows), 1),
        "resources_mean": {key: round(statistics.mean(row["resources"][key] for row in rows), 1) for key in rows[0]["resources"]},
    }


def print_summary(data: dict[str, Any]) -> None:
    print(f"\n== {data['policy']}（{data['games']} 局）好结局 {data['good_share']:.1%}（中兴 {data['best_share']:.1%}），靖康 {data['jingkang_share']:.1%}，"
          f"金兵南下 {data['invaded_share']:.0%}（平均 T{data['invaded_mean_turn']}），胡马南牧终局 {data['crisis_mean']}、峰值 {data['peak_mean']}，国库终局 {data['treasury_mean']}")
    print("   终局国势均值：" + "，".join(f"{key} {value:g}" for key, value in data.get("resources_mean", {}).items()))
    for key, row in data["outcomes"].items():
        print(f"   {key:<12} {row['count']:>5} {row['share']:7.1%}  平均终局 T{row['mean_turn']}  {row['title']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--policy", default="default", help="策略名、default（七种常规策略）、probes 或 all")
    parser.add_argument("--seeds", type=int, default=300)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--difficulty")
    parser.add_argument("--trace", action="store_true")
    parser.add_argument("--coverage", action="store_true")
    parser.add_argument("--out", help="把汇总写成 JSON")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    scenario = load_scenario(PACK)
    if args.policy == "default":
        names = DEFAULT_SET
    elif args.policy == "probes":
        names = PROBES
    elif args.policy == "all":
        names = DEFAULT_SET + PROBES
    else:
        names = [args.policy]
    seeds = [args.seed] if args.seed is not None else list(range(1, args.seeds + 1))
    if args.coverage:
        cover: dict[int, int] = {}
        for name in DEFAULT_SET:
            for seed in seeds[:40]:
                play(scenario, POLICIES[name], seed, args.difficulty, coverage=cover)
        print("每季最少可见奏疏：" + "，".join(f"T{turn}:{count}" for turn, count in sorted(cover.items())))
        low = [turn for turn, count in cover.items() if count < 3]
        print("不足 3 条的季：" + (", ".join(f"T{turn}" for turn in sorted(low)) or "无"))
        return 1 if low else 0
    results = {}
    for name in names:
        rows = [play(scenario, POLICIES[name], seed, args.difficulty, trace=args.trace) for seed in seeds]
        results[name] = summarize(name, rows)
        print_summary(results[name])
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        payload = {"difficulty": args.difficulty or "shishi", "seeds": len(seeds), "results": results}
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
