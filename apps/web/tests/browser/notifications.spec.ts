import { expect, test } from '@playwright/test';
import { browserDriver, responseEnvelope } from './ocr-fixtures';

test('inbox retries failed reads and pages without presenting failures as empty', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('ehsbha.auth', JSON.stringify({ state: { user, refreshToken: 'test-browser-session' }, version: 0 }));
    localStorage.setItem('ehsbha.locale', 'en');
  }, browserDriver);
  let initialFailure = true, moreFailure = true, readFailure = true;
  const records = Array.from({ length: 26 }, (_, index) => ({ id: `notification-${index}`, kind: 'GENERAL', channel: 'INAPP', title: `Recorded update ${index + 1}`,
    body: 'Recorded inbox content', data: null, sentAt: '2026-09-17T08:00:00Z', readAt: null as string | null }));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url()), path = url.pathname;
    const fail = () => route.fulfill({ status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' }, meta: responseEnvelope({}).meta } });
    if (path.endsWith('/auth/refresh')) await route.fulfill({ json: responseEnvelope({ user: browserDriver, accessToken: 'test-browser-access', refreshToken: 'test-browser-session' }) });
    else if (path.endsWith('/notifications/preferences')) await route.fulfill({ json: responseEnvelope({ digestEnabled: true, digestFrequency: 'DAILY', deliveryMinute: 510, quietEnabled: true, quietStartMinute: 1380, quietEndMinute: 420, version: 0 }) });
    else if (path.endsWith('/notifications')) {
      if (initialFailure || (url.searchParams.has('cursor') && moreFailure)) { await fail(); return; }
      await route.fulfill({ json: responseEnvelope({ items: url.searchParams.has('cursor') ? records.slice(25) : records.slice(0, 25), nextCursor: url.searchParams.has('cursor') ? null : 'next-page' }) });
    } else if (path.endsWith('/read')) {
      const record = records.find((item) => path.endsWith(`/${item.id}/read`));
      if (!record || (record.id === 'notification-0' && readFailure)) { await fail(); return; }
      record.readAt = '2026-09-17T09:00:00Z'; await route.fulfill({ json: responseEnvelope(record) });
    } else await route.fulfill({ json: responseEnvelope([]) });
  });
  await page.goto('/notifications'); await expect(page.getByRole('alert')).toContainText('inbox could not refresh');
  await expect(page.getByText('No notifications yet', { exact: true })).toHaveCount(0);
  initialFailure = false; await page.getByRole('alert').getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Recorded update 25', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load more notifications', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('next page could not load');
  moreFailure = false; await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Recorded update 26', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark displayed as read (26)', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Some read updates could not be confirmed');
  await expect(page.getByRole('button', { name: 'Mark as read', exact: true })).toHaveCount(1);
  readFailure = false; await page.getByRole('button', { name: 'Mark as read', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark as read', exact: true })).toHaveCount(0);
});
