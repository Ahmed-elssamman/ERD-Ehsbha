import { randomInt, randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { z } from 'zod';
import { driverAuthResultSchema, driverVehicleSchema, fuelPageSchema, driverFuelEntrySchema, dailyAnalyticsSchema, fuelEfficiencySchema } from '@ehsbha/api-contracts';

const base = 'http://127.0.0.1:55443/api/v1';
test.use({ timezoneId: 'UTC', viewport: { width: 360, height: 800 } });
async function account(request: APIRequestContext) {
  const phone = `010${randomInt(10000000, 99999999)}`, password = `fuel-test-${randomUUID()}`;
  const response = await request.post(`${base}/auth/register`, { data: { phone: `+2${phone}`, email: `${phone}@example.test`, password,
    displayName: 'Fuel journey', locale: 'en', timezone: 'Africa/Cairo' } });
  expect(response.status()).toBe(201);
  const auth = z.object({ data: driverAuthResultSchema }).parse(await response.json()).data;
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  const created = await request.post(`${base}/vehicles`, { headers, data: { type: 'CAR', fuelType: 'PETROL_92', make: 'Test', model: 'Car' } });
  const vehicle = z.object({ data: driverVehicleSchema }).parse(await created.json()).data;
  return { phone, password, headers, vehicle };
}
async function login(page: Page, user: { phone: string; password: string }, locale: string) {
  await page.addInitScript((value) => localStorage.setItem('ehsbha.locale', value), locale);
  await page.goto('/login'); await page.locator('#phone').fill(user.phone); await page.locator('#password').fill(user.password);
  await page.locator('button[type=submit]').click(); await expect(page).not.toHaveURL(/\/login/); await page.goto('/fuel');
  await page.locator('#fuel-month').fill('2026-09');
}
test('fuel pages, independent receipt amount, explicit link, uncertain save and stale correction', async ({ page, request }) => {
  test.setTimeout(90_000);
  const user = await account(request);
  for (let index = 0; index < 52; index++) {
    const response = await request.post(`${base}/fuel`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() },
      data: { vehicleId: user.vehicle.id, dateTime: '2026-09-01T08:00:00Z', totalPiastres: 0 } });
    expect(response.status()).toBe(201);
  }
  const expense = await request.post(`${base}/expenses`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() },
    data: { category: 'OTHER', amountPiastres: 1234, dateTime: '2026-09-03T08:00:00Z', vehicleId: user.vehicle.id } });
  expect(expense.status()).toBe(201);
  await login(page, user, 'en');
  await expect(page.getByRole('article')).toHaveCount(25);
  await page.getByRole('button', { name: 'Load more', exact: true }).click(); await expect(page.getByRole('article')).toHaveCount(50);
  await page.getByRole('button', { name: 'Load more', exact: true }).click(); await expect(page.getByRole('article')).toHaveCount(52);
  await page.getByRole('button', { name: 'Add purchase', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('#fuel-totalEgp')).toHaveValue('');
  await expect(dialog.locator('#fuel-odometerKm')).toHaveValue('');
  await dialog.locator('#fuel-dateTime').fill('2026-09-02T23:30');
  await dialog.locator('#fuel-totalEgp').fill('12.34'); await dialog.locator('#fuel-quantity').fill('2'); await dialog.locator('#fuel-unitPriceEgp').fill('10');
  await expect(dialog.getByText('Quantity × unit price differs', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Find matching expense', exact: true }).click(); await dialog.getByRole('button', { name: /12\.34/ }).click();
  await expect(dialog.locator('#fuel-totalEgp')).toHaveAttribute('readonly', '');
  let dropped = false;
  await page.route('**/api/v1/fuel', async (route) => {
    if (!dropped && route.request().method() === 'POST') { const response = await route.fetch(); expect(response.status()).toBe(201); dropped = true; await route.abort('failed'); }
    else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('The server may have saved this purchase.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry same save', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const response = await request.get(`${base}/fuel?vehicleId=${user.vehicle.id}`, { headers: user.headers });
  const listed = z.object({ data: fuelPageSchema }).parse(await response.json()).data;
  expect(listed.summary).toMatchObject({ recordCount: 53, totalPiastres: 1234 });
  const record = listed.items[0]; expect(record.linkedExpenseId).toBeTruthy(); expect(record.version).toBe(1);
  expect(record).toMatchObject({ quantity: 2, pricePerUnitPiastres: 1000, totalPiastres: 1234 });
  const day = await request.get(`${base}/analytics/daily?date=2026-09-02`, { headers: user.headers });
  expect(z.object({ data: dailyAnalyticsSchema }).parse(await day.json()).data).toMatchObject({ fuelPiastres: 0, netProfitPiastres: 0 });
  await expect(page.getByRole('article').first()).toContainText('12.34');
  await page.getByRole('article').first().getByRole('button', { name: 'Edit', exact: true }).click();
  await dialog.locator('#fuel-notes').fill('Pending correction');
  const updated = await request.patch(`${base}/fuel/${record.id}`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() }, data: { expectedVersion: 1, notes: 'Newer private fuel note' } });
  expect(updated.status()).toBe(200);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('This fuel record changed');
  await expect(dialog.locator('#fuel-notes')).toHaveValue('Pending correction');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('article').first().getByRole('button', { name: 'Correction history', exact: true }).click();
  await expect(dialog.getByText('Version 2', { exact: false })).toBeVisible(); await expect(dialog.getByText('Newer private fuel note')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('Arabic charging entry recovers from load failure and supports delete and restore at 320px', async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const user = await account(request);
  let failList = true;
  await page.route('**/api/v1/fuel?**', async (route) => { if (failList) await route.abort('failed'); else await route.continue(); });
  await login(page, user, 'ar');
  await expect(page.getByText('تعذّر تحميل مشتريات الوقود.', { exact: false })).toBeVisible({ timeout: 15000 });
  failList = false; await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
  await page.getByRole('button', { name: 'إضافة عملية شراء', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#fuel-kind').selectOption('ELECTRIC'); await dialog.locator('#fuel-dateTime').fill('2026-09-01T12:00');
  await dialog.locator('#fuel-totalEgp').fill('100'); await dialog.locator('#fuel-quantity').fill('12.5');
  await expect(dialog.getByText('كيلوواط ساعة', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'حفظ', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('١٢٫٥٠٠');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('article').getByRole('button', { name: 'حذف', exact: true }).click();
  await dialog.getByRole('button', { name: 'حذف', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const day = await request.get(`${base}/analytics/daily?date=2026-09-01`, { headers: user.headers });
  expect(z.object({ data: dailyAnalyticsSchema }).parse(await day.json()).data.netProfitPiastres).toBe(0);
  await page.getByRole('button', { name: 'المحذوفة', exact: true }).click();
  await page.getByRole('article').getByRole('button', { name: 'استعادة', exact: true }).click();
  await dialog.getByRole('button', { name: 'استعادة', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'السجلات الحالية', exact: true }).click(); await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
test('fuel HTTP evidence, mileage correction and retry fingerprints retain their scope', async ({ request }) => {
  const user = await account(request), foreign = await account(request);
  const headers = { ...user.headers, 'Idempotency-Key': randomUUID() };
  const body = { vehicleId: user.vehicle.id, dateTime: '2026-09-01T08:00Z', totalPiastres: 99999, quantity: 99,
    fuelKind: 'PETROL_92', isFullTank: true, odometerMeters: 100000, fillCoverage: 'COMPLETE' };
  const first = await request.post(`${base}/fuel`, { headers, data: body }); expect(first.status()).toBe(201);
  const record = z.object({ data: driverFuelEntrySchema }).parse(await first.json()).data;
  expect((await request.post(`${base}/fuel`, { headers, data: body })).headers()['idempotency-replayed']).toBe('true');
  expect((await request.post(`${base}/fuel`, { headers, data: { ...body, totalPiastres: 1 } })).status()).toBe(409);
  for (const entry of [{ dateTime: '2026-09-03T08:00Z', odometerMeters: null, quantity: 20, isFullTank: false },
    { dateTime: '2026-09-05T08:00Z', odometerMeters: 700000, quantity: 30, isFullTank: true }]) {
    expect((await request.post(`${base}/fuel`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() }, data: { ...body, ...entry, totalPiastres: 10000 } })).status()).toBe(201);
  }
  const evidence = await request.get(`${base}/fuel/efficiency?vehicleId=${user.vehicle.id}&from=2026-09-01&to=2026-09-10`, { headers: user.headers });
  expect(z.object({ data: fuelEfficiencySchema }).parse(await evidence.json()).data).toMatchObject({ kmPerLiter: 12, purchasePiastres: 20000, quantityLiters: 50, cycleCount: 1 });
  expect((await request.get(`${base}/fuel/efficiency?vehicleId=${user.vehicle.id}&from=2026-09-01&to=2026-09-10`, { headers: foreign.headers })).status()).toBe(404);
  const deletion = { ...user.headers, 'Idempotency-Key': randomUUID() };
  expect((await request.delete(`${base}/fuel/${record.id}?expectedVersion=1`, { headers: deletion })).status()).toBe(200);
  expect((await request.delete(`${base}/fuel/${record.id}?expectedVersion=1`, { headers: deletion })).headers()['idempotency-replayed']).toBe('true');
  expect((await request.delete(`${base}/fuel/${record.id}?expectedVersion=2`, { headers: deletion })).status()).toBe(409);
});
