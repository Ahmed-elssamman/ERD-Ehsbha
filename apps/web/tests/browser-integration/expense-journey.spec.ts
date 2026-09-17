import { randomInt, randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { z } from 'zod';
import { driverAuthResultSchema, driverVehicleSchema, driverAppBindingSchema, tripItemSchema,
  driverExpenseSchema, expensePageSchema, expenseSummarySchema, expenseHistorySchema, dailyAnalyticsSchema } from '@ehsbha/api-contracts';

const base = 'http://127.0.0.1:55443/api/v1';
test.use({ timezoneId: 'UTC', viewport: { width: 360, height: 800 } });

async function account(request: APIRequestContext) {
  const phone = `010${randomInt(10000000, 99999999)}`;
  const password = `expense-test-${randomUUID()}`;
  const response = await request.post(`${base}/auth/register`, { data: {
    phone: `+2${phone}`, email: `${phone}@example.test`, password, displayName: 'Expense journey', locale: 'en', timezone: 'Africa/Cairo',
  } });
  expect(response.status()).toBe(201);
  const auth = z.object({ data: driverAuthResultSchema }).parse(await response.json()).data;
  return { phone, password, headers: { Authorization: `Bearer ${auth.accessToken}` } };
}
async function login(page: Page, user: { phone: string; password: string }, locale: string) {
  await page.addInitScript((value) => localStorage.setItem('ehsbha.locale', value), locale);
  await page.goto('/login');
  await page.locator('#phone').fill(user.phone);
  await page.locator('#password').fill(user.password);
  await page.locator('button[type=submit]').click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto('/expenses');
  await page.locator('#expense-month').fill('2026-10');
}

test('complete monthly total, explicit fee link, lost-response retry, stale edit and history', async ({ page, request }) => {
  test.setTimeout(90_000);
  const user = await account(request);
  const vehicleResponse = await request.post(`${base}/vehicles`, { headers: user.headers, data: { type: 'CAR', fuelType: 'PETROL_92' } });
  const vehicle = z.object({ data: driverVehicleSchema }).parse(await vehicleResponse.json()).data;
  const appResponse = await request.post(`${base}/drivers/me/apps`, { headers: user.headers, data: { customName: 'Expense app', commissionPct: 0 } });
  const app = z.object({ data: driverAppBindingSchema }).parse(await appResponse.json()).data;
  const tripResponse = await request.post(`${base}/trips`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() }, data: {
    vehicleId: vehicle.id, driverAppId: app.id, startedAt: '2026-09-30T20:30:00Z', endedAt: '2026-09-30T20:50:00Z',
    earningsPiastres: 10000, tollPiastres: 1234, totalKmMeters: 10000, paidKmMeters: 8000,
  } });
  expect(tripResponse.status()).toBe(201);
  const trip = z.object({ data: tripItemSchema }).parse(await tripResponse.json()).data;
  for (let index = 0; index < 52; index++) {
    const response = await request.post(`${base}/expenses`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() },
      data: { category: 'PHONE', amountPiastres: 100, dateTime: '2026-10-01T08:00:00Z' } });
    expect(response.status()).toBe(201);
  }
  await login(page, user, 'en');
  await expect(page.getByTestId('expense-month-total')).toContainText('52.00');
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(25);
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(50);
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(52);
  await expect(page.getByRole('button', { name: 'Load more', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#category').selectOption('TOLL');
  await dialog.locator('#amountEgp').fill('12.34');
  await dialog.locator('#dateTime').fill('2026-10-02T11:00');
  await dialog.locator('#expense-trip-search-date').fill('2026-09-30');
  await dialog.getByRole('button', { name: 'Find matching fees' }).click();
  await dialog.getByRole('button', { name: 'Link this payment' }).click();
  await expect(dialog.locator('#amountEgp')).toHaveAttribute('readonly', '');
  let dropped = false;
  await page.route('**/api/v1/expenses', async (route) => {
    if (!dropped && route.request().method() === 'POST') {
      const saved = await route.fetch();
      expect(saved.status()).toBe(201);
      dropped = true;
      await route.abort('failed');
    } else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('The save result is not confirmed.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('expense-month-total')).toContainText('64.34');
  const summaryResponse = await request.get(`${base}/expenses/summary?from=2026-10-01&to=2026-10-31`, { headers: user.headers });
  const summary = z.object({ data: expenseSummarySchema }).parse(await summaryResponse.json()).data;
  expect(summary).toMatchObject({ recordCount: 53, linkedCount: 1, totalPiastres: 6434 });
  const dailyResponse = await request.get(`${base}/analytics/daily?date=2026-09-30`, { headers: user.headers });
  expect(z.object({ data: dailyAnalyticsSchema }).parse(await dailyResponse.json()).data).toMatchObject({ netProfitPiastres: 10000, expensePiastres: 0 });
  const listResponse = await request.get(`${base}/expenses`, { headers: user.headers });
  const expense = z.object({ data: expensePageSchema }).parse(await listResponse.json()).data.items.find((item) => item.linkedTripId === trip.id);
  expect(expense).toBeTruthy();
  if (!expense) throw new Error('Linked expense was not returned');
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await dialog.locator('#notes').fill('My pending correction');
  const updated = await request.patch(`${base}/expenses/${expense.id}`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() },
    data: { expectedVersion: expense.version, notes: 'Newer change from another device' } });
  expect(updated.status()).toBe(200);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('This expense changed after you opened it');
  await expect(dialog.locator('#notes')).toHaveValue('My pending correction');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await page.locator('#expense-month').fill('2026-10');
  await page.getByRole('button', { name: 'Change history', exact: true }).first().click();
  await expect(dialog.getByText('Version 2', { exact: false }).first()).toBeVisible();
  await expect(dialog.getByText('Newer change from another device')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Arabic deletion and restoration keep complete totals and show recoverable errors at 320px', async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const user = await account(request);
  const response = await request.post(`${base}/expenses`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() },
    data: { category: 'PHONE', amountPiastres: 2500, dateTime: '2026-10-01T08:00:00Z' } });
  expect(response.status()).toBe(201);
  let failSummary = true;
  await page.route('**/expenses/summary?**', async (route) => {
    if (failSummary) await route.abort('failed'); else await route.continue();
  });
  await login(page, user, 'ar');
  await expect(page.getByText('تعذر تحميل إجمالي الشهر بالكامل.', { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('expense-month-total')).toHaveCount(0);
  failSummary = false;
  await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
  await expect(page.getByTestId('expense-month-total')).toBeVisible();
  await page.getByRole('button', { name: 'حذف', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'حذف', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'المصروفات المحذوفة', exact: true }).click();
  await page.getByRole('button', { name: 'استعادة المصروف', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'استعادة المصروف', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'المصروفات النشطة', exact: true }).click();
  await expect(page.getByRole('button', { name: 'تعديل', exact: true })).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const summary = await request.get(`${base}/expenses/summary?from=2026-10-01&to=2026-10-31`, { headers: user.headers });
  expect(z.object({ data: expenseSummarySchema }).parse(await summary.json()).data.totalPiastres).toBe(2500);
});

test('expense retry fingerprints bind resource and deletion version while replaying the original result', async ({ request }) => {
  const user = await account(request);
  const create = async () => {
    const response = await request.post(`${base}/expenses`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() }, data: { category: 'PHONE', amountPiastres: 500, dateTime: '2026-10-01T08:00:00Z' } });
    expect(response.status()).toBe(201);
    return z.object({ data: driverExpenseSchema }).parse(await response.json()).data;
  };
  const first = await create();
  const second = await create();
  const headers = { ...user.headers, 'Idempotency-Key': randomUUID() };
  const data = { expectedVersion: 1, amountPiastres: 600 };
  const update = await request.patch(`${base}/expenses/${first.id}`, { headers, data });
  expect(update.status()).toBe(200);
  const replay = await request.patch(`${base}/expenses/${first.id}`, { headers, data });
  expect(replay.headers()['idempotency-replayed']).toBe('true');
  expect(z.object({ data: driverExpenseSchema }).parse(await replay.json()).data.version).toBe(2);
  expect((await request.patch(`${base}/expenses/${second.id}`, { headers, data })).status()).toBe(409);
  const deleteHeaders = { ...user.headers, 'Idempotency-Key': randomUUID() };
  expect((await request.delete(`${base}/expenses/${first.id}?expectedVersion=2`, { headers: deleteHeaders })).status()).toBe(200);
  const deletedReplay = await request.delete(`${base}/expenses/${first.id}?expectedVersion=2`, { headers: deleteHeaders });
  expect(deletedReplay.status()).toBe(200);
  expect(deletedReplay.headers()['idempotency-replayed']).toBe('true');
  expect((await request.delete(`${base}/expenses/${first.id}?expectedVersion=3`, { headers: deleteHeaders })).status()).toBe(409);
  expect((await request.delete(`${base}/expenses/${second.id}?expectedVersion=2`, { headers: deleteHeaders })).status()).toBe(409);
  const restoreHeaders = { ...user.headers, 'Idempotency-Key': randomUUID() };
  expect((await request.post(`${base}/expenses/${first.id}/restore`, { headers: restoreHeaders, data: { expectedVersion: 3 } })).status()).toBe(201);
  expect((await request.post(`${base}/expenses/${first.id}/restore`, { headers: restoreHeaders, data: { expectedVersion: 3 } })).status()).toBe(201);
  const history = await request.get(`${base}/expenses/${first.id}/history`, { headers: user.headers });
  expect(z.object({ data: expenseHistorySchema }).parse(await history.json()).data.items.map((row) => row.after.version)).toEqual([4, 3, 2, 1]);
});
