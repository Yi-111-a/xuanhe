#!/usr/bin/env bash
# choose.sh "<choice-id-suffix> <option>" ...  (choice id without the 'choice-' prefix)
set -o pipefail
for c in "$@"; do set -- $c; bash "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/sp.sh" call choose "{\"session_id\":\"$S\",\"choice_id\":\"choice-$1\",\"option_id\":\"$2\"}" | head -1 | PYTHONUTF8=1 "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/.venv/Scripts/python" -c "import sys; print(sys.stdin.read()[:40])"; done
