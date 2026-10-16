// Runs the Playwright suites in ../tests/e2e (tests/node_modules is a junction to app/node_modules,
// created by link-test-deps.mjs, so the specs resolve @playwright/test).
//   npm run test:e2e                 → mock backend (Vite dev server, VITE_MOCK=1)
//   E2E_API_BASE=http://127.0.0.1:8765 npm run test:e2e:real   → against a running engine
//   extra args are passed through, e.g. npm run test:e2e -- --grep @screens
import { spawnSync } from 'node:child_process';
import './link-test-deps.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..');
const args = process.argv.slice(2);
const env = { ...process.env };
if (args[0] === '--real') {
  args.shift();
  if (!env.E2E_API_BASE) env.E2E_API_BASE = 'http://127.0.0.1:8765';
}
const cli = path.join(app, 'node_modules', '@playwright', 'test', 'cli.js');
const result = spawnSync(process.execPath, [cli, 'test', '-c', path.join(app, 'playwright.config.ts'), ...args], {
  stdio: 'inherit',
  cwd: app,
  env,
});
process.exit(result.status ?? 1);
