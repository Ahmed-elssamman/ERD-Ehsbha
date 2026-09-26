import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { openSessionSchema, sessionPageSchema, sessionSchema, workSessionHistorySchema, dailyAnalyticsSchema } from '@ehsbha/api-contracts';
import { draftAccount, draftApiBase as base, draftLogin } from './record-draft-fixtures';

test.use({ viewport: { width: 360, height: 800 }, timezoneId: 'America/Los_Angeles' });

test('work start and end keep their intended times after lost responses and reloads', async ({ page, request }) => {
  const user = await draftAccount(request);
  const empty = await request.get(`${base}/sessions/open`, { headers: user.headers });
  expect(z.object({ data: openSessionSchema }).parse(await empty.json()).data.session).toBeNull();
  await draftLogin(page, user); await page.goto('/work-sessions');
  await expect(page.getByText('No work session is open.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start work', exact: true }).click();
  await page.locator('#work-start').fill('2026-09-16T17:00');
  const starts: string[] = [], ends: string[] = [];
  await page.route('**/api/v1/sessions/start', async (route) => {
    const response = await route.fetch(); expect(response.status()).toBe(201);
    starts.push(route.request().postData() ?? '');
    if (starts.length === 1) await route.abort('failed'); else await route.fulfill({ response });
  });
  await expect(page.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
  await expect(page.locator('#work-start')).toBeFocused();
  await page.getByRole('dialog').getByRole('button', { name: 'Start work', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Retry saved request', exact: true })).toBeEnabled();
  await expect(page.locator('#work-start')).toBeDisabled();
  await page.reload(); await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#work-start')).toBeDisabled();
  await page.getByRole('button', { name: 'Retry saved request', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(starts).toHaveLength(2); expect(starts[1]).toBe(starts[0]);
  await page.getByRole('button', { name: 'End work', exact: true }).click();
  await page.locator('#work-end').fill('2026-09-16T17:30');
  await page.route('**/api/v1/sessions/*/end', async (route) => {
    const response = await route.fetch(); expect(response.status()).toBe(201);
    ends.push(route.request().postData() ?? '');
    if (ends.length === 1) await route.abort('failed'); else await route.fulfill({ response });
  });
  await page.getByRole('dialog').getByRole('button', { name: 'End work', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saved request', exact: true })).toBeEnabled();
  await page.reload(); await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Retry saved request', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('No work session is open.', { exact: true })).toBeVisible();
  expect(ends).toHaveLength(2); expect(ends[1]).toBe(ends[0]);
  const response = await request.get(`${base}/sessions`, { headers: user.headers });
  const records = z.object({ data: sessionPageSchema }).parse(await response.json()).data.items;
  expect(records).toHaveLength(1); expect(records[0]).toMatchObject({ driverAppId: null, version: 2, activeMinutes: 30, startedAt: '2026-09-16T14:00:00.000Z', endedAt: '2026-09-16T14:30:00.000Z' });
  const history = await request.get(`${base}/sessions/${records[0].id}/history`, { headers: user.headers });
  expect(z.object({ data: workSessionHistorySchema }).parse(await history.json()).data.items).toHaveLength(2);
});

test('Arabic work-time correction, deletion, restoration, and history fit a 320px screen', async ({ page, request }) => {
  const user = await draftAccount(request); await page.setViewportSize({ width: 320, height: 760 });
  await draftLogin(page, user, 'ar'); await page.goto('/work-sessions');
  await page.getByRole('button', { name: 'إضافة فترة لم تُسجّل', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'إضافة فترة لم تُسجّل', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('راجع وقتَي البداية والانتهاء');
  await page.locator('#work-start').fill('2026-09-15T23:00'); await page.locator('#work-end').fill('2026-09-16T01:00');
  await page.getByRole('dialog').getByRole('button', { name: 'إضافة فترة لم تُسجّل', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByTestId('work-session-record')).toHaveCount(1);
  for (const date of ['2026-09-15', '2026-09-16']) {
    const response = await request.get(`${base}/analytics/daily?date=${date}`, { headers: user.headers });
    expect(z.object({ data: dailyAnalyticsSchema }).parse(await response.json()).data.onlineMinutes).toBe(60);
  }
  await page.getByRole('button', { name: 'تصحيح الأوقات', exact: true }).click();
  await page.locator('#work-end').fill('2026-09-16T02:00');
  await page.getByRole('dialog').getByRole('button', { name: 'تصحيح الأوقات', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'حذف الفترة', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'حذف الفترة', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByTestId('work-session-record')).toHaveCount(0);
  await page.getByRole('button', { name: 'السجلات المحذوفة', exact: true }).click();
  await page.getByRole('button', { name: 'استعادة الفترة', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'استعادة الفترة', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'السجلات الحالية', exact: true }).click();
  await page.getByRole('button', { name: 'سجل التعديلات', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('صُحّحت الأوقات');
  await expect(page.getByRole('dialog')).toContainText('استُعيدت الفترة');
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.screenshot({ path: 'verification-output/work-session-ar-320.png', fullPage: true });
});

test('a reviewed session version cannot overwrite a newer correction', async ({ page, request }) => {
  const user = await draftAccount(request);
  const response = await request.post(`${base}/sessions`, { headers: user.headers, data: { clientMutationId: randomUUID(), startedAt: '2026-09-15T08:00:00Z', endedAt: '2026-09-15T10:00:00Z' } });
  const record = z.object({ data: sessionSchema }).parse(await response.json()).data;
  await draftLogin(page, user); await page.goto('/work-sessions');
  await page.getByRole('button', { name: 'Correct times', exact: true }).click();
  await page.locator('#work-end').fill('2026-09-15T14:00');
  const changed = await request.patch(`${base}/sessions/${record.id}`, { headers: user.headers, data: { clientMutationId: randomUUID(), expectedVersion: 1, startedAt: record.startedAt, endedAt: '2026-09-15T12:00:00Z' } });
  expect(changed.status()).toBe(200);
  await page.getByRole('dialog').getByRole('button', { name: 'Correct times', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This session changed elsewhere');
  const current = await request.get(`${base}/sessions/${record.id}`, { headers: user.headers });
  expect(z.object({ data: sessionSchema }).parse(await current.json()).data).toMatchObject({ version: 2, endedAt: '2026-09-15T12:00:00.000Z' });
});

test('abandoned sessions require actual end times and storage failure prevents untracked work', async ({ page, request }) => {
  const user = await draftAccount(request);
  await request.post(`${base}/sessions/start`, { headers: user.headers, data: { clientMutationId: randomUUID(), startedAt: '2026-08-01T08:00:00Z' } });
  await draftLogin(page, user); await page.goto('/work-sessions');
  await expect(page.getByText(/open for more than seven days/)).toBeVisible();
  await page.getByRole('button', { name: 'End work', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'End work', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('within seven days');
  await page.locator('#work-end').fill('2026-08-01T13:00');
  await page.getByRole('dialog').getByRole('button', { name: 'End work', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => { IDBFactory.prototype.open = function () { throw new DOMException('Unavailable', 'SecurityError'); }; });
  await page.getByRole('button', { name: 'Start work', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('device');
  const open = await request.get(`${base}/sessions/open`, { headers: user.headers });
  expect(z.object({ data: openSessionSchema }).parse(await open.json()).data.session).toBeNull();
});

test('an offline start remains an explicit pending command and recovers with its original time', async ({ page, request }) => {
  const user = await draftAccount(request); await draftLogin(page, user);
  await page.route('**/api/v1/sessions/open', (route) => route.abort('failed'));
  await page.route('**/api/v1/sessions/start', (route) => route.abort('failed'));
  await page.goto('/work-sessions');
  await page.getByRole('button', { name: 'Start work', exact: true }).click();
  await page.locator('#work-start').fill('2026-09-16T17:00');
  await page.getByRole('dialog').getByRole('button', { name: 'Start work', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saved request', exact: true })).toBeEnabled();
  await page.unroute('**/api/v1/sessions/open'); await page.unroute('**/api/v1/sessions/start');
  await page.reload();
  const before = await request.get(`${base}/sessions/open`, { headers: user.headers });
  expect(z.object({ data: openSessionSchema }).parse(await before.json()).data.session).toBeNull();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Retry saved request', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await request.get(`${base}/sessions/open`, { headers: user.headers });
  expect(z.object({ data: openSessionSchema }).parse(await after.json()).data.session?.startedAt).toBe('2026-09-16T14:00:00.000Z');
});
