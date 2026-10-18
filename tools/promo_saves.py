"""Make the two saves the promo capture needs, in a given engine home (shared with the dev backend).

    .venv/Scripts/python tools/promo_saves.py --home playtests/home-promo

Plays whole games through the real GameService (bureaucratic delays, couriers, autonomy all on) with the
rule policies of tools/sim_policies.py, then forks each game just before its decisive settlement:

- PROMO_REBEL: the historical line, forked right before the end_turn in which 「金兵南下」 fires;
- PROMO_GOOD:  the wise line, forked right before the end_turn that reaches a good ending.

The fork keeps that season's confirmed edict, so pressing 「推演本季」 in the app replays the same
settlement (the turn RNG is seeded by seed + turn). Prints the two session ids.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--home", required=True)
    parser.add_argument("--seeds", type=int, default=40, help="seeds to try per line")
    args = parser.parse_args()
    os.environ["LLM_SIM_HOME"] = str(Path(args.home).resolve())
    os.environ.setdefault("SIM_SCENARIOS_DIR", str(ROOT / "scenarios"))
    os.environ.setdefault("PYTHONUTF8", "1")
    sys.path.insert(0, str(ROOT / "engine" / "backend"))
    sys.path.insert(0, str(ROOT / "tools"))
    from sim_policies import GOOD, POLICIES  # noqa: E402
    from simcore.service import GameService  # noqa: E402

    service = GameService()

    def play(policy_name: str, seed: int) -> tuple[str, list[dict]]:
        policy = POLICIES[policy_name]
        rng = random.Random(f"promo:{policy_name}:{seed}")
        session_id, _ = service.create_session("xuanhe_1120", seed)
        while True:
            view = service.view(session_id)
            if view["outcome"]:
                break
            adopted = []
            for item in view["memorials"]:
                pick = policy(str(item["id"]), [str(row["id"]) for row in item.get("options", [])], None, rng)
                if pick:
                    adopted.append({"memorial_id": item["id"], "option_id": pick})
            if adopted:
                receipt = asyncio.run(service.draft_edict(session_id, adopted=adopted, use_provider=False))
                if any(row["status"] in {"applied", "delayed"} for row in receipt["clauses"]):
                    service.confirm_edict(session_id, receipt["id"])
            for choice in service.view(session_id)["pending_choices"]:
                options = [str(row["id"]) for row in choice.get("options", []) if not row.get("disabled")]
                pick = policy(str(choice.get("event_id", choice["id"])), options, None, rng) or (options[0] if options else None)
                if pick:
                    service.choose(session_id, choice["id"], pick)
            asyncio.run(service.end_turn(session_id, narrate=False, discard_drafts=True))
        return session_id, service.session(session_id).history()

    def fork_before(session_id: str, history: list[dict], decisive_turn: int) -> str:
        """Fork at the last entry before the turn entry that settled season `decisive_turn`."""
        store = service.session(session_id)
        previous = None
        for entry in history:
            if entry["type"] == "turn" and store.state_at(entry["id"]).turn - 1 == decisive_turn:
                break
            previous = entry
        else:
            raise SystemExit(f"no turn entry for season {decisive_turn}")
        fork_id, _ = service.fork_session(session_id, previous["id"] if previous else None)
        return fork_id

    def first_turn_with(history: list[dict], session_id: str, flag: str) -> int | None:
        store = service.session(session_id)
        for entry in history:
            if entry["type"] != "turn":
                continue
            snapshot = store.state_at(entry["id"])
            if snapshot.flags.get(flag):
                return snapshot.turn - 1
        return None

    rebel = good = None
    for seed in range(1, args.seeds + 1):
        if rebel is None:
            session_id, history = play("historical", seed)
            state = service.session(session_id).state
            if state.flags.get("jin_invaded") and state.outcome and state.outcome.id == "e_jingkang":
                turn = first_turn_with(history, session_id, "jin_invaded")
                if turn is not None:
                    rebel = fork_before(session_id, history, turn)
                    print(f"PROMO_REBEL={rebel}  (seed {seed}, 金兵南下 settles in season {turn}, ends {state.outcome.title})", flush=True)
        if good is None:
            session_id, history = play("wise", seed)
            state = service.session(session_id).state
            if state.outcome and state.outcome.id in GOOD:
                good = fork_before(session_id, history, state.turn - 1)
                print(f"PROMO_GOOD={good}  (seed {seed}, {state.outcome.title} at turn {state.turn})", flush=True)
        if rebel and good:
            return 0
    print("did not find both saves", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
