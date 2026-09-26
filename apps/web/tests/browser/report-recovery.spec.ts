import { test, expect } from '@playwright/test';
import { browserDriver, responseEnvelope } from './ocr-fixtures';

test('Arabic reporting errors remain distinct from empty reports and offer retry', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('ehsbha.auth', JSON.stringify({ state: { user, refreshToken: 'test-browser-session' }, version: 0 }));
    localStorage.setItem('ehsbha.locale', 'ar');
  }, browserDriver);
  let attempts = 0;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/refresh')) {
      await route.fulfill({ json: responseEnvelope({ user: browserDriver, accessToken: 'test-browser-access', refreshToken: 'test-browser-session' }) });
    } else if (path.endsWith('/analytics/today')) {
      attempts += 1;
      await route.fulfill({ status: 503, json: {
        error: { code: 'REPORTING_CALENDAR_PENDING', message: 'Calendar update pending' },
        meta: responseEnvelope({}).meta,
      } });
    } else await route.fulfill({ json: responseEnvelope([]) });
  });
  await page.goto('/analytics');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('القاهرة');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const prior = attempts;
  await alert.getByRole('button').click();
  await expect.poll(() => attempts).toBeGreaterThan(prior);
  await expect(page.getByText('لا توجد بيانات لهذه الفترة', { exact: false })).toHaveCount(0);
});
