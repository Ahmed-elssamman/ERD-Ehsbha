import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/tests/browser',
  outputDir: './verification-output/browser-results',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: 'verification-output/browser-report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5187', browserName: 'chromium', serviceWorkers: 'block',
    screenshot: 'only-on-failure', trace: 'retain-on-failure', reducedMotion: 'reduce',
  },
  webServer: {
    command: 'npm --workspace @ehsbha/web run dev -- --host 127.0.0.1 --port 5187 --strictPort',
    url: 'http://127.0.0.1:5187', reuseExistingServer: false, timeout: 60_000,
    env: { VITE_API_URL: 'http://127.0.0.1:55441/api/v1' },
  },
});
