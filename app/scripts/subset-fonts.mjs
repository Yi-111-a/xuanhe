// Wrapper so `npm run fonts` regenerates the font subsets with the shared venv's fonttools.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const candidates = [
  path.join(root, '.venv', 'Scripts', 'python.exe'),
  path.join(root, '.venv', 'bin', 'python'),
  'python3',
  'python',
];
const python = candidates.find((p) => !p.includes(path.sep) || existsSync(p));
const result = spawnSync(python, ['-X', 'utf8', path.join(here, 'subset_fonts.py')], {
  stdio: 'inherit',
  cwd: path.resolve(here, '..'),
});
process.exit(result.status ?? 1);
