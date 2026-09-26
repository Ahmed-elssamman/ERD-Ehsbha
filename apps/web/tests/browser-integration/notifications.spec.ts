import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { businessDate } from '@ehsbha/shared-types';
import { notificationPreferencesSchema, notificationsListSchema } from '@ehsbha/api-contracts';
import { draftAccount, draftApiBase as base, draftLogin } from './record-draft-fixtures';

test.use({ viewport: { width: 360, height: 800 }, timezoneId: 'America/Los_Angeles' });

test('delivery settings retry the same saved body after a lost reply and reload', async ({ page, request }) => {
  const user = await draftAccount(request); await draftLogin(page, user); await page.goto('/notifications');
  await page.getByRole('button', { name: 'Edit delivery settings', exact: true }).click();
  await page.getByLabel('Send automatic work digests', { exact: true }).uncheck();
  await page.getByLabel('Frequency', { exact: true }).selectOption('WEEKLY');
  const bodies: string[] = [];
  await page.route('**/api/v1/notifications/preferences', async (route) => {
    if (route.request().method() !== 'PATCH') { await route.continue(); return; }
    const response = await route.fetch();
    if (response.status() === 401) { await route.fulfill({ response }); return; }
    bodies.push(route.request().postData() ?? ''); expect(response.status()).toBe(200);
    if (bodies.length === 1) await route.abort('failed'); else await route.fulfill({ response });
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saved request', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Frequency', { exact: true })).toBeDisabled();
  await page.reload(); await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Retry saved request', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0]);
  const response = await request.get(`${base}/notifications/preferences`, { headers: user.headers });
  expect(z.object({ data: notificationPreferencesSchema }).parse(await response.json()).data).toMatchObject({ version: 1, digestEnabled: false, digestFrequency: 'WEEKLY' });
  await expect(page.getByText('Automatic digests are off.', { exact: true })).toBeVisible();
});

test('offline delivery edits survive reload and stale versions cannot overwrite saved settings', async ({ page, request }) => {
  const user = await draftAccount(request); await draftLogin(page, user); await page.goto('/notifications');
  await page.getByRole('button', { name: 'Edit delivery settings', exact: true }).click();
  await page.locator('#deliveryTime').fill('10:15');
  await page.route('**/api/v1/notifications/preferences', (route) => route.request().method() === 'PATCH' ? route.abort('internetdisconnected') : route.continue());
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saved request', exact: true })).toBeEnabled();
  await page.reload(); await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#deliveryTime')).toHaveValue('10:15');
  const read = await request.get(`${base}/notifications/preferences`, { headers: user.headers });
  const saved = z.object({ data: notificationPreferencesSchema }).parse(await read.json()).data;
  const { version, ...fields } = saved;
  const changed = await request.patch(`${base}/notifications/preferences`, { headers: user.headers, data: { ...fields, deliveryMinute: 660, expectedVersion: version, clientMutationId: randomUUID() } });
  expect(changed.status()).toBe(200);
  await page.unroute('**/api/v1/notifications/preferences');
  await page.getByRole('button', { name: 'Retry saved request', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Delivery settings changed elsewhere');
  const after = await request.get(`${base}/notifications/preferences`, { headers: user.headers });
  expect(z.object({ data: notificationPreferencesSchema }).parse(await after.json()).data).toMatchObject({ version: 1, deliveryMinute: 660 });
});

test('digest is one saved snapshot per day, distinguishes missing history, and renders in Arabic at 320px', async ({ page, request }) => {
  const user = await draftAccount(request); await draftLogin(page, user); await page.goto('/notifications');
  await page.getByRole('button', { name: 'Get today’s digest', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not enough recorded history');
  const start = businessDate(new Date()), end = new Date(start); end.setUTCDate(end.getUTCDate() + 29);
  const goal = await request.post(`${base}/goals`, { headers: user.headers, data: { period: 'MONTHLY', targetPiastres: 900000, startsOn: start.toISOString(), endsOn: end.toISOString() } });
  expect(goal.status()).toBe(201);
  await page.getByRole('button', { name: 'Get today’s digest', exact: true }).click();
  await expect(page.getByText('Daily share of the remaining goal, calculated before today', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Get today’s digest', exact: true }).click();
  await expect(page.getByText('Today’s saved digest is available in your inbox.', { exact: true })).toBeVisible();
  const response = await request.get(`${base}/notifications`, { headers: user.headers });
  expect(z.object({ data: notificationsListSchema }).parse(await response.json()).data.items).toHaveLength(1);
  await page.getByRole('button', { name: 'Mark as read', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark as read', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 780 }); await page.evaluate(() => localStorage.setItem('ehsbha.locale', 'ar')); await page.reload();
  await expect(page.getByText('ملخص شغلك', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'تعديل إعدادات الوصول', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'verification-output/notifications-ar-320.png', fullPage: true });
});
