#!/usr/bin/env bash
# terser season: events + new memorials (id + options only) + pending choices; full text saved
set -o pipefail
G="C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/$SP_GAME"
bash "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/sp.sh" turn "$S" "$2" "${3:-[]}" "${4:-[]}" > "$G/t$1_turn.md"
rc=$?
grep -E "^[0-9]+\. \[rejected|结算毕|^## 触发事件|^## 终局" "$G/t$1_turn.md" | head -6
[ $rc -ne 0 ] && { echo "turn failed rc=$rc"; tail -20 "$G/t$1_turn.md"; exit $rc; }
bash "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/playtests/self/sp.sh" brief "$S" > "$G/brief_next.md"
PYTHONUTF8=1 "C:/Users/yiyin/Desktop/新建文件夹/xuanhe/.venv/Scripts/python" - "$G/brief_next.md" <<'PY'
import re,sys
t=open(sys.argv[1],encoding='utf-8').read()
m=re.search(r'^- 国库 ([\d.]+).*?^- 武备 ([\d.]+)',t,re.S|re.M)
st={k:re.search(rf'^- {k} ([\d.]+)',t,re.M) for k in ['国库','君威','民心','佞幸用事','武备','辽祚']}
print('  '.join(f"{k}{v.group(1)}" for k,v in st.items() if v), '|', (re.search(r'^## 危机计：(.*)$',t,re.M) or [None,''])[1])
for mm in re.finditer(r'^### \[(\S+)\] (\S+)',t,re.M):
    blk=t[mm.end():t.find('\n### ',mm.end()) if t.find('\n### ',mm.end())>0 else t.find('\n## ',mm.end())]
    opts=re.findall(r'^- 选项 `([\w-]+)`「([^」]*)」',blk,re.M)
    print(f"[{mm.group(1)}] {mm.group(2)} :: "+' | '.join(f"{a}={b[:14]}" for a,b in opts))
for c in re.findall(r'^- \[(choice-[\w-]+)\] ([^：]+)：.*?选项：(.*?)。默认',t,re.M):
    print('CHOICE',c[0],c[1],re.findall(r'`(\w+)`「([^」]*)」',c[2]))
PY
