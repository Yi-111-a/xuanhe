"""Compact view of a briefing for self-play: state, crisis, memorials (ids, options), pending choices, replies."""
import re, sys
text = sys.stdin.read()
keep = False
for line in text.splitlines():
    if line.startswith('## '):
        keep = any(k in line for k in ('国势', '危机计', '本季奏疏', '待决', '回奏', '上季', '本季新出', '军情', '敌情'))
        print(line); continue
    if not keep:
        continue
    if line.startswith('- 谏言'):
        continue
    if line.startswith('### ['):
        print(line); continue
    if line.startswith('- 选项'):
        m = re.match(r'- 选项 `([\w-]+)`「([^」]*)」 〔([^〕]*)〕', line)
        print('   ', m.group(1), m.group(2), '|', m.group(3)[:150] if m else line[:200]) if m else print('   ', line[:220]); continue
    if line.startswith('- ') or line.startswith('  - '):
        print(line[:220])
