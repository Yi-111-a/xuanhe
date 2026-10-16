// tests/e2e lives outside app/; give it access to app/node_modules through a directory
// junction at tests/node_modules (works on Windows without admin rights, symlink elsewhere).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, '..', 'node_modules');
const link = path.resolve(here, '..', '..', 'tests', 'node_modules');
let exists = false;
try {
  const st = fs.lstatSync(link);
  exists = st.isSymbolicLink() || st.isDirectory();
} catch {
  exists = false;
}
if (!exists && fs.existsSync(target)) {
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  console.log(`linked ${link} -> ${target}`);
}
