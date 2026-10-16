#!/usr/bin/env bash
# terse season: $1=label $2=adopted $3=ops $4=cards; prints rejected clauses, events, key state and next memorials/options/choices
set -o pipefail
G="C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/$SP_GAME"
bash "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/sp.sh" turn "$S" "$2" "${3:-[]}" "${4:-[]}" > "$G/t$1_turn.md"
rc=$?
grep -E "^[0-9]+\. \[rejected|^# 已结算|^## 触发事件|^## 危机计|终局|结局|outcome" "$G/t$1_turn.md" | head -12
[ $rc -ne 0 ] && { echo "turn failed rc=$rc"; tail -20 "$G/t$1_turn.md"; exit $rc; }
bash "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/sp.sh" brief "$S" > "$G/brief_next.md"
PYTHONUTF8=1 "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/.venv/Scripts/python" "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/brief.py" < "$G/brief_next.md" | grep -E "^### |^    |^- (国库|粮储|君威|民心|佞幸|东南|武备|辽祚|金人|胡马)|^## 待决|choice-" 
