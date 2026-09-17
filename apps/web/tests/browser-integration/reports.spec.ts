import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { reportRecordSchema, reportPageSchema, reportPreferencesSchema, notificationsListSchema } from '@ehsbha/api-contracts';
import { draftAccount, draftApiBase as base, draftLogin } from './record-draft-fixtures';

test.use({ viewport: { width: 360, height: 800 }, timezoneId: 'America/Los_Angeles' });

test('empty reports distinguish failed loads and validate completed periods and quiet hours', async ({ page, request }) => {
  const user = await draftAccount(request); await draftLogin(page, user); await page.goto('/reports');
  await expect(page.getByText('No saved reports yet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create or open report', exact: true }).click();
  await page.locator('#report-date').fill('2099-01-01');
  await page.getByRole('dialog').getByRole('button', { name: 'Create or open report', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('still in progress in Cairo');
  await page.locator('#report-date').fill('2026-08-01');
  await page.getByRole('dialog').getByRole('button', { name: 'Create or open report', exact: true }).click();
  await expect(page.getByText('No recorded financial or work activity was found for this period. This does not mean you did not work.', { exact: true })).toBeVisible();
  await page.goto('/reports'); await page.getByRole('button', { name: 'Change report delivery', exact: true }).click();
  await page.locator('#deliveryTime').fill('23:00');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('outside quiet hours');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('ehsbha.rq.account.')) localStorage.removeItem(key); });
  await page.route('**/api/v1/reports', (route) => route.abort('internetdisconnected'));
  await page.reload(); await expect(page.getByRole('alert')).toContainText('report list could not be refreshed');
  await expect(page.getByText('No saved reports yet', { exact: true })).toHaveCount(0);
});

test('saved report creation survives a lost response and revisions preserve prior amounts', async ({ page, request }) => {
  const user = await draftAccount(request);
  const expense = await request.post(`${base}/expenses`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() }, data: { category: 'OTHER', amountPiastres: 1234, dateTime: '2026-09-01T09:00:00Z', clientMutationId: randomUUID() } });
  expect(expense.status()).toBe(201);
  await draftLogin(page, user); await page.goto('/reports');
  await page.getByRole('button', { name: 'Create or open report', exact: true }).click();
  await page.locator('#report-date').fill('2026-09-01');
  const bodies: string[] = [];
  await page.route('**/api/v1/reports', async (route) => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    const response = await route.fetch();
    if (response.status() === 401) { await route.fulfill({ response }); return; }
    expect(response.status()).toBe(201); bodies.push(route.request().postData() ?? '');
    if (bodies.length === 1) await route.abort('failed'); else await route.fulfill({ response });
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Create or open report', exact: true }).click();
  await expect(page.locator('#report-date')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Retry saved request', exact: true })).toBeEnabled();
  await page.reload(); await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Retry saved request', exact: true }).click();
  await expect(page).toHaveURL(/\/reports\/[^/]+\/revisions\/1$/); expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0]);
  const listing = await request.get(`${base}/reports`, { headers: user.headers }), rows = z.object({ data: reportPageSchema }).parse(await listing.json()).data.items;
  expect(rows).toHaveLength(1); const id = rows[0].id;
  await expect(page.getByRole('heading', { name: 'Income, costs and work', exact: true })).toBeVisible();
  const old = await request.get(`${base}/reports/${id}/revisions/1`, { headers: user.headers });
  expect(z.object({ data: reportRecordSchema }).parse(await old.json()).data.content.totals.netPiastres).toBe(-1234);
  const extra = await request.post(`${base}/expenses`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() }, data: { category: 'OTHER', amountPiastres: 500, dateTime: '2026-09-02T09:00:00Z', clientMutationId: randomUUID() } });
  expect(extra.status()).toBe(201);
  await page.getByRole('button', { name: 'Save a new version', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save a new version', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/reports/${id}/revisions/2$`));
  const latest = await request.get(`${base}/reports/${id}`, { headers: user.headers });
  expect(z.object({ data: reportRecordSchema }).parse(await latest.json()).data.content.totals.netPiastres).toBe(-1734);
  const unchanged = await request.get(`${base}/reports/${id}/revisions/1`, { headers: user.headers });
  expect(z.object({ data: reportRecordSchema }).parse(await unchanged.json()).data.content.totals.netPiastres).toBe(-1234);
  await page.getByRole('button', { name: 'Show version history', exact: true }).click();
  await expect(page.getByRole('link', { name: /^Version 1/ })).toBeVisible();
  const foreign = await draftAccount(request);
  expect((await request.get(`${base}/reports/${id}`, { headers: foreign.headers })).status()).toBe(404);
  expect((await request.get(`${base}/reports/${id}/revisions/1`, { headers: foreign.headers })).status()).toBe(404);
  expect((await request.post(`${base}/reports/${id}/revisions`, { headers: foreign.headers, data: { expectedVersion: 2, clientMutationId: randomUUID() } })).status()).toBe(404);
});

test('report preferences retain an offline request and do not overwrite a newer setting', async ({ page, request }) => {
  const user = await draftAccount(request); await draftLogin(page, user); await page.goto('/reports');
  await page.getByRole('button', { name: 'Change report delivery', exact: true }).click();
  await page.locator('#deliveryTime').fill('10:15');
  await page.route('**/api/v1/reports/preferences', (route) => route.request().method() === 'PATCH' ? route.abort('internetdisconnected') : route.continue());
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saved settings', exact: true })).toBeEnabled();
  await page.reload(); await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#deliveryTime')).toHaveValue('10:15');
  const read = await request.get(`${base}/reports/preferences`, { headers: user.headers });
  const { version, ...fields } = z.object({ data: reportPreferencesSchema }).parse(await read.json()).data;
  expect((await request.patch(`${base}/reports/preferences`, { headers: user.headers, data: { ...fields, weeklyEnabled: false, expectedVersion: version, clientMutationId: randomUUID() } })).status()).toBe(200);
  await page.unroute('**/api/v1/reports/preferences');
  await page.getByRole('button', { name: 'Retry saved settings', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Report delivery settings changed elsewhere');
  const after = await request.get(`${base}/reports/preferences`, { headers: user.headers });
  expect(z.object({ data: reportPreferencesSchema }).parse(await after.json()).data).toMatchObject({ version: 1, weeklyEnabled: false, deliveryMinute: 540 });
});

test('automatic report notice opens its exact version in Arabic at 320px and cached content survives a network failure', async ({ page, request }) => {
  const user = await draftAccount(request);
  expect((await request.post(`${base}/expenses`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() }, data: { category: 'OTHER', vehicleId: user.vehicle.id, amountPiastres: 2000, dateTime: '2026-08-03T09:00:00Z', clientMutationId: randomUUID() } })).status()).toBe(201);
  const response = await request.post(`${base}/reports`, { headers: user.headers, data: { period: 'MONTHLY', date: '2026-08-03', clientMutationId: randomUUID() } });
  expect(response.status()).toBe(201); const saved = z.object({ data: reportRecordSchema }).parse(await response.json()).data;
  execFileSync(process.execPath, ['-r', 'ts-node/register', 'apps/api/scripts/browser-report-delivery.ts', saved.id], { env: { ...process.env, TS_NODE_PROJECT: 'apps/api/tsconfig.json' }, timeout: 30000, stdio: 'pipe' });
  const notifications = await request.get(`${base}/notifications`, { headers: user.headers });
  expect(z.object({ data: notificationsListSchema }).parse(await notifications.json()).data.items.some((item) => item.data?.kind === 'REPORT_READY')).toBe(true);
  expect((await request.post(`${base}/reports/${saved.id}/revisions`, { headers: user.headers, data: { expectedVersion: 1, clientMutationId: randomUUID() } })).status()).toBe(201);
  await page.setViewportSize({ width: 320, height: 780 }); await draftLogin(page, user, 'ar'); await page.goto('/notifications');
  await page.getByRole('link', { name: 'افتح التقرير المحفوظ', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/reports/${saved.id}/revisions/1$`));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'تقرير شهري', exact: true })).toBeVisible();
  await expect(page.getByText('مفيش إجابات عافية مسجلة للفترة دي متاحة حاليًا على الجهاز ده.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'verification-output/report-ar-320.png', fullPage: true });
  await page.route('**/api/v1/reports/**', (route) => route.abort('internetdisconnected'));
  await page.reload(); await expect(page.getByRole('heading', { name: 'تقرير شهري', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('النسخة المحفوظة متاحة');
});
