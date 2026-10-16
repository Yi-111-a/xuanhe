import { defineConfig, devices } from '@playwright/test';

// Mock mode (default): Vite dev server with VITE_MOCK=1 on :5174.
// Real backend: set E2E_API_BASE=http://127.0.0.1:8765 (engine must be running);
// the app is served without the mock and talks to that engine.
const real = process.env.E2E_API_BASE;
const port = Number(process.env.E2E_PORT ?? (real ? 5175 : 5174));

export default defineConfig({
  testDir: '../tests/e2e',
  outputDir: './test-results',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-CN',
    trace: 'retain-on-failure',
    actionTimeout: 8_000,
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  },
  webServer: {
    command: real ? `npx vite --port ${port} --strictPort` : `npx vite --mode mock --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: Boolean(process.env.E2E_PORT),
    timeout: 120_000,
    env: real ? { VITE_API_BASE: real, VITE_MOCK: '0' } : { VITE_MOCK: '1' },
  },
  metadata: { mode: real ? `real:${real}` : 'mock' },
});
