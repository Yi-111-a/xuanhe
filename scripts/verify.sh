#!/usr/bin/env bash
# Gate checks before committing: engine tests + lint + types, scenario validation + content lint.
# Fails on the first failing step (pipefail: a `| tail` can never hide a failure).
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHONIOENCODING=utf-8
PY=.venv/Scripts/python
(cd engine/backend && ../../$PY -m pytest -q -p no:cacheprovider 2>&1 | tail -1)
(cd engine/backend && ../../.venv/Scripts/ruff check . && ../../.venv/Scripts/mypy simcore api cli | tail -1)
.venv/Scripts/sim validate scenarios/tianbao_751 | head -1
$PY tools/content_lint.py | tail -1
echo "verify: OK"
