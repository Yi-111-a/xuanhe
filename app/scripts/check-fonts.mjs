// Fast pre-build check: every CJK character in app/src and scenarios/tianbao_751 must be in the
// bundled font subset. If not (scenario text changed), regenerate the subset automatically.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..');
const root = path.resolve(app, '..');
const manifest = path.join(app, 'src', 'assets', 'fonts', 'subset-chars.json');
const CJK = /[㐀-鿿豈-﫿]/gu;

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(name).toLowerCase()) && name !== 'subset-chars.json') out.push(full);
  }
  return out;
}

function missing() {
  if (!fs.existsSync(manifest)) return ['(no subset yet)'];
  const body = new Set(JSON.parse(fs.readFileSync(manifest, 'utf-8')).body);
  const files = [
    ...walk(path.join(app, 'src'), ['.ts', '.tsx', '.css', '.html', '.json']),
    path.join(app, 'index.html'),
    ...walk(path.join(root, 'scenarios', 'tianbao_751'), ['.yaml', '.yml', '.md', '.json', '.txt']),
  ];
  const out = new Set();
  for (const f of files) for (const ch of fs.readFileSync(f, 'utf-8').match(CJK) ?? []) if (!body.has(ch)) out.add(ch);
  return [...out];
}

let gaps = missing();
if (gaps.length) {
  console.log(`font subset is missing ${gaps.length} chars (${gaps.join('')}); regenerating…`);
  const r = spawnSync(process.execPath, [path.join(here, 'subset-fonts.mjs')], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  gaps = missing();
}
if (gaps.length) {
  console.error(`font subset still lacks: ${gaps.join('')} (not present in the source fonts)`);
  process.exit(1);
}
console.log('font subset covers all UI and scenario text');
