import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/tests/browser-integration',
  outputDir: './verification-output/browser-integration-results',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['json', { outputFile: 'verification-output/browser-integration-report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5188', browserName: 'chromium', serviceWorkers: 'block',
    screenshot: 'only-on-failure', trace: 'off', reducedMotion: 'reduce', timezoneId: 'Africa/Cairo',
  },
  webServer: [
    {
      command: 'node -r ts-node/register apps/api/scripts/browser-ocr-server.ts',
      url: 'http://127.0.0.1:55443/api/v1/health', reuseExistingServer: false, timeout: 60_000,
      env: { TS_NODE_PROJECT: 'apps/api/tsconfig.json' },
    },
    {
      command: 'npm --workspace @ehsbha/web run dev -- --host 127.0.0.1 --port 5188 --strictPort',
      url: 'http://127.0.0.1:5188', reuseExistingServer: false, timeout: 60_000,
      env: { VITE_API_URL: 'http://127.0.0.1:55443/api/v1' },
    },
  ],
});
