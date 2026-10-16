#!/usr/bin/env bash
# play one season: $1=turn label, $2=adopted json, $3=ops json (optional), $4=cards json (optional); prints facts + next compact briefing
set -o pipefail
G="C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/$SP_GAME"
bash "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/sp.sh" turn "$S" "$2" "${3:-[]}" "${4:-[]}" > "$G/t$1_turn.md"
rc=$?
grep -E "^\d*[0-9]+\. \[rejected|^# 已结算|^## 触发事件|^## 危机计|终局|^## 战报" "$G/t$1_turn.md"
sed -n '/^## 事实/,/^## 对账/p' "$G/t$1_turn.md" | grep -vE "^## " | head -40
[ $rc -ne 0 ] && { echo "turn failed rc=$rc"; tail -20 "$G/t$1_turn.md"; exit $rc; }
bash "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/sp.sh" brief "$S" > "$G/brief_next.md"
echo "=================== NEXT ==================="
PYTHONUTF8=1 "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/.venv/Scripts/python" "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/brief.py" < "$G/brief_next.md" | grep -vE "^## (目标|养兵|官职|政令卡|可召对|扮演)"
