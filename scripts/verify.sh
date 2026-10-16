#!/usr/bin/env bash
# Gate G2: engine tests + ruff + mypy, scenario validation, the template's content lint (--strict) and this game's
# own content lint, plus the frontend type check. Every step's exit code is checked directly (set -e + pipefail);
# full output goes to playtests/tmp/verify/<step>.log and only a summary line is printed — no pipe into tail can
# hide a failure.
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHONIOENCODING=utf-8 PYTHONUTF8=1
PY="$PWD/.venv/Scripts/python"
LOG="$PWD/playtests/tmp/verify"
mkdir -p "$LOG"

step() {  # step <name> <command...>
  local name="$1"; shift
  if "$@" >"$LOG/$name.log" 2>&1; then
    echo "ok   $name"
  else
    echo "FAIL $name (see $LOG/$name.log)"
    cat "$LOG/$name.log"
    exit 1
  fi
}

step pytest   bash -c "cd engine/backend && '$PY' -m pytest -q -p no:cacheprovider"
step ruff     bash -c "cd engine/backend && '$PWD/.venv/Scripts/ruff' check . ../scripts && cd ../.. && '$PWD/.venv/Scripts/ruff' check tools scripts"
step mypy     bash -c "cd engine/backend && '$PWD/.venv/Scripts/mypy' simcore api cli"
step validate "$PWD/.venv/Scripts/sim" validate scenarios/xuanhe_1120
step lint_tpl "$PY" engine/scripts/content_lint.py scenarios/xuanhe_1120 --strict
step lint_own "$PY" tools/content_lint.py
step tsc      npm --prefix app run typecheck
echo "verify: OK"
